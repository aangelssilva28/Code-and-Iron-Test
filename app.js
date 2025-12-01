// ===== Storage Module =====
const Storage = (() => {
  const STORAGE_KEY = "codeAndIronTemplates_v2";
  const PROGRESS_KEY = "codeAndIronProgress_v1";
  const BACKUP_KEY = "codeAndIronBackup_v1";

  function loadTemplates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load templates", e);
      return [];
    }
  }

  function saveTemplates(tpls) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tpls));
    } catch (e) {
      console.error("Failed to save templates", e);
    }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("Failed to load progress", e);
      return {};
    }
  }

  function saveProgress(data) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save progress", e);
    }
  }

  // optional: backup all app data in one lump
  function backupAll() {
    try {
      const data = {
        templates: loadTemplates(),
        progress: loadProgress(),
        timestamp: Date.now()
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to backup", e);
    }
  }

  function loadBackup() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Failed to load backup", e);
      return null;
    }
  }

  return {
    loadTemplates,
    saveTemplates,
    loadProgress,
    saveProgress,
    backupAll,
    loadBackup
  };
})();

// ===== Logger Module =====
const Logger = (() => {
  let currentLayout = null;   // e.g. template for today
  let currentLog = [];        // array of { exerciseId, sets: [...] }

  // DOM cache if needed
  let loggerRootEl = null;

  function init({ rootSelector }) {
    loggerRootEl = document.querySelector(rootSelector);
    if (!loggerRootEl) {
      console.warn("Logger root not found:", rootSelector);
    }
    // initial render or listeners
  }

  function getCurrentLayout() {
    return currentLayout;
  }

  function applyLayout(layout) {
    currentLayout = layout;
    currentLog = []; // reset log for fresh session
    renderLayout();
  }

  function renderLayout() {
    if (!loggerRootEl || !currentLayout) return;

    // Clear and rebuild cards based on currentLayout
    loggerRootEl.innerHTML = "";
    currentLayout.exercises.forEach(ex => {
      const card = document.createElement("div");
      card.className = "exercise-card";
      card.dataset.exerciseId = ex.id;
      card.innerHTML = `
        <h3>${ex.name}</h3>
        <div class="sets"></div>
        <button class="add-set-btn">+ Set</button>
      `;
      loggerRootEl.appendChild(card);
    });

    // reattach listeners
    loggerRootEl.addEventListener("click", handleLoggerClick);
  }

  function handleLoggerClick(e) {
    const addBtn = e.target.closest(".add-set-btn");
    if (addBtn) {
      const card = addBtn.closest(".exercise-card");
      const exerciseId = card.dataset.exerciseId;
      addSet(exerciseId);
    }
  }

  function addSet(exerciseId) {
    // find or create log entry
    let entry = currentLog.find(l => l.exerciseId === exerciseId);
    if (!entry) {
      entry = { exerciseId, sets: [] };
      currentLog.push(entry);
    }

    const newSet = { reps: 0, weight: 0 }; // or whatever your schema is
    entry.sets.push(newSet);

    renderSetsForExercise(exerciseId);
  }

  function renderSetsForExercise(exerciseId) {
    if (!loggerRootEl) return;
    const card = loggerRootEl.querySelector(`.exercise-card[data-exercise-id="${exerciseId}"]`);
    if (!card) return;

    const setsContainer = card.querySelector(".sets");
    const entry = currentLog.find(l => l.exerciseId === exerciseId);
    setsContainer.innerHTML = "";

    if (!entry) return;

    entry.sets.forEach((set, idx) => {
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <span>Set ${idx + 1}</span>
        <input type="number" class="set-reps" value="${set.reps}" data-index="${idx}">
        <input type="number" class="set-weight" value="${set.weight}" data-index="${idx}">
      `;
      setsContainer.appendChild(row);
    });
  }

  function getCurrentLog() {
    return currentLog;
  }

  return {
    init,
    getCurrentLayout,
    applyLayout,
    getCurrentLog
  };
})();

// ===== Templates Module =====
const Templates = (() => {
  let templates = [];
  let selectedTemplateId = null;

  let rootEl = null;

  function init({ rootSelector }) {
    rootEl = document.querySelector(rootSelector);
    templates = Storage.loadTemplates();
    renderList();
    attachEvents();
  }

  function attachEvents() {
    if (!rootEl) return;
    rootEl.addEventListener("click", e => {
      const selectBtn = e.target.closest("[data-template-id]");
      if (selectBtn) {
        const id = selectBtn.dataset.templateId;
        selectTemplate(id);
      }
    });

    // plus events for add / edit / delete buttons
  }

  function renderList() {
    if (!rootEl) return;
    rootEl.innerHTML = "";

    templates.forEach(tpl => {
      const item = document.createElement("div");
      item.className = "template-item";
      item.innerHTML = `
        <button data-template-id="${tpl.id}">
          ${tpl.name}
        </button>
      `;
      rootEl.appendChild(item);
    });
  }

  function selectTemplate(id) {
    selectedTemplateId = id;
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;

    // Let App / Logger handle applying it
    if (typeof App !== "undefined" && App.onTemplateSelected) {
      App.onTemplateSelected(tpl);
    }
  }

  function createTemplate(data) {
    const newTpl = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      ...data
    };
    templates.push(newTpl);
    Storage.saveTemplates(templates);
    renderList();
  }

  function updateTemplate(id, updates) {
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;
    Object.assign(tpl, updates);
    Storage.saveTemplates(templates);
    renderList();
  }

  function deleteTemplate(id) {
    templates = templates.filter(t => t.id !== id);
    Storage.saveTemplates(templates);
    renderList();
  }

  function getTemplates() {
    return templates;
  }

  return {
    init,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
  };
})();

// ===== Progress Module =====
const Progress = (() => {
  let progressData = {}; // { "A": { completed: true, ... }, ... }

  let gridRootEl = null;
  let detailRootEl = null;

  function init({ gridSelector, detailSelector }) {
    gridRootEl = document.querySelector(gridSelector);
    detailRootEl = document.querySelector(detailSelector);

    progressData = Storage.loadProgress();
    renderGrid();
    attachEvents();
  }

  function attachEvents() {
    if (!gridRootEl) return;
    gridRootEl.addEventListener("click", e => {
      const cell = e.target.closest("[data-letter]");
      if (cell) {
        const letter = cell.dataset.letter;
        showDetail(letter);
      }
    });
  }

  function renderGrid() {
    if (!gridRootEl) return;
    gridRootEl.innerHTML = "";

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    letters.forEach(letter => {
      const data = progressData[letter] || {};
      const cell = document.createElement("div");
      cell.className = "progress-cell" + (data.completed ? " completed" : "");
      cell.dataset.letter = letter;
      cell.textContent = letter;
      gridRootEl.appendChild(cell);
    });
  }

  function showDetail(letter) {
    if (!detailRootEl) return;
    const data = progressData[letter] || {};
    detailRootEl.innerHTML = `
      <h2>${letter}</h2>
      <p>Status: ${data.completed ? "Completed" : "Not completed"}</p>
      <!-- Add more detail fields as needed -->
    `;
  }

  // Called by App when a workout is logged/finished
  function updateFromData(newData) {
    // newData: e.g. { letter: "A", completed: true, date: "...", volume: 1234 }
    if (!newData || !newData.letter) return;
    progressData[newData.letter] = {
      ...(progressData[newData.letter] || {}),
      ...newData
    };
    Storage.saveProgress(progressData);
    renderGrid();
  }

  function getData() {
    return progressData;
  }

  return {
    init,
    updateFromData,
    getData
  };
})();

// ===== Tutorial Module =====
const Tutorial = (() => {
  let overlayEl = null;
  let isVisible = false;

  function init({ overlaySelector }) {
    overlayEl = document.querySelector(overlaySelector);
    if (!overlayEl) return;

    overlayEl.addEventListener("click", e => {
      if (e.target.matches(".tutorial-close, .tutorial-overlay")) {
        hide();
      }
    });
  }

  function show(stepId) {
    if (!overlayEl) return;
    isVisible = true;
    overlayEl.classList.add("visible");

    // You can swap content by stepId if desired
    if (stepId) {
      overlayEl.dataset.step = stepId;
    }
  }

  function hide() {
    if (!overlayEl) return;
    isVisible = false;
    overlayEl.classList.remove("visible");
  }

  function toggle() {
    isVisible ? hide() : show();
  }

  return {
    init,
    show,
    hide,
    toggle
  };
})();

// ===== App Orchestrator =====
const App = (() => {

  function init() {
    // Initialize all modules with selectors
    Templates.init({ rootSelector: "#templates-root" });
    Logger.init({ rootSelector: "#logger-root" });
    Progress.init({ gridSelector: "#progress-grid", detailSelector: "#progress-detail" });
    Tutorial.init({ overlaySelector: "#tutorial-overlay" });

    // Hook up UI-level buttons
    wireGlobalButtons();
  }

  function wireGlobalButtons() {
    const startTutorialBtn = document.querySelector("#start-tutorial-btn");
    if (startTutorialBtn) {
      startTutorialBtn.addEventListener("click", () => {
        Tutorial.show("welcome");
      });
    }

    const finishWorkoutBtn = document.querySelector("#finish-workout-btn");
    if (finishWorkoutBtn) {
      finishWorkoutBtn.addEventListener("click", handleWorkoutFinish);
    }
  }

  // Called by Templates when the user selects a routine
  function onTemplateSelected(template) {
    Logger.applyLayout(template.layout);
    // optionally mark some “current letter” somewhere
  }

  function handleWorkoutFinish() {
    const log = Logger.getCurrentLog();
    // Convert log into whatever shape Progress expects
    const summary = summarizeLogToProgress(log);

    Progress.updateFromData(summary);
    Storage.backupAll();
  }

  // Example mapping from log → progress summary
  function summarizeLogToProgress(log) {
    // Dummy example: map to letter "A" and mark completed
    return {
      letter: "A",
      completed: true,
      volume: calcTotalVolume(log),
      date: new Date().toISOString()
    };
  }

  function calcTotalVolume(log) {
    return log.reduce((total, ex) => {
      const exVol = ex.sets.reduce((v, s) => v + (Number(s.reps) * Number(s.weight || 0)), 0);
      return total + exVol;
    }, 0);
  }

  // Tiny public API
  return {
    init,
    onTemplateSelected
  };
})();

// Run once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});