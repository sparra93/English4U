# English46 Product Specification

## Product vision

English46 should behave like an intelligent private English teacher that builds an ongoing understanding of the student.

The system is not primarily a collection of independent exercises. Lessons, conversations, corrections, reviews, and evaluations should form one continuous learning journey.

## Primary outcomes

The product should help the student:

- improve speaking confidence and fluency;
- understand spoken English more reliably;
- expand usable vocabulary;
- improve grammar accuracy;
- improve pronunciation and natural phrasing;
- recognize recurring personal mistakes;
- retain previously learned material;
- progress toward explicit real-world or exam goals.

## Core experience

A normal learning cycle is:

1. Understand the learner and current goal.
2. Select an appropriate session objective.
3. Teach or activate the required language.
4. Make the learner produce English.
5. Observe mistakes and strengths.
6. Correct selectively.
7. Evaluate performance.
8. Save useful learning evidence.
9. Adapt future sessions.

## Product principles

### 1. Teacher-first experience

The interface and AI behavior should make the student feel guided by a teacher rather than navigating a catalog of disconnected features.

### 2. Continuity

The application should remember relevant learning history across sessions.

### 3. Adaptation

Lesson difficulty, feedback, topics, vocabulary, and correction behavior should respond to the learner.

### 4. Active production

Whenever pedagogically appropriate, prefer having the student speak, write, choose, explain, reformulate, or recall rather than passively read explanations.

### 5. Useful correction

Not every mistake deserves interruption. Feedback should consider the session goal, error severity, recurrence, configured correction mode, and learner level.

## Student model

The system should be capable of representing at least:

- current estimated CEFR level;
- target level;
- learning goals;
- preferred lesson duration;
- correction preference;
- teacher strictness;
- English exposure preference;
- known vocabulary;
- vocabulary being learned;
- recurring grammar mistakes;
- pronunciation issues;
- recent lesson history;
- skill-level estimates;
- confidence or mastery estimates where supported by evidence.

The exact persistence model belongs in the architecture and data model, not in prompts.

## Core learning domains

- Speaking
- Listening
- Grammar
- Vocabulary
- Pronunciation
- Reading
- Writing

A session may combine several domains but should have a clear primary objective.

## Non-goals

English46 should not:

- generate random exercises without learner context when context is available;
- assign progress scores without evidence;
- claim mastery from one successful answer;
- equate message length with learning quality;
- overwhelm the learner with corrections unrelated to the current objective.
