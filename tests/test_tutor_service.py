from __future__ import annotations

import unittest

from app.services.tutor_service import TutorServiceError, parse_tutor_answer


class ParseTutorAnswerTests(unittest.TestCase):
    def test_raises_on_empty_answer(self) -> None:
        with self.assertRaises(TutorServiceError):
            parse_tutor_answer("   ")

    def test_returns_fallback_shape_when_no_sections_exist(self) -> None:
        response, corrections, natural_version, vocabulary = parse_tutor_answer(
            "That sounds good. What did you do next?",
        )

        self.assertEqual(response, "That sounds good. What did you do next?")
        self.assertEqual(corrections, "No important corrections.")
        self.assertEqual(natural_version, "That sounds good. What did you do next?")
        self.assertEqual(vocabulary, "No vocabulary suggestion provided.")

    def test_parses_all_expected_sections(self) -> None:
        answer = """
RESPONSE:
That sounds like a productive day.

CORRECTIONS:
go -> went

NATURAL VERSION:
Yesterday I went to the store.

VOCABULARY:
work on
""".strip()

        response, corrections, natural_version, vocabulary = parse_tutor_answer(answer)

        self.assertEqual(response, "That sounds like a productive day.")
        self.assertEqual(corrections, "go -> went")
        self.assertEqual(natural_version, "Yesterday I went to the store.")
        self.assertEqual(vocabulary, "work on")

    def test_uses_defaults_for_missing_optional_sections(self) -> None:
        answer = """
RESPONSE:
That sounds fun.

NATURAL VERSION:
That sounded fun.
""".strip()

        response, corrections, natural_version, vocabulary = parse_tutor_answer(answer)

        self.assertEqual(response, "That sounds fun.")
        self.assertEqual(corrections, "No important corrections.")
        self.assertEqual(natural_version, "That sounded fun.")
        self.assertEqual(vocabulary, "No vocabulary suggestion provided.")

    def test_raises_when_response_section_is_empty(self) -> None:
        answer = """
RESPONSE:

CORRECTIONS:
No important corrections.
""".strip()

        with self.assertRaises(TutorServiceError):
            parse_tutor_answer(answer)


if __name__ == "__main__":
    unittest.main()
