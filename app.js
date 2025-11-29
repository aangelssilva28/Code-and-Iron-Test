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

function createSetBox(card, setData, indexOverride) {
  const box = document.createElement("div");
  box.className = "set-box";

  const setLabel = document.createElement("div");
  setLabel.className = "set-label";
  const existingCount = card.querySelectorAll(".set-box").length;
  const setNumber = indexOverride || existingCount + 1;
  setLabel.textContent = `Set ${setNumber}`;

  const weightInput = document.createElement("input");
  weightInput.className = "set-input";
  weightInput.placeholder = "Weight";
  weightInput.type = "text";
  weightInput.value = setData?.weight ?? "";

  const weightGroup = document.createElement("div");
  weightGroup.className = "set-weight-group";
  weightGroup.appendChild(weightInput);

  const repsInput = document.createElement("input");
  repsInput.className = "set-input";
  repsInput.placeholder = "Reps";
  repsInput.type = "number";
  repsInput.min = "0";
  repsInput.value = setData?.reps ?? "";

  const minusBtn = document.createElement("button");
  minusBtn.className = "round-btn";
  minusBtn.textContent = "–";
  minusBtn.addEventListener("click", () => {
    const boxes = card.querySelectorAll(".set-box");
    if (boxes.length > 1) {
      box.remove();
      renumberSets(card);
    }
  });

  const plusBtn = document.createElement("button");
  plusBtn.className = "round-btn";
  plusBtn.textContent = "+";
  plusBtn.addEventListener("click", () => {
    const wrapper = card.querySelector(".sets-wrapper") || card;
    wrapper.appendChild(createSetBox(card));
    renumberSets(card);
  });

  const rightGroup = document.createElement("div");
  rightGroup.className = "set-right-group";
  rightGroup.appendChild(repsInput);
  rightGroup.appendChild(minusBtn);
  rightGroup.appendChild(plusBtn);

  box.appendChild(setLabel);
  box.appendChild(weightGroup);
  box.appendChild(rightGroup);

  return box;
}

function renumberSets(card) {
  const boxes = card.querySelectorAll(".set-box");
  boxes.forEach((box, index) => {
    const label = box.querySelector(".set-label");
    if (label) {
      label.textContent = `Set ${index + 1}`;
    }
  });
}

function setCardCollapsed(card, collapsed) {
  const setsWrapper = card.querySelector(".sets-wrapper");
  const headerActions = card.querySelector(".workout-header-actions");
  const nameInput = card.querySelector(".workout-name");

  if (collapsed) {
    card.classList.add("collapsed");
    if (setsWrapper) setsWrapper.style.display = "none";
    if (headerActions) headerActions.style.display = "none";

    if (nameInput) {
      nameInput.readOnly = true;
      nameInput.blur();
    }
  } else {
    card.classList.remove("collapsed");
    if (setsWrapper) setsWrapper.style.display = "";
    if (headerActions) headerActions.style.display = "flex";

    if (nameInput) {
      nameInput.readOnly = false;
    }
  }
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

  nameInput.addEventListener("click", () => {
    if (card.classList.contains("collapsed")) {
      setCardCollapsed(card, false);
    }
  });

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

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "round-btn collapse-btn";
  collapseBtn.textContent = "▼";
  collapseBtn.addEventListener("click", () => {
    const isCollapsed = card.classList.contains("collapsed");
    setCardCollapsed(card, !isCollapsed);
  });

  const addExerciseBtn = document.createElement("button");
  addExerciseBtn.className = "round-btn plus";
  addExerciseBtn.textContent = "+";
  addExerciseBtn.addEventListener("click", () => {
    createWorkoutCard(parent);
  });

  headerActions.appendChild(removeWorkoutBtn);
  headerActions.appendChild(collapseBtn);
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

  if (workoutData && workoutData.collapsed) {
    setCardCollapsed(card, true);
  }

  return card;
}

// ---------- One-time tutorial walkthrough (GLOBAL) ----------

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

// NEW: progress grouping state
let progressByLetter = {};
let activeProgressLetter = null;

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

document.querySelectorAll(".menu-item[data-nav]").forEach((item) => {
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

// ---------- Progress list (letter grid + per-letter list) ----------

function renderProgressList() {
  const grid = document.getElementById("progressLetterGrid");
  const list = document.getElementById("progressList");

  if (!grid || !list) return;

  grid.innerHTML = "";
  list.innerHTML = "";

  const entries = Object.values(progressData || {});
  if (!entries.length) {
    // still draw disabled A–Z grid so layout looks consistent
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    letters.forEach((letter) => {
      const btn = document.createElement("button");
      btn.className = "progress-letter-btn disabled";
      btn.textContent = letter;
      grid.appendChild(btn);
    });

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

  // build map letter -> exercises
  progressByLetter = {};
  entries.forEach((ex) => {
    if (!ex.name) return;
    let letter = ex.name.trim().charAt(0).toUpperCase();
    if (letter < "A" || letter > "Z") return;
    if (!progressByLetter[letter]) progressByLetter[letter] = [];
    progressByLetter[letter].push(ex);
  });

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  letters.forEach((letter) => {
    const hasAny = !!(progressByLetter[letter] && progressByLetter[letter].length);
    const btn = document.createElement("button");
    btn.className = "progress-letter-btn";
    if (!hasAny) {
      btn.classList.add("disabled");
    }
    btn.textContent = letter;

    btn.addEventListener("click", () => {
      if (!hasAny) return;
      activeProgressLetter = letter;

      // update active visual state
      grid.querySelectorAll(".progress-letter-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });

      updateProgressExerciseList();
    });

    grid.appendChild(btn);
  });

  // choose default active letter (first one that has any exercises)
  if (!activeProgressLetter || !progressByLetter[activeProgressLetter]) {
    activeProgressLetter =
      letters.find((l) => progressByLetter[l] && progressByLetter[l].length) ||
      null;
  }

  // mark the active button
  if (activeProgressLetter) {
    const idx = letters.indexOf(activeProgressLetter);
    if (idx !== -1 && grid.children[idx]) {
      grid.children[idx].classList.add("active");
    }
  }

  updateProgressExerciseList();
}

function updateProgressExerciseList() {
  const list = document.getElementById("progressList");
  if (!list) return;

  list.innerHTML = "";

  if (
    !activeProgressLetter ||
    !progressByLetter[activeProgressLetter] ||
    !progressByLetter[activeProgressLetter].length
  ) {
    const empty = document.createElement("div");
    empty.className = "card-subtitle";
    empty.textContent =
      "No exercises saved under this letter yet. Log a workout and save progress.";
    list.appendChild(empty);

    if (progressDetail) {
      progressDetail.classList.remove("open");
      progressDetail.innerHTML = "";
    }
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const exList = [...progressByLetter[activeProgressLetter]];
  exList.sort((a, b) => a.name.localeCompare(b.name));

  exList.forEach((ex) => {
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

// ---------- Progress save, templates, backup, share, etc. ----------
// (all of this is exactly what you already had, unchanged)

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

// ... rest of your JS (load/save progress, templates, sharing, tutorial, init)
// stays exactly the same as what you pasted ...

// ---------- Init ----------

function init() {
  createWorkoutCard(workoutsContainer);
  renderTemplatesList();
  initTutorial();
}

init();