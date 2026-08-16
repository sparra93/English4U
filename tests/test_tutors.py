from __future__ import annotations

import unittest

from backend.tutors import DEFAULT_TUTOR_ID, TUTOR_CATALOG, get_tutor, list_tutors


class TutorCatalogTests(unittest.TestCase):
    def test_five_tutors_are_registered(self) -> None:
        self.assertEqual(
            {tutor.id for tutor in list_tutors()},
            {"emma", "james", "sophia", "michael", "nicole"},
        )

    def test_every_tutor_has_a_distinct_non_empty_behavior_prompt(self) -> None:
        prompts = [tutor.behavior_prompt for tutor in list_tutors()]
        self.assertTrue(all(prompt.strip() for prompt in prompts))
        self.assertEqual(len(prompts), len(set(prompts)))

    def test_every_tutor_has_specialty_and_tagline(self) -> None:
        for tutor in list_tutors():
            self.assertTrue(tutor.specialty.strip())
            self.assertTrue(tutor.tagline.strip())

    def test_behavior_prompt_does_not_mention_voice_or_accent(self) -> None:
        # Voice configuration and behavioral personality are deliberately
        # kept as separate concepts — a tutor's voice should not be part of
        # how its personality is described to the model.
        for tutor in list_tutors():
            self.assertNotIn("accent", tutor.behavior_prompt.lower())
            self.assertNotIn("voice", tutor.behavior_prompt.lower())

    def test_get_tutor_falls_back_to_default_for_unknown_id(self) -> None:
        self.assertEqual(get_tutor("not-a-real-tutor").id, DEFAULT_TUTOR_ID)
        self.assertEqual(get_tutor(None).id, DEFAULT_TUTOR_ID)

    def test_get_tutor_resolves_known_id(self) -> None:
        self.assertIs(get_tutor("james"), TUTOR_CATALOG["james"])


if __name__ == "__main__":
    unittest.main()
