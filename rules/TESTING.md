# Testing Rules

## General

Every meaningful behavior change should have an appropriate test unless testing is impractical and the reason is documented.

## Test hierarchy

Prefer:

1. focused unit tests;
2. service or orchestration tests;
3. API/integration tests;
4. live-model tests only where necessary.

## AI-related tests

Use deterministic fixtures for:

- learner profiles;
- lesson plans;
- model outputs;
- evaluation results;
- error classification.

Validate schemas independently from live model quality.

## Regression tests

When fixing a bug, add a test that fails for the original bug whenever practical.

## Test behavior

Tests should assert domain behavior rather than internal implementation details when possible.

Do not weaken assertions solely to make a change pass.
