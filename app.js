/****************************************************
 * DOM helpers
 ****************************************************/
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/****************************************************
 * Toast
 ****************************************************/
let _toastTimeoutId = null;

function showToast(msg, duration = 2200) {
  const el = $("#toast");
  if (!el) return alert(msg);

  el.textContent = msg;
  el.classList.remove("hidden");
  el.classList.add("show");

  if (_toastTimeoutId) clearTimeout(_toastTimeoutId);

  _toastTimeoutId = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.classList.add("hidden"), 300);
  }, duration);
}

/****************************************************
 * Confirm dialog
 ****************************************************/
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";

    overlay.innerHTML = `
      <div class="confirm-box">
        <p>${message.replace(/\n/g, "<br>")}</p>
        <div class="confirm-actions">
          <button class="btn-confirm">Yes</button>
          <button class="btn-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".btn-confirm").onclick = () => {
      overlay.remove();
      resolve(true);
    };
    overlay.querySelector(".btn-cancel").onclick = () => {
      overlay.remove();
      resolve(false);
    };
  });
}

/****************************************************
 * Version popup
 ****************************************************/
const APP_VERSION = "0.9.1";
const VERSION_KEY = "codeAndIronLastSeenVersion_v1";

function checkVersionChange() {
  const lastSeen = localStorage.getItem(VERSION_KEY);

  if (lastSeen !== APP_VERSION) {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    showWhatsNewModal();
  }
}

function showWhatsNewModal() {
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";

  overlay.innerHTML = `
    <div class="confirm-box">
      <h3>What's New (v${APP_VERSION})</h3>
      <ul style="padding-left:16px;margin:8px 0;">
        <li>Toast messages</li>
        <li>Are-you-sure dialogs</li>
        <li>Improved PWA support</li>
      </ul>
      <div class="confirm-actions">
        <button class="btn-confirm">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("button").onclick = () => overlay.remove();
}

/****************************************************
 * Storage (templates + progress)
 ****************************************************/
const Storage = (() => {
  const TEMPLATE_KEY = "codeAndIronTemplates_v2";
  const PROGRESS_KEY = "codeAndIronProgress_v1";

  function loadTemplates() {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveTemplates(data) {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data));
  }

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveProgress(data) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  }

  return { loadTemplates, saveTemplates, loadProgress, saveProgress };
})();

/****************************************************
 * Templates
 ****************************************************/
const Templates = (() => {
  let templates = [];

  function init() {
    templates = Storage.loadTemplates();
    renderTemplatesList();

    $("#saveTemplateBtn").onclick = onSaveTemplateClicked;

    const backupText = $("#backupText");

    $("#exportBackupBtn").onclick = () => {
      const code = btoa(JSON.stringify(templates));
      backupText.value = code;
      showToast("Backup code generated!");
    };

    $("#importBackupBtn").onclick = async () => {
      const raw = backupText.value.trim();
      if (!raw) return showToast("Paste a backup code first.");

      const ok = await showConfirm("Restore backup? This overwrites everything.");
      if (!ok) return;

      try {
        templates = JSON.parse(atob(raw));
        Storage.saveTemplates(templates);
        renderTemplatesList();
        showToast("Backup restored!");
      } catch {
        showToast("Invalid backup code.");
      }
    };
  }

  function onSaveTemplateClicked() {
    const name = $("#templateNameInput").value.trim();
    if (!name) return showToast("Enter a name.");

    templates.push({ name });
    Storage.saveTemplates(templates);
    renderTemplatesList();

    $("#templateNameInput").value = "";
    showToast("Template saved.");
  }

  function renderTemplatesList() {
    const box = $("#savedTemplatesList");
    box.innerHTML = "";

    templates.forEach((t, i) => {
      const div = document.createElement("div");
      div.className = "card";

      div.innerHTML = `
        <strong>${t.name}</strong>
        <button class="primary-btn" style="background:#444;color:white;margin-top:10px;" data-del="${i}">
          Delete
        </button>
      `;

      div.querySelector("button").onclick = async () => {
        const ok = await showConfirm("Delete this routine?");
        if (!ok) return;

        templates.splice(i, 1);
        Storage.saveTemplates(templates);
        renderTemplatesList();
        showToast("Routine deleted.");
      };

      box.appendChild(div);
    });
  }

  return { init };
})();

/****************************************************
 * Settings
 ****************************************************/
const Settings = (() => {
  const KEY = "codeAndIronSettings_v1";

  let state = {
    unit: "lb",
    highContrast: false,
  };

  function load() {
    try {
      Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {});
    } catch {}
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function init() {
    load();
    applyTheme();

    const unitSel = $("#settingsUnitSelect");
    const contrast = $("#settingsHighContrast");
    const reset = $("#resetAllDataBtn");

    unitSel.value = state.unit;
    contrast.checked = state.highContrast;

    unitSel.onchange = () => {
      state.unit = unitSel.value;
      save();
    };

    contrast.onchange = () => {
      state.highContrast = contrast.checked;
      save();
      applyTheme();
    };

    reset.onclick = async () => {
      const ok = await showConfirm("RESET ALL DATA?");
      if (!ok) return;

      localStorage.clear();
      location.reload();
    };
  }

  function applyTheme() {
    if (state.highContrast) document.body.classList.add("theme-high-contrast");
    else document.body.classList.remove("theme-high-contrast");
  }

  return { init };
})();

/****************************************************
 * App
 ****************************************************/
const App = (() => {
  function init() {
    setupNav();
    Templates.init();
    Settings.init();
    checkVersionChange();
  }

  function setupNav() {
    $$("nav button").forEach((btn) => {
      btn.onclick = () => {
        $$("nav button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.dataset.target;
        $$(".screen").forEach((s) => s.classList.remove("active"));
        $("#" + target).classList.add("active");
      };
    });
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);