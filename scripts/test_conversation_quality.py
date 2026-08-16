"""Live, qualitative conversation tests against a real Ollama instance.

Not part of `unittest discover` (see tests/) on purpose: these exercise the
actual LLM over the network and their point is naturalness, which is a
judgment call, not something a boolean assertion can fully capture. Tests 4
and 5 below do assert objective properties (question ratio, response
uniqueness); tests 1-3 print full transcripts for manual review, with a
soft heuristic flagged rather than a hard pass/fail.

Usage:
    OLLAMA_BASE_URL=http://soulblue-desktop:11434 venv/bin/python scripts/test_conversation_quality.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("OLLAMA_BASE_URL", "http://soulblue-desktop:11434")

from backend.schemas.teaching_config import DEFAULT_TEACHING_CONFIG  # noqa: E402
from backend.schemas.teacher_output import TeacherReply  # noqa: E402
from backend.services.tutor_service import TutorService  # noqa: E402
from backend.storage.learner_repository import LearnerRecord  # noqa: E402
from backend.storage.turn_repository import TurnRecord  # noqa: E402
from backend.tutors import list_tutors  # noqa: E402


def make_learner() -> LearnerRecord:
    return LearnerRecord(
        learner_id="qa",
        display_name=None,
        native_language="es",
        current_level="B1",
        target_level="B2",
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


def make_turn(index: int, transcription: str, reply: TeacherReply) -> TurnRecord:
    return TurnRecord(
        turn_id=index,
        session_id="qa",
        turn_index=index,
        created_at="2026-01-01T00:00:00+00:00",
        transcription=transcription,
        teacher_output=reply,
        voice_response=reply.response,
        whisper_elapsed_seconds=None,
        ollama_elapsed_seconds=None,
        tts_elapsed_seconds=None,
    )


def converse(
    service: TutorService,
    learner: LearnerRecord,
    history: list[TurnRecord],
    transcription: str,
    tutor_name: str,
    tutor_behavior_prompt: str,
) -> TurnRecord:
    result = service.ask(
        transcription,
        DEFAULT_TEACHING_CONFIG,
        learner,
        history,
        tutor_name=tutor_name,
        tutor_behavior_prompt=tutor_behavior_prompt,
    )
    return make_turn(len(history) + 1, transcription, result.structured)


def print_header(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def test_1_continuity(service: TutorService, learner: LearnerRecord) -> None:
    print_header("TEST 1 — CONTINUITY")
    emma = next(t for t in list_tutors() if t.id == "emma")
    history: list[TurnRecord] = []

    turn1 = converse(
        service, learner, history,
        "I was really tired yesterday because I worked too much.",
        emma.name, emma.behavior_prompt,
    )
    print(f"Student: I was really tired yesterday because I worked too much.")
    print(f"Emma:    {turn1.teacher_output.response}")
    history.append(turn1)

    turn2 = converse(
        service, learner, history,
        "Today is much better.",
        emma.name, emma.behavior_prompt,
    )
    print(f"Student: Today is much better.")
    print(f"Emma:    {turn2.teacher_output.response}")

    markers = ["yesterday", "tired", "rest", "relief", "better than", "compared"]
    hit = any(marker in turn2.teacher_output.response.lower() for marker in markers)
    print(f"\n[heuristic] continuity marker found: {hit} (manual review still recommended)")


def test_2_natural_correction(service: TutorService, learner: LearnerRecord) -> None:
    print_header("TEST 2 — NATURAL CORRECTION")
    emma = next(t for t in list_tutors() if t.id == "emma")
    result = service.ask(
        "Yesterday I go to the office.",
        DEFAULT_TEACHING_CONFIG, learner, [],
        tutor_name=emma.name, tutor_behavior_prompt=emma.behavior_prompt,
    )
    print(f"Student: Yesterday I go to the office.")
    print(f"Emma:    {result.response}")
    print(f"has_corrections: {result.structured.has_corrections}")
    print(f"natural_version: {result.natural_version}")
    went_modeled = "went" in result.response.lower() or "went" in result.natural_version.lower()
    print(f"\n[heuristic] 'went' modeled somewhere: {went_modeled} (manual review still recommended)")


def test_3_no_unnecessary_correction(service: TutorService, learner: LearnerRecord) -> None:
    print_header("TEST 3 — NO UNNECESSARY CORRECTION")
    emma = next(t for t in list_tutors() if t.id == "emma")
    result = service.ask(
        "I stayed home last night and watched a movie.",
        DEFAULT_TEACHING_CONFIG, learner, [],
        tutor_name=emma.name, tutor_behavior_prompt=emma.behavior_prompt,
    )
    print(f"Student: I stayed home last night and watched a movie.")
    print(f"Emma:    {result.response}")
    print(f"has_corrections: {result.structured.has_corrections}")
    if result.structured.has_corrections:
        print(f"[WARNING] Correction(s) invented for a clean sentence: {result.corrections}")
    else:
        print("[ok] No correction invented, as expected.")


def test_4_no_interview_behavior(service: TutorService, learner: LearnerRecord) -> None:
    print_header("TEST 4 — NO INTERVIEW BEHAVIOR (6 turns)")
    sophia = next(t for t in list_tutors() if t.id == "sophia")
    history: list[TurnRecord] = []
    student_lines = [
        "I had a pretty normal day today.",
        "I work as a software developer, actually.",
        "Yeah, it's mostly backend work, some APIs.",
        "Honestly, debugging is my least favorite part.",
        "I usually just take a walk to clear my head.",
        "There's a park near my apartment that I like.",
    ]

    question_endings = 0
    for line in student_lines:
        turn = converse(service, learner, history, line, sophia.name, sophia.behavior_prompt)
        print(f"Student: {line}")
        print(f"Sophia:  {turn.teacher_output.response}")
        if turn.teacher_output.response.strip().endswith("?"):
            question_endings += 1
        history.append(turn)

    print(f"\nResponses ending in a question: {question_endings}/6")
    if question_endings == 6:
        print("[FAIL] Every single response ended with a question — interview behavior.")
    else:
        print("[PASS] Not every response ended with a question.")


def test_5_tutor_differentiation(service: TutorService, learner: LearnerRecord) -> None:
    print_header("TEST 5 — TUTOR DIFFERENTIATION")
    message = (
        "I had a difficult meeting at work today and I don't think I "
        "explained my idea very well."
    )
    responses: dict[str, str] = {}
    for tutor in list_tutors():
        result = service.ask(
            message, DEFAULT_TEACHING_CONFIG, learner, [],
            tutor_name=tutor.name, tutor_behavior_prompt=tutor.behavior_prompt,
        )
        responses[tutor.name] = result.response
        print(f"\n{tutor.name} ({tutor.specialty}):")
        print(f"  {result.response}")

    unique = len(set(responses.values()))
    print(f"\nUnique responses: {unique}/{len(responses)}")
    if unique == len(responses):
        print("[PASS] All five tutors produced distinct responses.")
    else:
        print("[FAIL] Two or more tutors produced an identical response.")


def main() -> None:
    service = TutorService()
    if not service.check_health():
        print(f"Ollama at {os.environ['OLLAMA_BASE_URL']} is not reachable. Aborting.")
        sys.exit(1)

    learner = make_learner()
    test_1_continuity(service, learner)
    test_2_natural_correction(service, learner)
    test_3_no_unnecessary_correction(service, learner)
    test_4_no_interview_behavior(service, learner)
    test_5_tutor_differentiation(service, learner)


if __name__ == "__main__":
    main()
