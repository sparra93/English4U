# Python Rules

## Scope

Apply these rules to Python code.

## Code quality

- Prefer type hints for public functions and domain models.
- Keep functions focused on one responsibility.
- Prefer explicit domain objects over loosely structured dictionaries for important state.
- Avoid global mutable state.
- Keep side effects close to system boundaries.
- Use context managers for resources that require cleanup.

## Validation

Use explicit validation for data crossing boundaries, especially:

- API payloads;
- model output;
- persisted settings;
- environment-driven configuration.

If the project already uses a validation library, continue using it rather than introducing a competing one.

## Async

Use async only where the workload is genuinely asynchronous.

Do not mix blocking network or file operations into an async path without an explicit reason.

## Errors

- Raise meaningful domain or service errors.
- Preserve the original cause where useful.
- Do not catch broad exceptions merely to continue execution.
- Log enough context to diagnose failures without leaking secrets.

## Dependencies

Keep `requirements*.txt` consistent with the actual runtime boundary they represent.

Do not add a package to multiple requirement files unless it is truly needed in each environment.
