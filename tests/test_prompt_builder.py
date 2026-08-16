from __future__ import annotations

import unittest

from backend.config import PROMPTS_DIR
from backend.schemas.teacher_output import TeacherReply
from backend.schemas.teaching_config import DEFAULT_TEACHING_CONFIG, TeachingConfig
from backend.services.prompt_builder import ROLE_PROMPT_PATH, TEACHING_POLICY_PATH, build_messages
from backend.storage.learner_repository import LearnerRecord
from backend.storage.turn_repository import TurnRecord


def _make_learner(**overrides: object) -> LearnerRecord:
    fields = dict(
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
        tutor_id=None,
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:00:00+00:00",
    )
    fields.update(overrides)
    return LearnerRecord(**fields)


def _make_turn(transcription: str, response: str, index: int) -> TurnRecord:
    return TurnRecord(
        turn_id=index,
        session_id="sess-1",
        turn_index=index,
        created_at="2026-01-01T00:00:00+00:00",
        transcription=transcription,
        teacher_output=TeacherReply(response=response, has_corrections=False, natural_version=response),
        voice_response=response,
        whisper_elapsed_seconds=0.1,
        ollama_elapsed_seconds=0.2,
        tts_elapsed_seconds=0.1,
    )


class BuildMessagesTests(unittest.TestCase):
    def test_system_message_contains_config_and_learner_blocks(self) -> None:
        config = TeachingConfig(current_level="B2", target_level="C1", correction_mode="immediate")
        learner = _make_learner(native_language="es", goals="Prepare for a job interview")

        messages = build_messages(config, learner, [], "Hello, how are you?")

        system_content = messages[0]["content"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("Correction mode: immediate", system_content)
        self.assertIn("B2", system_content)
        self.assertIn("C1", system_content)
        self.assertIn("Native language: es", system_content)
        self.assertIn("Prepare for a job interview", system_content)

    def test_final_message_is_current_transcription(self) -> None:
        learner = _make_learner()
        messages = build_messages(DEFAULT_TEACHING_CONFIG, learner, [], "What did you do today?")

        self.assertEqual(messages[-1], {"role": "user", "content": "What did you do today?"})

    def test_recent_turns_render_as_alternating_messages_in_order(self) -> None:
        learner = _make_learner()
        turns = [
            _make_turn("I go to work yesterday", "Nice, tell me more.", 1),
            _make_turn("It was interesting", "What made it interesting?", 2),
        ]

        messages = build_messages(DEFAULT_TEACHING_CONFIG, learner, turns, "It was a new project.")

        # system, (user, assistant) x2, final user
        self.assertEqual(len(messages), 6)
        self.assertEqual(messages[1], {"role": "user", "content": "I go to work yesterday"})
        self.assertEqual(messages[2], {"role": "assistant", "content": "Nice, tell me more."})
        self.assertEqual(messages[3], {"role": "user", "content": "It was interesting"})
        self.assertEqual(messages[4], {"role": "assistant", "content": "What made it interesting?"})
        self.assertEqual(messages[5], {"role": "user", "content": "It was a new project."})

    def test_no_learner_history_falls_back_to_placeholder(self) -> None:
        learner = _make_learner(goals=None)
        messages = build_messages(DEFAULT_TEACHING_CONFIG, learner, [], "Hi")
        self.assertIn("No further learner history is available yet.", messages[0]["content"])

    def test_tutor_name_defaults_to_emma(self) -> None:
        learner = _make_learner()
        messages = build_messages(DEFAULT_TEACHING_CONFIG, learner, [], "Hi")
        self.assertIn("Your name is Emma.", messages[0]["content"])

    def test_tutor_name_reflects_the_selected_tutor(self) -> None:
        learner = _make_learner()
        messages = build_messages(DEFAULT_TEACHING_CONFIG, learner, [], "Hi", tutor_name="James")
        self.assertIn("Your name is James.", messages[0]["content"])
        self.assertNotIn("Your name is Emma.", messages[0]["content"])


class StaticPromptRegressionGuardTests(unittest.TestCase):
    """Ensures the static prompt files never regain hardcoded student data,
    per AGENTS.md: "Prompt text must not contain hardcoded student-specific data."
    """

    def test_role_and_policy_files_contain_no_hardcoded_native_language(self) -> None:
        role_text = ROLE_PROMPT_PATH.read_text(encoding="utf-8").lower()
        policy_text = TEACHING_POLICY_PATH.read_text(encoding="utf-8").lower()

        for forbidden in ("spanish-speaking", "spanish"):
            self.assertNotIn(forbidden, role_text)
            self.assertNotIn(forbidden, policy_text)

    def test_role_and_policy_files_contain_no_cefr_level(self) -> None:
        combined = (
            ROLE_PROMPT_PATH.read_text(encoding="utf-8")
            + TEACHING_POLICY_PATH.read_text(encoding="utf-8")
        ).upper()

        for level in ("A1", "A2", "B1", "B2", "C1", "C2"):
            self.assertNotIn(level, combined)

    def test_prompt_files_are_under_prompts_dir(self) -> None:
        self.assertEqual(ROLE_PROMPT_PATH.parent, PROMPTS_DIR)
        self.assertEqual(TEACHING_POLICY_PATH.parent, PROMPTS_DIR)


if __name__ == "__main__":
    unittest.main()
