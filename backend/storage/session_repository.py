from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from backend.schemas.teaching_config import TeachingConfig
from backend.storage.db import session_scope


@dataclass
class SessionRecord:
    session_id: str
    learner_id: str
    started_at: str
    last_active_at: str
    ended_at: str | None
    resolved_config_json: str | None
    session_override_json: str | None
    deleted_at: str | None
    tutor_id: str | None
    title: str | None
    level: str | None


@dataclass
class SessionSummary:
    session_id: str
    started_at: str
    last_active_at: str
    turn_count: int
    title: str | None


def _row_to_record(row: object) -> SessionRecord:
    return SessionRecord(
        session_id=row["session_id"],
        learner_id=row["learner_id"],
        started_at=row["started_at"],
        last_active_at=row["last_active_at"],
        ended_at=row["ended_at"],
        resolved_config_json=row["resolved_config_json"],
        session_override_json=row["session_override_json"],
        deleted_at=row["deleted_at"],
        tutor_id=row["tutor_id"],
        title=row["title"],
        level=row["level"],
    )


def get_session(db_path: str | Path, session_id: str) -> SessionRecord | None:
    """Read-only lookup — unlike `get_or_create_session`, never creates a row."""

    with session_scope(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()

    return _row_to_record(row) if row is not None else None


def get_or_create_session(
    db_path: str | Path,
    session_id: str,
    learner_id: str,
    tutor_id: str | None = None,
    level: str | None = None,
) -> SessionRecord:
    """Idempotent: returns the existing session, or opens a new one.

    A "session" spans one browser tab's lifetime (see `backend/static/app.js`),
    so this is also the window future recent-turn memory reads from.

    `tutor_id` and `level` are only written on first creation — once a
    session exists, its tutor and CEFR level are locked for the rest of the
    conversation, regardless of what the learner later picks as their
    default for the *next* chat. A session created before this locking
    existed simply keeps both NULL, which callers resolve via their own
    default fallback.
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
            INSERT OR IGNORE INTO sessions (session_id, learner_id, started_at, last_active_at, tutor_id, level)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (session_id, learner_id, now, now, tutor_id, level),
        )
        row = connection.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return _row_to_record(row)


def set_session_title(db_path: str | Path, session_id: str, title: str) -> None:
    """Persist a short, descriptive title for a session.

    Intended to be set once, from the session's first turn — not
    re-generated on every turn.
    """

    with session_scope(db_path) as connection:
        connection.execute(
            "UPDATE sessions SET title = ? WHERE session_id = ?",
            (title, session_id),
        )


def list_sessions_for_learner(
    db_path: str | Path, learner_id: str, limit: int = 100
) -> list[SessionSummary]:
    """Most recently active sessions first, each with its turn count.

    Sessions with zero turns (created but never completed a full round trip)
    are excluded — nothing to show or resume for those yet.
    """

    with session_scope(db_path) as connection:
        rows = connection.execute(
            """
            SELECT
                sessions.session_id AS session_id,
                sessions.started_at AS started_at,
                sessions.last_active_at AS last_active_at,
                sessions.title AS title,
                COUNT(turns.turn_id) AS turn_count
            FROM sessions
            JOIN turns ON turns.session_id = sessions.session_id
            WHERE sessions.learner_id = ? AND sessions.deleted_at IS NULL
            GROUP BY sessions.session_id
            ORDER BY sessions.last_active_at DESC
            LIMIT ?
            """,
            (learner_id, limit),
        ).fetchall()

    return [
        SessionSummary(
            session_id=row["session_id"],
            started_at=row["started_at"],
            last_active_at=row["last_active_at"],
            turn_count=row["turn_count"],
            title=row["title"],
        )
        for row in rows
    ]


def soft_delete_session(db_path: str | Path, session_id: str, learner_id: str) -> bool:
    """Hide a session from the sidebar without touching its turns.

    Turns stay in the database untouched, so `/api/history` (My Progress)
    keeps counting them — only `list_sessions_for_learner` excludes the
    session going forward. Returns False if the session doesn't exist,
    belongs to another learner, or was already deleted.
    """

    now = datetime.now(timezone.utc).isoformat()
    with session_scope(db_path) as connection:
        cursor = connection.execute(
            """
            UPDATE sessions
            SET deleted_at = ?
            WHERE session_id = ? AND learner_id = ? AND deleted_at IS NULL
            """,
            (now, session_id, learner_id),
        )
        return cursor.rowcount > 0


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
