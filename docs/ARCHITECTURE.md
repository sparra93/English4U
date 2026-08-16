# English46 Architecture

## Architectural goals

The architecture should support:

- persistent learner context;
- multiple specialized AI capabilities;
- deterministic configuration;
- structured AI outputs;
- testable orchestration;
- replaceable model providers;
- clear separation between prompts, product rules, and business logic.

## Separation of concerns

### Product specifications

Files under `docs/` describe what the product should do.

### Engineering rules

Files under `rules/` tell Codex how implementation work should be performed.

### Runtime agent contracts

Files under `agents/` define AI responsibilities, inputs, outputs, and boundaries.

### Runtime configuration

User- or system-configurable behavior belongs in typed application configuration and persistence.

Examples:

- target CEFR level;
- correction mode;
- strictness;
- English exposure;
- session duration;
- vocabulary target;
- focus weights.

These values should not be encoded only in Markdown prompts.

## Recommended AI architecture

Prefer a small orchestration layer coordinating specialized capabilities over several agents independently modifying shared state.

Conceptually:

`Student Context -> Session Planner -> Teacher/Conversation -> Specialized Evaluation -> Learning Evidence -> Student Model`

Agents should return structured evidence. A central application layer should decide how persistent state changes.

## Agent state ownership

Runtime agents should not directly mutate persistent learner state unless the architecture explicitly provides a validated command for doing so.

Preferred pattern:

1. agent observes;
2. agent returns structured evidence;
3. application validates evidence;
4. application updates state.

## Prompt organization

Prompt assembly should distinguish:

- immutable role instructions;
- shared teaching policy;
- runtime configuration;
- learner context;
- current session context;
- current task.

Avoid copying the same large teaching policy into multiple independently maintained prompt strings.

## Structured output

Use structured output for data consumed by application logic, such as:

- evaluation;
- mistake classification;
- lesson planning;
- progress evidence;
- vocabulary candidates;
- next-action recommendations.

Free-form text is appropriate for student-facing conversation.

## Testing

AI orchestration should be testable without requiring every test to call a live model.

Prefer:

- interface boundaries;
- deterministic fixtures;
- schema validation;
- prompt assembly tests;
- agent contract tests;
- optional integration tests for real providers.
