from __future__ import annotations

from dataclasses import dataclass

DEFAULT_TUTOR_ID = "emma"


@dataclass(frozen=True)
class TutorProfile:
    id: str
    name: str
    accent: str
    voice_id: str
    lang_code: str


TUTOR_CATALOG: dict[str, TutorProfile] = {
    profile.id: profile
    for profile in (
        TutorProfile(id="emma", name="Emma", accent="American", voice_id="af_heart", lang_code="a"),
        TutorProfile(id="james", name="James", accent="British", voice_id="bm_george", lang_code="b"),
        TutorProfile(id="sophia", name="Sophia", accent="British", voice_id="bf_emma", lang_code="b"),
        TutorProfile(id="michael", name="Michael", accent="American", voice_id="am_michael", lang_code="a"),
        TutorProfile(id="nicole", name="Nicole", accent="American", voice_id="af_nicole", lang_code="a"),
    )
}


def get_tutor(tutor_id: str | None) -> TutorProfile:
    """Resolve a learner's stored tutor_id to a profile, falling back to the default."""

    if tutor_id and tutor_id in TUTOR_CATALOG:
        return TUTOR_CATALOG[tutor_id]
    return TUTOR_CATALOG[DEFAULT_TUTOR_ID]


def list_tutors() -> list[TutorProfile]:
    return list(TUTOR_CATALOG.values())
