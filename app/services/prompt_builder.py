from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from app.config import PROMPTS_DIR
from app.schemas.teaching_config import TeachingConfig

if TYPE_CHECKING:
    from app.storage.learner_repository import LearnerRecord
    from app.storage.turn_repository import TurnRecord

ROLE_PROMPT_PATH = PROMPTS_DIR / "role.txt"
TEACHING_POLICY_PATH = PROMPTS_DIR / "teaching_policy.txt"

CORRECTION_MODE_INSTRUCTIONS: dict[str, str] = {
    "immediate": (
        "Correction mode: immediate. Correct high-value mistakes as part of "
        "this turn's response, but do not interrupt every minor mistake."
    ),
    "after_response": (
        "Correction mode: after_response. Let the student's meaning land "
        "first; deliver corrections as a distinct part of your reply rather "
        "than derailing the conversational flow."
    ),
    "end_of_session": (
        "Correction mode: end_of_session. Prioritize preserving conversational "
        "flow; only surface a correction now if it meaningfully blocks "
        "understanding."
    ),
}

TEACHER_STRICTNESS_INSTRUCTIONS: dict[str, str] = {
    "relaxed": (
        "Teacher strictness: relaxed. Correct only high-value mistakes; be "
        "generous with minor issues."
    ),
    "balanced": (
        "Teacher strictness: balanced. Correct clearly useful mistakes "
        "without nitpicking every minor issue."
    ),
    "strict": (
        "Teacher strictness: strict. Hold a higher bar for accuracy, but stay "
        "encouraging, never rude or pedantic."
    ),
}


def _load(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def _render_runtime_config_block(config: TeachingConfig) -> str:
    lines = [
        "Runtime teaching configuration:",
        CORRECTION_MODE_INSTRUCTIONS[config.correction_mode],
        TEACHER_STRICTNESS_INSTRUCTIONS[config.teacher_strictness],
        f"English exposure target: {config.english_exposure}%. "
        + (
            "Maximize understandable English; only use the student's native "
            "language when it materially improves understanding."
            if config.english_exposure >= 60
            else "You may use the student's native language for complex "
            "explanations, but do not make explanations incomprehensible."
        ),
        f"Target difficulty: currently {config.current_level}, working "
        f"toward {config.target_level}. Keep tasks slightly above the "
        "student's comfort level without unexplained jumps in complexity.",
        f"Offer at most {config.vocabulary_per_session} new vocabulary items "
        "across a full session — usually far fewer in a single turn.",
    ]
    return "\n".join(lines)


def _render_learner_context_block(learner: "LearnerRecord") -> str:
    lines = ["Learner context:", f"Native language: {learner.native_language}."]

    if learner.goals:
        lines.append(f"Stated goals: {learner.goals}")
    else:
        lines.append("No further learner history is available yet.")

    return "\n".join(lines)


def build_messages(
    config: TeachingConfig,
    learner: "LearnerRecord",
    recent_turns: list["TurnRecord"],
    transcription: str,
) -> list[dict[str, str]]:
    """Assemble the layered prompt: role -> policy -> runtime config ->
    learner context -> session history -> current task.

    Recent turns are rendered as real alternating user/assistant messages
    (the assistant side uses the spoken `response` text, not the raw
    structured JSON, so history reads as natural conversation rather than
    encouraging the model to echo JSON syntax back into its own reply text).
    """

    system_sections = [
        _load(ROLE_PROMPT_PATH),
        _load(TEACHING_POLICY_PATH),
        _render_runtime_config_block(config),
        _render_learner_context_block(learner),
    ]
    messages: list[dict[str, str]] = [
        {"role": "system", "content": "\n\n".join(system_sections)}
    ]

    for turn in recent_turns:
        messages.append({"role": "user", "content": turn.transcription})
        messages.append({"role": "assistant", "content": turn.teacher_output.response})

    messages.append({"role": "user", "content": transcription})
    return messages
