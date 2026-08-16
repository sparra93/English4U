from __future__ import annotations

import unittest

from pydantic import ValidationError

from backend.schemas.teaching_config import (
    DEFAULT_TEACHING_CONFIG,
    TeachingConfig,
    TeachingConfigOverride,
    resolve_teaching_config,
)


class ResolveTeachingConfigTests(unittest.TestCase):
    def test_no_overrides_returns_app_default(self) -> None:
        resolved = resolve_teaching_config()
        self.assertEqual(resolved, DEFAULT_TEACHING_CONFIG)

    def test_session_override_wins_over_learner_preference(self) -> None:
        session = TeachingConfigOverride(correction_mode="immediate")
        learner = TeachingConfigOverride(correction_mode="end_of_session", current_level="B2")

        resolved = resolve_teaching_config(session_override=session, learner_preference=learner)

        self.assertEqual(resolved.correction_mode, "immediate")

    def test_learner_preference_fills_fields_session_does_not_set(self) -> None:
        session = TeachingConfigOverride(correction_mode="immediate")
        learner = TeachingConfigOverride(current_level="B2", target_level="C1")

        resolved = resolve_teaching_config(session_override=session, learner_preference=learner)

        self.assertEqual(resolved.correction_mode, "immediate")
        self.assertEqual(resolved.current_level, "B2")
        self.assertEqual(resolved.target_level, "C1")

    def test_plan_recommendation_is_a_genuine_noop(self) -> None:
        # No Planner agent exists yet; passing None must behave identically
        # to omitting the argument entirely.
        with_none = resolve_teaching_config(plan_recommendation=None)
        without_arg = resolve_teaching_config()
        self.assertEqual(with_none, without_arg)

    def test_unset_fields_fall_back_to_app_default(self) -> None:
        learner = TeachingConfigOverride(current_level="B2")
        resolved = resolve_teaching_config(learner_preference=learner)

        self.assertEqual(resolved.current_level, "B2")
        self.assertEqual(resolved.correction_mode, DEFAULT_TEACHING_CONFIG.correction_mode)
        self.assertEqual(resolved.english_exposure, DEFAULT_TEACHING_CONFIG.english_exposure)

    def test_resolved_result_is_revalidated(self) -> None:
        # Merged values still go through TeachingConfig's own validation.
        session = TeachingConfigOverride(english_exposure=85)
        resolved = resolve_teaching_config(session_override=session)
        self.assertIsInstance(resolved, TeachingConfig)


class TeachingConfigValidationTests(unittest.TestCase):
    def test_invalid_cefr_level_raises(self) -> None:
        with self.assertRaises(ValidationError):
            TeachingConfig(current_level="Z9", target_level="B1")

    def test_english_exposure_out_of_range_raises(self) -> None:
        with self.assertRaises(ValidationError):
            TeachingConfig(current_level="B1", target_level="B1", english_exposure=150)

    def test_vocabulary_per_session_out_of_range_raises(self) -> None:
        with self.assertRaises(ValidationError):
            TeachingConfig(current_level="B1", target_level="B1", vocabulary_per_session=1)

    def test_skill_focus_weights_must_sum_to_one(self) -> None:
        with self.assertRaises(ValidationError):
            TeachingConfig(current_level="B1", target_level="B1", skill_focus={"speaking": 0.9})

    def test_skill_focus_rejects_unknown_domain(self) -> None:
        with self.assertRaises(ValidationError):
            TeachingConfig(
                current_level="B1",
                target_level="B1",
                skill_focus={"speaking": 1.0, "unknown_domain": 0.0},
            )

    def test_skill_focus_rejects_negative_weight(self) -> None:
        with self.assertRaises(ValidationError):
            TeachingConfig(
                current_level="B1",
                target_level="B1",
                skill_focus={
                    "speaking": 1.2,
                    "listening": -0.2,
                    "grammar": 0.0,
                    "vocabulary": 0.0,
                    "pronunciation": 0.0,
                    "reading": 0.0,
                    "writing": 0.0,
                },
            )


if __name__ == "__main__":
    unittest.main()
