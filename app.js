// ======================================================
// DOM helpers
// ======================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

  if (!toastEl) {
    alert(message);
    return;
  }

  toastEl.textContent = message;
  toastEl.classList.add("visible");

  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = setTimeout(() => {
    toastEl.classList.remove("visible");
  }, duration);
}

// ======================================================
// Exercise key normalization + migration helpers
// ======================================================
// ... unchanged normalize/merge/migrate helpers ...

// ======================================================
// Storage module (versioned templates + progress)
// ======================================================
// ... unchanged Storage ...

// ======================================================
// Settings module (units, theme, data control)
// ======================================================
// ... unchanged Settings ...

// ======================================================
// Logger module (home screen workout cards & sets)
// ======================================================
const Logger = (() => {
  let workoutsContainer = null;

  // NEW: track current mode ("standard" | "complex")
  let mode = "standard";
  let modeToggleBtn = null;

  function init({ containerSelector, saveButtonSelector, onSave }) {
    workoutsContainer = $(containerSelector);

    if (!workoutsContainer) {
      console.warn("Logger: workouts container not found:", containerSelector);
      return;
    }

    modeToggleBtn = $("#loggerModeToggle");
    if (modeToggleBtn) {
      modeToggleBtn.textContent = "Standard";
      modeToggleBtn.addEventListener("click", () => {
        mode = mode === "standard" ? "complex" : "standard";
        modeToggleBtn.textContent =
          mode === "standard" ? "Standard" : "Complex";

        resetForMode();

        if (typeof showToast === "function") {
          showToast(
            mode === "standard"
              ? "Standard mode: one exercise per card."
              : "Complex mode: exercise per row."
          );
        }
      });
    }

    // Start with one blank card in the current mode
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
    } else {
      createComplexCard(workoutsContainer);
    }
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

  // ---------- COMPLEX mode rows (exercise per row) ----------
  function createComplexRow(card, rowData) {
    const box = document.createElement("div");
    box.className = "set-box";

    const exerciseInput = document.createElement("input");
    exerciseInput.className = "text-input complex-exercise-name";
    exerciseInput.placeholder = "Exercise name";
    exerciseInput.value = rowData?.name || "";
    exerciseInput.style.width = "100%";

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

    const weightGroup = document.createElement("div");
    weightGroup.className = "set-weight-group";
    weightGroup.appendChild(weightInput);

    const repsInput = document.createElement("input");
    repsInput.className = "set-input";
    repsInput.placeholder = "Reps";
    repsInput.type = "number";
    repsInput.inputMode = "numeric";
    repsInput.min = "0";
    repsInput.value = rowData?.reps ?? "";
    repsInput.dataset.field = "reps";

    const minusBtn = document.createElement("button");
    minusBtn.className = "round-btn";
    minusBtn.type = "button";
    minusBtn.setAttribute("aria-label", "Remove exercise row");
    minusBtn.textContent = "–";
    minusBtn.addEventListener("click", () => {
      const rows = card.querySelectorAll(".set-box");
      if (rows.length > 1) {
        box.remove();
      }
    });

    const plusBtn = document.createElement("button");
    plusBtn.className = "round-btn";
    plusBtn.type = "button";
    plusBtn.setAttribute("aria-label", "Add exercise row");
    plusBtn.textContent = "+";
    plusBtn.addEventListener("click", () => {
      const wrapper = card.querySelector(".sets-wrapper") || card;
      wrapper.appendChild(createComplexRow(card));
    });

    const rightGroup = document.createElement("div");
    rightGroup.className = "set-right-group";
    rightGroup.appendChild(repsInput);
    rightGroup.appendChild(minusBtn);
    rightGroup.appendChild(plusBtn);

    box.appendChild(exerciseInput);
    box.appendChild(weightGroup);
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

    const nameInput = document.createElement("input");
    nameInput.className = "text-input workout-name";
    nameInput.placeholder = "Enter exercise name";
    nameInput.setAttribute("aria-label", "Exercise name");
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
    removeWorkoutBtn.type = "button";
    removeWorkoutBtn.setAttribute("aria-label", "Remove exercise card");
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
  function createComplexCard(parent, complexData) {
    const card = document.createElement("div");
    card.className = "workout-card";

    const setsWrapper = document.createElement("div");
    setsWrapper.className = "sets-wrapper";

    const header = document.createElement("div");
    header.className = "workout-header";

    const nameInput = document.createElement("input");
    nameInput.className = "text-input workout-name";
    nameInput.placeholder = "Complex name (optional)";
    nameInput.setAttribute("aria-label", "Complex name");
    if (complexData && complexData.name) {
      nameInput.value = complexData.name;
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
    removeWorkoutBtn.type = "button";
    removeWorkoutBtn.setAttribute("aria-label", "Remove complex card");
    removeWorkoutBtn.textContent = "–";
    removeWorkoutBtn.addEventListener("click", () => {
      const allCards = parent.querySelectorAll(".workout-card");
      if (allCards.length <= 1) {
        nameInput.value = "";
        const setsWrapper = card.querySelector(".sets-wrapper");
        if (setsWrapper) {
          setsWrapper.innerHTML = "";
          setsWrapper.appendChild(createComplexRow(card));
        }
      } else {
        card.remove();
      }
    });

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "round-btn collapse-btn";
    collapseBtn.type = "button";
    collapseBtn.setAttribute("aria-label", "Collapse or expand complex");
    collapseBtn.textContent = "▼";
    collapseBtn.addEventListener("click", () => {
      const isCollapsed = card.classList.contains("collapsed");
      setCardCollapsed(card, !isCollapsed);
    });

    const addComplexBtn = document.createElement("button");
    addComplexBtn.className = "round-btn plus";
    addComplexBtn.type = "button";
    addComplexBtn.setAttribute("aria-label", "Add new complex card");
    addComplexBtn.textContent = "+";
    addComplexBtn.addEventListener("click", () => {
      createComplexCard(parent);
    });

    headerActions.appendChild(removeWorkoutBtn);
    headerActions.appendChild(collapseBtn);
    headerActions.appendChild(addComplexBtn);

    header.appendChild(nameInput);
    header.appendChild(headerActions);

    card.appendChild(header);
    card.appendChild(setsWrapper);

    const rows =
      complexData && Array.isArray(complexData.rows)
        ? complexData.rows
        : [{}];

    rows.forEach((row) => {
      setsWrapper.appendChild(createComplexRow(card, row));
    });

    attachQuickAddRow(card);

    parent.appendChild(card);

    if (complexData && complexData.collapsed) {
      setCardCollapsed(card, true);
    }

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

        const name = exInput ? exInput.value.trim() : "";
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
    if (mode === "complex") {
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
    createCard: createWorkoutCard,
    getLayoutFromContainer: getWorkoutLayoutFrom,
  };
})();

// ======================================================
// Progress module (A–Z grid + detail + saving progress)
// ======================================================
// ... unchanged ...

// ======================================================
// Charts module
// ======================================================
// ... unchanged ...

// ======================================================
// Templates module
// ======================================================
// ... unchanged ...

// ======================================================
// Tutorial module
// ======================================================
// ... unchanged ...

// ======================================================
// QuickAdd module
// ======================================================
// ... unchanged ...

// ======================================================
// App orchestrator
// ======================================================
// ... unchanged App (no changes needed) ...

// ======================================================
// Boot
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});