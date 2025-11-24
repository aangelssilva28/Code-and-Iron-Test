// ---------- Privacy footer toggle ----------
document.addEventListener("DOMContentLoaded", () => {
  const togglePrivacy = document.getElementById("toggle-privacy");
  const privacyPanel = document.getElementById("privacy-panel");

  if (togglePrivacy && privacyPanel) {
    togglePrivacy.addEventListener("click", () => {
      privacyPanel.classList.toggle("hidden");
    });
  }
});

// ---------- Helpers: exercise card + sets ----------
// NOTE: createSetBox is now clean. Tutorial is NO LONGER inside this function.

function createSetBox(card, setData, indexOverride) {
  const existing = card.querySelectorAll(".set-box").length;
  const setNumber = indexOverride || existing + 1;

  const box = document.createElement("div");
  box.className = "set-box";

  const header = document.createElement("div");
  header.className = "set-header";
  header.textContent = "Set " + setNumber;
  box.appendChild(header);

  const row = document.createElement("div");
  row.className = "set-row";

  const fields = document.createElement("div");
  fields.className = "set-fields";

  const colWeight = document.createElement("div");
  colWeight.className = "set-col";

  const weightInput = document.createElement("input");
  weightInput.className = "set-input";
  weightInput.type = "text";
  weightInput.placeholder = "Weight";
  if (setData && setData.weight != null) {
    weightInput.value = setData.weight;
  }
  colWeight.appendChild(weightInput);

  const colReps = document.createElement("div");
  colReps.className = "set-col";

  const repsInput = document.createElement("input");
  repsInput.className = "set-input";
  repsInput.type = "number";
  repsInput.min = "0";
  repsInput.placeholder = "Reps";
  if (setData && setData.reps != null) {
    repsInput.value = setData.reps;
  }
  colReps.appendChild(repsInput);

  fields.appendChild(colWeight);
  fields.appendChild(colReps);

  const actions = document.createElement("div");
  actions.className = "set-actions";

  const minusBtn = document.createElement("button");
  minusBtn.className = "round-btn minus";
  minusBtn.textContent = "–";
  minusBtn.addEventListener("click", () => {
    const allSets = card.querySelectorAll(".set-box");
    if (allSets.length > 1) {
      box.remove();
      card.querySelectorAll(".set-box").forEach((b, i) => {
        const h = b.querySelector(".set-header");
        if (h) h.textContent = "Set " + (i + 1);
      });
    }
  });

  const plusBtn = document.createElement("button");
  plusBtn.className = "round-btn plus";
  plusBtn.textContent = "+";
  plusBtn.addEventListener("click", () => {
    const newBox = createSetBox(card);
    const wrapper = card.querySelector(".sets-wrapper") || card;
    wrapper.appendChild(newBox);
  });

  actions.appendChild(minusBtn);
  actions.appendChild(plusBtn);

  row.appendChild(fields);
  row.appendChild(actions);
  box.appendChild(row);

  return box;
}

function createWorkoutCard(parent, workoutData) {
  const card = document.createElement("div");
  card.className = "workout-card";

  const setsWrapper = document.createElement("div");
  setsWrapper.className = "sets-wrapper";

  const header = document.createElement("div");
  header.className = "workout-header";

  const nameInput = document.createElement("input");
  nameInput.className = "text-input workout-name";
  nameInput.placeholder = "Enter exercise name";
  if (workoutData && workoutData.name) {
    nameInput.value = workoutData.name;
  }

  const headerActions = document.createElement("div");
  headerActions.className = "workout-header-actions";

  const removeWorkoutBtn = document.createElement("button");
  removeWorkoutBtn.className = "round-btn minus";
  removeWorkoutBtn.textContent = "–";
  removeWorkoutBtn.addEventListener("click", () => {
    const allCards = parent.querySelectorAll(".workout-card");

    if (allCards.length <= 1) {
      nameInput.value = "";
      const setsWrapper = card.querySelector(".sets-wrapper");
      if (setsWrapper) {
        setsWrapper.innerHTML = "";
        const setBox = createSetBox(card, { weight: "", reps: "" }, 1);
        setsWrapper.appendChild(setBox);
      }
    } else {
      card.remove();
    }
  });

  // Header "+" = add a NEW EXERCISE card below (NOT a set)
  const addExerciseBtn = document.createElement("button");
  addExerciseBtn.className = "round-btn plus";
  addExerciseBtn.textContent = "+";
  addExerciseBtn.addEventListener("click", () => {
    createWorkoutCard(parent);
  });

  headerActions.appendChild(removeWorkoutBtn);
  headerActions.appendChild(addExerciseBtn);

  header.appendChild(nameInput);
  header.appendChild(headerActions);

  card.appendChild(header);
  card.appendChild(setsWrapper);

  const setsFromData =
    workoutData && Array.isArray(workoutData.sets)
      ? workoutData.sets
      : [{ weight: "", reps: "" }];

  setsFromData.forEach((set, idx) => {
    const setBox = createSetBox(card, set, idx + 1);
    setsWrapper.appendChild(setBox);
  });

  parent.appendChild(card);
  return card;
}

// ---------- One-time tutorial walkthrough (GLOBAL) ----------
// NOTE: This was previously nested inside createSetBox.
// Moving it here makes initTutorial() available to init() at the bottom.

const TUTORIAL_KEY = "codeAndIronTutorialSeen_v1";

function initTutorial() {
  const overlay = document.getElementById("tutorialOverlay");
  if (!overlay) return;

  const seen = localStorage.getItem(TUTORIAL_KEY);
  if (seen === "true") {
    overlay.classList.remove("visible");
    return;
  }

  const screens = Array.from(overlay.querySelectorAll(".tutorial-screen"));
  if (!screens.length) return;

  let currentIndex = 0;

  function showStep(index) {
    screens.forEach((el, i) => {
      el.classList.toggle("active", i === index);
    });
  }

  function finishTutorial() {
    localStorage.setItem(TUTORIAL_KEY, "true");
    overlay.classList.remove("visible");
  }

  overlay.classList.add("visible");
  showStep(currentIndex);

  const skipBtn = document.getElementById("tutorialSkipBtn");
  const startBtn = document.getElementById("tutorialStartBtn");

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      finishTutorial();
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      currentIndex = 1;
      showStep(currentIndex);
    });
  }

  overlay.querySelectorAll("[data-tutorial-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentIndex < screens.length - 1) {
        currentIndex++;
        showStep(currentIndex);
      } else {
        finishTutorial();
      }
    });
  });

  overlay.querySelectorAll("[data-tutorial-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentIndex > 0) {
        currentIndex--;
        showStep(currentIndex);
      }
    });
  });

  overlay.querySelectorAll("[data-tutorial-done]").forEach((btn) => {
    btn.addEventListener("click", () => {
      finishTutorial();
    });
  });
}

// ---------- Screens & navigation ----------

const menuButton = document.getElementById("menuButton");
const menuDropdown = document.getElementById("menuDropdown");
const homeScreen = document.getElementById("homeScreen");
const workoutsScreen = document.getElementById("workoutsScreen");
const progressScreen = document.getElementById("progressScreen");
const progressDetail = document.getElementById("progressDetail");

function renderProgressList() {
  const list = document.getElementById("progressList");
  list.innerHTML = "";

  const entries = Object.values(progressData);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "card-subtitle";
    empty.textContent =
      "No progress saved yet. Log a workout on the home screen and tap 'Save progress'.";
    list.appendChild(empty);
    if (progressDetail) {
      progressDetail.classList.remove("open");
      progressDetail.innerHTML = "";
    }
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  entries.sort((a, b) => a.name.localeCompare(b.name));

  let currentLetter = null;

  entries.forEach((ex) => {
    if (!ex.name) return;

    const firstLetter = ex.name.charAt(0).toUpperCase();

    if (firstLetter !== currentLetter) {
      currentLetter = firstLetter;
      const letterHeader = document.createElement("div");
      letterHeader.className = "progress-letter-header";
      letterHeader.textContent = currentLetter;
      list.appendChild(letterHeader);
    }

    const row = document.createElement("div");
    row.className = "saved-item";

    const nameDiv = document.createElement("div");
    nameDiv.className = "saved-name";
    nameDiv.textContent = ex.name;
    row.appendChild(nameDiv);

    const detail = document.createElement("div");
    detail.style.fontSize = "13px";
    detail.style.color = "#bbbbbb";

    let prText = "";

    if (ex.bestRepsDate && ex.bestRepsDate.startsWith(today)) {
      prText += " (NEW REP PR!)";
    }

    if (ex.bestWeightDate && ex.bestWeightDate.startsWith(today)) {
      prText += " (NEW WEIGHT PR!)";
    }

    if (ex.bestWeight !== null) {
      detail.textContent = `Best: ${ex.bestWeight} x ${ex.bestWeightReps} • Max reps: ${ex.bestReps}${prText}`;
    } else {
      detail.textContent = `Best: ${ex.bestReps} reps${prText}`;
    }

    row.appendChild(detail);

    row.addEventListener("click", () => {
      openProgressDetail(ex);
    });

    list.appendChild(row);
  });
}

function closeMenu() {
  menuDropdown.classList.remove("open");
}

menuButton.addEventListener("click", () => {
  menuDropdown.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!menuButton.contains(e.target) && !menuDropdown.contains(e.target)) {
    closeMenu();
  }
});

document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    const nav = item.dataset.nav;
    if (nav === "workouts" || nav === "progress") {
      showScreen(nav);
      if (nav === "progress") {
        renderProgressList();
      }
    }
    closeMenu();
  });
});

const backToLoggerFromProgress = document.getElementById(
  "backToLoggerFromProgress"
);
if (backToLoggerFromProgress) {
  backToLoggerFromProgress.addEventListener("click", () => {
    showScreen("home");
  });
}

function showScreen(which) {
  if (which === "home") {
    homeScreen.classList.add("active");
    workoutsScreen.classList.remove("active");
    progressScreen.classList.remove("active");
  } else if (which === "workouts") {
    homeScreen.classList.remove("active");
    workoutsScreen.classList.add("active");
    progressScreen.classList.remove("active");
  } else if (which === "progress") {
    homeScreen.classList.remove("active");
    workoutsScreen.classList.remove("active");
    progressScreen.classList.add("active");
  }

  if (which !== "progress" && progressDetail) {
    progressDetail.classList.remove("open");
    progressDetail.innerHTML = "";
  }
}

// ---------- Logger (home) ----------

const workoutsContainer = document.getElementById("workoutsContainer");
const saveProgressBtn = document.getElementById("saveProgressBtn");

saveProgressBtn.addEventListener("click", () => {
  saveCurrentProgress();
  alert("Progress saved!");
});

// ---------- Progress detail panel (last 5 logs) ----------

function formatDateLabel(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function openProgressDetail(ex) {
  if (!progressDetail) return;

  progressDetail.classList.add("open");
  progressDetail.innerHTML = "";

  const title = document.createElement("div");
  title.className = "card-subtitle";
  title.style.marginBottom = "8px";
  title.textContent = ex.name + " — last sessions";
  progressDetail.appendChild(title);

  if (ex.bestRepsDate || ex.bestWeightDate) {
    const prInfo = document.createElement("div");
    prInfo.style.fontSize = "13px";
    prInfo.style.color = "#bbbbbb";
    prInfo.style.marginBottom = "8px";

    const parts = [];
    if (ex.bestRepsDate) {
      parts.push(
        `Rep PR: ${ex.bestReps} reps on ${formatDateLabel(
          ex.bestRepsDate.split("T")[0]
        )}`
      );
    }
    if (ex.bestWeightDate && ex.bestWeight !== null) {
      parts.push(
        `Weight PR: ${ex.bestWeight} x ${ex.bestWeightReps} on ${formatDateLabel(
          ex.bestWeightDate.split("T")[0]
        )}`
      );
    }

    prInfo.textContent = parts.join(" • ");
    progressDetail.appendChild(prInfo);
  }

  const history = (ex.history || []).slice(0, 5);
  if (!history.length) {
    const empty = document.createElement("div");
    empty.style.fontSize = "13px";
    empty.style.color = "#bbbbbb";
    empty.textContent =
      "No detailed history yet. Save progress a few times for this exercise.";
    progressDetail.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "progress-detail-row";

    const left = document.createElement("span");
    left.textContent = formatDateLabel(entry.date);

    const right = document.createElement("span");
    if (entry.bestWeight !== null) {
      right.textContent = `${entry.bestWeight} x ${entry.bestWeightReps} • Max reps: ${entry.bestReps}`;
    } else {
      right.textContent = `Best: ${entry.bestReps} reps`;
    }

    row.appendChild(left);
    row.appendChild(right);
    progressDetail.appendChild(row);
  });
}

function saveCurrentProgress() {
  const workouts = getCurrentWorkoutLayout();
  if (!workouts || !workouts.length) return;

  const now = new Date().toISOString();
  const today = now.split("T")[0];
  const updated = { ...progressData };

  workouts.forEach((w) => {
    const rawName = (w.name || "").trim();
    if (!rawName) return;

    const key = rawName.toLowerCase();
    let maxReps = 0;
    let bestWeight = null;
    let bestWeightReps = 0;

    (w.sets || []).forEach((set) => {
      const repsNum = parseInt(set.reps, 10);
      if (!repsNum || isNaN(repsNum)) return;

      const weightStr = (set.weight || "").trim();
      const weightNum = parseFloat(weightStr);

      if (repsNum > maxReps) maxReps = repsNum;

      if (!isNaN(weightNum)) {
        if (
          bestWeight === null ||
          weightNum > bestWeight ||
          (weightNum === bestWeight && repsNum > bestWeightReps)
        ) {
          bestWeight = weightNum;
          bestWeightReps = repsNum;
        }
      }
    });

    if (maxReps === 0 && bestWeight === null) return;

    const existing = updated[key] || {
      name: rawName,
      bestReps: 0,
      bestRepsDate: null,
      bestWeight: null,
      bestWeightReps: 0,
      bestWeightDate: null,
      lastUpdated: null,
      history: [],
    };

    if (maxReps > existing.bestReps) {
      existing.bestReps = maxReps;
      existing.bestRepsDate = now;
    }

    if (bestWeight !== null) {
      if (
        existing.bestWeight === null ||
        bestWeight > existing.bestWeight ||
        (bestWeight === existing.bestWeight &&
          bestWeightReps > existing.bestWeightReps)
      ) {
        existing.bestWeight = bestWeight;
        existing.bestWeightReps = bestWeightReps;
        existing.bestWeightDate = now;
      }
    }

    const snapshot = {
      date: today,
      bestReps: maxReps,
      bestWeight: bestWeight,
      bestWeightReps: bestWeightReps,
    };

    existing.history = existing.history || [];
    existing.history = existing.history.filter((h) => h.date !== today);
    existing.history.push(snapshot);
    existing.history.sort((a, b) => b.date.localeCompare(a.date));

    if (existing.history.length > 30) {
      existing.history = existing.history.slice(0, 30);
    }

    existing.lastUpdated = now;
    existing.name = rawName;
    updated[key] = existing;
  });

  progressData = updated;
  saveProgress(progressData);
}

function getCurrentWorkoutLayout() {
  return getWorkoutLayoutFrom(workoutsContainer);
}

function applyTemplateToHome(workoutDataArray) {
  workoutsContainer.innerHTML = "";
  if (!workoutDataArray || workoutDataArray.length === 0) {
    createWorkoutCard(workoutsContainer);
    return;
  }
  workoutDataArray.forEach((w) => {
    createWorkoutCard(workoutsContainer, w);
  });
}

// ---------- Templates (routines screen) ----------

const templateNameInput = document.getElementById("templateNameInput");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const savedTemplatesList = document.getElementById("savedTemplatesList");
const backToLogger = document.getElementById("backToLogger");

// Backup UI elements (on Progress screen)
const backupText = document.getElementById("backupText");
const exportBackupBtn = document.getElementById("exportBackupBtn");
const importBackupBtn = document.getElementById("importBackupBtn");

// ---------- Versioned storage keys ----------

const STORAGE_KEY = "codeAndIronTemplates_v2";
const PROGRESS_KEY = "codeAndIronProgress_v1";

const TEMPLATE_VERSION = 1;
const PROGRESS_VERSION = 1;

// ---------- Versioned load/save: PROGRESS ----------

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);

    // Old format: plain object with no version (what your current users have)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    if (!Object.prototype.hasOwnProperty.call(parsed, "version")) {
      // Treat entire object as the original data
      return parsed;
    }

    // New format: { version, data }
    if (parsed.version === PROGRESS_VERSION) {
      return parsed.data || {};
    }

    console.warn("Newer progress version found — falling back to .data.");
    return parsed.data || {};
  } catch (e) {
    console.error("Error loading progress", e);
    return {};
  }
}

function saveProgress(data) {
  try {
    const wrapped = {
      version: PROGRESS_VERSION,
      data: data,
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(wrapped));
  } catch (e) {
    console.error("Error saving progress", e);
  }
}

let progressData = loadProgress();

// ---------- Versioned load/save: TEMPLATES ----------

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Old format: templates were stored as a plain array
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (!parsed || typeof parsed !== "object") {
      return [];
    }

    if (!Object.prototype.hasOwnProperty.call(parsed, "version")) {
      // Unversioned but object-shaped? Try to treat as array-ish, else empty.
      return [];
    }

    if (parsed.version === TEMPLATE_VERSION) {
      return parsed.data || [];
    }

    console.warn("Newer template version found — falling back to .data.");
    return parsed.data || [];
  } catch (e) {
    console.error("Error loading templates", e);
    return [];
  }
}

function saveTemplates(templates) {
  try {
    const wrapped = {
      version: TEMPLATE_VERSION,
      data: templates,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped));
  } catch (e) {
    console.error("Error saving templates", e);
  }
}

let templates = loadTemplates();

// ---------- Backup & restore ----------

// Export backup: generate JSON and dump it into the textarea
if (exportBackupBtn && backupText) {
  exportBackupBtn.addEventListener("click", () => {
    const backupString = createBackupString();
    if (!backupString) return;
    backupText.value = backupString;
    alert("Backup code generated. Copy it and save it somewhere safe.");
  });
}

// Import backup: read JSON from textarea and restore
if (importBackupBtn && backupText) {
  importBackupBtn.addEventListener("click", () => {
    const str = backupText.value.trim();
    if (!str) {
      alert("Paste a backup code first.");
      return;
    }
    restoreFromBackupString(str);
  });
}

function getBackupObject() {
  // Everything we care about goes in here
  return {
    templates,
    progressData,
    version: 1,
  };
}

function createBackupString() {
  try {
    return JSON.stringify(getBackupObject());
  } catch (e) {
    console.error("Error creating backup", e);
    alert("Could not create backup.");
    return "";
  }
}

function restoreFromBackupString(str) {
  try {
    const parsed = JSON.parse(str);

    // Restore templates if present
    if (parsed.templates && Array.isArray(parsed.templates)) {
      templates = parsed.templates;
      saveTemplates(templates);
      renderTemplatesList();
    }

    // Restore progressData if present
    if (parsed.progressData && typeof parsed.progressData === "object") {
      progressData = parsed.progressData;
      saveProgress(progressData);
      renderProgressList();
    }

    alert("Backup restored!");
  } catch (e) {
    console.error("Error restoring backup", e);
    alert("That backup code was invalid. Make sure you pasted the whole thing.");
  }
}

// ---------- Templates helpers ----------

function getWorkoutLayoutFrom(container) {
  const cards = container.querySelectorAll(".workout-card");
  const workouts = [];

  cards.forEach((card) => {
    const nameInput = card.querySelector(".workout-name");
    const sets = [];
    card.querySelectorAll(".set-box").forEach((box) => {
      const inputs = box.querySelectorAll(".set-input");
      sets.push({
        weight: inputs[0] ? inputs[0].value : "",
        reps: inputs[1] ? inputs[1].value : "",
      });
    });
    workouts.push({
      name: nameInput ? nameInput.value : "",
      sets,
    });
  });

  return workouts;
}

function buildEditorPanel(panel, tpl) {
  panel.innerHTML = "";
  panel.classList.add("open");

  const innerContainer = document.createElement("div");
  innerContainer.className = "workouts-container";
  panel.appendChild(innerContainer);

  const data =
    tpl.workouts && tpl.workouts.length
      ? tpl.workouts
      : [{ name: "", sets: [{ weight: "", reps: "" }] }];

  data.forEach((w) => createWorkoutCard(innerContainer, w));
}

function closePanelAndSave(panel) {
  const index = parseInt(panel.dataset.index, 10);
  if (!isNaN(index) && templates[index]) {
    const container = panel.querySelector(".workouts-container");
    if (container) {
      templates[index].workouts = getWorkoutLayoutFrom(container);
      saveTemplates(templates);
    }
  }
  panel.classList.remove("open");
  panel.innerHTML = "";
}

function renderTemplatesList() {
  savedTemplatesList.innerHTML = "";
  if (!templates.length) return;

  templates.forEach((tpl, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "saved-wrapper";

    const row = document.createElement("div");
    row.className = "saved-item";

    const name = document.createElement("div");
    name.className = "saved-name";
    name.textContent = tpl.name || "Untitled routine";
    row.appendChild(name);

    const btnWrap = document.createElement("div");
    btnWrap.className = "saved-buttons";

    const loadBtn = document.createElement("button");
    loadBtn.className = "small-btn load";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => {
      applyTemplateToHome(tpl.workouts || []);
      showScreen("home");
    });
    btnWrap.appendChild(loadBtn);

    const openBtn = document.createElement("button");
    openBtn.className = "small-btn open";
    openBtn.textContent = "Open";
    btnWrap.appendChild(openBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "small-btn delete";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const panel = savedTemplatesList.querySelector(
        `.open-panel[data-index="${index}"]`
      );
      if (panel && panel.classList.contains("open")) {
        closePanelAndSave(panel);
      }
      templates.splice(index, 1);
      saveTemplates(templates);
      renderTemplatesList();
      renderProgressList();
    });
    btnWrap.appendChild(delBtn);

    row.appendChild(btnWrap);
    wrapper.appendChild(row);

    const panel = document.createElement("div");
    panel.className = "open-panel";
    panel.dataset.index = index.toString();
    wrapper.appendChild(panel);

    openBtn.addEventListener("click", () => {
      if (panel.classList.contains("open")) {
        closePanelAndSave(panel);
        openBtn.textContent = "Open";
        return;
      }

      document.querySelectorAll(".open-panel.open").forEach((p) => {
        if (p !== panel) {
          const btnIndex = p.dataset.index;
          const otherBtn = savedTemplatesList.querySelector(
            `.saved-wrapper:nth-child(${parseInt(btnIndex, 10) + 1}) .small-btn.open`
          );
          if (otherBtn) otherBtn.textContent = "Open";
          closePanelAndSave(p);
        }
      });

      buildEditorPanel(panel, tpl);
      openBtn.textContent = "Close";
    });

    savedTemplatesList.appendChild(wrapper);
  });
}

saveTemplateBtn.addEventListener("click", () => {
  const name = templateNameInput.value.trim();
  if (!name) {
    alert("Give this routine a name first.");
    return;
  }

  const workoutsData = getCurrentWorkoutLayout();

  const safeWorkouts =
    workoutsData && workoutsData.length
      ? workoutsData
      : [{ name: "", sets: [{ weight: "", reps: "" }] }];

  templates.push({
    id: Date.now(),
    name,
    workouts: JSON.parse(JSON.stringify(safeWorkouts)),
  });

  saveTemplates(templates);
  renderTemplatesList();
  templateNameInput.value = "";
});

backToLogger.addEventListener("click", () => {
  showScreen("home");
});

// ---------- Init ----------
// NOTE: initTutorial() is now defined above, so this call works.

function init() {
  createWorkoutCard(workoutsContainer);
  renderTemplatesList();
  initTutorial(); // run one-time tutorial if not seen
}

init();