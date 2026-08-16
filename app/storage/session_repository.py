from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.teaching_config import TeachingConfig
from app.storage.db import session_scope


@dataclass
class SessionRecord:
    session_id: str
    learner_id: str
    started_at: str
    last_active_at: str
    ended_at: str | None
    resolved_config_json: str | None
    session_override_json: str | None


def _row_to_record(row: object) -> SessionRecord:
    return SessionRecord(
        session_id=row["session_id"],
        learner_id=row["learner_id"],
        started_at=row["started_at"],
        last_active_at=row["last_active_at"],
        ended_at=row["ended_at"],
        resolved_config_json=row["resolved_config_json"],
        session_override_json=row["session_override_json"],
    )


def get_or_create_session(
    db_path: str | Path, session_id: str, learner_id: str
) -> SessionRecord:
    """Idempotent: returns the existing session, or opens a new one.

    A "session" spans one browser tab's lifetime (see `app/static/app.js`),
    so this is also the window future recent-turn memory reads from.
    """

    with session_scope(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()

        if row is not None:
            return _row_to_record(row)

        now = datetime.now(timezone.utc).isoformat()
        connection.execute(
            """
            INSERT OR IGNORE INTO sessions (session_id, learner_id, started_at, last_active_at)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, learner_id, now, now),
        )
        row = connection.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return _row_to_record(row)


def touch_session(
    db_path: str | Path,
    session_id: str,
    resolved_config: TeachingConfig,
    session_override_json: str | None,
) -> None:
    """Record the freshly-resolved config for this turn as an audit snapshot."""

    now = datetime.now(timezone.utc).isoformat()
    with session_scope(db_path) as connection:
        connection.execute(
            """
            UPDATE sessions
            SET last_active_at = ?, resolved_config_json = ?, session_override_json = ?
            WHERE session_id = ?
            """,
            (
                now,
                resolved_config.model_dump_json(),
                session_override_json,
                session_id,
            ),
        )
