from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent
APP_DIR = PROJECT_DIR / "app"
GENERATED_DIR = APP_DIR / "generated"
PROMPTS_DIR = APP_DIR / "prompts"


def _get_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = _get_int("APP_PORT", 8090)
    remote_backend_base_url: str = os.getenv("REMOTE_BACKEND_BASE_URL", "").strip()
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3.5:9b-32k")
    whisper_model: str = os.getenv("WHISPER_MODEL", "distil-large-v3")
    whisper_language: str = os.getenv("WHISPER_LANGUAGE", "en")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cuda")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "float16")
    whisper_fallback_device: str = os.getenv("WHISPER_FALLBACK_DEVICE", "cpu")
    whisper_fallback_compute_type: str = os.getenv("WHISPER_FALLBACK_COMPUTE_TYPE", "int8")
    tts_voice: str = os.getenv("TTS_VOICE", "af_heart")
    tts_repo_id: str = os.getenv("TTS_REPO_ID", "hexgrad/Kokoro-82M")
    generated_retention_seconds: int = _get_int("GENERATED_RETENTION_SECONDS", 3600)


settings = Settings()
