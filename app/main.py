from __future__ import annotations

import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import GENERATED_DIR, settings
from app.services.tts_service import TTSService, TTSServiceError
from app.services.tutor_service import TutorService, TutorServiceError
from app.services.whisper_service import WhisperService, WhisperServiceError


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


def _proxy_json(method: str, path: str, **kwargs: object) -> JSONResponse:
    try:
        response = requests.request(method, _remote_url(path), timeout=300, **kwargs)
        response.raise_for_status()
    except requests.Timeout as exc:
        raise HTTPException(status_code=504, detail="The remote tutor server timed out.") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="The remote tutor server is unavailable.") from exc

    return JSONResponse(response.json(), status_code=response.status_code)


@asynccontextmanager
async def lifespan(app: FastAPI):
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    if _is_proxy_mode():
        app.state.remote_backend_base_url = settings.remote_backend_base_url.rstrip("/")
    else:
        _cleanup_generated_audio()
        app.state.whisper = WhisperService()
        app.state.tutor = TutorService()
        app.state.tts = TTSService()
    yield


app = FastAPI(title="English AI Tutor", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if not _is_proxy_mode():
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

    whisper_ok = hasattr(app.state, "whisper")
    tts_ok = hasattr(app.state, "tts")
    ollama_ok = False

    tutor_service = getattr(app.state, "tutor", None)
    if tutor_service is not None:
        ollama_ok = tutor_service.check_health()

    return JSONResponse(
        {
            "status": "ok" if whisper_ok and tts_ok and ollama_ok else "degraded",
            "whisper": whisper_ok,
            "ollama": ollama_ok,
            "tts": tts_ok,
        }
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
async def tutor(audio: UploadFile = File(...)) -> JSONResponse:
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
            return _proxy_json("POST", "/api/tutor", files=files)
        finally:
            await audio.close()

    upload_path: Path | None = None
    started_at = time.perf_counter()

    try:
        _cleanup_generated_audio()
        upload_path = _save_uploaded_audio(audio)

        if upload_path.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="The recording was empty.")

        whisper_result = app.state.whisper.transcribe_file(upload_path)
        tutor_result = app.state.tutor.ask(whisper_result.transcription)

        output_name = f"{uuid.uuid4().hex}.wav"
        output_path = GENERATED_DIR / output_name
        tts_result = app.state.tts.synthesize_to_file(
            tutor_result.voice_response,
            output_path,
        )

        total_seconds = time.perf_counter() - started_at

        return JSONResponse(
            {
                "transcription": whisper_result.transcription,
                "response": tutor_result.response,
                "corrections": tutor_result.corrections,
                "natural_version": tutor_result.natural_version,
                "vocabulary": tutor_result.vocabulary,
                "timings": {
                    "whisper": round(whisper_result.elapsed_seconds, 3),
                    "ollama": round(tutor_result.elapsed_seconds, 3),
                    "tts": round(tts_result.elapsed_seconds, 3),
                    "total": round(total_seconds, 3),
                },
                "audio_url": f"/generated/{output_name}",
            }
        )
    except HTTPException:
        raise
    except WhisperServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TutorServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except TTSServiceError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="The tutor request failed unexpectedly.") from exc
    finally:
        await audio.close()
        if upload_path is not None:
            upload_path.unlink(missing_ok=True)
