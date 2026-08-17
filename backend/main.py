from __future__ import annotations

import json
import logging
import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import GENERATED_DIR, settings
from backend.tutors import get_tutor, list_tutors

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

MAX_SESSION_ID_LENGTH = 128
MAX_HISTORY_LIMIT = 500
DEFAULT_HISTORY_LIMIT = 200
CEFR_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
DEFAULT_LEVEL = "B1"


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

AUDIO_SUFFIXES = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/webm": ".webm",
    "video/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
}

def _cleanup_generated_audio() -> None:
    retention_seconds = settings.generated_retention_seconds
    if retention_seconds <= 0:
        return

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=retention_seconds)

    for path in GENERATED_DIR.iterdir():
        if not path.is_file() or path.name == ".gitkeep":
            continue

        modified_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        if modified_at < cutoff:
            path.unlink(missing_ok=True)


def _is_proxy_mode() -> bool:
    return bool(settings.remote_backend_base_url)


def _remote_url(path: str) -> str:
    base_url = settings.remote_backend_base_url.rstrip("/")
    return f"{base_url}{path}"


def _load_local_service_classes() -> dict[str, type]:
    from backend.services.tts_service import TTSService, TTSServiceError
    from backend.services.tutor_service import TutorService, TutorServiceError
    from backend.services.whisper_service import WhisperService, WhisperServiceError

    return {
        "tts_service": TTSService,
        "tts_error": TTSServiceError,
        "tutor_service": TutorService,
        "tutor_error": TutorServiceError,
        "whisper_service": WhisperService,
        "whisper_error": WhisperServiceError,
    }


def _load_local_data_layer() -> dict[str, object]:
    """Everything that touches Pydantic schemas or SQLite storage.

    Kept behind a lazy import, same pattern as `_load_local_service_classes`,
    so proxy mode never imports Pydantic or the storage layer at all.
    """

    from pydantic import ValidationError

    from backend.schemas.teaching_config import TeachingConfigOverride, resolve_teaching_config
    from backend.services.tutor_service import (
        format_corrections_for_display,
        format_key_phrases_for_display,
        format_vocabulary_for_display,
    )
    from backend.storage.db import init_db, session_scope
    from backend.storage.learner_repository import (
        get_or_create_default_learner,
        update_learner_preferences,
        update_learner_tutor,
    )
    from backend.storage.session_repository import (
        get_or_create_session,
        get_session,
        list_sessions_for_learner,
        set_session_title,
        soft_delete_session,
        touch_session,
    )
    from backend.storage.turn_repository import (
        get_recent_turns,
        get_turns_for_learner,
        get_turns_for_session,
        insert_turn,
    )

    return {
        "validation_error": ValidationError,
        "teaching_config_override": TeachingConfigOverride,
        "resolve_teaching_config": resolve_teaching_config,
        "init_db": init_db,
        "session_scope": session_scope,
        "get_or_create_default_learner": get_or_create_default_learner,
        "update_learner_tutor": update_learner_tutor,
        "update_learner_preferences": update_learner_preferences,
        "get_or_create_session": get_or_create_session,
        "get_session": get_session,
        "set_session_title": set_session_title,
        "list_sessions_for_learner": list_sessions_for_learner,
        "soft_delete_session": soft_delete_session,
        "touch_session": touch_session,
        "get_recent_turns": get_recent_turns,
        "get_turns_for_learner": get_turns_for_learner,
        "get_turns_for_session": get_turns_for_session,
        "insert_turn": insert_turn,
        "format_corrections_for_display": format_corrections_for_display,
        "format_vocabulary_for_display": format_vocabulary_for_display,
        "format_key_phrases_for_display": format_key_phrases_for_display,
    }


def _init_optional_service(
    app: FastAPI,
    state_name: str,
    error_state_name: str,
    service_factory: type,
) -> None:
    """Initialize a startup dependency without crashing the whole server."""

    try:
        setattr(app.state, state_name, service_factory())
        setattr(app.state, error_state_name, None)
    except Exception as exc:
        logger.exception("Failed to initialize %s at startup", state_name)
        setattr(app.state, state_name, None)
        setattr(app.state, error_state_name, str(exc))


def _proxy_json(method: str, path: str, **kwargs: object) -> JSONResponse:
    """Forward a request to the remote backend and relay its response as-is.

    Only a genuine connection failure (DNS, refused, TLS, timeout) becomes a
    502/504 here — a response that reached us with an error status (400 for
    an empty transcription, 404 for a missing session, ...) is real signal
    from the remote server and must reach the caller unchanged, not be
    swallowed into a generic "server unavailable".
    """

    try:
        response = requests.request(method, _remote_url(path), timeout=300, **kwargs)
    except requests.Timeout as exc:
        raise HTTPException(status_code=504, detail="The remote tutor server timed out.") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="The remote tutor server is unavailable.") from exc

    return JSONResponse(response.json(), status_code=response.status_code)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if _is_proxy_mode():
        app.state.remote_backend_base_url = settings.remote_backend_base_url.rstrip("/")
    else:
        service_classes = _load_local_service_classes()
        data_layer = _load_local_data_layer()
        _cleanup_generated_audio()
        data_layer["init_db"](settings.db_path)
        _init_optional_service(
            app,
            "whisper",
            "whisper_startup_error",
            service_classes["whisper_service"],
        )
        _init_optional_service(
            app,
            "tutor",
            "tutor_startup_error",
            service_classes["tutor_service"],
        )
        _init_optional_service(
            app,
            "tts",
            "tts_startup_error",
            service_classes["tts_service"],
        )
        app.state.whisper_error_type = service_classes["whisper_error"]
        app.state.tutor_error_type = service_classes["tutor_error"]
        app.state.tts_error_type = service_classes["tts_error"]
        app.state.data_layer = data_layer
    yield


app = FastAPI(title="English AI Tutor", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if not _is_proxy_mode():
    # Created here, not in lifespan: StaticFiles checks the directory at
    # mount time (import time), before the lifespan startup event ever runs.
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")


def _get_upload_suffix(upload: UploadFile) -> str:
    if upload.content_type in AUDIO_SUFFIXES:
        return AUDIO_SUFFIXES[upload.content_type]

    filename = upload.filename or ""
    suffix = Path(filename).suffix.lower()
    return suffix or ".bin"


def _save_uploaded_audio(upload: UploadFile) -> Path:
    suffix = _get_upload_suffix(upload)

    with tempfile.NamedTemporaryFile(
        delete=False,
        dir=GENERATED_DIR,
        prefix="upload-",
        suffix=suffix,
    ) as temp_file:
        shutil.copyfileobj(upload.file, temp_file)
        return Path(temp_file.name)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
async def health() -> JSONResponse:
    if _is_proxy_mode():
        return _proxy_json("GET", "/api/health")

    whisper_ok = getattr(app.state, "whisper", None) is not None
    tts_ok = getattr(app.state, "tts", None) is not None
    ollama_ok = False

    tutor_service = getattr(app.state, "tutor", None)
    if tutor_service is not None:
        ollama_ok = tutor_service.check_health()

    database_ok = False
    data_layer = getattr(app.state, "data_layer", None)
    if data_layer is not None:
        try:
            with data_layer["session_scope"](settings.db_path) as connection:
                connection.execute("SELECT 1")
            database_ok = True
        except Exception:
            database_ok = False

    return JSONResponse(
        {
            "status": "ok" if whisper_ok and tts_ok and ollama_ok and database_ok else "degraded",
            "whisper": whisper_ok,
            "ollama": ollama_ok,
            "tts": tts_ok,
            "database": database_ok,
            "startup_errors": {
                "whisper": getattr(app.state, "whisper_startup_error", None),
                "tutor": getattr(app.state, "tutor_startup_error", None),
                "tts": getattr(app.state, "tts_startup_error", None),
            },
        }
    )


@app.get("/progress")
async def progress_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "progress.html")


@app.get("/api/history")
async def history(limit: int = DEFAULT_HISTORY_LIMIT) -> JSONResponse:
    limit = max(1, min(limit, MAX_HISTORY_LIMIT))

    if _is_proxy_mode():
        return _proxy_json("GET", "/api/history", params={"limit": limit})

    data_layer = app.state.data_layer
    learner = data_layer["get_or_create_default_learner"](settings.db_path)
    turns = data_layer["get_turns_for_learner"](settings.db_path, learner.learner_id, limit)

    return JSONResponse(
        {
            "learner_id": learner.learner_id,
            "turns": [
                {
                    "turn_id": turn.turn_id,
                    "session_id": turn.session_id,
                    "created_at": turn.created_at,
                    "transcription": turn.transcription,
                    "response": turn.teacher_output.response,
                    "corrections": data_layer["format_corrections_for_display"](
                        turn.teacher_output.corrections
                    ),
                    "natural_version": turn.teacher_output.natural_version,
                    "vocabulary": data_layer["format_vocabulary_for_display"](
                        turn.teacher_output.vocabulary
                    ),
                    "key_phrases": data_layer["format_key_phrases_for_display"](
                        turn.teacher_output.key_phrases
                    ),
                }
                for turn in turns
            ],
        }
    )


@app.get("/api/sessions")
async def sessions_list() -> JSONResponse:
    if _is_proxy_mode():
        return _proxy_json("GET", "/api/sessions")

    data_layer = app.state.data_layer
    learner = data_layer["get_or_create_default_learner"](settings.db_path)
    summaries = data_layer["list_sessions_for_learner"](settings.db_path, learner.learner_id)

    return JSONResponse(
        {
            "sessions": [
                {
                    "session_id": summary.session_id,
                    "started_at": summary.started_at,
                    "last_active_at": summary.last_active_at,
                    "turn_count": summary.turn_count,
                    "title": summary.title,
                }
                for summary in summaries
            ],
        }
    )


@app.get("/api/sessions/{session_id}/turns")
async def session_turns(session_id: str) -> JSONResponse:
    if len(session_id) > MAX_SESSION_ID_LENGTH:
        raise HTTPException(status_code=400, detail="session_id is too long.")

    if _is_proxy_mode():
        return _proxy_json("GET", f"/api/sessions/{session_id}/turns")

    data_layer = app.state.data_layer
    turns = data_layer["get_turns_for_session"](settings.db_path, session_id)
    session = data_layer["get_session"](settings.db_path, session_id)
    tutor_id = get_tutor(session.tutor_id if session else None).id
    level = (session.level if session else None) or DEFAULT_LEVEL

    return JSONResponse(
        {
            "session_id": session_id,
            "tutor_id": tutor_id,
            "level": level,
            "turns": [
                {
                    "turn_id": turn.turn_id,
                    "created_at": turn.created_at,
                    "transcription": turn.transcription,
                    "response": turn.teacher_output.response,
                    "corrections": data_layer["format_corrections_for_display"](
                        turn.teacher_output.corrections
                    ),
                    "natural_version": turn.teacher_output.natural_version,
                    "vocabulary": data_layer["format_vocabulary_for_display"](
                        turn.teacher_output.vocabulary
                    ),
                    "key_phrases": data_layer["format_key_phrases_for_display"](
                        turn.teacher_output.key_phrases
                    ),
                }
                for turn in turns
            ],
        }
    )


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> JSONResponse:
    if len(session_id) > MAX_SESSION_ID_LENGTH:
        raise HTTPException(status_code=400, detail="session_id is too long.")

    if _is_proxy_mode():
        return _proxy_json("DELETE", f"/api/sessions/{session_id}")

    data_layer = app.state.data_layer
    learner = data_layer["get_or_create_default_learner"](settings.db_path)
    deleted = data_layer["soft_delete_session"](settings.db_path, session_id, learner.learner_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")

    return JSONResponse({"session_id": session_id, "deleted": True})


@app.get("/api/tutors")
async def tutors() -> JSONResponse:
    # The catalog is static code, identical on every machine that runs this
    # repo, so a proxy client can answer this locally without a round trip.
    return JSONResponse(
        {
            "tutors": [
                {
                    "id": tutor.id,
                    "name": tutor.name,
                    "accent": tutor.accent,
                    "specialty": tutor.specialty,
                    "tagline": tutor.tagline,
                }
                for tutor in list_tutors()
            ]
        }
    )


@app.get("/api/learner")
async def learner_profile() -> JSONResponse:
    if _is_proxy_mode():
        return _proxy_json("GET", "/api/learner")

    data_layer = app.state.data_layer
    learner = data_layer["get_or_create_default_learner"](settings.db_path)
    return JSONResponse(
        {
            "learner_id": learner.learner_id,
            "tutor_id": learner.tutor_id,
            "level": learner.current_level,
        }
    )


@app.put("/api/learner/level")
async def set_learner_level(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Request body must be JSON.") from exc

    level = payload.get("level") if isinstance(payload, dict) else None
    if not isinstance(level, str) or level not in CEFR_LEVELS:
        raise HTTPException(status_code=400, detail=f"Unknown level: {level!r}.")

    if _is_proxy_mode():
        return _proxy_json("PUT", "/api/learner/level", json={"level": level})

    data_layer = app.state.data_layer
    override = data_layer["teaching_config_override"](current_level=level, target_level=level)
    learner = data_layer["update_learner_preferences"](settings.db_path, override)
    return JSONResponse(
        {"learner_id": learner.learner_id, "level": learner.current_level}
    )


@app.put("/api/learner/tutor")
async def set_learner_tutor(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Request body must be JSON.") from exc

    tutor_id = payload.get("tutor_id") if isinstance(payload, dict) else None
    if not isinstance(tutor_id, str) or not tutor_id:
        raise HTTPException(status_code=400, detail="tutor_id is required.")

    if tutor_id not in {tutor.id for tutor in list_tutors()}:
        raise HTTPException(status_code=400, detail=f"Unknown tutor_id: {tutor_id!r}.")

    if _is_proxy_mode():
        return _proxy_json("PUT", "/api/learner/tutor", json={"tutor_id": tutor_id})

    data_layer = app.state.data_layer
    learner = data_layer["update_learner_tutor"](settings.db_path, tutor_id)
    return JSONResponse(
        {"learner_id": learner.learner_id, "tutor_id": learner.tutor_id}
    )


@app.get("/generated/{file_path:path}")
async def generated_proxy(file_path: str) -> Response:
    if not _is_proxy_mode():
        raise HTTPException(status_code=404, detail="Generated audio route is not proxied in local mode.")

    try:
        response = requests.get(_remote_url(f"/generated/{file_path}"), timeout=300)
        response.raise_for_status()
    except requests.Timeout as exc:
        raise HTTPException(status_code=504, detail="The remote audio server timed out.") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="The remote audio server is unavailable.") from exc

    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "audio/wav"),
    )


@app.post("/api/tutor")
async def tutor(
    audio: UploadFile = File(...),
    session_id: str | None = Form(None),
    teaching_config_override: str | None = Form(None),
) -> JSONResponse:
    if not audio.filename and not audio.content_type:
        raise HTTPException(status_code=400, detail="No audio file was received.")

    if _is_proxy_mode():
        try:
            audio_bytes = await audio.read()
            if not audio_bytes:
                raise HTTPException(status_code=400, detail="The recording was empty.")

            filename = audio.filename or f"recording{_get_upload_suffix(audio)}"
            files = {
                "audio": (
                    filename,
                    audio_bytes,
                    audio.content_type or "application/octet-stream",
                )
            }
            data = {}
            if session_id:
                data["session_id"] = session_id
            if teaching_config_override:
                data["teaching_config_override"] = teaching_config_override

            return _proxy_json("POST", "/api/tutor", files=files, data=data)
        finally:
            await audio.close()

    upload_path: Path | None = None
    started_at = time.perf_counter()
    session_id_for_log = session_id or "new-session"
    whisper_error_type = getattr(app.state, "whisper_error_type", ())
    tutor_error_type = getattr(app.state, "tutor_error_type", ())
    tts_error_type = getattr(app.state, "tts_error_type", ())
    data_layer = app.state.data_layer
    whisper_service = getattr(app.state, "whisper", None)
    tutor_service = getattr(app.state, "tutor", None)
    tts_service = getattr(app.state, "tts", None)

    try:
        if whisper_service is None:
            raise HTTPException(
                status_code=503,
                detail=getattr(app.state, "whisper_startup_error", None)
                or "Whisper is unavailable.",
            )
        if tutor_service is None:
            raise HTTPException(
                status_code=503,
                detail=getattr(app.state, "tutor_startup_error", None)
                or "Tutor service is unavailable.",
            )
        if tts_service is None:
            raise HTTPException(
                status_code=503,
                detail=getattr(app.state, "tts_startup_error", None)
                or "TTS service is unavailable.",
            )

        if session_id and len(session_id) > MAX_SESSION_ID_LENGTH:
            raise HTTPException(status_code=400, detail="session_id is too long.")
        resolved_session_id = session_id or uuid.uuid4().hex
        session_id_for_log = resolved_session_id

        session_override = None
        if teaching_config_override:
            try:
                override_payload = json.loads(teaching_config_override)
                session_override = data_layer["teaching_config_override"](**override_payload)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=400, detail="teaching_config_override is not valid JSON."
                ) from exc
            except data_layer["validation_error"] as exc:
                raise HTTPException(
                    status_code=400, detail=f"teaching_config_override is invalid: {exc}"
                ) from exc

        _cleanup_generated_audio()
        upload_path = _save_uploaded_audio(audio)

        if upload_path.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="The recording was empty.")

        learner = data_layer["get_or_create_default_learner"](settings.db_path)
        preferred_tutor = get_tutor(learner.tutor_id)
        preferred_level = learner.current_level or DEFAULT_LEVEL
        session = data_layer["get_or_create_session"](
            settings.db_path,
            resolved_session_id,
            learner.learner_id,
            tutor_id=preferred_tutor.id,
            level=preferred_level,
        )
        # The tutor and level are locked in on a session's first turn (see
        # `get_or_create_session`) and never change for the rest of that
        # conversation, even if the learner later picks different defaults
        # for their *next* chat.
        tutor = get_tutor(session.tutor_id)
        session_level = session.level or DEFAULT_LEVEL
        if session_override is None:
            session_override = data_layer["teaching_config_override"](
                current_level=session_level, target_level=session_level
            )
        resolved_config = data_layer["resolve_teaching_config"](
            session_override=session_override,
            learner_preference=learner.to_override(),
        )
        recent_turns = data_layer["get_recent_turns"](
            settings.db_path, resolved_session_id, settings.recent_turns_limit
        )

        whisper_result = whisper_service.transcribe_file(upload_path)
        tutor_result = tutor_service.ask(
            whisper_result.transcription,
            resolved_config,
            learner,
            recent_turns,
            tutor_name=tutor.name,
            tutor_behavior_prompt=tutor.behavior_prompt,
        )

        output_name = f"{uuid.uuid4().hex}.wav"
        output_path = GENERATED_DIR / output_name
        tts_result = tts_service.synthesize_to_file(
            tutor_result.voice_response,
            output_path,
            voice=tutor.voice_id,
            lang_code=tutor.lang_code,
        )

        data_layer["insert_turn"](
            settings.db_path,
            resolved_session_id,
            whisper_result.transcription,
            tutor_result.structured,
            tutor_result.voice_response,
            whisper_result.elapsed_seconds,
            tutor_result.elapsed_seconds,
            tts_result.elapsed_seconds,
        )
        data_layer["touch_session"](
            settings.db_path,
            resolved_session_id,
            resolved_config,
            teaching_config_override,
        )

        if not recent_turns:
            # This was the session's first turn — generate a one-time
            # descriptive title for the sidebar. Best-effort: a failure here
            # must never break the actual lesson turn the student is
            # waiting on.
            try:
                title = tutor_service.generate_session_title(
                    whisper_result.transcription, tutor_result.response
                )
                if title:
                    data_layer["set_session_title"](settings.db_path, resolved_session_id, title)
            except Exception:
                logger.warning(
                    "Session title generation failed for %s", resolved_session_id, exc_info=True
                )

        total_seconds = time.perf_counter() - started_at

        return JSONResponse(
            {
                "transcription": whisper_result.transcription,
                "response": tutor_result.response,
                "tutor_id": tutor.id,
                "level": session_level,
                "corrections": tutor_result.corrections,
                "natural_version": tutor_result.natural_version,
                "vocabulary": tutor_result.vocabulary,
                "key_phrases": tutor_result.key_phrases,
                "session_id": resolved_session_id,
                "timings": {
                    "whisper": round(whisper_result.elapsed_seconds, 3),
                    "ollama": round(tutor_result.elapsed_seconds, 3),
                    "tts": round(tts_result.elapsed_seconds, 3),
                    "total": round(total_seconds, 3),
                },
                "audio_url": f"/generated/{output_name}",
            }
        )
    except HTTPException as exc:
        logger.warning(
            "session=%s /api/tutor rejected with %s: %s", session_id_for_log, exc.status_code, exc.detail
        )
        raise
    except Exception as exc:
        if whisper_error_type and isinstance(exc, whisper_error_type):
            logger.warning("session=%s Whisper failed: %s", session_id_for_log, exc)
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if tutor_error_type and isinstance(exc, tutor_error_type):
            logger.warning("session=%s Tutor service failed: %s", session_id_for_log, exc)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        if tts_error_type and isinstance(exc, tts_error_type):
            logger.warning("session=%s TTS service failed: %s", session_id_for_log, exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        logger.exception("session=%s Unexpected error handling /api/tutor", session_id_for_log)
        raise HTTPException(status_code=500, detail="The tutor request failed unexpectedly.") from exc
    finally:
        await audio.close()
        if upload_path is not None:
            upload_path.unlink(missing_ok=True)
