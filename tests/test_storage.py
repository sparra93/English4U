from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from backend.schemas.teacher_output import TeacherReply
from backend.schemas.teaching_config import TeachingConfigOverride, resolve_teaching_config
from backend.storage.db import init_db
from backend.storage.learner_repository import (
    DEFAULT_LEARNER_ID,
    get_or_create_default_learner,
    update_learner_preferences,
    update_learner_tutor,
)
from backend.storage.session_repository import (
    get_or_create_session,
    get_session,
    set_session_title,
    touch_session,
)
from backend.storage.turn_repository import get_recent_turns, insert_turn


class StorageTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._tmp_dir.name) / "test.db"

    def tearDown(self) -> None:
        self._tmp_dir.cleanup()


class InitDbTests(StorageTestCase):
    def test_init_db_is_idempotent(self) -> None:
        init_db(self.db_path)
        init_db(self.db_path)  # must not raise

        connection = sqlite3.connect(self.db_path)
        try:
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
        finally:
            connection.close()

        self.assertEqual(
            {"learners", "sessions", "turns", "vocabulary_items"} - tables, set()
        )

    def test_vocabulary_items_check_constraint_values(self) -> None:
        init_db(self.db_path)
        connection = sqlite3.connect(self.db_path)
        try:
            (sql,) = connection.execute(
                "SELECT sql FROM sqlite_master WHERE name='vocabulary_items'"
            ).fetchone()
        finally:
            connection.close()

        for state in (
            "new",
            "introduced",
            "recognized",
            "used_with_help",
            "used_independently",
            "review_due",
            "mastered",
        ):
            self.assertIn(state, sql)


class LearnerRepositoryTests(StorageTestCase):
    def setUp(self) -> None:
        super().setUp()
        init_db(self.db_path)

    def test_get_or_create_is_idempotent_and_fabricates_nothing(self) -> None:
        first = get_or_create_default_learner(self.db_path)
        second = get_or_create_default_learner(self.db_path)

        self.assertEqual(first.learner_id, DEFAULT_LEARNER_ID)
        self.assertEqual(first.created_at, second.created_at)
        self.assertIsNone(first.current_level)
        self.assertIsNone(first.correction_mode)
        self.assertIsNone(first.tutor_id)

    def test_update_preferences_persists_and_reloads(self) -> None:
        get_or_create_default_learner(self.db_path)
        updated = update_learner_preferences(
            self.db_path,
            TeachingConfigOverride(current_level="B2", correction_mode="immediate"),
        )

        self.assertEqual(updated.current_level, "B2")
        self.assertEqual(updated.correction_mode, "immediate")

        reloaded = get_or_create_default_learner(self.db_path)
        self.assertEqual(reloaded.current_level, "B2")

    def test_learner_override_feeds_precedence_resolution(self) -> None:
        update_learner_preferences(self.db_path, TeachingConfigOverride(current_level="C1"))
        learner = get_or_create_default_learner(self.db_path)

        resolved = resolve_teaching_config(learner_preference=learner.to_override())

        self.assertEqual(resolved.current_level, "C1")

    def test_update_tutor_persists_and_reloads(self) -> None:
        get_or_create_default_learner(self.db_path)
        updated = update_learner_tutor(self.db_path, "james")

        self.assertEqual(updated.tutor_id, "james")

        reloaded = get_or_create_default_learner(self.db_path)
        self.assertEqual(reloaded.tutor_id, "james")

    def test_update_tutor_does_not_touch_teaching_preferences(self) -> None:
        update_learner_preferences(self.db_path, TeachingConfigOverride(current_level="B2"))
        updated = update_learner_tutor(self.db_path, "sophia")

        self.assertEqual(updated.tutor_id, "sophia")
        self.assertEqual(updated.current_level, "B2")


class LearnerTutorIdMigrationTests(StorageTestCase):
    def test_init_db_adds_tutor_id_to_a_pre_existing_learners_table(self) -> None:
        connection = sqlite3.connect(self.db_path)
        try:
            connection.execute(
                """
                CREATE TABLE learners (
                    learner_id TEXT PRIMARY KEY,
                    display_name TEXT,
                    native_language TEXT NOT NULL DEFAULT 'es',
                    current_level TEXT,
                    target_level TEXT,
                    correction_mode TEXT,
                    teacher_strictness TEXT,
                    english_exposure INTEGER,
                    session_duration_minutes INTEGER,
                    vocabulary_per_session INTEGER,
                    skill_focus_json TEXT,
                    goals TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.commit()
        finally:
            connection.close()

        init_db(self.db_path)  # must not raise, and must add the missing column

        learner = get_or_create_default_learner(self.db_path)
        self.assertIsNone(learner.tutor_id)


class SessionTutorIdAndTitleMigrationTests(StorageTestCase):
    def test_init_db_adds_tutor_id_and_title_to_a_pre_existing_sessions_table(self) -> None:
        connection = sqlite3.connect(self.db_path)
        try:
            connection.execute(
                """
                CREATE TABLE sessions (
                    session_id TEXT PRIMARY KEY,
                    learner_id TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    last_active_at TEXT NOT NULL,
                    ended_at TEXT,
                    resolved_config_json TEXT,
                    session_override_json TEXT,
                    deleted_at TEXT
                )
                """
            )
            connection.commit()
        finally:
            connection.close()

        init_db(self.db_path)  # must not raise, and must add the missing columns

        learner = get_or_create_default_learner(self.db_path)
        session = get_or_create_session(self.db_path, "sess-1", learner.learner_id)
        self.assertIsNone(session.tutor_id)
        self.assertIsNone(session.title)


class SessionRepositoryTests(StorageTestCase):
    def setUp(self) -> None:
        super().setUp()
        init_db(self.db_path)
        self.learner = get_or_create_default_learner(self.db_path)

    def test_get_or_create_session_is_idempotent(self) -> None:
        first = get_or_create_session(self.db_path, "sess-1", self.learner.learner_id)
        second = get_or_create_session(self.db_path, "sess-1", self.learner.learner_id)

        self.assertEqual(first.started_at, second.started_at)

    def test_touch_session_stores_resolved_config_snapshot(self) -> None:
        get_or_create_session(self.db_path, "sess-1", self.learner.learner_id)
        resolved = resolve_teaching_config()

        touch_session(self.db_path, "sess-1", resolved, session_override_json=None)

        connection = sqlite3.connect(self.db_path)
        try:
            row = connection.execute(
                "SELECT resolved_config_json FROM sessions WHERE session_id = ?", ("sess-1",)
            ).fetchone()
        finally:
            connection.close()

        self.assertIn('"correction_mode":"after_response"', row[0].replace(" ", ""))

    def test_tutor_id_is_set_on_first_creation(self) -> None:
        session = get_or_create_session(
            self.db_path, "sess-1", self.learner.learner_id, tutor_id="james"
        )
        self.assertEqual(session.tutor_id, "james")

    def test_tutor_id_is_locked_after_first_creation(self) -> None:
        get_or_create_session(self.db_path, "sess-1", self.learner.learner_id, tutor_id="james")
        # A later call with a different tutor_id (e.g. the learner changed
        # their default pick for the *next* chat) must not change this
        # already-existing session's locked tutor.
        second = get_or_create_session(
            self.db_path, "sess-1", self.learner.learner_id, tutor_id="sophia"
        )
        self.assertEqual(second.tutor_id, "james")

    def test_get_session_returns_none_for_unknown_id(self) -> None:
        self.assertIsNone(get_session(self.db_path, "does-not-exist"))

    def test_get_session_reflects_stored_tutor_and_title(self) -> None:
        get_or_create_session(self.db_path, "sess-1", self.learner.learner_id, tutor_id="nicole")
        set_session_title(self.db_path, "sess-1", "Talking about a tough meeting")

        session = get_session(self.db_path, "sess-1")

        self.assertIsNotNone(session)
        self.assertEqual(session.tutor_id, "nicole")
        self.assertEqual(session.title, "Talking about a tough meeting")


class TurnRepositoryTests(StorageTestCase):
    def setUp(self) -> None:
        super().setUp()
        init_db(self.db_path)
        self.learner = get_or_create_default_learner(self.db_path)
        get_or_create_session(self.db_path, "sess-1", self.learner.learner_id)
        self.reply = TeacherReply(response="Nice!", has_corrections=False, natural_version="Nice!")

    def test_insert_turn_assigns_increasing_indices(self) -> None:
        first = insert_turn(self.db_path, "sess-1", "hello", self.reply, "Nice!")
        second = insert_turn(self.db_path, "sess-1", "hello again", self.reply, "Nice again!")

        self.assertEqual(first.turn_index, 1)
        self.assertEqual(second.turn_index, 2)

    def test_get_recent_turns_orders_oldest_first_and_respects_limit(self) -> None:
        for i in range(5):
            insert_turn(self.db_path, "sess-1", f"turn {i}", self.reply, "ok")

        recent = get_recent_turns(self.db_path, "sess-1", limit=2)

        self.assertEqual([t.transcription for t in recent], ["turn 3", "turn 4"])

    def test_get_recent_turns_roundtrips_structured_output(self) -> None:
        insert_turn(self.db_path, "sess-1", "hello", self.reply, "Nice!")

        (turn,) = get_recent_turns(self.db_path, "sess-1", limit=6)

        self.assertEqual(turn.teacher_output, self.reply)


if __name__ == "__main__":
    unittest.main()
