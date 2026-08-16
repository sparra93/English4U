from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

from app.config import settings

SAMPLE_RATE = 24000


class TTSServiceError(RuntimeError):
    """Raised when speech synthesis fails."""


@dataclass
class TTSResult:
    output_path: str
    elapsed_seconds: float


class TTSService:
    def __init__(self) -> None:
        self.pipeline = KPipeline(
            lang_code="a",
            repo_id=settings.tts_repo_id,
        )
        self.voice_name = settings.tts_voice

    def synthesize_to_file(self, text: str, output_path: str | Path) -> TTSResult:
        if not text.strip():
            raise TTSServiceError("Cannot synthesize empty tutor speech.")

        start = time.perf_counter()

        try:
            generator = self.pipeline(
                text,
                voice=self.voice_name,
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
