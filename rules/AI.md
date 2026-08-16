# AI Engineering Rules

## Scope

Apply these rules whenever implementing prompts, model calls, agent orchestration, learner memory, evaluations, or generated teaching content.

## Runtime configuration is not prompt policy

Do not hardcode mutable learner settings in prompts.

Examples of runtime settings:

- current level;
- target level;
- correction mode;
- teacher strictness;
- English exposure;
- session duration;
- skill focus;
- vocabulary target.

Pass them as validated runtime context.

## Student data

Do not hardcode student-specific information in source-controlled prompt text.

Only provide agents with the learner information required for the current task.

## Agent boundaries

Each agent must have:

- one primary responsibility;
- documented inputs;
- documented outputs;
- explicit non-responsibilities.

Do not create a new agent merely because a new prompt is needed.

## State mutation

Agents should normally produce evidence or recommendations rather than directly mutating persistent progress.

Persistent changes must pass application validation.

## Structured output

When output controls application behavior:

- define a schema;
- validate every response;
- handle invalid output explicitly;
- avoid parsing important decisions from prose with fragile string matching.

## Prompt maintenance

- Keep shared pedagogical rules centralized.
- Avoid duplicated prompt fragments with slightly different wording.
- Keep prompts concise enough to understand and test.
- Version behavior when a prompt change can materially affect stored evaluation semantics.

## Hallucination control

Agents must not claim:

- a student mastered content without evidence;
- a pronunciation problem that was not observable;
- a score based on evidence they did not receive;
- remembered history that was not supplied.

## Model-provider isolation

Business logic should not depend unnecessarily on one provider's response object.

Prefer a provider adapter or service boundary for model-specific details.

## Testing

Test:

- context assembly;
- schema validation;
- agent routing;
- configuration precedence;
- failure handling;
- representative teaching scenarios.

Live-model tests should not be the only protection for critical behavior.
