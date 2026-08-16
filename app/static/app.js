const recordButton = document.getElementById("recordButton");
const recordIcon = document.getElementById("recordIcon");
const recordLabel = document.getElementById("recordLabel");
const recordingTimeEl = document.getElementById("recordingTime");
const recordingWave = document.getElementById("recordingWave");
const statusMessage = document.getElementById("statusMessage");
const errorMessage = document.getElementById("errorMessage");
const responseAudio = document.getElementById("responseAudio");

const appStatus = document.getElementById("appStatus");
const appStatusLabel = document.getElementById("appStatusLabel");
const emptyState = document.getElementById("emptyState");
const conversationList = document.getElementById("conversationList");
const feedbackSection = document.getElementById("feedbackSection");

const correctionsEl = document.getElementById("corrections");
const naturalVersionEl = document.getElementById("naturalVersion");

const newSessionButton = document.getElementById("newSessionButton");
const sessionsListEl = document.getElementById("sessionsList");
const sessionsEmptyEl = document.getElementById("sessionsEmpty");

const SESSION_STORAGE_KEY = "english-ai-tutor-session";

const UI_STATE = {
  READY: "ready",
  RECORDING: "recording",
  PROCESSING: "processing",
  PLAYING: "playing",
  ERROR: "error",
};

const ICONS = {
  mic: `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 1 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
      <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3M8.5 20.5h7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
    </svg>
  `,
  stop: `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <rect x="7.5" y="7.5" width="9" height="9" rx="2" fill="currentColor"></rect>
    </svg>
  `,
  replay: `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M5.5 9.5V5.75L2.75 8.5 5.5 11.25V9.5h8a5 5 0 1 1-4.95 5.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
    </svg>
  `,
  check: `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m5.5 12.5 4.2 4.2 8.8-9.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
    </svg>
  `,
  arrow: `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M4 12h14M13 7l5 5-5 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
    </svg>
  `,
  kebab: `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.7" fill="currentColor"/>
      <circle cx="12" cy="19" r="1.7" fill="currentColor"/>
    </svg>
  `,
};

const state = {
  uiState: UI_STATE.READY,
  mediaRecorder: null,
  mediaStream: null,
  recordedChunks: [],
  recordingStartedAt: 0,
  recordingTimerId: null,
  messages: [],
  currentAudioUrl: "",
  latestFeedback: null,
  sessionId: "",
};

function ensureSessionId() {
  if (!state.sessionId && window.crypto && typeof window.crypto.randomUUID === "function") {
    state.sessionId = window.crypto.randomUUID();
    saveSessionState();
  }
}

function loadSessionState() {
  try {
    const rawSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) {
      return;
    }

    const parsed = JSON.parse(rawSession);

    if (Array.isArray(parsed.messages)) {
      state.messages = parsed.messages.filter(
        (message) =>
          message &&
          (message.role === "student" || message.role === "teacher") &&
          typeof message.text === "string",
      );
    }

    if (parsed.latestFeedback && typeof parsed.latestFeedback === "object") {
      state.latestFeedback = parsed.latestFeedback;
    }

    if (typeof parsed.sessionId === "string" && parsed.sessionId) {
      state.sessionId = parsed.sessionId;
    }
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function saveSessionState() {
  const snapshot = {
    messages: state.messages,
    latestFeedback: state.latestFeedback,
    sessionId: state.sessionId,
  };

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures so lesson flow continues normally.
  }
}

function setStatus(message, uiState = state.uiState) {
  state.uiState = uiState;
  statusMessage.textContent = message;
  appStatus.dataset.state = uiState;

  appStatusLabel.textContent = {
    [UI_STATE.READY]: "Session Ready",
    [UI_STATE.RECORDING]: "Listening",
    [UI_STATE.PROCESSING]: "Tutor Responding",
    [UI_STATE.PLAYING]: "Lesson Audio",
    [UI_STATE.ERROR]: "Attention Needed",
  }[uiState];

  recordingWave.dataset.active = String(uiState === UI_STATE.RECORDING);
  updateRecordButton();
}

function showError(message) {
  errorMessage.hidden = !message;
  errorMessage.textContent = message || "";

  if (message) {
    setStatus("Please try again when you are ready.", UI_STATE.ERROR);
  }
}

function hideError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startRecordingTimer() {
  stopRecordingTimer();
  state.recordingStartedAt = Date.now();
  recordingTimeEl.textContent = "00:00";

  state.recordingTimerId = window.setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - state.recordingStartedAt) / 1000);
    recordingTimeEl.textContent = formatDuration(elapsedSeconds);
  }, 250);
}

function stopRecordingTimer() {
  if (!state.recordingTimerId) {
    return;
  }

  window.clearInterval(state.recordingTimerId);
  state.recordingTimerId = null;
}

function updateRecordButton() {
  const isRecording = state.uiState === UI_STATE.RECORDING;
  const isBusy = state.uiState === UI_STATE.PROCESSING || state.uiState === UI_STATE.PLAYING;

  recordButton.disabled = isBusy;
  recordButton.dataset.mode = state.uiState;
  recordButton.setAttribute("aria-pressed", String(isRecording));

  if (isRecording) {
    recordButton.setAttribute("aria-label", "Stop recording");
    recordLabel.textContent = "Listening...";
    recordIcon.innerHTML = ICONS.stop;
    return;
  }

  recordButton.setAttribute("aria-label", "Start recording");
  recordIcon.innerHTML = ICONS.mic;

  if (state.uiState === UI_STATE.PROCESSING) {
    recordLabel.textContent = "Preparing feedback...";
  } else if (state.uiState === UI_STATE.PLAYING) {
    recordLabel.textContent = "Tutor is speaking";
  } else {
    recordLabel.textContent = "Tap to speak";
  }
}

function stopStreamTracks() {
  if (!state.mediaStream) {
    return;
  }

  state.mediaStream.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
}

function detectMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find(
    (candidate) => window.MediaRecorder && MediaRecorder.isTypeSupported(candidate),
  ) || "";
}

function extensionFromMimeType(mimeType) {
  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

function createMessage(role, text, audioUrl = "") {
  return {
    role,
    text,
    audioUrl,
  };
}

let typingIndicatorEl = null;

function showTypingIndicator() {
  hideTypingIndicator();
  emptyState.hidden = true;

  const item = document.createElement("li");
  item.className = "message teacher typing-indicator";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "EM";

  const body = document.createElement("div");
  body.className = "message-body";

  const bubble = document.createElement("div");
  bubble.className = "message-copy typing-bubble";
  bubble.innerHTML = "<span></span><span></span><span></span>";

  body.appendChild(bubble);
  item.append(avatar, body);
  conversationList.appendChild(item);
  typingIndicatorEl = item;

  window.requestAnimationFrame(() => {
    item.scrollIntoView({ block: "end", behavior: "smooth" });
  });
}

function hideTypingIndicator() {
  if (typingIndicatorEl) {
    typingIndicatorEl.remove();
    typingIndicatorEl = null;
  }
}

function renderConversation() {
  conversationList.innerHTML = "";
  emptyState.hidden = state.messages.length > 0;

  state.messages.forEach((message, index) => {
    const item = document.createElement("li");
    item.className = `message ${message.role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.role === "teacher" ? "EM" : "You";

    const body = document.createElement("div");
    body.className = "message-body";

    const label = document.createElement("div");
    label.className = "message-label";
    label.innerHTML =
      message.role === "teacher"
        ? "<strong>Emma</strong><span>Private English Tutor</span>"
        : "<strong>You</strong>";

    const copy = document.createElement("div");
    copy.className = "message-copy";
    copy.textContent = message.text;

    body.append(label, copy);

    if (message.role === "teacher" && message.audioUrl) {
      const actions = document.createElement("div");
      actions.className = "message-actions";

      const replayButton = document.createElement("button");
      replayButton.type = "button";
      replayButton.className = "message-action";
      replayButton.dataset.audioUrl = message.audioUrl;
      replayButton.setAttribute("aria-label", "Replay tutor response");
      replayButton.innerHTML = `<span aria-hidden="true">${ICONS.replay}</span><span>Replay response</span>`;

      actions.appendChild(replayButton);
      body.appendChild(actions);
    }

    item.append(avatar, body);
    conversationList.appendChild(item);

    if (index === state.messages.length - 1) {
      window.requestAnimationFrame(() => {
        item.scrollIntoView({ block: "end", behavior: "smooth" });
      });
    }
  });
}

function createParagraphBlock(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "feedback-copy";

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    const paragraph = document.createElement("p");
    paragraph.textContent = lines[0] || text.trim();
    wrapper.appendChild(paragraph);
    return wrapper;
  }

  const list = document.createElement("ul");
  list.className = "feedback-list";

  lines.forEach((line) => {
    const item = document.createElement("li");

    if (line.includes("->") || line.includes("→")) {
      const [fromText, toText] = line.split(/->|→/).map((part) => part.trim());
      const row = document.createElement("div");
      row.className = "correction-row";

      const from = document.createElement("span");
      from.className = "correction-fragment";
      from.textContent = fromText;

      const arrow = document.createElement("span");
      arrow.className = "correction-arrow";
      arrow.innerHTML = ICONS.arrow;

      const to = document.createElement("span");
      to.className = "correction-fragment";
      to.textContent = toText;

      row.append(from, arrow, to);
      item.appendChild(row);
    } else {
      item.textContent = line;
    }

    list.appendChild(item);
  });

  wrapper.appendChild(list);
  return wrapper;
}

function renderCorrections(text) {
  correctionsEl.innerHTML = "";
  const normalized = (text || "").trim();

  if (!normalized || /^no important corrections\.?$/i.test(normalized)) {
    const ok = document.createElement("div");
    ok.className = "feedback-check";
    ok.innerHTML = `<span aria-hidden="true">${ICONS.check}</span><span>Great sentence. No important corrections.</span>`;
    correctionsEl.appendChild(ok);
    return;
  }

  correctionsEl.appendChild(createParagraphBlock(normalized));
}

function renderNaturalVersion(text) {
  naturalVersionEl.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "feedback-quote";

  const paragraph = document.createElement("p");
  paragraph.textContent = (text || "").trim() || "No rewrite available.";
  wrapper.appendChild(paragraph);

  naturalVersionEl.appendChild(wrapper);
}

function renderFeedback(data) {
  feedbackSection.hidden = false;
  renderCorrections(data.corrections || "");
  renderNaturalVersion(data.natural_version || "");
}

let sessionsCache = [];

function formatSessionDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Session";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSessionsList() {
  closeSessionMenu();
  sessionsListEl.innerHTML = "";
  sessionsEmptyEl.hidden = sessionsCache.length > 0;

  sessionsCache.forEach((session) => {
    const item = document.createElement("li");
    item.className = "session-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "session-item";
    button.dataset.sessionId = session.session_id;

    if (session.session_id === state.sessionId) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "true");
    }

    const dateEl = document.createElement("span");
    dateEl.className = "session-item-date";
    dateEl.textContent = formatSessionDate(session.last_active_at);

    const countEl = document.createElement("span");
    countEl.className = "session-item-count";
    countEl.textContent = session.turn_count === 1 ? "1 turn" : `${session.turn_count} turns`;

    button.append(dateEl, countEl);

    const menuTrigger = document.createElement("button");
    menuTrigger.type = "button";
    menuTrigger.className = "session-menu-trigger";
    menuTrigger.dataset.sessionId = session.session_id;
    menuTrigger.setAttribute("aria-label", "Session options");
    menuTrigger.setAttribute("aria-haspopup", "true");
    menuTrigger.setAttribute("aria-expanded", "false");
    menuTrigger.innerHTML = ICONS.kebab;

    item.append(button, menuTrigger);
    sessionsListEl.appendChild(item);
  });
}

let sessionMenuEl = null;
let sessionMenuOpenId = null;

function getSessionMenu() {
  if (sessionMenuEl) {
    return sessionMenuEl;
  }

  sessionMenuEl = document.createElement("div");
  sessionMenuEl.className = "session-menu";
  sessionMenuEl.setAttribute("role", "menu");
  sessionMenuEl.hidden = true;

  const deleteItem = document.createElement("button");
  deleteItem.type = "button";
  deleteItem.className = "session-menu-item is-danger";
  deleteItem.setAttribute("role", "menuitem");
  deleteItem.textContent = "Delete";
  deleteItem.addEventListener("click", () => {
    const sessionId = sessionMenuEl.dataset.sessionId;
    closeSessionMenu();
    handleDeleteSession(sessionId);
  });

  sessionMenuEl.appendChild(deleteItem);
  document.body.appendChild(sessionMenuEl);
  return sessionMenuEl;
}

function closeSessionMenu() {
  if (sessionMenuEl) {
    sessionMenuEl.hidden = true;
  }

  if (sessionMenuOpenId) {
    const trigger = sessionsListEl.querySelector(
      `.session-menu-trigger[data-session-id="${CSS.escape(sessionMenuOpenId)}"]`,
    );
    trigger?.setAttribute("aria-expanded", "false");
  }

  sessionMenuOpenId = null;
}

function openSessionMenu(trigger) {
  const sessionId = trigger.dataset.sessionId;
  const wasOpenForThisSession = sessionMenuOpenId === sessionId;

  closeSessionMenu();

  if (wasOpenForThisSession) {
    return;
  }

  const menu = getSessionMenu();
  menu.dataset.sessionId = sessionId;
  menu.hidden = false;

  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  menu.style.top = `${triggerRect.bottom + 4}px`;
  menu.style.left = `${triggerRect.right - menuRect.width}px`;

  trigger.setAttribute("aria-expanded", "true");
  sessionMenuOpenId = sessionId;
}

async function handleDeleteSession(sessionId) {
  if (!sessionId) {
    return;
  }

  const confirmed = window.confirm(
    "Delete this session? It will disappear from your session list, but it won't affect your progress stats.",
  );
  if (!confirmed) {
    return;
  }

  hideError();

  try {
    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 404) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Could not delete that session.");
    }

    sessionsCache = sessionsCache.filter((session) => session.session_id !== sessionId);
    renderSessionsList();

    if (sessionId === state.sessionId) {
      startNewSession();
    }
  } catch (error) {
    showError(error.message || "Could not delete that session.");
  }
}

async function loadSessionsList() {
  try {
    const response = await fetch("/api/sessions");
    const data = await response.json();

    if (!response.ok) {
      return;
    }

    sessionsCache = Array.isArray(data.sessions) ? data.sessions : [];
    renderSessionsList();
  } catch {
    // Non-critical: the sidebar just keeps whatever it last showed.
  }
}

function turnsToMessages(turns) {
  const messages = [];

  turns.forEach((turn) => {
    messages.push(createMessage("student", turn.transcription || ""));
    messages.push(createMessage("teacher", turn.response || ""));
  });

  return messages;
}

async function switchToSession(sessionId) {
  if (!sessionId || sessionId === state.sessionId) {
    return;
  }

  hideError();

  try {
    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/turns`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not load that session.");
    }

    const turns = Array.isArray(data.turns) ? data.turns : [];
    const lastTurn = turns[turns.length - 1];

    state.sessionId = sessionId;
    state.messages = turnsToMessages(turns);
    state.latestFeedback = lastTurn
      ? {
          corrections: lastTurn.corrections || "",
          natural_version: lastTurn.natural_version || "",
        }
      : null;

    saveSessionState();
    renderConversation();

    if (state.latestFeedback) {
      renderFeedback(state.latestFeedback);
    } else {
      feedbackSection.hidden = true;
    }

    renderSessionsList();
  } catch (error) {
    showError(error.message || "Could not load that session.");
  }
}

function startNewSession() {
  hideError();

  state.sessionId = window.crypto.randomUUID();
  state.messages = [];
  state.latestFeedback = null;
  feedbackSection.hidden = true;

  saveSessionState();
  renderConversation();
  renderSessionsList();
}

async function playTutorAudio(audioUrl, replay = false) {
  if (!audioUrl) {
    return;
  }

  state.currentAudioUrl = audioUrl;
  responseAudio.src = audioUrl;
  responseAudio.currentTime = 0;

  try {
    await responseAudio.play();
    setStatus(replay ? "Emma is speaking again." : "Emma is speaking.", UI_STATE.PLAYING);
  } catch (error) {
    setStatus("Your tutor is ready. Press replay to listen.", UI_STATE.READY);
  }
}

async function startRecording() {
  hideError();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError("This browser does not support microphone recording.");
    return;
  }

  if (!window.MediaRecorder) {
    showError("This browser does not support MediaRecorder.");
    return;
  }

  const mimeType = detectMimeType();
  if (!mimeType) {
    showError("This browser does not support a compatible recording format.");
    return;
  }

  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    showError("Microphone permission was denied.");
    return;
  }

  state.recordedChunks = [];

  try {
    state.mediaRecorder = new MediaRecorder(state.mediaStream, { mimeType });
  } catch (error) {
    stopStreamTracks();
    showError("The microphone recording format is not supported.");
    return;
  }

  state.mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      state.recordedChunks.push(event.data);
    }
  });

  state.mediaRecorder.addEventListener("stop", handleRecordingStop);
  state.mediaRecorder.start();

  setStatus("Emma is listening...", UI_STATE.RECORDING);
  startRecordingTimer();
}

function stopRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
    return;
  }

  stopRecordingTimer();
  setStatus("Emma is preparing feedback...", UI_STATE.PROCESSING);
  state.mediaRecorder.stop();
}

async function handleRecordingStop() {
  stopStreamTracks();

  if (!state.recordedChunks.length) {
    recordingTimeEl.textContent = "00:00";
    showError("The recording was empty.");
    return;
  }

  const blob = new Blob(state.recordedChunks, { type: state.mediaRecorder.mimeType });
  if (blob.size === 0) {
    recordingTimeEl.textContent = "00:00";
    showError("The recording was empty.");
    return;
  }

  const extension = extensionFromMimeType(state.mediaRecorder.mimeType);
  const formData = new FormData();
  formData.append("audio", blob, `recording.${extension}`);
  if (state.sessionId) {
    formData.append("session_id", state.sessionId);
  }

  showTypingIndicator();

  try {
    const response = await fetch("/api/tutor", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "The tutor request failed.");
    }

    state.messages.push(
      createMessage("student", data.transcription || ""),
      createMessage("teacher", data.response || "", data.audio_url || ""),
    );
    state.latestFeedback = {
      corrections: data.corrections || "",
      natural_version: data.natural_version || "",
    };
    if (data.session_id) {
      state.sessionId = data.session_id;
    }
    saveSessionState();
    loadSessionsList();

    renderConversation();
    renderFeedback(data);

    if (!data.audio_url) {
      throw new Error("The tutor response did not include audio.");
    }

    await playTutorAudio(data.audio_url);
  } catch (error) {
    hideTypingIndicator();
    renderConversation();
    showError(error.message || "The tutor request failed.");
  } finally {
    hideTypingIndicator();
    state.mediaRecorder = null;
    state.recordedChunks = [];
    stopRecordingTimer();
    recordingTimeEl.textContent = "00:00";
  }
}

recordButton.addEventListener("click", () => {
  if (state.uiState === UI_STATE.RECORDING) {
    stopRecording();
    return;
  }

  if (state.uiState === UI_STATE.PROCESSING || state.uiState === UI_STATE.PLAYING) {
    return;
  }

  if (!responseAudio.paused) {
    responseAudio.pause();
    responseAudio.currentTime = 0;
  }

  setStatus("Tap the microphone to begin speaking.", UI_STATE.READY);
  startRecording();
});

conversationList.addEventListener("click", async (event) => {
  const button = event.target.closest(".message-action");
  if (!button) {
    return;
  }

  hideError();

  const { audioUrl } = button.dataset;
  if (!audioUrl) {
    showError("There is no tutor response audio to replay.");
    return;
  }

  await playTutorAudio(audioUrl, true);
});

responseAudio.addEventListener("play", () => {
  setStatus("Emma is speaking.", UI_STATE.PLAYING);
});

responseAudio.addEventListener("ended", () => {
  setStatus("Tap the microphone to continue the lesson.", UI_STATE.READY);
});

responseAudio.addEventListener("pause", () => {
  if (state.uiState === UI_STATE.PLAYING && responseAudio.currentTime < responseAudio.duration) {
    setStatus("Your tutor is ready. Press replay to listen again.", UI_STATE.READY);
  }
});

responseAudio.addEventListener("error", () => {
  showError("The browser could not play the tutor response audio.");
});

newSessionButton.addEventListener("click", startNewSession);

sessionsListEl.addEventListener("click", (event) => {
  const menuTrigger = event.target.closest(".session-menu-trigger");
  if (menuTrigger) {
    openSessionMenu(menuTrigger);
    return;
  }

  const button = event.target.closest(".session-item");
  if (!button) {
    return;
  }

  switchToSession(button.dataset.sessionId);
});

document.addEventListener("click", (event) => {
  if (!sessionMenuOpenId) {
    return;
  }

  if (event.target.closest(".session-menu") || event.target.closest(".session-menu-trigger")) {
    return;
  }

  closeSessionMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sessionMenuOpenId) {
    closeSessionMenu();
  }
});

recordingWave.dataset.active = "false";
loadSessionState();
ensureSessionId();
renderConversation();
if (state.latestFeedback) {
  renderFeedback(state.latestFeedback);
}
updateRecordButton();
setStatus("Tap the microphone to begin speaking.", UI_STATE.READY);
loadSessionsList();
