const progressErrorEl = document.getElementById("progressError");
const progressLoadingEl = document.getElementById("progressLoading");
const progressContentEl = document.getElementById("progressContent");

const rangeFilterEl = document.getElementById("rangeFilter");
const statsRowEl = document.getElementById("statsRow");

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

const SVG_NS = "http://www.w3.org/2000/svg";
const CHART_W = 640;
const CHART_H = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;

const state = {
  allTurns: [],
  range: "all",
};

/* ---------- formatting & parsing helpers ---------- */

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

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function shortDayLabel(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isClean(correctionsText) {
  const normalized = (correctionsText || "").trim();
  return !normalized || /^no important corrections\.?$/i.test(normalized);
}

function parseVocabulary(text) {
  const normalized = (text || "").trim();
  if (!normalized || /^no vocabulary suggestion provided\.?$/i.test(normalized)) {
    return null;
  }

  const [term, ...rest] = normalized.split(/\n+/).map((line) => line.trim());
  return { term, description: rest.join(" ") };
}

function parseCorrections(text) {
  const normalized = (text || "").trim();
  if (isClean(normalized)) {
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

/* ---------- range filtering ---------- */

function rangeToDays(range) {
  if (range === "7" || range === "30" || range === "90") {
    return Number(range);
  }
  return null;
}

function filteredTurns() {
  const days = rangeToDays(state.range);
  if (days === null) {
    return state.allTurns;
  }

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return state.allTurns.filter((turn) => new Date(turn.created_at) >= cutoff);
}

/* ---------- streak (always computed from full history) ---------- */

function localDayNumber(date) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / oneDay);
}

function computeStreaks(turns) {
  const dayNumbers = Array.from(
    new Set(turns.map((turn) => localDayNumber(new Date(turn.created_at)))),
  ).sort((a, b) => a - b);

  if (dayNumbers.length === 0) {
    return { current: 0, longest: 0 };
  }

  let longest = 1;
  let run = 1;

  for (let i = 1; i < dayNumbers.length; i += 1) {
    run = dayNumbers[i] - dayNumbers[i - 1] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayNumber = localDayNumber(new Date());
  const lastDayNumber = dayNumbers[dayNumbers.length - 1];

  let current = 0;
  if (todayNumber - lastDayNumber <= 1) {
    current = 1;
    for (let i = dayNumbers.length - 1; i > 0; i -= 1) {
      if (dayNumbers[i] - dayNumbers[i - 1] === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}

/* ---------- stat tiles ---------- */

function renderStats(turns) {
  const vocabCount = buildVocabulary(turns).length;
  const sessionCount = new Set(turns.map((turn) => turn.session_id)).size;
  const cleanCount = turns.filter((turn) => isClean(turn.corrections)).length;
  const cleanRate = turns.length > 0 ? Math.round((cleanCount / turns.length) * 100) : 0;
  const { current } = computeStreaks(state.allTurns);

  const tiles = [
    { value: String(turns.length), label: "Turns practiced" },
    { value: String(sessionCount), label: "Sessions" },
    { value: `${cleanRate}%`, label: "Clean sentence rate" },
    { value: String(vocabCount), label: "Words learned" },
    { value: String(current), label: "Day streak" },
  ];

  statsRowEl.innerHTML = "";
  tiles.forEach((tile) => {
    const chip = document.createElement("div");
    chip.className = "stat-chip";

    const value = document.createElement("div");
    value.className = "stat-value";
    value.textContent = tile.value;

    const label = document.createElement("div");
    label.className = "stat-label";
    label.textContent = tile.label;

    chip.append(value, label);
    statsRowEl.appendChild(chip);
  });
}

/* ---------- bucketing for charts ---------- */

function buildDailyBuckets(turns, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    buckets.push({
      date,
      label: shortDayLabel(date),
      shortLabel: shortDayLabel(date),
      count: 0,
      cleanCount: 0,
    });
  }

  const byKey = new Map(buckets.map((bucket) => [dayKey(bucket.date), bucket]));

  turns.forEach((turn) => {
    const d = new Date(turn.created_at);
    const bucket = byKey.get(dayKey(d));
    if (bucket) {
      bucket.count += 1;
      if (isClean(turn.corrections)) {
        bucket.cleanCount += 1;
      }
    }
  });

  return buckets;
}

function buildWeeklyBuckets(turns, weeks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - i * 7 - 6);
    const endExclusive = new Date(start);
    endExclusive.setDate(endExclusive.getDate() + 7);
    const lastDay = new Date(endExclusive);
    lastDay.setDate(lastDay.getDate() - 1);

    buckets.push({
      start,
      endExclusive,
      label: `${shortDayLabel(start)} - ${shortDayLabel(lastDay)}`,
      shortLabel: shortDayLabel(start),
      count: 0,
      cleanCount: 0,
    });
  }

  turns.forEach((turn) => {
    const d = new Date(turn.created_at);
    const bucket = buckets.find((b) => d >= b.start && d < b.endExclusive);
    if (bucket) {
      bucket.count += 1;
      if (isClean(turn.corrections)) {
        bucket.cleanCount += 1;
      }
    }
  });

  return buckets;
}

function buildBuckets(turns) {
  const days = rangeToDays(state.range);

  if (days === 7 || days === 30) {
    return { buckets: buildDailyBuckets(turns, days), granularity: "day" };
  }

  if (days === 90) {
    return { buckets: buildWeeklyBuckets(turns, 13), granularity: "week" };
  }

  // "all time": weekly buckets spanning from the earliest turn, capped at ~1 year.
  const oldest = state.allTurns.length
    ? state.allTurns.reduce(
        (min, turn) => Math.min(min, new Date(turn.created_at).getTime()),
        Date.now(),
      )
    : Date.now();
  const spanWeeks = Math.max(1, Math.ceil((Date.now() - oldest) / (7 * 24 * 60 * 60 * 1000)) + 1);
  const weeks = Math.min(52, spanWeeks);

  return { buckets: buildWeeklyBuckets(turns, weeks), granularity: "week" };
}

/* ---------- shared chart building blocks ---------- */

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

function niceMax(value) {
  if (value <= 0) {
    return 4;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  let niceResidual = 10;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;

  return niceResidual * magnitude;
}

function shouldShowXLabel(index, total) {
  if (total <= 8) {
    return true;
  }

  const step = Math.ceil(total / 6);
  return index === 0 || index === total - 1 || index % step === 0;
}

function roundedTopPath(x, yTop, width, height, radius) {
  if (height <= 0) {
    return "";
  }

  const yBottom = yTop + height;
  const r = Math.max(0, Math.min(radius, width / 2, height));

  return [
    `M ${x} ${yBottom}`,
    `L ${x} ${yTop + r}`,
    `Q ${x} ${yTop} ${x + r} ${yTop}`,
    `L ${x + width - r} ${yTop}`,
    `Q ${x + width} ${yTop} ${x + width} ${yTop + r}`,
    `L ${x + width} ${yBottom}`,
    "Z",
  ].join(" ");
}

let chartTooltipEl = null;

function getTooltip() {
  if (!chartTooltipEl) {
    chartTooltipEl = document.createElement("div");
    chartTooltipEl.className = "chart-tooltip";
    chartTooltipEl.hidden = true;
    document.body.appendChild(chartTooltipEl);
  }
  return chartTooltipEl;
}

function showTooltip(clientX, clientY, valueText, labelText) {
  const tooltip = getTooltip();
  tooltip.innerHTML = "";

  const value = document.createElement("div");
  value.className = "chart-tooltip-value";
  value.textContent = valueText;

  const label = document.createElement("div");
  label.className = "chart-tooltip-label";
  label.textContent = labelText;

  tooltip.append(value, label);
  tooltip.style.left = `${clientX}px`;
  tooltip.style.top = `${clientY}px`;
  tooltip.hidden = false;
}

function hideTooltip() {
  if (chartTooltipEl) {
    chartTooltipEl.hidden = true;
  }
}

function drawGridlines(svg, baselineY, plotH, formatTick) {
  [0, 0.5, 1].forEach((fraction) => {
    const y = baselineY - plotH * fraction;
    svg.appendChild(
      svgEl("line", {
        x1: PAD_LEFT,
        x2: CHART_W - PAD_RIGHT,
        y1: y,
        y2: y,
        class: "chart-gridline",
      }),
    );

    const label = svgEl("text", {
      x: PAD_LEFT - 8,
      y: y + 4,
      class: "chart-axis-label",
      "text-anchor": "end",
    });
    label.textContent = formatTick(fraction);
    svg.appendChild(label);
  });
}

/* ---------- activity bar chart ---------- */

function renderActivityChart(buckets) {
  const container = document.getElementById("activityChart");
  container.innerHTML = "";

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + plotH;
  const maxCount = niceMax(Math.max(0, ...buckets.map((b) => b.count)));
  const slot = plotW / buckets.length;
  const barW = Math.min(24, slot * 0.6);

  const svg = svgEl("svg", {
    viewBox: `0 0 ${CHART_W} ${CHART_H}`,
    role: "img",
    "aria-label": "Turns practiced per period",
  });

  drawGridlines(svg, baselineY, plotH, (fraction) => String(Math.round(maxCount * fraction)));

  let peakIndex = 0;
  buckets.forEach((bucket, i) => {
    if (bucket.count > buckets[peakIndex].count) {
      peakIndex = i;
    }
  });

  buckets.forEach((bucket, i) => {
    const cx = PAD_LEFT + slot * i + slot / 2;
    const barHeight = maxCount > 0 ? (bucket.count / maxCount) * plotH : 0;
    const x = cx - barW / 2;
    const yTop = baselineY - barHeight;

    let bar = null;
    if (bucket.count > 0) {
      bar = svgEl("path", { d: roundedTopPath(x, yTop, barW, barHeight, 4), class: "chart-bar" });
      svg.appendChild(bar);
    }

    if (i === peakIndex && bucket.count > 0) {
      const peakLabel = svgEl("text", {
        x: cx,
        y: yTop - 6,
        class: "chart-bar-label",
        "text-anchor": "middle",
      });
      peakLabel.textContent = String(bucket.count);
      svg.appendChild(peakLabel);
    }

    if (shouldShowXLabel(i, buckets.length)) {
      const xLabel = svgEl("text", {
        x: cx,
        y: CHART_H - 6,
        class: "chart-axis-label",
        "text-anchor": "middle",
      });
      xLabel.textContent = bucket.shortLabel;
      svg.appendChild(xLabel);
    }

    const hit = svgEl("rect", {
      x: PAD_LEFT + slot * i,
      y: PAD_TOP,
      width: slot,
      height: plotH,
      class: "chart-hit",
    });

    const onHover = (event) => {
      bar?.classList.add("is-hovered");
      showTooltip(
        event.clientX,
        event.clientY,
        `${bucket.count} turn${bucket.count === 1 ? "" : "s"}`,
        bucket.label,
      );
    };
    hit.addEventListener("pointerenter", onHover);
    hit.addEventListener("pointermove", onHover);
    hit.addEventListener("pointerleave", () => {
      bar?.classList.remove("is-hovered");
      hideTooltip();
    });

    svg.appendChild(hit);
  });

  container.appendChild(svg);
}

function renderActivityTable(buckets) {
  const wrap = document.getElementById("activityTableWrap");
  wrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "chart-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Period</th><th>Turns</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  buckets.forEach((bucket) => {
    const row = document.createElement("tr");
    const periodCell = document.createElement("td");
    periodCell.textContent = bucket.label;
    const countCell = document.createElement("td");
    countCell.textContent = String(bucket.count);
    row.append(periodCell, countCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
}

/* ---------- clean-rate trend line chart ---------- */

function renderCleanRateChart(buckets) {
  const container = document.getElementById("cleanRateChart");
  container.innerHTML = "";

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + plotH;
  const slot = plotW / buckets.length;

  const points = buckets.map((bucket, i) => ({
    ...bucket,
    index: i,
    rate: bucket.count > 0 ? (bucket.cleanCount / bucket.count) * 100 : null,
  }));

  const svg = svgEl("svg", {
    viewBox: `0 0 ${CHART_W} ${CHART_H}`,
    role: "img",
    "aria-label": "Clean sentence rate over time",
  });

  drawGridlines(svg, baselineY, plotH, (fraction) => `${Math.round(fraction * 100)}%`);

  const xFor = (i) => PAD_LEFT + slot * i + slot / 2;
  const yFor = (rate) => baselineY - (rate / 100) * plotH;

  const segments = [];
  let current = [];
  points.forEach((point) => {
    if (point.rate === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  });
  if (current.length) segments.push(current);

  segments.forEach((segment) => {
    if (segment.length > 1) {
      const linePath = segment
        .map((point, idx) => `${idx === 0 ? "M" : "L"} ${xFor(point.index)} ${yFor(point.rate)}`)
        .join(" ");
      const areaPath =
        `M ${xFor(segment[0].index)} ${baselineY} ` +
        segment.map((point) => `L ${xFor(point.index)} ${yFor(point.rate)}`).join(" ") +
        ` L ${xFor(segment[segment.length - 1].index)} ${baselineY} Z`;

      svg.appendChild(svgEl("path", { d: areaPath, class: "chart-area" }));
      svg.appendChild(svgEl("path", { d: linePath, class: "chart-line", fill: "none" }));
    }

    segment.forEach((point, idx) => {
      const isEnd = idx === segment.length - 1;
      svg.appendChild(
        svgEl("circle", {
          cx: xFor(point.index),
          cy: yFor(point.rate),
          r: isEnd ? 5 : 3,
          class: "chart-dot",
        }),
      );

      if (isEnd) {
        const label = svgEl("text", {
          x: xFor(point.index),
          y: yFor(point.rate) - 10,
          class: "chart-bar-label",
          "text-anchor": "middle",
        });
        label.textContent = `${Math.round(point.rate)}%`;
        svg.appendChild(label);
      }
    });
  });

  const crosshair = svgEl("line", {
    x1: 0,
    x2: 0,
    y1: PAD_TOP,
    y2: baselineY,
    class: "chart-crosshair",
  });
  crosshair.style.opacity = "0";
  svg.appendChild(crosshair);

  points.forEach((point, i) => {
    if (shouldShowXLabel(i, points.length)) {
      const xLabel = svgEl("text", {
        x: xFor(i),
        y: CHART_H - 6,
        class: "chart-axis-label",
        "text-anchor": "middle",
      });
      xLabel.textContent = point.shortLabel;
      svg.appendChild(xLabel);
    }

    const hit = svgEl("rect", {
      x: PAD_LEFT + slot * i,
      y: PAD_TOP,
      width: slot,
      height: plotH,
      class: "chart-hit",
    });

    const onHover = (event) => {
      crosshair.setAttribute("x1", String(xFor(point.index)));
      crosshair.setAttribute("x2", String(xFor(point.index)));
      crosshair.style.opacity = "1";
      const text = point.rate === null ? "No practice" : `${Math.round(point.rate)}% clean`;
      showTooltip(event.clientX, event.clientY, text, point.label);
    };
    hit.addEventListener("pointerenter", onHover);
    hit.addEventListener("pointermove", onHover);
    hit.addEventListener("pointerleave", () => {
      crosshair.style.opacity = "0";
      hideTooltip();
    });

    svg.appendChild(hit);
  });

  container.appendChild(svg);
}

function renderCleanRateTable(buckets) {
  const wrap = document.getElementById("cleanRateTableWrap");
  wrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "chart-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Period</th><th>Clean rate</th><th>Turns</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  buckets.forEach((bucket) => {
    const row = document.createElement("tr");
    const periodCell = document.createElement("td");
    periodCell.textContent = bucket.label;
    const rateCell = document.createElement("td");
    rateCell.textContent =
      bucket.count > 0 ? `${Math.round((bucket.cleanCount / bucket.count) * 100)}%` : "-";
    const countCell = document.createElement("td");
    countCell.textContent = String(bucket.count);
    row.append(periodCell, rateCell, countCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
}

/* ---------- vocabulary / corrections / practice log ---------- */

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
    if (turn.created_at < existing.firstSeenAt) existing.firstSeenAt = turn.created_at;
    if (turn.created_at > existing.lastSeenAt) existing.lastSeenAt = turn.created_at;
  });

  return Array.from(byTerm.values()).sort(
    (a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt),
  );
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

function buildCorrectionHistory(turns) {
  const history = [];
  turns.forEach((turn) => {
    parseCorrections(turn.corrections).forEach((item) => {
      history.push({ ...item, created_at: turn.created_at });
    });
  });
  return history;
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
    const youLabel = document.createElement("strong");
    youLabel.textContent = "You:";
    you.append(youLabel, ` ${turn.transcription}`);

    const emma = document.createElement("p");
    emma.className = "log-line";
    const emmaLabel = document.createElement("strong");
    emmaLabel.textContent = "Emma:";
    emma.append(emmaLabel, ` ${turn.response}`);

    entry.append(date, you, emma);
    practiceLogEl.appendChild(entry);
  });
}

/* ---------- render orchestration ---------- */

function render() {
  const turns = filteredTurns();

  renderStats(turns);

  const { buckets } = buildBuckets(turns);
  renderActivityChart(buckets);
  renderActivityTable(buckets);
  renderCleanRateChart(buckets);
  renderCleanRateTable(buckets);

  renderVocabulary(buildVocabulary(turns));
  renderCorrectionHistory(buildCorrectionHistory(turns));
  renderPracticeLog(turns);
}

rangeFilterEl.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-pill");
  if (!button) {
    return;
  }

  rangeFilterEl.querySelectorAll(".filter-pill").forEach((pill) => pill.classList.remove("is-active"));
  button.classList.add("is-active");
  state.range = button.dataset.range;
  render();
});

document.querySelectorAll(".table-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.target);
    if (!target) return;
    target.hidden = !target.hidden;
    button.classList.toggle("is-active", !target.hidden);
    button.textContent = target.hidden ? "View as table" : "Hide table";
  });
});

async function loadHistory() {
  try {
    const response = await fetch("/api/history?limit=500");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not load your learning history.");
    }

    state.allTurns = Array.isArray(data.turns) ? data.turns : [];

    progressLoadingEl.hidden = true;
    progressContentEl.hidden = false;
    render();
  } catch (error) {
    progressLoadingEl.hidden = true;
    progressErrorEl.hidden = false;
    progressErrorEl.textContent = error.message || "Could not load your learning history.";
  }
}

loadHistory();
