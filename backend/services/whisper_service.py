from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

from faster_whisper import WhisperModel

from app.config import settings


class WhisperServiceError(RuntimeError):
    """Raised when transcription fails."""


@dataclass
class WhisperResult:
    transcription: str
    elapsed_seconds: float
    language: str | None


class WhisperService:
    def __init__(self) -> None:
        self.model_name = settings.whisper_model
        self.device = settings.whisper_device
        self.compute_type = settings.whisper_compute_type
        self.fallback_device = settings.whisper_fallback_device
        self.fallback_compute_type = settings.whisper_fallback_compute_type
        self.model = self._load_model()

    def _load_model(self) -> WhisperModel:
        try:
            return WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type,
            )
        except Exception as exc:
            if self.fallback_device == self.device and self.fallback_compute_type == self.compute_type:
                raise WhisperServiceError("Whisper could not be loaded on the configured device.") from exc

        try:
            return WhisperModel(
                self.model_name,
                device=self.fallback_device,
                compute_type=self.fallback_compute_type,
            )
        except Exception as exc:
            raise WhisperServiceError("Whisper could not be loaded on either the primary or fallback device.") from exc

    def transcribe_file(self, audio_path: str | Path) -> WhisperResult:
        start = time.perf_counter()

        try:
            segments, info = self.model.transcribe(
                str(audio_path),
                language=settings.whisper_language,
                beam_size=5,
                vad_filter=True,
            )
        except Exception as exc:
            raise WhisperServiceError("Whisper failed to transcribe the audio.") from exc

        transcription = " ".join(segment.text.strip() for segment in segments).strip()
        elapsed_seconds = time.perf_counter() - start

        if not transcription:
            raise WhisperServiceError("Whisper returned an empty transcription.")

        return WhisperResult(
            transcription=transcription,
            elapsed_seconds=elapsed_seconds,
            language=getattr(info, "language", None),
        )
