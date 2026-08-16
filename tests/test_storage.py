from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from app.schemas.teacher_output import TeacherReply
from app.schemas.teaching_config import TeachingConfigOverride, resolve_teaching_config
from app.storage.db import init_db
from app.storage.learner_repository import DEFAULT_LEARNER_ID, get_or_create_default_learner, update_learner_preferences
from app.storage.session_repository import get_or_create_session, touch_session
from app.storage.turn_repository import get_recent_turns, insert_turn


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
