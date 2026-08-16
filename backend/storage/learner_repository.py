from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.teaching_config import TeachingConfigOverride
from app.storage.db import session_scope

DEFAULT_LEARNER_ID = "default"


@dataclass
class LearnerRecord:
    learner_id: str
    display_name: str | None
    native_language: str
    current_level: str | None
    target_level: str | None
    correction_mode: str | None
    teacher_strictness: str | None
    english_exposure: int | None
    session_duration_minutes: int | None
    vocabulary_per_session: int | None
    skill_focus: dict[str, float] | None
    goals: str | None
    created_at: str
    updated_at: str

    def to_override(self) -> TeachingConfigOverride:
        """Project the persisted preferences into a config-precedence override.

        Only non-null columns are included, so unset preferences fall through
        to lower-precedence layers instead of overriding them with None.
        """

        fields = {
            "current_level": self.current_level,
            "target_level": self.target_level,
            "correction_mode": self.correction_mode,
            "teacher_strictness": self.teacher_strictness,
            "english_exposure": self.english_exposure,
            "session_duration_minutes": self.session_duration_minutes,
            "vocabulary_per_session": self.vocabulary_per_session,
            "skill_focus": self.skill_focus,
        }
        present = {key: value for key, value in fields.items() if value is not None}
        return TeachingConfigOverride(**present)


def _row_to_record(row: object) -> LearnerRecord:
    skill_focus_json = row["skill_focus_json"]
    return LearnerRecord(
        learner_id=row["learner_id"],
        display_name=row["display_name"],
        native_language=row["native_language"],
        current_level=row["current_level"],
        target_level=row["target_level"],
        correction_mode=row["correction_mode"],
        teacher_strictness=row["teacher_strictness"],
        english_exposure=row["english_exposure"],
        session_duration_minutes=row["session_duration_minutes"],
        vocabulary_per_session=row["vocabulary_per_session"],
        skill_focus=json.loads(skill_focus_json) if skill_focus_json else None,
        goals=row["goals"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def get_or_create_default_learner(
    db_path: str | Path, learner_id: str = DEFAULT_LEARNER_ID
) -> LearnerRecord:
    """Idempotent: returns the existing learner row, or creates a blank one.

    A freshly created learner has every preference column NULL — no level or
    correction preference is fabricated on first run.
    """

    with session_scope(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM learners WHERE learner_id = ?", (learner_id,)
        ).fetchone()

        if row is not None:
            return _row_to_record(row)

        now = datetime.now(timezone.utc).isoformat()
        connection.execute(
            """
            INSERT OR IGNORE INTO learners (learner_id, native_language, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (learner_id, "es", now, now),
        )
        row = connection.execute(
            "SELECT * FROM learners WHERE learner_id = ?", (learner_id,)
        ).fetchone()
        return _row_to_record(row)


def update_learner_preferences(
    db_path: str | Path,
    override: TeachingConfigOverride,
    learner_id: str = DEFAULT_LEARNER_ID,
) -> LearnerRecord:
    """Persist any non-None fields from `override` onto the learner row.

    Ensures the learner row exists first, so this is safe to call without a
    prior `get_or_create_default_learner` — an UPDATE against a row that
    doesn't exist yet would otherwise silently affect zero rows.
    """

    get_or_create_default_learner(db_path, learner_id)

    updates = override.model_dump(exclude_none=True)
    if "skill_focus" in updates:
        updates["skill_focus_json"] = json.dumps(updates.pop("skill_focus"))

    if not updates:
        return get_or_create_default_learner(db_path, learner_id)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    with session_scope(db_path) as connection:
        set_clause = ", ".join(f"{column} = ?" for column in updates)
        connection.execute(
            f"UPDATE learners SET {set_clause} WHERE learner_id = ?",
            (*updates.values(), learner_id),
        )

    return get_or_create_default_learner(db_path, learner_id)
