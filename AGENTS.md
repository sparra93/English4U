# English46 — Codex Project Instructions

## Purpose

English46 is an AI-powered English learning application designed to feel like a persistent private English teacher, not a generic exercise app.

The product should adapt to the student over time using their profile, goals, recent performance, mistakes, vocabulary history, and session context.

## How Codex should work in this repository

Before making non-trivial changes:

1. Read this file.
2. Read the relevant product or architecture specification in `docs/`.
3. Read the applicable engineering rules in `rules/`.
4. If the change affects AI behavior, read the relevant agent definition in `agents/`.
5. Inspect the existing implementation before proposing a replacement.
6. Prefer extending existing patterns over creating parallel abstractions.

Do not invent product behavior when it is already defined in the repository documentation.

## Source-of-truth hierarchy

When instructions conflict, use this order:

1. Explicit user request for the current task.
2. `AGENTS.md`.
3. Product and teaching specifications under `docs/`.
4. Engineering rules under `rules/`.
5. Agent contracts under `agents/`.
6. Existing implementation.

If a lower-level document conflicts with a higher-level document, stop and call out the conflict before implementing the change.

## Core product principles

- The experience must feel like a real 1:1 English teacher.
- Personalization is more important than generic content volume.
- The system should teach, observe, evaluate, remember, and adapt.
- The student should spend as much useful time producing English as possible.
- Corrections should improve learning without destroying conversational flow.
- Difficulty should be challenging but appropriate for the learner.
- Student progress must affect future lessons.
- AI output that drives application behavior should use structured data when practical.
- Deterministic business rules belong in code or configuration, not only in prompts.
- Prompt text must not contain hardcoded student-specific data.
- Avoid duplicated teaching rules across multiple agents.

## Repository conventions

Current high-level structure:

- `app/` — application code.
- `tests/` — automated tests.
- `docs/` — product, architecture, and teaching specifications.
- `rules/` — engineering implementation rules for Codex.
- `agents/` — runtime AI-agent responsibilities and contracts.

Existing root scripts and environment files should remain in place unless a task explicitly requires reorganizing them.

## Required checks

For every meaningful code change:

- Run the narrowest relevant tests first.
- Run the broader test suite when the change can affect shared behavior.
- Do not silently disable failing tests.
- Do not remove behavior merely to make a test pass.
- Document assumptions when requirements are incomplete.

## Definition of done

A task is complete only when:

- The requested behavior is implemented.
- Relevant tests are added or updated.
- Existing behavior is preserved unless intentionally changed.
- Product and engineering rules are respected.
- Documentation is updated when a contract, configuration option, or architectural decision changes.
