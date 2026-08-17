from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from backend.config import PROMPTS_DIR
from backend.schemas.teaching_config import TeachingConfig

if TYPE_CHECKING:
    from backend.storage.learner_repository import LearnerRecord
    from backend.storage.turn_repository import TurnRecord

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


LEVEL_SPEAKING_GUIDANCE: dict[str, str] = {
    "A1": (
        "Use very short, simple sentences (roughly 5-10 words). Stick to "
        "common, everyday words a total beginner would know. Use only "
        "simple present and simple past. No phrasal verbs, no idioms, no "
        "compound or complex sentences."
    ),
    "A2": (
        "Use short, simple sentences. Stick to common everyday vocabulary "
        "and basic tenses (present, past, 'going to' future). Avoid idioms "
        "and complex grammar; keep each sentence to one main idea."
    ),
    "B1": (
        "Use everyday vocabulary and moderately simple sentences. Basic "
        "idioms and a normal range of common tenses are fine, but avoid "
        "dense or highly complex phrasing."
    ),
    "B2": (
        "Use natural, moderately complex sentences and everyday idioms. A "
        "wider range of vocabulary and tenses is fine — talk the way you "
        "would with a confident non-native speaker."
    ),
    "C1": (
        "Use natural, fluent English with a rich vocabulary, idioms, and "
        "varied sentence structures — the way you'd actually talk to a "
        "strong English speaker."
    ),
    "C2": (
        "Speak completely naturally, as you would with a native speaker — "
        "full range of vocabulary, idiom, nuance, and complexity, no "
        "simplification at all."
    ),
}


def _load(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def _render_difficulty_line(config: TeachingConfig) -> str:
    if config.current_level == config.target_level:
        guidance = LEVEL_SPEAKING_GUIDANCE[config.current_level]
        return (
            f"Target difficulty: hold this whole conversation at "
            f"{config.current_level} level. {guidance}"
        )
    return (
        f"Target difficulty: currently {config.current_level}, working "
        f"toward {config.target_level}. Keep tasks slightly above the "
        "student's comfort level without unexplained jumps in complexity."
    )


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
        _render_difficulty_line(config),
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


def _ends_in_question(text: str) -> bool:
    return text.strip().endswith("?")


def _last_replies_were_all_questions(recent_turns: list["TurnRecord"], count: int = 2) -> bool:
    """True when the tutor's own last `count` replies all ended in a question.

    Prose instructions alone ("don't ask a question every turn") were not
    enough to reliably break the model's default pattern — this checks the
    actual conversation state in code and, when triggered, injects an
    explicit one-turn reminder instead of relying on the model to notice on
    its own.
    """

    if len(recent_turns) < count:
        return False
    return all(_ends_in_question(turn.teacher_output.response) for turn in recent_turns[-count:])


def build_messages(
    config: TeachingConfig,
    learner: "LearnerRecord",
    recent_turns: list["TurnRecord"],
    transcription: str,
    tutor_name: str = "Emma",
    tutor_behavior_prompt: str = "",
) -> list[dict[str, str]]:
    """Assemble the layered prompt: role -> tutor personality -> policy ->
    runtime config -> learner context -> session history -> current task.

    Recent turns are rendered as real alternating user/assistant messages
    (the assistant side uses the spoken `response` text, not the raw
    structured JSON, so history reads as natural conversation rather than
    encouraging the model to echo JSON syntax back into its own reply text).
    """

    system_sections = [
        _load(ROLE_PROMPT_PATH),
        f"Your own name is {tutor_name} — that's who you are, the tutor. If "
        f"the student asks your name, answer naturally as {tutor_name} — "
        "never describe yourself as an AI, a bot, or a language model. Never "
        "use this name to address the student — you don't know the "
        "student's name unless they've told you theirs.",
        tutor_behavior_prompt,
        _load(TEACHING_POLICY_PATH),
        _render_runtime_config_block(config),
        _render_learner_context_block(learner),
    ]
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": "\n\n".join(section for section in system_sections if section),
        }
    ]

    for turn in recent_turns:
        messages.append({"role": "user", "content": turn.transcription})
        messages.append({"role": "assistant", "content": turn.teacher_output.response})

    if _last_replies_were_all_questions(recent_turns):
        messages.append(
            {
                "role": "system",
                "content": (
                    "Reminder: your last two replies both ended in a question. "
                    "This time, do NOT end your response with a question — "
                    "react with an observation, an opinion, or a "
                    "reformulation instead."
                ),
            }
        )

    messages.append({"role": "user", "content": transcription})
    return messages
