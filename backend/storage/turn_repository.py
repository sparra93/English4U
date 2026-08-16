from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.teacher_output import TeacherReply
from app.storage.db import session_scope


@dataclass
class TurnRecord:
    turn_id: int
    session_id: str
    turn_index: int
    created_at: str
    transcription: str
    teacher_output: TeacherReply
    voice_response: str
    whisper_elapsed_seconds: float | None
    ollama_elapsed_seconds: float | None
    tts_elapsed_seconds: float | None


def _row_to_record(row: object) -> TurnRecord:
    return TurnRecord(
        turn_id=row["turn_id"],
        session_id=row["session_id"],
        turn_index=row["turn_index"],
        created_at=row["created_at"],
        transcription=row["transcription"],
        teacher_output=TeacherReply.model_validate_json(row["teacher_output_json"]),
        voice_response=row["voice_response"],
        whisper_elapsed_seconds=row["whisper_elapsed_seconds"],
        ollama_elapsed_seconds=row["ollama_elapsed_seconds"],
        tts_elapsed_seconds=row["tts_elapsed_seconds"],
    )


def insert_turn(
    db_path: str | Path,
    session_id: str,
    transcription: str,
    teacher_output: TeacherReply,
    voice_response: str,
    whisper_elapsed_seconds: float | None = None,
    ollama_elapsed_seconds: float | None = None,
    tts_elapsed_seconds: float | None = None,
) -> TurnRecord:
    now = datetime.now(timezone.utc).isoformat()

    with session_scope(db_path) as connection:
        (next_index,) = connection.execute(
            "SELECT COALESCE(MAX(turn_index), 0) + 1 FROM turns WHERE session_id = ?",
            (session_id,),
        ).fetchone()

        cursor = connection.execute(
            """
            INSERT INTO turns (
                session_id, turn_index, created_at, transcription,
                teacher_output_json, voice_response,
                whisper_elapsed_seconds, ollama_elapsed_seconds, tts_elapsed_seconds
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                next_index,
                now,
                transcription,
                teacher_output.model_dump_json(),
                voice_response,
                whisper_elapsed_seconds,
                ollama_elapsed_seconds,
                tts_elapsed_seconds,
            ),
        )
        row = connection.execute(
            "SELECT * FROM turns WHERE turn_id = ?", (cursor.lastrowid,)
        ).fetchone()
        return _row_to_record(row)


def get_recent_turns(
    db_path: str | Path, session_id: str, limit: int
) -> list[TurnRecord]:
    """Return up to `limit` most recent turns, oldest first (ready for prompt assembly)."""

    with session_scope(db_path) as connection:
        rows = connection.execute(
            """
            SELECT * FROM turns
            WHERE session_id = ?
            ORDER BY turn_index DESC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()

    return [_row_to_record(row) for row in reversed(rows)]


def get_turns_for_session(db_path: str | Path, session_id: str) -> list[TurnRecord]:
    """Return every turn in one session, oldest first, for re-displaying it in full."""

    with session_scope(db_path) as connection:
        rows = connection.execute(
            """
            SELECT * FROM turns
            WHERE session_id = ?
            ORDER BY turn_index ASC
            """,
            (session_id,),
        ).fetchall()

    return [_row_to_record(row) for row in rows]


def get_turns_for_learner(
    db_path: str | Path, learner_id: str, limit: int
) -> list[TurnRecord]:
    """Return up to `limit` most recent turns across all of a learner's sessions.

    Most recent first, for the learning-history page — unlike
    `get_recent_turns`, this crosses session boundaries via a join since
    turns are only linked to a session, not directly to a learner.
    """

    with session_scope(db_path) as connection:
        rows = connection.execute(
            """
            SELECT turns.* FROM turns
            JOIN sessions ON sessions.session_id = turns.session_id
            WHERE sessions.learner_id = ?
            ORDER BY turns.created_at DESC
            LIMIT ?
            """,
            (learner_id, limit),
        ).fetchall()

    return [_row_to_record(row) for row in rows]
