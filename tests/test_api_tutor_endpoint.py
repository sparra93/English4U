from __future__ import annotations

import dataclasses
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.schemas.teacher_output import TeacherReply
from app.services.tutor_service import TutorResult, TutorServiceError, TutorValidationError

AUDIO_BYTES = b"fake-audio-bytes-not-really-a-wav-file"


class FakeWhisperService:
    def transcribe_file(self, path):  # noqa: ANN001 - test double
        return SimpleNamespace(transcription="Hello teacher, how are you?", elapsed_seconds=0.1, language="en")


class FakeWhisperServiceError(RuntimeError):
    pass


class FakeTutorService:
    """Records every `ask()` call so tests can inspect what the endpoint passed in."""

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def check_health(self) -> bool:
        return True

    def ask(self, transcription, config, learner, recent_turns):  # noqa: ANN001
        self.calls.append(
            {
                "transcription": transcription,
                "config": config,
                "learner": learner,
                "recent_turns": recent_turns,
            }
        )

        if transcription == "TRIGGER_VALIDATION_ERROR":
            raise TutorValidationError("The tutor could not produce a valid response.")

        structured = TeacherReply(
            response="Great, tell me more!",
            has_corrections=False,
            natural_version="Great, tell me more!",
        )
        return TutorResult(
            structured=structured,
            response=structured.response,
            corrections="No important corrections.",
            natural_version=structured.natural_version,
            vocabulary="No vocabulary suggestion provided.",
            voice_response=structured.response,
            elapsed_seconds=0.05,
        )


class FakeTTSService:
    def synthesize_to_file(self, text, output_path):  # noqa: ANN001
        return SimpleNamespace(output_path=str(output_path), elapsed_seconds=0.02)


class FakeTTSServiceError(RuntimeError):
    pass


def _fake_local_service_classes() -> dict[str, object]:
    return {
        "whisper_service": FakeWhisperService,
        "whisper_error": FakeWhisperServiceError,
        "tutor_service": FakeTutorService,
        "tutor_error": TutorServiceError,
        "tts_service": FakeTTSService,
        "tts_error": FakeTTSServiceError,
    }


class ApiTutorEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        import app.main as main_module

        self.main_module = main_module

        self._tmp_dir = tempfile.TemporaryDirectory()
        db_path = str(Path(self._tmp_dir.name) / "test.db")

        # Force server mode regardless of this machine's own .env — a dev
        # machine may be configured as a proxy client (REMOTE_BACKEND_BASE_URL
        # set), but this test always exercises the server-mode code path.
        self._settings_patch = patch.object(
            main_module,
            "settings",
            dataclasses.replace(main_module.settings, db_path=db_path, remote_backend_base_url=""),
        )
        self._service_classes_patch = patch.object(
            main_module, "_load_local_service_classes", _fake_local_service_classes
        )

        self._settings_patch.start()
        self._service_classes_patch.start()

        self.addCleanup(self._settings_patch.stop)
        self.addCleanup(self._service_classes_patch.stop)
        self.addCleanup(self._tmp_dir.cleanup)

        self.client_cm = TestClient(main_module.app)
        self.client = self.client_cm.__enter__()
        self.addCleanup(lambda: self.client_cm.__exit__(None, None, None))

    def _post_audio(self, **data: str) -> object:
        return self.client.post(
            "/api/tutor",
            files={"audio": ("recording.webm", AUDIO_BYTES, "audio/webm")},
            data=data,
        )

    def test_first_call_creates_learner_session_and_turn_and_returns_session_id(self) -> None:
        response = self._post_audio()

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["session_id"])
        self.assertEqual(body["response"], "Great, tell me more!")

        from app.storage.turn_repository import get_recent_turns

        turns = get_recent_turns(self.main_module.settings.db_path, body["session_id"], limit=10)
        self.assertEqual(len(turns), 1)
        self.assertEqual(turns[0].transcription, "Hello teacher, how are you?")

    def test_second_call_with_same_session_id_receives_recent_turns(self) -> None:
        first_response = self._post_audio()
        session_id = first_response.json()["session_id"]

        self._post_audio(session_id=session_id)

        tutor_service = self.main_module.app.state.tutor
        self.assertEqual(len(tutor_service.calls), 2)
        self.assertEqual(tutor_service.calls[0]["recent_turns"], [])
        self.assertEqual(len(tutor_service.calls[1]["recent_turns"]), 1)

    def test_validation_error_propagates_as_502_without_fabricated_corrections(self) -> None:
        # The fake whisper service always returns the same transcription, so
        # drive the failure path through the tutor mock's trigger phrase by
        # monkeypatching the whisper transcription for this one request.
        original_transcribe = FakeWhisperService.transcribe_file
        FakeWhisperService.transcribe_file = lambda self, path: SimpleNamespace(
            transcription="TRIGGER_VALIDATION_ERROR", elapsed_seconds=0.1, language="en"
        )
        try:
            response = self._post_audio()
        finally:
            FakeWhisperService.transcribe_file = original_transcribe

        self.assertEqual(response.status_code, 502)
        detail = response.json()["detail"]
        self.assertNotIn("No important corrections", detail)
        self.assertIn("could not produce a valid response", detail)

    def test_malformed_teaching_config_override_returns_400(self) -> None:
        response = self._post_audio(teaching_config_override="{not valid json")
        self.assertEqual(response.status_code, 400)

    def test_health_endpoint_reports_database_true(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["database"])


if __name__ == "__main__":
    unittest.main()
