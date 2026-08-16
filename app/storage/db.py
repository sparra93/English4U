from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS learners (
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
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL REFERENCES learners(learner_id),
    started_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    ended_at TEXT,
    resolved_config_json TEXT,
    session_override_json TEXT,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS turns (
    turn_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id),
    turn_index INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    transcription TEXT NOT NULL,
    teacher_output_json TEXT NOT NULL,
    voice_response TEXT NOT NULL,
    whisper_elapsed_seconds REAL,
    ollama_elapsed_seconds REAL,
    tts_elapsed_seconds REAL,
    UNIQUE(session_id, turn_index)
);

CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, turn_index);

CREATE TABLE IF NOT EXISTS vocabulary_items (
    vocabulary_id INTEGER PRIMARY KEY AUTOINCREMENT,
    learner_id TEXT NOT NULL REFERENCES learners(learner_id),
    term TEXT NOT NULL,
    evidence_state TEXT NOT NULL DEFAULT 'new'
        CHECK (evidence_state IN (
            'new', 'introduced', 'recognized', 'used_with_help',
            'used_independently', 'review_due', 'mastered'
        )),
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    times_seen INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    UNIQUE(learner_id, term)
);
"""


def _connect(db_path: str | Path) -> sqlite3.Connection:
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def _migrate(connection: sqlite3.Connection) -> None:
    """Lightweight, additive migrations for columns added after initial release.

    `CREATE TABLE IF NOT EXISTS` in `SCHEMA` never touches an existing table,
    so a column added later needs an explicit `ALTER TABLE` here to reach
    databases created before that column existed.
    """

    columns = {row["name"] for row in connection.execute("PRAGMA table_info(sessions)")}
    if "deleted_at" not in columns:
        connection.execute("ALTER TABLE sessions ADD COLUMN deleted_at TEXT")


def init_db(db_path: str | Path) -> None:
    """Create the database file and schema if they do not already exist.

    Idempotent: safe to call on every server-mode startup.
    """

    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    connection = _connect(path)
    try:
        connection.executescript(SCHEMA)
        _migrate(connection)
        connection.commit()
    finally:
        connection.close()


@contextmanager
def session_scope(db_path: str | Path) -> Iterator[sqlite3.Connection]:
    """One short-lived connection per operation, committed or rolled back."""

    connection = _connect(db_path)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
