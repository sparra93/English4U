from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import requests

from app.config import PROMPTS_DIR, settings

SYSTEM_PROMPT_PATH = PROMPTS_DIR / "tutor_system_prompt.txt"
OLLAMA_URL = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
OLLAMA_TAGS_URL = f"{settings.ollama_base_url.rstrip('/')}/api/tags"


def load_system_prompt(prompt_path: str | Path = SYSTEM_PROMPT_PATH) -> str:
    return Path(prompt_path).read_text(encoding="utf-8").strip()

SECTION_NAMES = (
    "RESPONSE",
    "CORRECTIONS",
    "NATURAL VERSION",
    "VOCABULARY",
)


class TutorServiceError(RuntimeError):
    """Raised when the LLM response cannot be produced or parsed."""


@dataclass
class TutorResult:
    raw_answer: str
    response: str
    corrections: str
    natural_version: str
    vocabulary: str
    voice_response: str
    elapsed_seconds: float


def parse_tutor_answer(answer: str) -> tuple[str, str, str, str]:
    if not answer.strip():
        raise TutorServiceError("Ollama returned an empty response.")

    normalized = answer.replace("\r\n", "\n")
    positions: dict[str, int] = {}

    for section in SECTION_NAMES:
        marker = f"{section}:"
        index = normalized.find(marker)
        if index != -1:
            positions[section] = index

    if not positions:
        response = normalized.strip()
        return (
            response,
            "No important corrections.",
            response,
            "No vocabulary suggestion provided.",
        )

    extracted: dict[str, str] = {}
    ordered = sorted(positions.items(), key=lambda item: item[1])

    for offset, (section, start_index) in enumerate(ordered):
        start = start_index + len(section) + 1
        end = len(normalized)
        if offset + 1 < len(ordered):
            end = ordered[offset + 1][1]
        extracted[section] = normalized[start:end].strip()

    response = extracted.get("RESPONSE", "").strip()
    corrections = extracted.get("CORRECTIONS", "").strip() or "No important corrections."
    natural_version = extracted.get("NATURAL VERSION", "").strip() or response
    vocabulary = extracted.get("VOCABULARY", "").strip() or "No vocabulary suggestion provided."

    if not response:
        raise TutorServiceError("Ollama returned an empty voice response.")

    return response, corrections, natural_version, vocabulary


class TutorService:
    def __init__(self) -> None:
        self.model_name = settings.ollama_model
        self.system_prompt = load_system_prompt()

    def check_health(self, timeout: float = 3.0) -> bool:
        try:
            response = requests.get(OLLAMA_TAGS_URL, timeout=timeout)
            response.raise_for_status()
        except requests.RequestException:
            return False
        return True

    def ask(self, transcription: str, timeout: float = 300.0) -> TutorResult:
        if not transcription.strip():
            raise TutorServiceError("Whisper returned an empty transcription.")

        start = time.perf_counter()

        try:
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model": self.model_name,
                    "stream": False,
                    "think": False,
                    "keep_alive": "30m",
                    "options": {
                        "temperature": 0.4,
                        "num_predict": 500,
                    },
                    "messages": [
                        {
                            "role": "system",
                            "content": self.system_prompt,
                        },
                        {
                            "role": "user",
                            "content": transcription,
                        },
                    ],
                },
                timeout=timeout,
            )
            response.raise_for_status()
        except requests.Timeout as exc:
            raise TutorServiceError("Ollama timed out while generating a response.") from exc
        except requests.RequestException as exc:
            raise TutorServiceError("Ollama is unavailable.") from exc

        elapsed_seconds = time.perf_counter() - start
        data = response.json()
        answer = data.get("message", {}).get("content", "").strip()

        response_text, corrections, natural_version, vocabulary = parse_tutor_answer(answer)

        return TutorResult(
            raw_answer=answer,
            response=response_text,
            corrections=corrections,
            natural_version=natural_version,
            vocabulary=vocabulary,
            voice_response=response_text,
            elapsed_seconds=elapsed_seconds,
        )
