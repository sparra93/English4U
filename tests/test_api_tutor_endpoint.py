from __future__ import annotations

import dataclasses
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.schemas.teacher_output import TeacherReply
from backend.services.tutor_service import TutorResult, TutorServiceError, TutorValidationError

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
        self.title_calls: list[dict[str, object]] = []

    def check_health(self) -> bool:
        return True

    def generate_session_title(self, transcription, response):  # noqa: ANN001
        self.title_calls.append({"transcription": transcription, "response": response})
        return "A generated conversation title"

    def ask(
        self, transcription, config, learner, recent_turns, tutor_name="Emma", tutor_behavior_prompt=""
    ):  # noqa: ANN001
        self.calls.append(
            {
                "transcription": transcription,
                "config": config,
                "learner": learner,
                "recent_turns": recent_turns,
                "tutor_name": tutor_name,
                "tutor_behavior_prompt": tutor_behavior_prompt,
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
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def synthesize_to_file(self, text, output_path, voice=None, lang_code=None):  # noqa: ANN001
        self.calls.append({"text": text, "voice": voice, "lang_code": lang_code})
        return SimpleNamespace(output_path=str(output_path), elapsed_seconds=0.02)


class FakeTTSServiceError(RuntimeError):
    pass


class BrokenTTSService:
    def __init__(self) -> None:
        raise FakeTTSServiceError("Kokoro model could not be loaded.")


def _fake_local_service_classes() -> dict[str, object]:
    return {
        "whisper_service": FakeWhisperService,
        "whisper_error": FakeWhisperServiceError,
        "tutor_service": FakeTutorService,
        "tutor_error": TutorServiceError,
        "tts_service": FakeTTSService,
        "tts_error": FakeTTSServiceError,
    }


def _broken_tts_service_classes() -> dict[str, object]:
    return {
        "whisper_service": FakeWhisperService,
        "whisper_error": FakeWhisperServiceError,
        "tutor_service": FakeTutorService,
        "tutor_error": TutorServiceError,
        "tts_service": BrokenTTSService,
        "tts_error": FakeTTSServiceError,
    }


class ApiTutorEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        import backend.main as main_module

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

        from backend.storage.turn_repository import get_recent_turns

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

    def test_tutors_catalog_lists_emma_and_four_others(self) -> None:
        response = self.client.get("/api/tutors")
        self.assertEqual(response.status_code, 200)

        tutors = response.json()["tutors"]
        ids = {tutor["id"] for tutor in tutors}
        self.assertEqual(ids, {"emma", "james", "sophia", "michael", "nicole"})

        for tutor in tutors:
            self.assertTrue(tutor["specialty"])
            self.assertTrue(tutor["tagline"])
            self.assertNotIn("voice_id", tutor)
            self.assertNotIn("behavior_prompt", tutor)

    def test_learner_defaults_to_no_tutor_selected(self) -> None:
        response = self.client.get("/api/learner")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["tutor_id"])

    def test_setting_an_unknown_tutor_id_is_rejected(self) -> None:
        response = self.client.put("/api/learner/tutor", json={"tutor_id": "not-a-real-tutor"})
        self.assertEqual(response.status_code, 400)

    def test_setting_a_valid_tutor_id_persists(self) -> None:
        response = self.client.put("/api/learner/tutor", json={"tutor_id": "james"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["tutor_id"], "james")

        reloaded = self.client.get("/api/learner")
        self.assertEqual(reloaded.json()["tutor_id"], "james")

    def test_selected_tutor_name_and_voice_reach_the_services(self) -> None:
        set_response = self.client.put("/api/learner/tutor", json={"tutor_id": "sophia"})
        self.assertEqual(set_response.status_code, 200)

        self._post_audio()

        tutor_service = self.main_module.app.state.tutor
        self.assertEqual(tutor_service.calls[-1]["tutor_name"], "Sophia")

        tts_service = self.main_module.app.state.tts
        self.assertEqual(tts_service.calls[-1]["voice"], "bf_emma")
        self.assertEqual(tts_service.calls[-1]["lang_code"], "b")

    def test_default_tutor_is_emma_when_none_selected(self) -> None:
        self._post_audio()

        tutor_service = self.main_module.app.state.tutor
        self.assertEqual(tutor_service.calls[-1]["tutor_name"], "Emma")

        tts_service = self.main_module.app.state.tts
        self.assertEqual(tts_service.calls[-1]["voice"], "af_heart")
        self.assertEqual(tts_service.calls[-1]["lang_code"], "a")

    def test_response_includes_the_resolved_tutor_id(self) -> None:
        response = self._post_audio()
        self.assertEqual(response.json()["tutor_id"], "emma")

    def test_tutor_is_locked_to_the_session_after_the_first_turn(self) -> None:
        first_response = self._post_audio()
        session_id = first_response.json()["session_id"]
        self.assertEqual(first_response.json()["tutor_id"], "emma")

        # Changing the learner's default tutor mid-conversation must not
        # affect a session that already has a locked-in tutor.
        self.client.put("/api/learner/tutor", json={"tutor_id": "james"})
        second_response = self._post_audio(session_id=session_id)

        self.assertEqual(second_response.json()["tutor_id"], "emma")
        tutor_service = self.main_module.app.state.tutor
        self.assertEqual(tutor_service.calls[-1]["tutor_name"], "Emma")

        # A brand-new session, though, should pick up the new default.
        third_response = self._post_audio()
        self.assertEqual(third_response.json()["tutor_id"], "james")

    def test_first_turn_generates_and_persists_a_session_title(self) -> None:
        response = self._post_audio()
        session_id = response.json()["session_id"]

        tutor_service = self.main_module.app.state.tutor
        self.assertEqual(len(tutor_service.title_calls), 1)

        sessions = self.client.get("/api/sessions").json()["sessions"]
        matching = next(s for s in sessions if s["session_id"] == session_id)
        self.assertEqual(matching["title"], "A generated conversation title")

    def test_second_turn_does_not_regenerate_the_title(self) -> None:
        first_response = self._post_audio()
        session_id = first_response.json()["session_id"]

        self._post_audio(session_id=session_id)

        tutor_service = self.main_module.app.state.tutor
        self.assertEqual(len(tutor_service.title_calls), 1)

    def test_session_turns_endpoint_includes_the_locked_tutor_id(self) -> None:
        self.client.put("/api/learner/tutor", json={"tutor_id": "sophia"})
        response = self._post_audio()
        session_id = response.json()["session_id"]

        turns_response = self.client.get(f"/api/sessions/{session_id}/turns")
        self.assertEqual(turns_response.json()["tutor_id"], "sophia")

    def test_session_turns_endpoint_defaults_tutor_id_for_unknown_session(self) -> None:
        response = self.client.get("/api/sessions/does-not-exist/turns")
        self.assertEqual(response.json()["tutor_id"], "emma")

    def test_selected_tutor_behavior_prompt_reaches_the_tutor_service(self) -> None:
        self.client.put("/api/learner/tutor", json={"tutor_id": "james"})
        self._post_audio()

        tutor_service = self.main_module.app.state.tutor
        behavior_prompt = tutor_service.calls[-1]["tutor_behavior_prompt"]
        self.assertIn("James", behavior_prompt)
        self.assertIn("accuracy", behavior_prompt.lower())


class ApiTutorEndpointStartupFailureTests(unittest.TestCase):
    def setUp(self) -> None:
        import backend.main as main_module

        self.main_module = main_module

        self._tmp_dir = tempfile.TemporaryDirectory()
        db_path = str(Path(self._tmp_dir.name) / "test.db")

        self._settings_patch = patch.object(
            main_module,
            "settings",
            dataclasses.replace(main_module.settings, db_path=db_path, remote_backend_base_url=""),
        )
        self._service_classes_patch = patch.object(
            main_module,
            "_load_local_service_classes",
            _broken_tts_service_classes,
        )

        self._settings_patch.start()
        self._service_classes_patch.start()

        self.addCleanup(self._settings_patch.stop)
        self.addCleanup(self._service_classes_patch.stop)
        self.addCleanup(self._tmp_dir.cleanup)

        self.client_cm = TestClient(main_module.app)
        self.client = self.client_cm.__enter__()
        self.addCleanup(lambda: self.client_cm.__exit__(None, None, None))

    def test_startup_service_failure_degrades_health_and_returns_503(self) -> None:
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        health_body = health.json()
        self.assertEqual(health_body["status"], "degraded")
        self.assertFalse(health_body["tts"])
        self.assertIn("Kokoro model could not be loaded.", health_body["startup_errors"]["tts"])

        response = self.client.post(
            "/api/tutor",
            files={"audio": ("recording.webm", AUDIO_BYTES, "audio/webm")},
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("Kokoro model could not be loaded.", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
