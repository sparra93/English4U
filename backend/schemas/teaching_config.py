from __future__ import annotations

from typing import Literal, Optional, get_args

from pydantic import BaseModel, ConfigDict, Field, create_model, field_validator

CEFRLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
CorrectionMode = Literal["immediate", "after_response", "end_of_session"]
TeacherStrictness = Literal["relaxed", "balanced", "strict"]
SkillDomain = Literal[
    "speaking",
    "listening",
    "grammar",
    "vocabulary",
    "pronunciation",
    "reading",
    "writing",
]

_SKILL_DOMAINS: tuple[str, ...] = get_args(SkillDomain)
_WEIGHT_TOLERANCE = 1e-6


def _default_skill_focus() -> dict[str, float]:
    return {domain: 1 / len(_SKILL_DOMAINS) for domain in _SKILL_DOMAINS}


class TeachingConfig(BaseModel):
    """Runtime teaching parameters per `config/TEACHING_CONFIG_SPEC.md`.

    This is the fully-resolved shape used to drive prompt assembly. All
    fields are required and validated; `TeachingConfigOverride` is the
    partial shape used at each precedence layer before resolution.
    """

    model_config = ConfigDict(extra="forbid")

    current_level: CEFRLevel
    target_level: CEFRLevel
    correction_mode: CorrectionMode = "after_response"
    teacher_strictness: TeacherStrictness = "balanced"
    english_exposure: int = Field(default=85, ge=0, le=100)
    session_duration_minutes: int = Field(default=30, gt=0)
    vocabulary_per_session: int = Field(default=6, ge=3, le=12)
    skill_focus: dict[SkillDomain, float] = Field(default_factory=_default_skill_focus)

    @field_validator("skill_focus")
    @classmethod
    def _validate_skill_focus(cls, value: dict[str, float]) -> dict[str, float]:
        if not value:
            raise ValueError("skill_focus must not be empty.")

        for domain, weight in value.items():
            if domain not in _SKILL_DOMAINS:
                raise ValueError(f"Unknown skill domain: {domain!r}")
            if weight < 0:
                raise ValueError(f"skill_focus weight for {domain!r} must not be negative.")

        total = sum(value.values())
        if abs(total - 1.0) > 1e-3:
            raise ValueError(f"skill_focus weights must sum to 1.0 (got {total}).")

        return value


# All-optional mirror of TeachingConfig, generated from its own field set so
# the two never drift apart when a field is added or removed.
TeachingConfigOverride = create_model(
    "TeachingConfigOverride",
    __config__=ConfigDict(extra="forbid"),
    **{
        name: (Optional[field.annotation], None)
        for name, field in TeachingConfig.model_fields.items()
    },
)


DEFAULT_TEACHING_CONFIG = TeachingConfig(
    current_level="B1",
    target_level="B1",
)


def resolve_teaching_config(
    session_override: "TeachingConfigOverride | None" = None,
    learner_preference: "TeachingConfigOverride | None" = None,
    plan_recommendation: "TeachingConfigOverride | None" = None,
    app_default: TeachingConfig = DEFAULT_TEACHING_CONFIG,
) -> TeachingConfig:
    """Resolve the four-level precedence chain from `config/TEACHING_CONFIG_SPEC.md`:

    session override > learner preference > plan recommendation > app default.

    `plan_recommendation` is always `None` until a Planner agent exists; the
    parameter is kept so wiring one in later does not require touching this
    function's callers.
    """

    layers = (session_override, learner_preference, plan_recommendation)
    merged: dict[str, object] = app_default.model_dump()

    for field_name in TeachingConfig.model_fields:
        for layer in layers:
            if layer is None:
                continue
            value = getattr(layer, field_name, None)
            if value is not None:
                merged[field_name] = value
                break

    return TeachingConfig(**merged)
