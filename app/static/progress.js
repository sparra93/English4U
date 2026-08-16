const statTurnsEl = document.getElementById("statTurns");
const statVocabEl = document.getElementById("statVocab");
const statSessionsEl = document.getElementById("statSessions");

const progressErrorEl = document.getElementById("progressError");
const progressLoadingEl = document.getElementById("progressLoading");

const vocabGridEl = document.getElementById("vocabGrid");
const vocabEmptyEl = document.getElementById("vocabEmpty");

const correctionsHistoryEl = document.getElementById("correctionsHistory");
const correctionsEmptyEl = document.getElementById("correctionsEmpty");

const practiceLogEl = document.getElementById("practiceLog");
const practiceLogEmptyEl = document.getElementById("practiceLogEmpty");

const ARROW_ICON = `
  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
    <path d="M4 12h14M13 7l5 5-5 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
  </svg>
`;

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseVocabulary(text) {
  const normalized = (text || "").trim();
  if (!normalized || /^no vocabulary suggestion provided\.?$/i.test(normalized)) {
    return null;
  }

  const [term, ...rest] = normalized.split(/\n+/).map((line) => line.trim());
  return {
    term,
    description: rest.join(" "),
  };
}

function parseCorrections(text) {
  const normalized = (text || "").trim();
  if (!normalized || /^no important corrections\.?$/i.test(normalized)) {
    return [];
  }

  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const items = [];

  for (let i = 0; i < lines.length; i += 2) {
    const correctionLine = lines[i];
    const explanation = lines[i + 1] || "";

    if (!correctionLine || !(correctionLine.includes("->") || correctionLine.includes("→"))) {
      continue;
    }

    const [original, corrected] = correctionLine.split(/->|→/).map((part) => part.trim());
    items.push({ original, corrected, explanation });
  }

  return items;
}

function buildVocabulary(turns) {
  const byTerm = new Map();

  turns.forEach((turn) => {
    const parsed = parseVocabulary(turn.vocabulary);
    if (!parsed || !parsed.term) {
      return;
    }

    const key = parsed.term.toLowerCase();
    const existing = byTerm.get(key);

    if (!existing) {
      byTerm.set(key, {
        term: parsed.term,
        description: parsed.description,
        timesSeen: 1,
        firstSeenAt: turn.created_at,
        lastSeenAt: turn.created_at,
      });
      return;
    }

    existing.timesSeen += 1;
    if (turn.created_at < existing.firstSeenAt) {
      existing.firstSeenAt = turn.created_at;
    }
    if (turn.created_at > existing.lastSeenAt) {
      existing.lastSeenAt = turn.created_at;
    }
  });

  return Array.from(byTerm.values()).sort(
    (a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt),
  );
}

function buildCorrectionHistory(turns) {
  const history = [];

  turns.forEach((turn) => {
    const items = parseCorrections(turn.corrections);
    items.forEach((item) => {
      history.push({ ...item, created_at: turn.created_at });
    });
  });

  return history;
}

function renderStats(turns, vocabulary) {
  statTurnsEl.textContent = String(turns.length);
  statVocabEl.textContent = String(vocabulary.length);
  statSessionsEl.textContent = String(new Set(turns.map((turn) => turn.session_id)).size);
}

function renderVocabulary(vocabulary) {
  vocabGridEl.innerHTML = "";
  vocabEmptyEl.hidden = vocabulary.length > 0;

  vocabulary.forEach((item) => {
    const card = document.createElement("article");
    card.className = "vocab-card-item";

    const term = document.createElement("span");
    term.className = "feedback-vocab-term";
    term.textContent = item.term;

    const description = document.createElement("p");
    description.textContent = item.description;

    const metaEl = document.createElement("p");
    metaEl.className = "vocab-meta";
    metaEl.textContent =
      item.timesSeen > 1
        ? `Seen ${item.timesSeen} times · last on ${formatDate(item.lastSeenAt)}`
        : `Learned on ${formatDate(item.firstSeenAt)}`;

    card.append(term, description, metaEl);
    vocabGridEl.appendChild(card);
  });
}

function renderCorrectionHistory(history) {
  correctionsHistoryEl.innerHTML = "";
  correctionsEmptyEl.hidden = history.length > 0;

  history.forEach((item) => {
    const entry = document.createElement("li");
    entry.className = "correction-entry";

    const row = document.createElement("div");
    row.className = "correction-row";

    const from = document.createElement("span");
    from.className = "correction-fragment";
    from.textContent = item.original;

    const arrow = document.createElement("span");
    arrow.className = "correction-arrow";
    arrow.innerHTML = ARROW_ICON;

    const to = document.createElement("span");
    to.className = "correction-fragment";
    to.textContent = item.corrected;

    row.append(from, arrow, to);

    const explanation = document.createElement("p");
    explanation.className = "correction-explanation";
    explanation.textContent = item.explanation;

    const date = document.createElement("p");
    date.className = "correction-date";
    date.textContent = formatDate(item.created_at);

    entry.append(row, explanation, date);
    correctionsHistoryEl.appendChild(entry);
  });
}

function renderPracticeLog(turns) {
  practiceLogEl.innerHTML = "";
  practiceLogEmptyEl.hidden = turns.length > 0;

  turns.forEach((turn) => {
    const entry = document.createElement("li");
    entry.className = "log-entry";

    const date = document.createElement("p");
    date.className = "log-date";
    date.textContent = formatDate(turn.created_at);

    const you = document.createElement("p");
    you.className = "log-line";
    you.innerHTML = `<strong>You:</strong> ${turn.transcription}`;

    const emma = document.createElement("p");
    emma.className = "log-line";
    emma.innerHTML = `<strong>Emma:</strong> ${turn.response}`;

    entry.append(date, you, emma);
    practiceLogEl.appendChild(entry);
  });
}

async function loadHistory() {
  try {
    const response = await fetch("/api/history?limit=300");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not load your learning history.");
    }

    const turns = Array.isArray(data.turns) ? data.turns : [];
    const vocabulary = buildVocabulary(turns);
    const correctionHistory = buildCorrectionHistory(turns);

    renderStats(turns, vocabulary);
    renderVocabulary(vocabulary);
    renderCorrectionHistory(correctionHistory);
    renderPracticeLog(turns);

    progressLoadingEl.hidden = true;
  } catch (error) {
    progressLoadingEl.hidden = true;
    progressErrorEl.hidden = false;
    progressErrorEl.textContent = error.message || "Could not load your learning history.";
  }
}

loadHistory();
