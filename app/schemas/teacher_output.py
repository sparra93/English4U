from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CorrectionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    original: str = Field(min_length=1)
    corrected: str = Field(min_length=1)
    explanation: str = Field(min_length=1)


class VocabularySuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str = Field(min_length=1)
    meaning: str = Field(min_length=1)
    example_usage: str = Field(min_length=1)


class TeacherReply(BaseModel):
    """Structured, schema-validated shape of a single Teacher turn.

    Replaces marker-string parsing of free text. `has_corrections` forces the
    model to make an explicit claim rather than letting the application infer
    "no important corrections" whenever parsing merely failed.
    """

    model_config = ConfigDict(extra="forbid")

    response: str = Field(min_length=1)
    has_corrections: bool
    corrections: list[CorrectionItem] = Field(default_factory=list)
    natural_version: str = Field(min_length=1)
    vocabulary: VocabularySuggestion | None = None

    @model_validator(mode="after")
    def _corrections_consistency(self) -> "TeacherReply":
        if self.has_corrections and not self.corrections:
            raise ValueError("has_corrections=True but no corrections were provided.")
        if not self.has_corrections and self.corrections:
            raise ValueError("has_corrections=False but corrections were provided.")
        return self


def inline_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Resolve Pydantic v2's `$ref`/`$defs` into a fully inlined JSON schema.

    Ollama's schema-constrained decoding has been less reliable with
    `$ref`-based schemas than fully inlined ones, so the schema sent as the
    `format` field on `/api/chat` should not contain `$ref`.
    """

    defs = schema.get("$defs", {})

    def resolve(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                ref_name = node["$ref"].rsplit("/", 1)[-1]
                resolved = resolve(defs[ref_name])
                remainder = {k: v for k, v in node.items() if k != "$ref"}
                if remainder:
                    return {**resolved, **resolve(remainder)}
                return resolved
            return {key: resolve(value) for key, value in node.items() if key != "$defs"}
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    return resolve(schema)
