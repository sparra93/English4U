# General Engineering Rules

## Scope

These rules apply to all implementation work unless a more specific rule overrides them.

## Principles

- Understand the existing implementation before editing it.
- Prefer small, cohesive changes.
- Avoid speculative abstractions.
- Preserve existing behavior unless the task intentionally changes it.
- Do not duplicate business logic.
- Use clear names that describe domain intent.
- Keep configuration separate from code where runtime variation is expected.
- Validate inputs at system boundaries.
- Fail explicitly rather than silently swallowing important errors.
- Add comments for decisions and constraints, not for obvious syntax.

## Refactoring

Refactor when it materially helps the requested task, but do not turn a targeted task into an unrelated rewrite.

When replacing an existing path:

- identify all callers;
- preserve required behavior;
- migrate tests;
- remove obsolete code only after the replacement is verified.

## Dependencies

A new dependency is acceptable when it provides clear value and is actively maintained.

Before adding one:

- check whether the repository already has an equivalent capability;
- prefer a focused dependency over a large framework for a small problem;
- document why it is needed if the choice is non-obvious.

## Secrets

Never commit:

- API keys;
- access tokens;
- private certificates;
- production credentials.

Use `.env` locally and keep `.env.example` limited to safe placeholders.

## Documentation

Update documentation when changing:

- public configuration;
- architectural boundaries;
- runtime agent contracts;
- setup commands;
- externally visible behavior.
