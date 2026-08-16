from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

import requests
from pydantic import ValidationError

from backend.config import settings
from backend.schemas.teacher_output import CorrectionItem, TeacherReply, VocabularySuggestion, inline_refs
from backend.schemas.teaching_config import TeachingConfig
from backend.services.prompt_builder import build_messages
from backend.storage.learner_repository import LearnerRecord
from backend.storage.turn_repository import TurnRecord

logger = logging.getLogger(__name__)

OLLAMA_URL = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
OLLAMA_TAGS_URL = f"{settings.ollama_base_url.rstrip('/')}/api/tags"

MAX_ATTEMPTS = 2  # one initial attempt + one retry


class TutorServiceError(RuntimeError):
    """Raised when the LLM response cannot be produced."""


class TutorValidationError(TutorServiceError):
    """Raised when the model's reply never validates against the required schema.

    Deliberately never accompanied by a fabricated response: callers must
    surface this as an explicit failure, not silently substitute default text.
    """


@dataclass
class TutorResult:
    structured: TeacherReply
    response: str
    corrections: str
    natural_version: str
    vocabulary: str
    voice_response: str
    elapsed_seconds: float


def format_corrections_for_display(corrections: list[CorrectionItem]) -> str:
    if not corrections:
        return "No important corrections."

    lines: list[str] = []
    for item in corrections:
        lines.append(f"{item.original} -> {item.corrected}")
        lines.append(item.explanation)
    return "\n".join(lines)


def format_vocabulary_for_display(vocabulary: VocabularySuggestion | None) -> str:
    if vocabulary is None:
        return "No vocabulary suggestion provided."

    return f"{vocabulary.term}\n{vocabulary.meaning} — {vocabulary.example_usage}"


class TutorService:
    def __init__(self) -> None:
        self.model_name = settings.ollama_model
        self._response_schema = inline_refs(TeacherReply.model_json_schema())

    def check_health(self, timeout: float = 3.0) -> bool:
        try:
            response = requests.get(OLLAMA_TAGS_URL, timeout=timeout)
            response.raise_for_status()
        except requests.RequestException:
            return False
        return True

    def _call_ollama(self, messages: list[dict[str, str]], timeout: float) -> str:
        try:
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model": self.model_name,
                    "stream": False,
                    "think": False,
                    "keep_alive": "30m",
                    "format": self._response_schema,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 600,
                    },
                    "messages": messages,
                },
                timeout=timeout,
            )
            response.raise_for_status()
        except requests.Timeout as exc:
            raise TutorServiceError("Ollama timed out while generating a response.") from exc
        except requests.RequestException as exc:
            raise TutorServiceError("Ollama is unavailable.") from exc

        data = response.json()
        content = data.get("message", {}).get("content", "").strip()
        if not content:
            raise TutorServiceError("Ollama returned an empty response.")
        return content

    def _parse_and_validate(self, content: str) -> TeacherReply:
        parsed = json.loads(content)  # may raise json.JSONDecodeError
        return TeacherReply.model_validate(parsed)  # may raise pydantic.ValidationError

    def ask(
        self,
        transcription: str,
        config: TeachingConfig,
        learner: LearnerRecord,
        recent_turns: list[TurnRecord],
        tutor_name: str = "Emma",
        timeout: float = 300.0,
    ) -> TutorResult:
        if not transcription.strip():
            raise TutorServiceError("Whisper returned an empty transcription.")

        start = time.perf_counter()
        messages = build_messages(config, learner, recent_turns, transcription, tutor_name)

        last_error: Exception | None = None
        structured: TeacherReply | None = None

        for attempt in range(1, MAX_ATTEMPTS + 1):
            raw_content = self._call_ollama(messages, timeout)

            try:
                structured = self._parse_and_validate(raw_content)
                break
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                logger.warning(
                    "Tutor reply failed schema validation on attempt %s: %s | raw=%r",
                    attempt,
                    exc,
                    raw_content[:500],
                )
                if attempt < MAX_ATTEMPTS:
                    messages = messages + [
                        {"role": "assistant", "content": raw_content},
                        {
                            "role": "user",
                            "content": (
                                "Your previous reply did not match the required JSON "
                                f"schema ({exc}). Respond again with ONLY a single "
                                "JSON object matching the schema — no text outside "
                                "the JSON."
                            ),
                        },
                    ]

        if structured is None:
            raise TutorValidationError(
                "The tutor could not produce a response matching the required "
                f"schema after {MAX_ATTEMPTS} attempts."
            ) from last_error

        elapsed_seconds = time.perf_counter() - start

        return TutorResult(
            structured=structured,
            response=structured.response,
            corrections=format_corrections_for_display(structured.corrections),
            natural_version=structured.natural_version,
            vocabulary=format_vocabulary_for_display(structured.vocabulary),
            voice_response=structured.response,
            elapsed_seconds=elapsed_seconds,
        )
