from __future__ import annotations

import unittest

from pydantic import ValidationError

from app.schemas.teacher_output import CorrectionItem, TeacherReply, VocabularySuggestion, inline_refs


class TeacherReplyTests(unittest.TestCase):
    def test_valid_payload_without_corrections(self) -> None:
        reply = TeacherReply(
            response="That sounds like a great day!",
            has_corrections=False,
            natural_version="That sounds like a great day!",
        )
        self.assertEqual(reply.corrections, [])
        self.assertIsNone(reply.vocabulary)

    def test_valid_payload_with_corrections_and_vocabulary(self) -> None:
        reply = TeacherReply(
            response="Nice, tell me more.",
            has_corrections=True,
            corrections=[
                CorrectionItem(original="I go yesterday", corrected="I went yesterday", explanation="Use past tense.")
            ],
            natural_version="Yesterday I went to the store.",
            vocabulary=VocabularySuggestion(
                term="work on", meaning="to spend effort improving something", example_usage="I'm working on my pronunciation."
            ),
        )
        self.assertEqual(len(reply.corrections), 1)
        self.assertEqual(reply.vocabulary.term, "work on")

    def test_missing_required_field_raises(self) -> None:
        with self.assertRaises(ValidationError):
            TeacherReply(has_corrections=False, natural_version="ok")  # missing `response`

    def test_has_corrections_true_with_no_items_raises(self) -> None:
        with self.assertRaises(ValidationError):
            TeacherReply(response="ok", has_corrections=True, natural_version="ok")

    def test_has_corrections_false_with_items_raises(self) -> None:
        with self.assertRaises(ValidationError):
            TeacherReply(
                response="ok",
                has_corrections=False,
                corrections=[CorrectionItem(original="a", corrected="b", explanation="c")],
                natural_version="ok",
            )

    def test_extra_field_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            TeacherReply(
                response="ok",
                has_corrections=False,
                natural_version="ok",
                unexpected_field="nope",
            )

    def test_empty_string_fields_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            TeacherReply(response="", has_corrections=False, natural_version="ok")


class InlineRefsTests(unittest.TestCase):
    def test_removes_refs_and_defs(self) -> None:
        schema = TeacherReply.model_json_schema()
        self.assertIn("$defs", schema)

        inlined = inline_refs(schema)

        self.assertNotIn("$defs", inlined)
        self.assertNotIn("$ref", str(inlined))

    def test_inlined_schema_keeps_nested_structure(self) -> None:
        inlined = inline_refs(TeacherReply.model_json_schema())
        corrections_items = inlined["properties"]["corrections"]["items"]
        self.assertEqual(
            set(corrections_items["required"]), {"original", "corrected", "explanation"}
        )


if __name__ == "__main__":
    unittest.main()
