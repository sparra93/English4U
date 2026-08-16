from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

from backend.config import settings

SAMPLE_RATE = 24000

# Lang codes for the accents in backend/tutors.py — warmed up eagerly at
# startup so switching tutors mid-session never pays pipeline-construction
# latency on the first request for an accent.
KNOWN_LANG_CODES = ("a", "b")


class TTSServiceError(RuntimeError):
    """Raised when speech synthesis fails."""


@dataclass
class TTSResult:
    output_path: str
    elapsed_seconds: float


class TTSService:
    def __init__(self) -> None:
        self.default_voice_name = settings.tts_voice
        self.default_lang_code = "a"
        self._pipelines: dict[str, KPipeline] = {}

        for lang_code in KNOWN_LANG_CODES:
            self._get_pipeline(lang_code)

    def _get_pipeline(self, lang_code: str) -> KPipeline:
        pipeline = self._pipelines.get(lang_code)
        if pipeline is None:
            pipeline = KPipeline(lang_code=lang_code, repo_id=settings.tts_repo_id)
            self._pipelines[lang_code] = pipeline
        return pipeline

    def synthesize_to_file(
        self,
        text: str,
        output_path: str | Path,
        voice: str | None = None,
        lang_code: str | None = None,
    ) -> TTSResult:
        if not text.strip():
            raise TTSServiceError("Cannot synthesize empty tutor speech.")

        voice_name = voice or self.default_voice_name
        pipeline = self._get_pipeline(lang_code or self.default_lang_code)

        start = time.perf_counter()

        try:
            generator = pipeline(
                text,
                voice=voice_name,
                speed=1.0,
            )

            audio_chunks = []

            for _, _, audio in generator:
                if audio is not None and len(audio) > 0:
                    audio_chunks.append(audio)
        except Exception as exc:
            raise TTSServiceError("Kokoro failed to generate audio.") from exc

        if not audio_chunks:
            raise TTSServiceError("Kokoro did not generate audio.")

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        audio = np.concatenate(audio_chunks)
        sf.write(str(output), audio, SAMPLE_RATE)

        return TTSResult(
            output_path=str(output),
            elapsed_seconds=time.perf_counter() - start,
        )
