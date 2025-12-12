// ======================================================
// DOM helpers
// ======================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Tiny utility: make sure only one panel with `.open` is active
function openSinglePanel(
  container,
  targetPanel,
  { panelSelector = ".open-panel.open", openClass = "open", onClose } = {}
) {
  if (!container || !targetPanel) return;

  $$(panelSelector, container).forEach((panel) => {
    if (panel === targetPanel) return;
    if (onClose) {
      onClose(panel);
    } else {
      panel.classList.remove(openClass);
    }
  });

  targetPanel.classList.add(openClass);
}

// ======================================================
// App version + toast helper
// ======================================================
const APP_VERSION = "0.9.1";
const VERSION_STORAGE_KEY = "codeAndIronLastSeenVersion_v1";

let toastTimeoutId = null;

function showToast(message, options = {}) {
  const duration = options.duration ?? 2500;
  const toastEl = document.getElementById("toast");

  // Fallback if the element is missing for some reason
  if (!toastEl) {
    alert(message);
    return;
  }

  // Set message
  toastEl.textContent = message;

  // Show
  toastEl.classList.add("visible");

  // Reset any existing timer
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  // Hide after duration
  toastTimeoutId = setTimeout(() => {
    toastEl.classList.remove("visible");
  }, duration);
}

// ======================================================
// Exercise key normalization + migration helpers
// ======================================================

function normalizeExerciseKey(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // collapse multiple spaces
    .replace(/[^\w\s]/g, ""); // strip punctuation (.,!?-/ etc.)
}

// Merge two progress entries when keys collide during migration
function mergeProgressEntries(a, b) {
  const merged = { ...(a || {}), ...(b || {}) };

  // Choose the "nicer" name (longer wins)
  const nameA = (a && a.name) || "";
  const nameB = (b && b.name) || "";
  merged.name = nameB.length > nameA.length ? nameB : nameA;

  // Best reps
  const bestRepsA = (a && a.bestReps) || 0;
  const bestRepsB = (b && b.bestReps) || 0;
  if (bestRepsB > bestRepsA) {
    merged.bestReps = bestRepsB;
    merged.bestRepsDate = b.bestRepsDate || null;
  } else {
    merged.bestReps = bestRepsA;
    merged.bestRepsDate = a.bestRepsDate || null;
  }

  // Best weight x reps
  const wA = a && typeof a.bestWeight === "number" ? a.bestWeight : null;
  const rA = (a && a.bestWeightReps) || 0;
  const wB = b && typeof b.bestWeight === "number" ? b.bestWeight : null;
  const rB = (b && b.bestWeightReps) || 0;

  function betterWeight(firstW, firstR, secondW, secondR) {
    if (secondW === null) return { w: firstW, r: firstR };
    if (firstW === null) return { w: secondW, r: secondR };
    if (secondW > firstW) return { w: secondW, r: secondR };
    if (secondW < firstW) return { w: firstW, r: firstR };
    // same weight → keep higher reps
    if (secondR > firstR) return { w: secondW, r: secondR };
    return { w: firstW, r: firstR };
  }

  const best = betterWeight(wA, rA, wB, rB);
  merged.bestWeight = best.w;
  merged.bestWeightReps = best.r;
  merged.bestWeightDate =
    best.w === wB ? b.bestWeightDate || null : a.bestWeightDate || null;

  // Merge history by date (favor entry with higher bestWeight / bestReps)
  const histA = Array.isArray(a && a.history) ? a.history : [];
  const histB = Array.isArray(b && b.history) ? b.history : [];
  const byDate = {};

  histA.concat(histB).forEach((h) => {
    if (!h || !h.date) return;
    const existing = byDate[h.date];
    if (!existing) {
      byDate[h.date] = h;
      return;
    }

    const wE =
      typeof existing.bestWeight === "number" ? existing.bestWeight : null;
    const wH = typeof h.bestWeight === "number" ? h.bestWeight : null;
    const rE = existing.bestWeightReps || 0;
    const rH = h.bestWeightReps || 0;
    const repsE = existing.bestReps || 0;
    const repsH = h.bestReps || 0;

    let takeNew = false;
    if (wH !== null) {
      if (wE === null || wH > wE || (wH === wE && rH > rE)) {
        takeNew = true;
      }
    } else if (repsH > repsE) {
      takeNew = true;
    }

    if (takeNew) byDate[h.date] = h;
  });

  merged.history = Object.values(byDate).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return merged;
}

// One-time migration: move old keys → normalized keys
function migrateProgressKeys(rawData) {
  if (!rawData || typeof rawData !== "object") return {};

  const migrated = {};

  Object.entries(rawData).forEach(([oldKey, ex]) => {
    if (!ex || typeof ex !== "object") return;
    const name = (ex.name || "").trim() || oldKey;
    const newKey = normalizeExerciseKey(name);
    if (!newKey) return;

    if (!migrated[newKey]) {
      migrated[newKey] = { ...ex, name };
    } else {
      migrated[newKey] = mergeProgressEntries(migrated[newKey], {
        ...ex,
        name,
      });
    }
  });

  return migrated;
}

// When a *new* exercise name looks similar to an existing one,
// we can offer to merge.
function findSimilarExistingExercise(normalizedKey, rawName, progressObj) {
  const entries = Object.entries(progressObj || {});
  if (!entries.length) return null;

  const lowerName = rawName.toLowerCase().trim();
  const [firstWordNew] = lowerName.split(/\s+/);

  let candidate = null;

  for (const [key, ex] of entries) {
    const existingName = (ex.name || "").toLowerCase().trim();
    if (!existingName) continue;
    const [firstWordExisting] = existingName.split(/\s+/);

    // same first word and somewhat overlapping text
    const looksSimilar =
      firstWordExisting &&
      firstWordExisting === firstWordNew &&
      (existingName.includes(firstWordNew) ||
        lowerName.includes(firstWordExisting));

    if (looksSimilar) {
      candidate = { key, name: ex.name || existingName };
      break;
    }
  }

  return candidate;
}

// ======================================================
// Storage module (versioned templates + progress)
// ======================================================
const Storage = (() => {
  const STORAGE_KEY = "codeAndIronTemplates_v2";
  const PROGRESS_KEY = "codeAndIronProgress_v1";

  const TEMPLATE_VERSION = 1;
  const PROGRESS_VERSION = 1;

  // ---- PROGRESS ----
  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return {};

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      if (!Object.prototype.hasOwnProperty.call(parsed, "version")) {
        // old format: just data
        return parsed;
      }

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

  // ---- TEMPLATES ----
  function loadTemplates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        // very old format
        return parsed;
      }

      if (!parsed || typeof parsed !== "object") {
        return [];
      }

      if (!Object.prototype.hasOwnProperty.call(parsed, "version")) {
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

  return {
    loadProgress,
    saveProgress,
    loadTemplates,
    saveTemplates,
  };
})();

// ======================================================
// Settings module (units, theme, data control)
// ======================================================
const Settings = (() => {
  const SETTINGS_KEY = "codeAndIronSettings_v1";

  let state = {
    unit: "lb", // "lb" | "kg"
    highContrast: false, // boolean
  };

  function load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state.unit = parsed.unit === "kg" ? "kg" : "lb";
        state.highContrast = !!parsed.highContrast;
      }
    } catch (e) {
      console.error("Error loading settings", e);
    }
  }

  function save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Error saving settings", e);
    }
  }

  function applyTheme() {
    if (state.highContrast) {
      document.body.classList.add("theme-high-contrast");
    } else {
      document.body.classList.remove("theme-high-contrast");
    }
  }

  function applyUnitPlaceholders() {
    const label = getWeightPlaceholder();
    document
      .querySelectorAll('.set-input[data-field="weight"]')
      .forEach((input) => {
        input.placeholder = label;
      });
  }

  function init({
    unitSelectSelector,
    highContrastSelector,
    exportButtonSelector,
    resetButtonSelector,
  }) {
    load();
    applyTheme();

    const unitSelect = $(unitSelectSelector);
    const contrastCheckbox = $(highContrastSelector);
    const exportBtn = $(exportButtonSelector);
    const resetBtn = $(resetButtonSelector);

    if (unitSelect) {
      unitSelect.value = state.unit;
      unitSelect.addEventListener("change", () => {
        state.unit = unitSelect.value === "kg" ? "kg" : "lb";
        save();
        applyUnitPlaceholders();
      });
    }

    if (contrastCheckbox) {
      contrastCheckbox.checked = state.highContrast;
      contrastCheckbox.addEventListener("change", () => {
        state.highContrast = contrastCheckbox.checked;
        save();
        applyTheme();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        // Reuse the existing Progress backup button
        const progressBackupBtn = $("#exportBackupBtn");
        if (progressBackupBtn) {
          progressBackupBtn.click();
        } else {
          alert("Open the Progress screen to use backup, then try again.");
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const confirmText = prompt(
          "This will ERASE all Code & Iron data in this browser:\n" +
            "• Saved routines\n" +
            "• Progress / PRs\n" +
            "• Tutorial status\n" +
            "• Settings\n\n" +
            "Type RESET (all caps) to confirm."
        );

        if (confirmText !== "RESET") {
          if (typeof showToast === "function") {
            showToast("Reset cancelled.");
          } else {
            alert("Reset cancelled.");
          }
          return;
        }

        try {
          const keysToRemove = [
            "codeAndIronTemplates_v2",
            "codeAndIronProgress_v1",
            "codeAndIronTutorialSeen_v1",
            SETTINGS_KEY,
          ];
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch (e) {
          console.error("Error clearing data", e);
        }

        window.location.reload();
      });
    }

    // Make sure current logger inputs match chosen unit
    applyUnitPlaceholders();
  }

  function getUnit() {
    return state.unit;
  }

  function getWeightPlaceholder() {
    return state.unit === "kg" ? "Weight (kg)" : "Weight (lb)";
  }

  return {
    init,
    getUnit,
    getWeightPlaceholder,
  };
})();

// ======================================================
// Logger module (home screen workout cards & sets)
// ======================================================
const Logger = (() => {
  let workoutsContainer = null;

  // NEW: track current mode ("standard" | "complex" | "aft")
  let mode = "standard";
  let modeToggleBtn = null;
  let complexModeBtn = null;
  let aftModeBtn = null;

  // NEW: sticky footer buttons for complex mode
  let complexAddCardBtn = null;
  let complexRemoveCardBtn = null;
  let complexAddRowBtn = null;
  let complexRemoveRowBtn = null;

  function updateFooterVisibility() {
    const show = mode === "complex";
    const display = show ? "" : "none";

    if (complexAddCardBtn) complexAddCardBtn.style.display = display;
    if (complexRemoveCardBtn) complexRemoveCardBtn.style.display = display;
    if (complexAddRowBtn) complexAddRowBtn.style.display = display;
    if (complexRemoveRowBtn) complexRemoveRowBtn.style.display = display;
  }

  function getComplexCards() {
    if (!workoutsContainer) return [];
    return Array.from(workoutsContainer.querySelectorAll(".workout-card"));
  }

  function getLastComplexCard() {
    const cards = getComplexCards();
    return cards.length ? cards[cards.length - 1] : null;
  }

  function init({ containerSelector, saveButtonSelector, onSave }) {
    workoutsContainer = $(containerSelector);

    if (!workoutsContainer) {
      console.warn("Logger: workouts container not found:", containerSelector);
      return;
    }

    // Sticky footer buttons (complex mode only)
    complexAddCardBtn = $("#complexAddCardBtn");
    complexRemoveCardBtn = $("#complexRemoveCardBtn");
    complexAddRowBtn = $("#complexAddRowBtn");
    complexRemoveRowBtn = $("#complexRemoveRowBtn");

    if (complexAddCardBtn) {
      complexAddCardBtn.addEventListener("click", () => {
        if (mode !== "complex" || !workoutsContainer) return;
        createComplexCard(workoutsContainer);
      });
    }

    if (complexRemoveCardBtn) {
      complexRemoveCardBtn.addEventListener("click", () => {
        if (mode !== "complex" || !workoutsContainer) return;

        const cards = getComplexCards();
        if (!cards.length) return;

        if (cards.length === 1) {
          // Reset the single remaining card instead of deleting it
          const card = cards[0];
          const label = card.querySelector(".complex-set-label");
          if (label) {
            label.textContent = "Set 1";
            label.setAttribute("aria-label", "Set 1");
          }

          const setsWrapper = card.querySelector(".sets-wrapper");
          if (setsWrapper) {
            setsWrapper.innerHTML = "";
            setsWrapper.appendChild(createComplexRow(card));
          }
        } else {
          cards[cards.length - 1].remove();
          renumberComplexCards(workoutsContainer);
        }
      });
    }

    if (complexAddRowBtn) {
      complexAddRowBtn.addEventListener("click", () => {
        if (mode !== "complex" || !workoutsContainer) return;
        const card = getLastComplexCard();
        if (!card) return;

        const setsWrapper = card.querySelector(".sets-wrapper");
        if (!setsWrapper) return;

        setsWrapper.appendChild(createComplexRow(card));
      });
    }

    if (complexRemoveRowBtn) {
      complexRemoveRowBtn.addEventListener("click", () => {
        if (mode !== "complex" || !workoutsContainer) return;
        const card = getLastComplexCard();
        if (!card) return;

        const rows = card.querySelectorAll(".set-box");
        if (!rows.length) return;

        if (rows.length === 1) {
          // Just clear the last row instead of removing it
          rows[0].querySelectorAll("input").forEach((input) => {
            input.value = "";
          });
        } else {
          rows[rows.length - 1].remove();
        }
      });
    }

    // Mode toggle button (Standard / Complex)
    // Mode buttons: Standard, Complex, AFT
    modeToggleBtn = $("#loggerModeToggle");     // Standard
    complexModeBtn = $("#complexModeButton");  // Complex
    aftModeBtn = $("#aftModeButton");          // AFT

    function setMode(newMode) {
      mode = newMode;
      resetForMode();

      if (typeof showToast === "function") {
        if (mode === "standard") {
          showToast("Standard mode: one exercise per card.");
        } else if (mode === "complex") {
          showToast("Complex mode: exercise per row.");
        } else if (mode === "aft") {
          showToast("AFT mode: Army Fitness Test template.");
        }
      }
    }

    if (modeToggleBtn) {
      modeToggleBtn.addEventListener("click", () => setMode("standard"));
    }
    if (complexModeBtn) {
      complexModeBtn.addEventListener("click", () => setMode("complex"));
    }
    if (aftModeBtn) {
      aftModeBtn.addEventListener("click", () => setMode("aft"));
    }

    // Start with one blank card in current mode
    resetForMode();

    const saveBtn = $(saveButtonSelector);
    if (saveBtn && typeof onSave === "function") {
      saveBtn.addEventListener("click", () => {
        onSave(getCurrentWorkoutLayout());
      });
    }
  }

  // NEW: reset container when mode changes
  function resetForMode() {
    if (!workoutsContainer) return;
    workoutsContainer.innerHTML = "";

    if (mode === "standard") {
      createWorkoutCard(workoutsContainer);
    } else if (mode === "complex") {
      createComplexCard(workoutsContainer);
    } else if (mode === "aft") {
      createAftCard(workoutsContainer);
    }

    updateFooterVisibility();
  }

  // ---------- Set rows (Weight / Reps) for STANDARD mode ----------
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
    weightInput.placeholder =
      typeof Settings !== "undefined" && Settings.getWeightPlaceholder
        ? Settings.getWeightPlaceholder()
        : "Weight";
    weightInput.type = "number";
    weightInput.inputMode = "decimal";
    weightInput.min = "0";
    weightInput.value = setData?.weight ?? "";
    weightInput.dataset.field = "weight";

    const weightGroup = document.createElement("div");
    weightGroup.className = "set-weight-group";
    weightGroup.appendChild(weightInput);

    const repsInput = document.createElement("input");
    repsInput.className = "set-input";
    repsInput.placeholder = "Reps";
    repsInput.type = "number";
    repsInput.inputMode = "numeric";
    repsInput.min = "0";
    repsInput.value = setData?.reps ?? "";
    repsInput.dataset.field = "reps";

    const minusBtn = document.createElement("button");
    minusBtn.className = "round-btn";
    minusBtn.type = "button";
    minusBtn.setAttribute("aria-label", "Remove set");
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
    plusBtn.type = "button";
    plusBtn.setAttribute("aria-label", "Add set");
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

function renumberComplexCards(parent) {
  const cards = parent.querySelectorAll(".workout-card");
  cards.forEach((card, index) => {
    const nameEl = card.querySelector(".complex-set-label");
    if (nameEl) {
      const labelText = `Set ${index + 1}`;
      nameEl.textContent = labelText;
      nameEl.setAttribute("aria-label", labelText);
    }
  });
}

  
  // ---------- COMPLEX mode rows (exercise per row) ----------
  function createComplexRow(card, rowData) {
    const box = document.createElement("div");
    box.className = "set-box complex-row";

    const exerciseInput = document.createElement("input");
    exerciseInput.className = "text-input complex-exercise-name";
    exerciseInput.placeholder = "Exercise name";
    exerciseInput.value = rowData?.name || "";
    exerciseInput.style.width = "100%";

    // Spacer takes the place of the old weight box column so layout stays aligned
    const spacer = document.createElement("div");
    spacer.className = "complex-row-spacer";

    const repsInput = document.createElement("input");
    repsInput.className = "set-input";
    repsInput.placeholder = "Reps";
    repsInput.type = "number";
    repsInput.inputMode = "numeric";
    repsInput.min = "0";
    repsInput.value = rowData?.reps ?? "";
    repsInput.dataset.field = "reps";

    const weightInput = document.createElement("input");
    weightInput.className = "set-input";
    weightInput.placeholder =
      typeof Settings !== "undefined" && Settings.getWeightPlaceholder
        ? Settings.getWeightPlaceholder()
        : "Weight";
    weightInput.type = "number";
    weightInput.inputMode = "decimal";
    weightInput.min = "0";
    weightInput.value = rowData?.weight ?? "";
    weightInput.dataset.field = "weight";

    const rightGroup = document.createElement("div");
    rightGroup.className = "set-right-group";

    // Order: Reps where the "-" button was, Weight where the "+" button was
    rightGroup.appendChild(repsInput);
    rightGroup.appendChild(weightInput);

    box.appendChild(exerciseInput);
    box.appendChild(spacer);
    box.appendChild(rightGroup);

    return box;
  }

  // ---------- Workout cards (exercises) ----------

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

  // helper so standard + complex share the same quick-add chips
  function attachQuickAddRow(card) {
    const quickAddRow = document.createElement("div");
    quickAddRow.className = "quick-add-row";

    const quickLabel = document.createElement("span");
    quickLabel.className = "quick-add-label";
    quickLabel.textContent = "Quick add:";
    quickAddRow.appendChild(quickLabel);

    [5, 10, 25, 35, 45].forEach((val) => {
      const chip = document.createElement("button");
      chip.className = "quick-add-chip";
      chip.type = "button";
      chip.dataset.quick = String(val);
      chip.textContent = `+${val}`;
      chip.setAttribute("aria-label", `Add ${val} to weight`);
      quickAddRow.appendChild(chip);
    });

    card.appendChild(quickAddRow);
  }

  function createWorkoutCard(parent, workoutData) {
  const card = document.createElement("div");
  card.className = "workout-card";

  const setsWrapper = document.createElement("div");
  setsWrapper.className = "sets-wrapper";

  const header = document.createElement("div");
  header.className = "workout-header";

  // STANDARD MODE: editable exercise name input
  const nameInput = document.createElement("input");
  nameInput.className = "text-input workout-name";
  nameInput.placeholder = "Enter exercise name";
  nameInput.value = (workoutData && workoutData.name) || "";

  // If the card is collapsed, tapping the name expands it
  nameInput.addEventListener("click", () => {
    if (card.classList.contains("collapsed")) {
      setCardCollapsed(card, false);
    }
  });

  const headerActions = document.createElement("div");
  headerActions.className = "workout-header-actions";

  const removeWorkoutBtn = document.createElement("button");
  removeWorkoutBtn.className = "round-btn minus";
  removeWorkoutBtn.type = "button";
  removeWorkoutBtn.setAttribute("aria-label", "Remove exercise card");
  removeWorkoutBtn.textContent = "–";
  removeWorkoutBtn.addEventListener("click", () => {
    const allCards = parent.querySelectorAll(".workout-card");

    if (allCards.length <= 1) {
      // Reset last card instead of deleting
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
  collapseBtn.type = "button";
  collapseBtn.setAttribute("aria-label", "Collapse or expand exercise");
  collapseBtn.textContent = "▼";
  collapseBtn.addEventListener("click", () => {
    const isCollapsed = card.classList.contains("collapsed");
    setCardCollapsed(card, !isCollapsed);
  });

  const addExerciseBtn = document.createElement("button");
  addExerciseBtn.className = "round-btn plus";
  addExerciseBtn.type = "button";
  addExerciseBtn.setAttribute("aria-label", "Add new exercise card");
  addExerciseBtn.textContent = "+";
  addExerciseBtn.addEventListener("click", () => {
    if (mode === "standard") {
      createWorkoutCard(parent);
    } else {
      createComplexCard(parent);
    }
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

  attachQuickAddRow(card);

  parent.appendChild(card);

  if (workoutData && workoutData.collapsed) {
    setCardCollapsed(card, true);
  }

  return card;
}

  // NEW: complex card (multiple exercises inside one card)
// NEW: complex card (multiple exercises inside one card)
function createComplexCard(parent, complexData) {
  const card = document.createElement("div");
  card.className = "workout-card";

  const setsWrapper = document.createElement("div");
  setsWrapper.className = "sets-wrapper";

  const header = document.createElement("div");
  header.className = "workout-header";

  // COMPLEX MODE: static "Set #" label
  const nameLabel = document.createElement("div");
  nameLabel.className = "complex-set-label set-label";

  const existingCards = parent.querySelectorAll(".workout-card").length;
  const setNumber = existingCards + 1;
  const labelText = `Set ${setNumber}`;
  nameLabel.textContent = labelText;
  nameLabel.setAttribute("aria-label", labelText);

  // Controls row: +C, -C, +S, -S (same style/size as weight box)
  const controls = document.createElement("div");
  controls.className = "complex-header-controls";

  function makeCtl(label, action, aria) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "round-btn complex-ctl-btn";
    btn.textContent = label;
    if (aria) btn.setAttribute("aria-label", aria);
    btn.dataset.action = action;
    return btn;
  }

  const addCardBtn    = makeCtl("+C", "add-card",    "Add complex card");
  const removeCardBtn = makeCtl("-C", "remove-card", "Remove complex card");
  const addRowBtn     = makeCtl("+S", "add-row",     "Add set");
  const removeRowBtn  = makeCtl("-S", "remove-row",  "Remove set");

  controls.append(addCardBtn, removeCardBtn, addRowBtn, removeRowBtn);

  header.appendChild(nameLabel);
  header.appendChild(controls);

  // Click on header background/label toggles collapse, NOT the control buttons
  header.addEventListener("click", (e) => {
    if (e.target.closest(".complex-ctl-btn")) return;
    const isCollapsed = card.classList.contains("collapsed");
    setCardCollapsed(card, !isCollapsed);
  });

  card.appendChild(header);
  card.appendChild(setsWrapper);

  const rows =
    complexData && Array.isArray(complexData.rows) ? complexData.rows : [{}];

  rows.forEach((row) => {
    setsWrapper.appendChild(createComplexRow(card, row));
  });

  attachQuickAddRow(card);
  parent.appendChild(card);

  if (complexData && complexData.collapsed) {
    setCardCollapsed(card, true);
  }

  // ---- Control behaviour ----

  // +C → add another complex card at the bottom
  addCardBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    createComplexCard(parent);
    renumberComplexCards(parent);
  });

  // -C → remove THIS card (or reset if it's the last one)
  removeCardBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const cards = parent.querySelectorAll(".workout-card");
    if (cards.length <= 1) {
      const labelEl = card.querySelector(".complex-set-label");
      if (labelEl) {
        labelEl.textContent = "Set 1";
        labelEl.setAttribute("aria-label", "Set 1");
      }
      const wrapper = card.querySelector(".sets-wrapper");
      if (wrapper) {
        wrapper.innerHTML = "";
        wrapper.appendChild(createComplexRow(card));
      }
      return;
    }
    card.remove();
    renumberComplexCards(parent);
  });

  // +S → add a row inside THIS card
  addRowBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setsWrapper.appendChild(createComplexRow(card));
  });

  // -S → remove a row from THIS card
  removeRowBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const rows = setsWrapper.querySelectorAll(".set-box");
    if (!rows.length) return;
    if (rows.length === 1) {
      rows[0].querySelectorAll("input").forEach((input) => {
        input.value = "";
      });
    } else {
      rows[rows.length - 1].remove();
    }
  });

  return card;
}

  // NEW: AFT card (Army Fitness Test, fixed exercises)
  function createAftCard(parent) {
    const card = document.createElement("div");
    card.className = "workout-card aft-card";

    const setsWrapper = document.createElement("div");
    setsWrapper.className = "sets-wrapper";

    const header = document.createElement("div");
    header.className = "workout-header";

    // Title for the AFT card (display-only, gunmetal background)
    const titleInput = document.createElement("div");
    titleInput.className = "text-input workout-name aft-title";
    titleInput.textContent = "Army Fitness Test (AFT)";

    header.appendChild(titleInput);
    card.appendChild(header);
    card.appendChild(setsWrapper);

    // -----------------------------
    // Top row: [M/F] [Age]
    // -----------------------------
    const metaRow = document.createElement("div");
    metaRow.className = "set-box complex-row";

    // invisible left cell to keep right group in the same place
    const metaLeft = document.createElement("div");
    metaLeft.style.visibility = "hidden";
    metaLeft.textContent = "X";

    const metaGroup = document.createElement("div");
    metaGroup.className = "set-right-group";

const genderInput = document.createElement("input");
genderInput.className = "set-input aft-meta-input";
genderInput.placeholder = "M / F";
genderInput.type = "text";
genderInput.maxLength = 1;

const ageInput = document.createElement("input");
ageInput.className = "set-input aft-meta-input";
ageInput.placeholder = "Age";
ageInput.type = "number";
ageInput.inputMode = "numeric";
ageInput.min = "0";

    metaGroup.appendChild(genderInput);
    metaGroup.appendChild(ageInput);

    metaRow.appendChild(metaLeft);
    metaRow.appendChild(metaGroup);
    setsWrapper.appendChild(metaRow);

    // -----------------------------
    // AFT events
    // 3 MDL  -> [Weight] [Score]
    // HRP    -> [Rep]    [Score]
    // SDC    -> [Time]   [Score]
    // PLK    -> [Time]   [Score]
    // 2MR    -> [Time]   [Score]
    // -----------------------------
    const events = ["3 MDL", "HRP", "SDC", "PLK", "2MR"];

    const eventConfig = {
      "3 MDL": {
        primaryPlaceholder:
          typeof Settings !== "undefined" && Settings.getWeightPlaceholder
            ? Settings.getWeightPlaceholder()
            : "Weight",
        primaryType: "number",
        primaryInputMode: "decimal",
        primaryDataset: "weight", // actual weight
        secondaryPlaceholder: "Score",
        secondaryType: "number",
        secondaryInputMode: "numeric",
        secondaryDataset: "reps", // save score as "reps" for progress
      },
      HRP: {
        primaryPlaceholder: "Rep",
        primaryType: "number",
        primaryInputMode: "numeric",
        primaryDataset: "reps", // raw reps
        secondaryPlaceholder: "Score",
        secondaryType: "number",
        secondaryInputMode: "numeric",
        secondaryDataset: null, // score not tied to weight/reps field
      },
      SDC: {
        primaryPlaceholder: "Time",
        primaryType: "text",
        primaryInputMode: "text",
        primaryDataset: null,
        secondaryPlaceholder: "Score",
        secondaryType: "number",
        secondaryInputMode: "numeric",
        secondaryDataset: "reps", // store score
      },
      PLK: {
        primaryPlaceholder: "Time",
        primaryType: "text",
        primaryInputMode: "text",
        primaryDataset: null,
        secondaryPlaceholder: "Score",
        secondaryType: "number",
        secondaryInputMode: "numeric",
        secondaryDataset: "reps",
      },
      "2MR": {
        primaryPlaceholder: "Time",
        primaryType: "text",
        primaryInputMode: "text",
        primaryDataset: null,
        secondaryPlaceholder: "Score",
        secondaryType: "number",
        secondaryInputMode: "numeric",
        secondaryDataset: "reps",
      },
    };

    events.forEach((eventName) => {
      const row = document.createElement("div");
      row.className = "set-box complex-row";

      const exerciseInput = document.createElement("div");
      exerciseInput.className =
        "text-input complex-exercise-name aft-exercise-label";
      exerciseInput.textContent = eventName;

      const spacer = document.createElement("div");
      spacer.className = "complex-row-spacer";

      const cfg = eventConfig[eventName];

      const primaryInput = document.createElement("input");
      primaryInput.className = "set-input  aft-primary-input";
      primaryInput.placeholder = cfg.primaryPlaceholder;
      primaryInput.type = cfg.primaryType;
      if (cfg.primaryInputMode) {
        primaryInput.inputMode = cfg.primaryInputMode;
      }
      if (cfg.primaryType === "number") {
        primaryInput.min = "0";
      }
      if (cfg.primaryDataset) {
        primaryInput.dataset.field = cfg.primaryDataset;
      }

      const secondaryInput = document.createElement("input");
      secondaryInput.className = "set-input  aft-score-input";
      secondaryInput.placeholder = cfg.secondaryPlaceholder;
      secondaryInput.type = cfg.secondaryType;
      if (cfg.secondaryInputMode) {
        secondaryInput.inputMode = cfg.secondaryInputMode;
      }
      if (cfg.secondaryType === "number") {
        secondaryInput.min = "0";
      }
      if (cfg.secondaryDataset) {
        secondaryInput.dataset.field = cfg.secondaryDataset;
      }

      const rightGroup = document.createElement("div");
      rightGroup.className = "set-right-group";
      // order matters visually: [Weight/Rep/Time] [Score]
      rightGroup.appendChild(primaryInput);
      rightGroup.appendChild(secondaryInput);

      row.appendChild(exerciseInput);
      row.appendChild(spacer);
      row.appendChild(rightGroup);

      setsWrapper.appendChild(row);
    });

    // -----------------------------
    // Bottom row: [Total]
    // -----------------------------
    const totalRow = document.createElement("div");
    totalRow.className = "set-box complex-row";

    const totalLeft = document.createElement("div");
    totalLeft.style.visibility = "hidden";
    totalLeft.textContent = "X";

    const totalGroup = document.createElement("div");
    totalGroup.className = "set-right-group";

    const totalInput = document.createElement("input");
    totalInput.className = "set-input  aft-total-input";
    totalInput.placeholder = "Total";
    totalInput.type = "number";
    totalInput.inputMode = "numeric";
    totalInput.min = "0";

    totalGroup.appendChild(totalInput);
    totalRow.appendChild(totalLeft);
    totalRow.appendChild(totalGroup);
    setsWrapper.appendChild(totalRow);

    // IMPORTANT: no quick-add chips on the AFT card
    // (leave quick-add available for Standard / Complex modes only)
    parent.appendChild(card);
    return card;
  }

  // ---------- Helpers ----------

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

  // NEW: read layout in complex mode (exercise per row)
  function getComplexLayoutFromContainer(container) {
    const cards = container.querySelectorAll(".workout-card");
    const byName = {};

    cards.forEach((card) => {
      card.querySelectorAll(".set-box").forEach((box) => {
        const exInput = box.querySelector(".complex-exercise-name");
        const weightInput = box.querySelector('.set-input[data-field="weight"]');
        const repsInput = box.querySelector('.set-input[data-field="reps"]');

        const rawName =
          exInput && typeof exInput.value === "string"
            ? exInput.value
            : (exInput && exInput.textContent) || "";
        const name = rawName.trim();
        const weight = weightInput ? weightInput.value : "";
        const reps = repsInput ? repsInput.value : "";

        // Skip completely empty rows
        if (!name && !weight && !reps) return;
        if (!name) return; // require a name to track progress

        if (!byName[name]) {
          byName[name] = { name, sets: [] };
        }
        byName[name].sets.push({ weight, reps });
      });
    });

    return Object.values(byName);
  }

  function getCurrentWorkoutLayout() {
    if (!workoutsContainer) return [];
    if (mode === "complex" || mode === "aft") {
      return getComplexLayoutFromContainer(workoutsContainer);
    }
    return getWorkoutLayoutFrom(workoutsContainer);
  }

  function applyTemplateToHome(workoutDataArray) {
    if (!workoutsContainer) return;

    // When loading a routine, always go back to Standard mode
    mode = "standard";
    if (modeToggleBtn) {
      modeToggleBtn.textContent = "Standard";
    }

    workoutsContainer.innerHTML = "";
    if (!workoutDataArray || workoutDataArray.length === 0) {
      createWorkoutCard(workoutsContainer);
      return;
    }
    workoutDataArray.forEach((w) => {
      createWorkoutCard(workoutsContainer, w);
    });
  }

  return {
    init,
    getCurrentWorkoutLayout,
    applyTemplateToHome,
    // expose helpers so Templates can use the same card UI in its editor panels
    createCard: createWorkoutCard,
    getLayoutFromContainer: getWorkoutLayoutFrom,
  };
})();

// ======================================================
// Progress module (A–Z grid + detail + saving progress)
// ======================================================
const Progress = (() => {
  // migrate old keys to normalized keys once
  let progressData = migrateProgressKeys(Storage.loadProgress() || {});

  let progressLetterGrid = null;
  let progressListEl = null;
  let progressDetailEl = null;

  let progressByLetter = {};
  let activeProgressLetter = null;

  function init({ gridSelector, listSelector, detailSelector }) {
    progressLetterGrid = $(gridSelector);
    progressListEl = $(listSelector);
    progressDetailEl = $(detailSelector);

    renderProgressList();
  }

  function getData() {
    return progressData;
  }

  // NEW: allow other modules (backup restore) to replace progress data in memory
  function setData(newData) {
    progressData = migrateProgressKeys(newData || {});
  }

  // ---------- Save current workout into progress ----------
  function saveFromWorkouts(workouts) {
    if (!workouts || !workouts.length) return;

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // Copy current data so we don't mutate in-place mid-loop
    const updated = { ...progressData };

    // For this save operation:
    // - keyMapping tracks "rawName → final key" (handles merge choice)
    // - sessionData accumulates all sets per exercise for today
    const keyMapping = {};
    const sessionData = {}; // key -> { rawName, maxReps, bestWeight, bestWeightReps, sets: [] }

    workouts.forEach((w) => {
      const rawName = (w.name || "").trim();
      if (!rawName) return;

      const baseKey = normalizeExerciseKey(rawName);
      if (!baseKey) return;

      // Map normalized key → final key (might be merged with an existing one)
      let finalKey = keyMapping[baseKey];
      if (!finalKey) {
        finalKey = baseKey;

        // If no existing entry, see if there's a similar exercise to merge into
        if (!updated[finalKey]) {
          const similar = findSimilarExistingExercise(baseKey, rawName, updated);
          if (similar && typeof window !== "undefined" && window.confirm) {
            const merge = window.confirm(
              `You logged "${rawName}".\n\n` +
                `There is already progress for "${similar.name}".\n\n` +
                `Press OK to merge them (treat as the same exercise),\n` +
                `or Cancel to keep them separate as a new exercise.`
            );
            if (merge) {
              finalKey = similar.key;
            }
          }
        }

        keyMapping[baseKey] = finalKey;
      }

      if (!sessionData[finalKey]) {
        sessionData[finalKey] = {
          rawName,
          maxReps: 0,
          bestWeight: null,
          bestWeightReps: 0,
          sets: [],
        };
      }

      const acc = sessionData[finalKey];

      (w.sets || []).forEach((set) => {
        const repsNum = parseInt(set.reps, 10);
        const weightStr = (set.weight || "").toString().trim();
        const weightNum = weightStr === "" ? NaN : parseFloat(weightStr);

        const hasReps = !isNaN(repsNum) && repsNum > 0;
        const hasWeight = !isNaN(weightNum) && weightNum > 0;

        // Ignore completely empty sets (both fields blank / zero)
        if (!hasReps && !hasWeight) return;

        if (hasReps && repsNum > acc.maxReps) {
          acc.maxReps = repsNum;
        }

        if (hasWeight) {
          if (
            acc.bestWeight === null ||
            weightNum > acc.bestWeight ||
            (weightNum === acc.bestWeight &&
              hasReps &&
              repsNum > acc.bestWeightReps)
          ) {
            acc.bestWeight = weightNum;
            acc.bestWeightReps = hasReps ? repsNum : acc.bestWeightReps;
          }
        }

        acc.sets.push({
          weight: hasWeight ? weightNum : null,
          reps: hasReps ? repsNum : null,
        });
      });
    });

    // Now fold per-exercise sessionData into overall progress
    Object.entries(sessionData).forEach(([key, acc]) => {
      // If nothing meaningful logged for this exercise, skip it
      if (acc.maxReps === 0 && acc.bestWeight === null) return;

      const existing =
        updated[key] || {
          name: acc.rawName,
          bestReps: 0,
          bestRepsDate: null,
          bestWeight: null,
          bestWeightReps: 0,
          bestWeightDate: null,
          lastUpdated: null,
          history: [],
        };

      // Update PRs
      if (acc.maxReps > (existing.bestReps || 0)) {
        existing.bestReps = acc.maxReps;
        existing.bestRepsDate = now;
      }

      if (acc.bestWeight !== null) {
        if (
          existing.bestWeight === null ||
          acc.bestWeight > existing.bestWeight ||
          (acc.bestWeight === existing.bestWeight &&
            acc.bestWeightReps > (existing.bestWeightReps || 0))
        ) {
          existing.bestWeight = acc.bestWeight;
          existing.bestWeightReps = acc.bestWeightReps;
          existing.bestWeightDate = now;
        }
      }

      // New: per-set snapshot for this day
      const snapshot = {
        date: today,
        bestReps: acc.maxReps,
        bestWeight: acc.bestWeight,
        bestWeightReps: acc.bestWeightReps,
      };

      if (acc.sets && acc.sets.length) {
        snapshot.sets = acc.sets.map((s) => ({
          weight: s.weight,
          reps: s.reps,
        }));

        let volume = 0;
        acc.sets.forEach((s) => {
          if (
            typeof s.weight === "number" &&
            typeof s.reps === "number" &&
            s.weight > 0 &&
            s.reps > 0
          ) {
            volume += s.weight * s.reps;
          }
        });
        snapshot.totalVolume = volume;
      }

      existing.history = Array.isArray(existing.history)
        ? existing.history
        : [];
      // Ensure only one entry per date
      existing.history = existing.history.filter((h) => h.date !== today);
      existing.history.push(snapshot);
      existing.history.sort((a, b) => b.date.localeCompare(a.date));

      // Trim history length if needed
      if (existing.history.length > 30) {
        existing.history = existing.history.slice(0, 30);
      }

      existing.lastUpdated = now;
      existing.name = acc.rawName;

      updated[key] = existing;
    });

    // Save back
    progressData = updated;
    Storage.saveProgress(progressData);
    renderProgressList();

    // NEW: keep charts in sync when saving
    if (typeof Charts !== "undefined" && Charts.refresh) {
      Charts.refresh();
    }
  }

  // ---------- Progress list (A–Z grid + per-letter list) ----------
  function renderProgressList() {
    const grid = progressLetterGrid;
    const list = progressListEl;

    if (!grid || !list) return;

    grid.innerHTML = "";
    list.innerHTML = "";

    const entries = Object.values(progressData || {});
    if (!entries.length) {
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
        const btn = document.createElement("button");
        btn.className = "progress-letter-btn disabled";
        btn.type = "button";
        btn.textContent = letter;
        grid.appendChild(btn);
      });

      const empty = document.createElement("div");
      empty.className = "card-subtitle";
      empty.textContent =
        "No progress saved yet. Log a workout on the home screen and tap 'Save progress'.";
      list.appendChild(empty);

      if (progressDetailEl) {
        progressDetailEl.classList.remove("open");
        progressDetailEl.innerHTML = "";
      }
      return;
    }

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
      const hasAny = !!(
        progressByLetter[letter] && progressByLetter[letter].length
      );
      const btn = document.createElement("button");
      btn.className = "progress-letter-btn";
      btn.type = "button";
      if (!hasAny) btn.classList.add("disabled");
      btn.textContent = letter;

      btn.addEventListener("click", () => {
        if (!hasAny) return;
        activeProgressLetter = letter;

        grid.querySelectorAll(".progress-letter-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });

        updateProgressExerciseList();
      });

      grid.appendChild(btn);
    });

    if (!activeProgressLetter || !progressByLetter[activeProgressLetter]) {
      activeProgressLetter =
        letters.find(
          (l) => progressByLetter[l] && progressByLetter[l].length
        ) || null;
    }

    if (activeProgressLetter) {
      const idx = letters.indexOf(activeProgressLetter);
      if (idx !== -1 && grid.children[idx]) {
        grid.children[idx].classList.add("active");
      }
    }

    updateProgressExerciseList();
  }

  function updateProgressExerciseList() {
    const list = progressListEl;
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

      if (progressDetailEl) {
        progressDetailEl.classList.remove("open");
        progressDetailEl.innerHTML = "";
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
      detail.className = "progress-detail-meta";

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
    if (!progressDetailEl) return;

    progressDetailEl.classList.add("open");
    progressDetailEl.innerHTML = "";

    const title = document.createElement("div");
    title.className = "card-subtitle progress-detail-title";
    title.textContent = ex.name + " — last sessions";
    progressDetailEl.appendChild(title);

    if (ex.bestRepsDate || ex.bestWeightDate) {
      const prInfo = document.createElement("div");
      prInfo.className = "progress-detail-pr";

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
      progressDetailEl.appendChild(prInfo);
    }

    const history = (ex.history || []).slice(0, 5);
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "progress-detail-empty";
      empty.textContent =
        "No detailed history yet. Save progress a few times for this exercise.";
      progressDetailEl.appendChild(empty);
      return;
    }

    history.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "progress-detail-row";

      const left = document.createElement("span");
      left.textContent = formatDateLabel(entry.date);

      const right = document.createElement("span");

      const hasWeight =
        typeof entry.bestWeight === "number" && entry.bestWeight !== null;
      const bestReps = entry.bestReps || 0;

      // NEW: if we have per-set info, show volume + a small sets preview
      const hasSets = Array.isArray(entry.sets) && entry.sets.length > 0;
      const hasVolume =
        typeof entry.totalVolume === "number" && entry.totalVolume > 0;

      if (hasSets) {
        const preview = entry.sets
          .filter(
            (s) =>
              typeof s.weight === "number" &&
              typeof s.reps === "number" &&
              s.weight > 0 &&
              s.reps > 0
          )
          .slice(0, 3)
          .map((s) => `${s.weight}x${s.reps}`)
          .join(", ");

        const more =
          entry.sets.length > 3 ? `, … (+${entry.sets.length - 3} more)` : "";

        const base =
          hasWeight && bestReps
            ? `${entry.bestWeight} x ${entry.bestWeightReps} • Max reps: ${bestReps}`
            : hasWeight
            ? `${entry.bestWeight} x ${entry.bestWeightReps}`
            : `Best: ${bestReps} reps`;

        const volText = hasVolume ? ` • Volume: ${entry.totalVolume}` : "";
        const setsText = preview ? ` • Sets: ${preview}${more}` : "";

        right.textContent = base + volText + setsText;
      } else {
        // Backwards compatible: old entries without per-set data
        if (hasWeight) {
          right.textContent = `${entry.bestWeight} x ${entry.bestWeightReps} • Max reps: ${bestReps}`;
        } else {
          right.textContent = `Best: ${bestReps} reps`;
        }
      }

      row.appendChild(left);
      row.appendChild(right);
      progressDetailEl.appendChild(row);
    });
  }

  function closeDetail() {
    if (!progressDetailEl) return;
    progressDetailEl.classList.remove("open");
    progressDetailEl.innerHTML = "";
  }

  function refreshUI() {
    renderProgressList();
  }

  return {
    init,
    saveFromWorkouts,
    getData,
    setData, // NEW
    refreshUI,
    closeDetail,
  };
})();

// ======================================================
// Charts module (select exercises + show progress charts)
// ======================================================
const Charts = (() => {
  const CHARTS_KEY = "codeAndIronCharts_v1";

  let selectedKeys = [];
  let listEl = null;
  let chartsContainer = null;

  function loadSelected() {
    try {
      const raw = localStorage.getItem(CHARTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Error loading charts selection", e);
      return [];
    }
  }

  function saveSelected() {
    try {
      localStorage.setItem(CHARTS_KEY, JSON.stringify(selectedKeys));
    } catch (e) {
      console.error("Error saving charts selection", e);
    }
  }

  function getProgressData() {
    return typeof Progress !== "undefined" && Progress.getData
      ? Progress.getData()
      : {};
  }

  function init({ listSelector, chartsContainerSelector }) {
    selectedKeys = loadSelected();
    listEl = $(listSelector);
    chartsContainer = $(chartsContainerSelector);
    renderAll();
  }

  function refresh() {
    renderAll();
  }

  function renderAll() {
    if (listEl) renderExerciseList();
    if (chartsContainer) renderCharts();
  }

  function renderExerciseList() {
    const data = getProgressData();
    listEl.innerHTML = "";

    const entries = Object.entries(data || {});
    if (!entries.length) {
      const note = document.createElement("div");
      note.className = "settings-note";
      note.textContent =
        "No exercises yet. Log a workout and save progress to see them here.";
      listEl.appendChild(note);
      return;
    }

    entries
      .sort((a, b) => {
        const nameA = (a[1].name || a[0]).toLowerCase();
        const nameB = (b[1].name || b[0]).toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .forEach(([key, ex]) => {
        const row = document.createElement("label");
        row.className = "settings-row";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = ex.name || key;

        const box = document.createElement("input");
        box.type = "checkbox";
        box.className = "settings-checkbox";
        box.checked = selectedKeys.includes(key);

        box.addEventListener("change", () => {
          if (box.checked) {
            if (!selectedKeys.includes(key)) selectedKeys.push(key);
          } else {
            selectedKeys = selectedKeys.filter((k) => k !== key);
          }
          saveSelected();
          renderCharts();
        });

        row.appendChild(nameSpan);
        row.appendChild(box);
        listEl.appendChild(row);
      });
  }

  function renderCharts() {
    chartsContainer.innerHTML = "";

    const data = getProgressData();
    const activeKeys = selectedKeys.filter((k) => !!data[k]);

    if (!activeKeys.length) {
      const note = document.createElement("div");
      note.className = "card-subtitle";
      note.textContent =
        "No charts yet. Select one or more exercises above.";
      chartsContainer.appendChild(note);
      return;
    }

    activeKeys.forEach((key) => {
      const ex = data[key];
      const card = document.createElement("div");
      card.className = "chart-card";

      const title = document.createElement("div");
      title.className = "chart-card-title";
      title.textContent = ex.name || key;
      card.appendChild(title);

      const sub = document.createElement("div");
      sub.className = "chart-card-sub";
      sub.textContent = "Newest sessions are on the right.";
      card.appendChild(sub);

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 140;
      canvas.style.width = "100%";
      canvas.style.height = "90px";
      card.appendChild(canvas);

      chartsContainer.appendChild(card);

      drawExerciseChart(canvas, ex);
    });
  }

  // Simple line chart: prefers volume, then weight, then reps
  function drawExerciseChart(canvas, ex) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const history = Array.isArray(ex.history) ? ex.history.slice() : [];
    if (!history.length) {
      ctx.fillStyle = "#bbbbbb";
      ctx.font =
        "11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("No history yet.", 10, 20);
      return;
    }

    // Oldest → newest, cap to last 12 entries
    const ordered = history.slice().reverse(); // now oldest → newest
    const maxPoints = 12;
    const slice = ordered.slice(-maxPoints);

    const points = slice.map((entry) => {
      let value;
      let mode = "volume";

      if (
        typeof entry.totalVolume === "number" &&
        entry.totalVolume > 0
      ) {
        value = entry.totalVolume;
      } else if (
        typeof entry.bestWeight === "number" &&
        entry.bestWeight > 0
      ) {
        value = entry.bestWeight;
        mode = "weight";
      } else {
        value = entry.bestReps || 0;
        mode = "reps";
      }

      return { value, mode };
    });

    const maxVal = points.reduce((max, p) => Math.max(max, p.value), 0);
    if (!maxVal) {
      ctx.fillStyle = "#bbbbbb";
      ctx.font =
        "11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("No numeric data yet.", 10, 20);
      return;
    }

    const paddingLeft = 30;
    const paddingRight = 8;
    const paddingTop = 12;
    const paddingBottom = 20;
    const chartW = canvas.width - paddingLeft - paddingRight;
    const chartH = canvas.height - paddingTop - paddingBottom;

    const n = points.length;
    const bottomY = canvas.height - paddingBottom;

    // Axes
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, bottomY);
    ctx.lineTo(canvas.width - paddingRight, bottomY);
    ctx.stroke();

    // Compute x/y for each point
    const coords = points.map((p, i) => {
      const ratio = p.value / maxVal;
      const y = bottomY - ratio * chartH;

      let x;
      if (n === 1) {
        // single point → center it
        x = paddingLeft + chartW / 2;
      } else {
        const step = chartW / (n - 1);
        x = paddingLeft + step * i;
      }
      return { x, y, value: p.value, mode: p.mode };
    });

    // Line
    ctx.beginPath();
    coords.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = "#39ff14"; // neon line
    ctx.lineWidth = 2;
    ctx.stroke();

    // Points (little circles)
    ctx.fillStyle = "#39ff14";
    coords.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Label: what we're plotting + max value
    const lastMode = points[points.length - 1].mode;
    let label;
    if (lastMode === "volume") {
      label = "Volume (weight × reps)";
    } else if (lastMode === "weight") {
      label = "Best weight";
    } else {
      label = "Best reps";
    }

    ctx.fillStyle = "#bbbbbb";
    ctx.font =
      "10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${label} — max ${maxVal}`, paddingLeft, 2);
  }

  // Public API for Charts
  return {
    init,
    refresh,
  };
})();

// ======================================================
// Templates module (routines screen + share + backup)
// ======================================================
const Templates = (() => {
  const ROUTINE_SHARE_PREFIX = "C1:";
  const LEGACY_SHARE_PREFIX = "CIROUTINEv1:";

  let templates = Storage.loadTemplates();

  let templateNameInput;
  let saveTemplateBtn;
  let savedTemplatesList;
  let backToLoggerBtn;

  // Backup UI
  let backupText;
  let exportBackupBtn;
  let importBackupBtn;

  function init({
    nameInputSelector,
    saveButtonSelector,
    listSelector,
    backButtonSelector,
    backupTextSelector,
    exportButtonSelector,
    importButtonSelector,
  }) {
    templateNameInput = $(nameInputSelector);
    saveTemplateBtn = $(saveButtonSelector);
    savedTemplatesList = $(listSelector);
    backToLoggerBtn = $(backButtonSelector);

    backupText = $(backupTextSelector);
    exportBackupBtn = $(exportButtonSelector);
    importBackupBtn = $(importButtonSelector);

    if (saveTemplateBtn) {
      saveTemplateBtn.addEventListener("click", onSaveTemplateClicked);
    }

    if (backToLoggerBtn) {
      backToLoggerBtn.addEventListener("click", () => {
        App.showScreen("home");
      });
    }

    // Backup handlers
    if (exportBackupBtn && backupText) {
      exportBackupBtn.addEventListener("click", () => {
        const backupString = createBackupString();
        if (!backupString) return;
        backupText.value = backupString;

        if (typeof showToast === "function") {
          showToast("Backup code generated. Copy & save it!");
        } else {
          alert("Backup code generated. Copy it and save it somewhere safe.");
        }
      });
    }

    if (importBackupBtn && backupText) {
      importBackupBtn.addEventListener("click", () => {
        const str = backupText.value.trim();
        if (!str) {
          alert("Paste a backup code first.");
          return;
        }

        const ok = window.confirm(
          "Restoring from backup will overwrite your current routines and progress " +
            "with the data in the box.\n\n" +
            "Are you sure you want to restore from backup?"
        );
        if (!ok) {
          return;
        }

        restoreFromBackupString(str);
      });
    }

    renderTemplatesList();
  }

  function getTemplates() {
    return templates;
  }

  // ---------- Share codes ----------

  function makeShareCode(tpl) {
    const payload = {
      n: tpl.name || "Shared routine",
      w: (tpl.workouts || []).map((ex) => ({
        n: ex.name || "",
        s: (ex.sets || []).map((set) => ({
          w: set.weight ?? "",
          r: set.reps ?? "",
        })),
      })),
    };

    return ROUTINE_SHARE_PREFIX + btoa(JSON.stringify(payload));
  }

  function tryImportShareCode(rawCode) {
    try {
      if (rawCode.startsWith(ROUTINE_SHARE_PREFIX)) {
        const encoded = rawCode.slice(ROUTINE_SHARE_PREFIX.length);
        const payload = JSON.parse(atob(encoded));

        const workouts = (payload.w || []).map((ex) => ({
          name: ex.n || "",
          sets: (ex.s || []).map((set) => ({
            weight: set.w ?? "",
            reps: set.r ?? "",
          })),
        }));

        return {
          name: payload.n || "Shared routine",
          workouts:
            workouts && workouts.length
              ? workouts
              : [{ name: "", sets: [{ weight: "", reps: "" }] }],
        };
      }

      if (rawCode.startsWith(LEGACY_SHARE_PREFIX)) {
        const encoded = rawCode.slice(LEGACY_SHARE_PREFIX.length);
        const payload = JSON.parse(atob(encoded));

        const safeWorkouts =
          payload.workouts && payload.workouts.length
            ? payload.workouts
            : [{ name: "", sets: [{ weight: "", reps: "" }] }];

        return {
          name: payload.name || "Shared routine",
          workouts: safeWorkouts,
        };
      }

      return null;
    } catch (e) {
      console.error("Bad share code", e);
      return null;
    }
  }

  // ---------- Backup & restore (templates + progress) ----------
  function getBackupObject() {
    const progressData = Progress.getData ? Progress.getData() : {};
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

      if (parsed.templates && Array.isArray(parsed.templates)) {
        templates = parsed.templates;
        Storage.saveTemplates(templates);
        renderTemplatesList();
      }

      if (parsed.progressData && typeof parsed.progressData === "object") {
        // Save to storage
        Storage.saveProgress(parsed.progressData);
        // NEW: update Progress module's in-memory state
        if (Progress.setData) {
          Progress.setData(parsed.progressData);
        }
        // Refresh UI for Progress
        Progress.refreshUI();
        // NEW: keep charts in sync with restored backup
        if (typeof Charts !== "undefined" && Charts.refresh) {
          Charts.refresh();
        }
      }

      if (typeof showToast === "function") {
        showToast("Backup restored!");
      } else {
        alert("Backup restored!");
      }
    } catch (e) {
      console.error("Error restoring backup", e);
      alert(
        "That backup code was invalid. Make sure you pasted the whole thing."
      );
    }
  }

  // ---------- Templates UI ----------

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

    // use Logger's card factory so the UI matches the main logger screen
    data.forEach((w) => Logger.createCard(innerContainer, w));
  }

  function closePanelAndSave(panel) {
    const index = parseInt(panel.dataset.index, 10);
    if (!isNaN(index) && templates[index]) {
      const inner = panel.querySelector(".workouts-container");
      if (inner) {
        // read layout from the panel using Logger helper
        const workouts = Logger.getLayoutFromContainer(inner);
        templates[index].workouts = workouts;
        Storage.saveTemplates(templates);
      }
    }
    panel.classList.remove("open");
    panel.innerHTML = "";
  }

  function renderTemplatesList() {
    if (!savedTemplatesList) return;

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
      name.title = tpl.name || "Untitled routine";
      row.appendChild(name);

      const btnWrap = document.createElement("div");
      btnWrap.className = "saved-buttons";

      const shareBtn = document.createElement("button");
      shareBtn.className = "small-btn share";
      shareBtn.type = "button";
      shareBtn.textContent = "Share";
      shareBtn.addEventListener("click", () => {
        const code = makeShareCode(tpl);
        if (templateNameInput) {
          templateNameInput.value = code;
        }
        alert(
          "Share code generated and placed in the 'New routine name' box.\n\n" +
            "Copy it and send it to your friend. They can paste it into the same box " +
            "and tap Create to import this routine."
        );
      });
      btnWrap.appendChild(shareBtn);

      const loadBtn = document.createElement("button");
      loadBtn.className = "small-btn load";
      loadBtn.type = "button";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        Logger.applyTemplateToHome(tpl.workouts || []);
        App.showScreen("home");
      });
      btnWrap.appendChild(loadBtn);

      const openBtn = document.createElement("button");
      openBtn.className = "small-btn open";
      openBtn.type = "button";
      openBtn.textContent = "Open";
      btnWrap.appendChild(openBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "small-btn delete";
      delBtn.type = "button";
      delBtn.textContent = "Delete";

      delBtn.addEventListener("click", () => {
        const routineName = tpl.name || "this routine";

        const ok = window.confirm(
          `Delete "${routineName}"?\n\n` +
            "This will remove the routine from your saved workouts, " +
            "but it will NOT delete any past progress."
        );
        if (!ok) return;

        const panel = savedTemplatesList.querySelector(
          `.open-panel[data-index="${index}"]`
        );
        if (panel && panel.classList.contains("open")) {
          closePanelAndSave(panel);
        }

        templates.splice(index, 1);
        Storage.saveTemplates(templates);
        renderTemplatesList();
        Progress.refreshUI();

        if (typeof showToast === "function") {
          showToast("Routine deleted.");
        }
      });

      btnWrap.appendChild(delBtn);

      row.appendChild(btnWrap);
      wrapper.appendChild(row);

      const panel = document.createElement("div");
      panel.className = "open-panel";
      panel.dataset.index = index.toString();
      wrapper.appendChild(panel);

      openBtn.addEventListener("click", () => {
        // If panel is already open → close & save
        if (panel.classList.contains("open")) {
          closePanelAndSave(panel);
          openBtn.textContent = "Open";
          return;
        }

        // Reset all "Open" button labels
        $$(".saved-wrapper .small-btn.open", savedTemplatesList).forEach(
          (btn) => {
            btn.textContent = "Open";
          }
        );

        // Close any other open panels first, saving their data
        openSinglePanel(savedTemplatesList, panel, {
          onClose: closePanelAndSave,
        });

        // Build the editor UI inside this panel
        buildEditorPanel(panel, tpl);
        openBtn.textContent = "Close";
      });

      savedTemplatesList.appendChild(wrapper);
    });
  }

  // Save template button handler
  function onSaveTemplateClicked() {
    if (!templateNameInput) return;

    const raw = templateNameInput.value.trim();
    if (!raw) {
      alert("Give this routine a name first, or paste a share code.");
      return;
    }

    const imported = tryImportShareCode(raw);
    if (imported) {
      templates.push({
        id: Date.now(),
        name: imported.name,
        workouts: JSON.parse(JSON.stringify(imported.workouts)),
      });
      Storage.saveTemplates(templates);
      renderTemplatesList();
      templateNameInput.value = "";

      if (typeof showToast === "function") {
        showToast(`Imported "${imported.name}".`);
      } else {
        alert(`Shared routine imported as "${imported.name}".`);
      }
      return;
    }

    const name = raw;
    const workoutsData = Logger.getCurrentWorkoutLayout();

    const safeWorkouts =
      workoutsData && workoutsData.length
        ? workoutsData
        : [{ name: "", sets: [{ weight: "", reps: "" }] }];

    templates.push({
      id: Date.now(),
      name,
      workouts: JSON.parse(JSON.stringify(safeWorkouts)),
    });

    Storage.saveTemplates(templates);
    renderTemplatesList();
    templateNameInput.value = "";
  }

  return {
    init,
    getTemplates,
  };
})();

// ======================================================
// Tutorial module (overlay + menu item)
// ======================================================
const Tutorial = (() => {
  const TUTORIAL_KEY = "codeAndIronTutorialSeen_v1";

  let overlay;
  let menuReopenItem;

  function init({ overlaySelector, menuItemSelector }) {
    overlay = $(overlaySelector);
    menuReopenItem = $(menuItemSelector);

    if (menuReopenItem) {
      menuReopenItem.addEventListener("click", () => {
        localStorage.removeItem(TUTORIAL_KEY);
        startTutorial();
        App.closeMenu();
      });
    }

    startTutorial();
  }

  function startTutorial() {
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

    const skipBtn = $("#tutorialSkipBtn");
    const startBtn = $("#tutorialStartBtn");

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

  return {
    init,
  };
})();

// ======================================================
// QuickAdd module (weight chips)
// ======================================================
const QuickAdd = (() => {
  let lastFocusedWeightInput = null;

  function init() {
    // Track last-focused weight input anywhere in the app
    document.addEventListener("focusin", (e) => {
      const input = e.target.closest('.set-input[data-field="weight"]');
      if (input) {
        lastFocusedWeightInput = input;
      }
    });

    // Delegate chip clicks
    document.addEventListener("click", (e) => {
      const chip = e.target.closest(".quick-add-chip");
      if (!chip) return;

      const delta = Number(chip.dataset.quick) || 0;
      if (!delta) return;

      // Prefer last focused weight input
      let targetInput = lastFocusedWeightInput;

      // Fallback: first weight input in this workout card
      if (!targetInput) {
        const card = chip.closest(".workout-card");
        if (card) {
          targetInput = card.querySelector('.set-input[data-field="weight"]');
        }
      }

      if (!targetInput) return;

      const raw = (targetInput.value || "").trim();
      const current = raw === "" ? 0 : Number(raw) || 0;
      const next = current + delta;
      targetInput.value = next;
    });
  }

  return {
    init,
  };
})();

// ======================================================
// App orchestrator (navigation, wiring everything)
// ======================================================
const App = (() => {
  let menuButton;
  let menuDropdown;
  let homeScreen;
  let workoutsScreen;
  let progressScreen;
  let chartsScreen;
  let settingsScreen;

  function handleVersionChange() {
    try {
      const lastSeen = localStorage.getItem(VERSION_STORAGE_KEY);
      if (lastSeen !== APP_VERSION) {
        // Store new version
        localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
        // Force the tutorial / "What's new" overlay to show once per version
        localStorage.removeItem("codeAndIronTutorialSeen_v1");
      }
    } catch (e) {
      console.error("Error checking app version", e);
    }
  }

  function sanitizeWorkoutsForSave(workouts) {
    if (!Array.isArray(workouts)) return [];

    const result = [];

    workouts.forEach((w) => {
      const name = (w.name || "").trim();
      const sets = Array.isArray(w.sets) ? w.sets : [];

      const filteredSets = sets.filter((set) => {
        const wRaw = (set.weight ?? "").toString().trim();
        const rRaw = (set.reps ?? "").toString().trim();

        const wNum = wRaw === "" ? 0 : Number(wRaw) || 0;
        const rNum = rRaw === "" ? 0 : Number(rRaw) || 0;

        const weightEmptyOrZero = wRaw === "" || wNum === 0;
        const repsEmptyOrZero = rRaw === "" || rNum === 0;

        // if BOTH are empty/zero, ignore this set
        if (weightEmptyOrZero && repsEmptyOrZero) {
          return false;
        }
        return true;
      });

      // If no name OR no meaningful sets, skip this workout entirely
      if (!name || filteredSets.length === 0) return;

      result.push({
        name,
        sets: filteredSets,
      });
    });

    return result;
  }

  function init() {
    // Privacy footer toggle
    const togglePrivacy = $("#toggle-privacy");
    const privacyPanel = $("#privacy-panel");
    if (togglePrivacy && privacyPanel) {
      togglePrivacy.addEventListener("click", () => {
        privacyPanel.classList.toggle("hidden");
      });
    }

    // Screens & nav
    menuButton = $("#menuButton");
    menuDropdown = $("#menuDropdown");
    homeScreen = $("#homeScreen");
    workoutsScreen = $("#workoutsScreen");
    progressScreen = $("#progressScreen");
    settingsScreen = $("#settingsScreen");
    chartsScreen = $("#chartsScreen");

    if (menuButton) {
      menuButton.setAttribute("aria-haspopup", "true");
      menuButton.setAttribute("aria-expanded", "false");
    }

    const chartsBackBtn = $("#backToLoggerFromCharts");
    if (chartsBackBtn) {
      chartsBackBtn.addEventListener("click", () => showScreen("home"));
    }

    const progressBackBtn = $("#backToLoggerFromProgress");
    if (progressBackBtn) {
      progressBackBtn.addEventListener("click", () => showScreen("home"));
    }

    const settingsBackBtn = $("#backToLoggerFromSettings");
    if (settingsBackBtn) {
      settingsBackBtn.addEventListener("click", () => showScreen("home"));
    }

    if (menuButton && menuDropdown) {
      menuButton.addEventListener("click", () => {
        const isOpen = menuDropdown.classList.toggle("open");
        menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      document.addEventListener("click", (e) => {
        if (
          !menuButton.contains(e.target) &&
          !menuDropdown.contains(e.target)
        ) {
          closeMenu();
        }
      });

      $$(".menu-item[data-nav]").forEach((item) => {
        item.addEventListener("click", () => {
          const nav = item.dataset.nav;

          if (
            nav === "workouts" ||
            nav === "progress" ||
            nav === "charts" ||
            nav === "settings"
          ) {
            showScreen(nav);

            if (nav === "progress") {
              Progress.refreshUI();
            } else if (nav === "charts") {
              if (typeof Charts !== "undefined" && Charts.refresh) {
                Charts.refresh();
              }
            }
          }

          closeMenu();
        });
      });
    }

    // Init modules
    Logger.init({
      containerSelector: "#workoutsContainer",
      saveButtonSelector: "#saveProgressBtn",
      onSave: (rawWorkouts) => {
        const workouts = sanitizeWorkoutsForSave(rawWorkouts);

        if (!workouts.length) {
          alert(
            "Nothing to save yet.\n\nAdd at least one set with weight and/or reps before saving."
          );
          return;
        }

        Progress.saveFromWorkouts(workouts);

        if (typeof showToast === "function") {
          showToast("Progress saved!");
        } else {
          alert("Progress saved!");
        }
      },
    });

    Progress.init({
      gridSelector: "#progressLetterGrid",
      listSelector: "#progressList",
      detailSelector: "#progressDetail",
    });

    Templates.init({
      nameInputSelector: "#templateNameInput",
      saveButtonSelector: "#saveTemplateBtn",
      listSelector: "#savedTemplatesList",
      backButtonSelector: "#backToLogger",
      backupTextSelector: "#backupText",
      exportButtonSelector: "#exportBackupBtn",
      importButtonSelector: "#importBackupBtn",
    });

    handleVersionChange();

    Tutorial.init({
      overlaySelector: "#tutorialOverlay",
      menuItemSelector: "#menuTutorial",
    });

    QuickAdd.init();

    Settings.init({
      unitSelectSelector: "#settingsUnitSelect",
      highContrastSelector: "#settingsHighContrast",
      exportButtonSelector: "#settingsExportBackupBtn",
      resetButtonSelector: "#resetAllDataBtn",
    });

    Charts.init({
      listSelector: "#chartsExerciseList",
      chartsContainerSelector: "#chartsContainer",
    });

    showScreen("home");
  }

  function showScreen(which) {
    if (
      !homeScreen ||
      !workoutsScreen ||
      !progressScreen ||
      !chartsScreen ||
      !settingsScreen
    ) {
      return;
    }

    homeScreen.classList.remove("active");
    workoutsScreen.classList.remove("active");
    progressScreen.classList.remove("active");
    chartsScreen.classList.remove("active");
    settingsScreen.classList.remove("active");

    if (which === "home") {
      homeScreen.classList.add("active");
    } else if (which === "workouts") {
      workoutsScreen.classList.add("active");
    } else if (which === "progress") {
      progressScreen.classList.add("active");
    } else if (which === "charts") {
      chartsScreen.classList.add("active");
    } else if (which === "settings") {
      settingsScreen.classList.add("active");
    }
  }

  function closeMenu() {
    if (menuDropdown) {
      menuDropdown.classList.remove("open");
    }
    if (menuButton) {
      menuButton.setAttribute("aria-expanded", "false");
    }
  }

  return {
    init,
    showScreen,
    closeMenu,
  };
})();

// ======================================================
// Boot
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
