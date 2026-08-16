# Teaching Configuration Specification

## Purpose

This document defines the initial runtime parameters that should eventually exist as validated application configuration.

It is a specification, not the persistence implementation.

## Student/session parameters

### `current_level`

Type: enum

Values:

- `A1`
- `A2`
- `B1`
- `B2`
- `C1`
- `C2`

### `target_level`

Type: enum

Same CEFR values as `current_level`.

### `correction_mode`

Type: enum

Values:

- `immediate`
- `after_response`
- `end_of_session`

Default: `after_response`

### `teacher_strictness`

Type: enum

Values:

- `relaxed`
- `balanced`
- `strict`

Default: `balanced`

### `english_exposure`

Type: integer

Range: `0..100`

Default: `85`

### `session_duration_minutes`

Type: integer

Recommended values:

- `15`
- `30`
- `45`
- `60`

Default: `30`

### `vocabulary_per_session`

Type: integer

Recommended range: `3..12`

Default: `6`

## Skill focus

Represent skill focus as explicit normalized weights or a clearly documented priority model.

Candidate keys:

- `speaking`
- `listening`
- `grammar`
- `vocabulary`
- `pronunciation`
- `reading`
- `writing`

Do not bury skill priorities in natural-language prompts if the application needs to reason about them.

## Configuration precedence

Recommended precedence:

1. explicit session override;
2. learner preference;
3. learner-plan recommendation;
4. application default.

The implementation should make this precedence deterministic and testable.
