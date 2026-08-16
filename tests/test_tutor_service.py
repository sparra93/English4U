from __future__ import annotations

import json
import unittest
from unittest.mock import Mock, patch

import requests

from app.schemas.teaching_config import DEFAULT_TEACHING_CONFIG
from app.services.tutor_service import (
    TutorService,
    TutorServiceError,
    TutorValidationError,
    format_corrections_for_display,
    format_vocabulary_for_display,
)
from app.storage.learner_repository import LearnerRecord

VALID_PAYLOAD = {
    "response": "That sounds like a productive day.",
    "has_corrections": True,
    "corrections": [
        {"original": "I go yesterday", "corrected": "I went yesterday", "explanation": "Use past tense."}
    ],
    "natural_version": "Yesterday I went to the store.",
    "vocabulary": {
        "term": "work on",
        "meaning": "to spend effort improving something",
        "example_usage": "I'm working on my pronunciation.",
    },
}


def _make_learner() -> LearnerRecord:
    return LearnerRecord(
        learner_id="default",
        display_name=None,
        native_language="es",
        current_level=None,
        target_level=None,
        correction_mode=None,
        teacher_strictness=None,
        english_exposure=None,
        session_duration_minutes=None,
        vocabulary_per_session=None,
        skill_focus=None,
        goals=None,
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:00:00+00:00",
    )


def _ollama_response(content: str) -> Mock:
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"message": {"content": content}}
    return response


class ParseCorrectionsAndVocabularyDisplayTests(unittest.TestCase):
    def test_no_corrections_message(self) -> None:
        self.assertEqual(format_corrections_for_display([]), "No important corrections.")

    def test_no_vocabulary_message(self) -> None:
        self.assertEqual(format_vocabulary_for_display(None), "No vocabulary suggestion provided.")


class TutorServiceAskTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = TutorService()
        self.learner = _make_learner()

    def test_empty_transcription_raises_without_calling_ollama(self) -> None:
        with patch("app.services.tutor_service.requests.post") as mock_post:
            with self.assertRaises(TutorServiceError):
                self.service.ask("   ", DEFAULT_TEACHING_CONFIG, self.learner, [])
            mock_post.assert_not_called()

    def test_valid_json_on_first_attempt_succeeds(self) -> None:
        mock_response = _ollama_response(json.dumps(VALID_PAYLOAD))

        with patch("app.services.tutor_service.requests.post", return_value=mock_response) as mock_post:
            result = self.service.ask("I go to the store yesterday.", DEFAULT_TEACHING_CONFIG, self.learner, [])

        self.assertEqual(mock_post.call_count, 1)
        self.assertEqual(result.response, VALID_PAYLOAD["response"])
        self.assertEqual(result.natural_version, VALID_PAYLOAD["natural_version"])
        self.assertIn("I go yesterday -> I went yesterday", result.corrections)
        self.assertIn("work on", result.vocabulary)
        self.assertTrue(result.structured.has_corrections)

    def test_invalid_then_valid_retries_exactly_once(self) -> None:
        invalid_response = _ollama_response("not valid json at all")
        valid_response = _ollama_response(json.dumps(VALID_PAYLOAD))

        with patch(
            "app.services.tutor_service.requests.post",
            side_effect=[invalid_response, valid_response],
        ) as mock_post:
            result = self.service.ask("I go to the store yesterday.", DEFAULT_TEACHING_CONFIG, self.learner, [])

        self.assertEqual(mock_post.call_count, 2)
        self.assertEqual(result.response, VALID_PAYLOAD["response"])

        second_call_messages = mock_post.call_args_list[1].kwargs["json"]["messages"]
        self.assertEqual(second_call_messages[-2]["role"], "assistant")
        self.assertEqual(second_call_messages[-2]["content"], "not valid json at all")
        self.assertEqual(second_call_messages[-1]["role"], "user")
        self.assertIn("did not match the required JSON schema", second_call_messages[-1]["content"])

    def test_invalid_twice_raises_validation_error_without_fabricating(self) -> None:
        invalid_response = _ollama_response("still not json")

        with patch(
            "app.services.tutor_service.requests.post",
            side_effect=[invalid_response, invalid_response],
        ) as mock_post:
            with self.assertRaises(TutorValidationError):
                self.service.ask("I go to the store yesterday.", DEFAULT_TEACHING_CONFIG, self.learner, [])

        self.assertEqual(mock_post.call_count, 2)

    def test_missing_required_field_triggers_retry(self) -> None:
        incomplete_payload = dict(VALID_PAYLOAD)
        del incomplete_payload["natural_version"]
        invalid_response = _ollama_response(json.dumps(incomplete_payload))
        valid_response = _ollama_response(json.dumps(VALID_PAYLOAD))

        with patch(
            "app.services.tutor_service.requests.post",
            side_effect=[invalid_response, valid_response],
        ) as mock_post:
            result = self.service.ask("hi", DEFAULT_TEACHING_CONFIG, self.learner, [])

        self.assertEqual(mock_post.call_count, 2)
        self.assertEqual(result.natural_version, VALID_PAYLOAD["natural_version"])

    def test_http_timeout_raises_tutor_service_error(self) -> None:
        with patch("app.services.tutor_service.requests.post", side_effect=requests.Timeout):
            with self.assertRaises(TutorServiceError):
                self.service.ask("hi", DEFAULT_TEACHING_CONFIG, self.learner, [])

    def test_format_sent_to_ollama_has_no_refs(self) -> None:
        mock_response = _ollama_response(json.dumps(VALID_PAYLOAD))

        with patch("app.services.tutor_service.requests.post", return_value=mock_response) as mock_post:
            self.service.ask("hi", DEFAULT_TEACHING_CONFIG, self.learner, [])

        sent_format = mock_post.call_args.kwargs["json"]["format"]
        self.assertNotIn("$ref", json.dumps(sent_format))
        self.assertNotIn("$defs", sent_format)


if __name__ == "__main__":
    unittest.main()
