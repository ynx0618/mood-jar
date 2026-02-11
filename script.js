/* Mood colors */

const moodColors = {
    /* Happy – Apricot
      Hex: #FFFAA0
      RGB: 255, 250, 160
      HSL: 57, 100, 81 */
    happy: "#FFFAA0",

  /* Sad – Pastel Blue */
  sad: "#A7C7E7",

  /* Energetic – Nyanza */
  energetic: "#ECFFDC",

  /* Loved – Light Pink */
  loved: "#FFB6C1",

  /* Anxious – Wisteria */
  anxious: "#BDB5D5",

  /* Surprised – Coral */
  surprised: "#FF7F50",

  /* Neutral – Nude */
  neutral: "#F2D2BD",

  /* Angry – Crimson */
  angry: "#DC143C"
};

/* Emoji map for diaries and small UI */
const moodEmojiMap = {
  happy: "🔅",
  neutral: "🪷",
  energetic: "🎧",
  loved: "🤍",
  sad: "🫧",
  angry: "🌪️",
  anxious: "👾",
  surprised: "🥠"
};

/* Mood counts */

const moodCounts = {
  happy: 0,
  sad: 0,
  energetic: 0,
  loved: 0,
  anxious: 0,
  surprised: 0,
  neutral: 0,
  angry: 0
};

let selectedMood = null;

/* Canvas + liquid state */

const jarCanvas =
  document.getElementById("jarCanvas");

const jarCtx =
  jarCanvas.getContext("2d");

/* Each band represents one mood layer from bottom → top */
const liquidBands = []; // { color, phase }

const BAND_HEIGHT = 30;

let waveTime = 0;
let dropImpulse = 0;

/* Current jar + archive state */

let currentJar = {
  id: `jar_${Date.now()}`,
  createdAt: new Date().toISOString()
};

let currentEntries = []; // { mood, note, at }
let archivedJars = [];

const STORAGE_KEY_ARCHIVES =
  "moodJar.archivedJars.v1";

/* Simple helpers for totals + pretty names */

function getTotalMoods() {
  return Object.values(moodCounts)
    .reduce((a, b) => a + b, 0);
}

function prettyMoodName(key) {
  const map = {
    happy: "Happy",
    sad: "Sad",
    energetic: "Energetic",
    loved: "Loved",
    anxious: "Anxious",
    surprised: "Surprised",
    neutral: "Neutral",
    angry: "Angry"
  };
  return map[key] || key;
}

/* Recent moods list */

const recentMoods = [];
const MAX_RECENT = 6;

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function addRecentMood(key) {
  const now = new Date();
  recentMoods.unshift({
    key,
    at: now
  });
  if (recentMoods.length > MAX_RECENT) {
    recentMoods.pop();
  }
  renderRecentMoods();
}

function renderRecentMoods() {
  const list =
    document.getElementById("recentList");
  if (!list) return;

  if (!recentMoods.length) {
    list.innerHTML =
      `<p class="recent-empty">No moods yet. Your story starts today.</p>`;
    return;
  }

  const items = recentMoods
    .map(item => {
      const label = prettyMoodName(item.key);
      const color = moodColors[item.key] || "#e5e7eb";
      const date = formatDate(item.at);
      const time = formatTime(item.at);
      return `
        <div class="recent-item">
          <span class="recent-dot" style="background:${color};"></span>
          <div>
            <div class="recent-text-main">${label}</div>
            <div class="recent-text-sub">${date}, ${time}</div>
          </div>
        </div>
      `;
    })
    .join("");

  list.innerHTML = items;
}

/* Jar side message + counter */

function updateJarSideUI() {
  const total = getTotalMoods();

  const msgEl =
    document.getElementById("jarMessage");
  const countTextEl =
    document.getElementById("jarCounterText");
  const fillEl =
    document.getElementById("jarCounterFill");

  if (msgEl) {
    msgEl.textContent =
      total === 0
        ? "Your jar is empty. Add your first mood!"
        : `You’ve logged ${total} mood${total === 1 ? "" : "s"} today.`;
  }

  if (countTextEl) {
    countTextEl.textContent =
      `${total} mood${total === 1 ? "" : "s"}`;
  }

  if (fillEl) {
    const target = 10;
    const ratio =
      Math.max(0, Math.min(1, total / target));
    fillEl.style.width =
      `${Math.round(ratio * 100)}%`;
  }
}

/* Archive helpers */

function loadArchives() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY_ARCHIVES);
    if (!raw) {
      archivedJars = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      archivedJars = parsed;
    } else {
      archivedJars = [];
    }
  } catch (e) {
    archivedJars = [];
  }
}

function saveArchives() {
  try {
    localStorage.setItem(
      STORAGE_KEY_ARCHIVES,
      JSON.stringify(archivedJars)
    );
  } catch (e) {
    // ignore
  }
}

function formatDateRange(startIso, endIso) {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  if (!start && !end) return "";

  if (start && end) {
    const sameDay =
      start.toDateString() === end.toDateString();
    if (sameDay) {
      return formatDate(start);
    }
    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  const d = start || end;
  return formatDate(d);
}

function renderArchiveGrid() {
  const grid =
    document.getElementById("archiveGrid");
  if (!grid) return;

  if (!archivedJars.length) {
    grid.innerHTML =
      `<p class="archive-empty">No archived jars yet. Reset your jar to start preserving chapters.</p>`;
    return;
  }

  const items = archivedJars
    .map((jar, index) => {
      const total = jar.totalEntries || 0;
      const moods = jar.moods || {};

      let topMood = null;
      let maxCount = 0;
      for (const key in moods) {
        if (moods[key] > maxCount) {
          maxCount = moods[key];
          topMood = key;
        }
      }

      const dominantName =
        topMood ? prettyMoodName(topMood) : "Mixed";

      const dateLabel =
        formatDateRange(jar.createdAt, jar.archivedAt);

      const title =
        `Jar ${archivedJars.length - index} • ${dominantName}`;

      const layers =
        Array.isArray(jar.layers)
          ? jar.layers
          : [];

      const layerDivs = layers
        .map(
          c =>
            `<div class="archive-mini-layer" style="background:${c};"></div>`
        )
        .join("");

      const nameLabel = jar.name || title;
      const entriesCount = (Array.isArray(jar.entries) ? jar.entries.length : jar.totalEntries) || 0;

      return `
        <div class="archive-card">
          <button class="archive-item" data-archive-id="${jar.id}">
            <div class="archive-mini-jar">
              <div class="archive-mini-glass">
                <div class="archive-mini-layers">
                  ${jar.layersHTML || layerDivs}
                </div>
              </div>
            </div>
            <div class="archive-meta">
              <p class="archive-meta-title">${escapeHtml(nameLabel)}</p>
              <p class="archive-meta-sub">${dateLabel || "Unknown range"}</p>
              <p class="archive-meta-sub small">${entriesCount} entr${entriesCount === 1 ? 'y' : 'ies'}</p>
            </div>
          </button>
              <button class="archive-edit" data-archive-id="${jar.id}" aria-label="Rename archived jar">✏️</button>
              <button class="archive-delete" data-archive-id="${jar.id}" aria-label="Delete archived jar">🗑️</button>
        </div>
      `;
    })
    .join("");

  grid.innerHTML = items;
}

/* Floating emoji */

function spawnFloatingEmoji(emoji, x, y) {

  const float = document.createElement("div");
  float.className = "floating-emoji";
  float.innerText = emoji;

  float.style.left = x + "px";
  float.style.top = y + "px";

  document.body.appendChild(float);

  setTimeout(() => float.remove(), 2000);
}

/* Select emoji */

document.querySelectorAll(".mood-btn")
.forEach(btn => {

  btn.addEventListener("click", () => {

    document
      .querySelectorAll(".mood-btn")
      .forEach(b => b.classList.remove("selected"));

    btn.classList.add("selected");
    selectedMood = btn.dataset.mood;

    const rect = btn.getBoundingClientRect();

    spawnFloatingEmoji(
      btn.querySelector(".mood-emoji")?.innerText || "",
      rect.left + rect.width / 2,
      rect.top
    );

  });

});

/* Simple color helpers for blending between layers on canvas */

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function mixHexColors(a, b, t) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const bVal = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${bVal})`;
}

function addLiquidBand(color) {
  liquidBands.push({
    color,
    phase: Math.random() * Math.PI * 2
  });

  /* Kick the waves a bit when a new drop lands */
  dropImpulse = 1;
}

function drawLiquid() {

  const ctx = jarCtx;
  const width = jarCanvas.width;
  const height = jarCanvas.height;

  ctx.clearRect(0, 0, width, height);

  if (!liquidBands.length) return;

  const total = liquidBands.length;
  const steps = 80;

  /* Pre‑compute shared boundaries so adjacent bands always touch with no gaps */
  const boundaries = []; // boundaries[levelIndex][stepIndex] = y

  /* Gentle global side‑to‑side slosh value; boosted a bit by dropImpulse */
  const baseSloshAmplitude = 1.4 + dropImpulse * 1.6;

  for (let level = 0; level <= total; level++) {

    const bandForPhase =
      liquidBands[Math.max(level - 1, 0)];

    const phase =
      bandForPhase ? bandForPhase.phase : 0;

    const baseY =
      height - BAND_HEIGHT * level;

    const levelOffsets = [];

    for (let s = 0; s <= steps; s++) {

      const ratio =
        s / steps; // 0 left → 1 right

      const x =
        ratio * width;

      /* Whole‑column slosh: water hits one side, then the other */
      const sloshTilt =
        (ratio - 0.5) *
        baseSloshAmplitude *
        Math.sin(waveTime + phase);

      /* Very small local wave on each boundary so it's not perfectly straight */
      const tinyWave =
        Math.sin(
          ratio * Math.PI * 2 +
            waveTime * 1.2 +
            level * 0.5
        ) * 0.9;

      const y =
        baseY + sloshTilt + tinyWave;

      levelOffsets.push(y);
    }

    boundaries.push(levelOffsets);
  }

  /* Now draw each band between its two boundaries so they meet perfectly */
  for (let i = 0; i < total; i++) {

    const band = liquidBands[i];

    const bandAbove =
      liquidBands[i + 1];

    const bandBelow =
      liquidBands[i - 1];

    const colorCenter = band.color;

    const colorTop =
      bandAbove
        ? mixHexColors(
            colorCenter,
            bandAbove.color,
            0.35
          )
        : colorCenter;

    const colorBottom =
      bandBelow
        ? mixHexColors(
            colorCenter,
            bandBelow.color,
            0.3
          )
        : colorCenter;

    const topBoundary =
      boundaries[i + 1];

    const bottomBoundary =
      boundaries[i];

    const minY =
      Math.min(
        ...topBoundary,
        ...bottomBoundary
      );

    const maxY =
      Math.max(
        ...topBoundary,
        ...bottomBoundary
      );

    const gradient =
      ctx.createLinearGradient(
        0,
        minY,
        0,
        maxY
      );

    gradient.addColorStop(0, colorTop);
    gradient.addColorStop(0.5, colorCenter);
    gradient.addColorStop(1, colorBottom);

    ctx.fillStyle = gradient;

    ctx.beginPath();

    /* Bottom edge: from right → left */
    for (let s = steps; s >= 0; s--) {

      const ratio =
        s / steps;

      const x =
        ratio * width;

      const y =
        bottomBoundary[s];

      if (s === steps) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    /* Top edge: from left → right */
    for (let s = 0; s <= steps; s++) {

      const ratio =
        s / steps;

      const x =
        ratio * width;

      const y =
        topBoundary[s];

      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
  }
}

function animate(timestamp) {

  waveTime = timestamp / 900;

  /* Let the impulse gradually calm down */
  dropImpulse *= 0.94;

  drawLiquid();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

/* Drop into jar */

document
  .getElementById("dropBtn")
  .addEventListener("click", () => {

    if (!selectedMood) {
      alert("Pick a mood first!");
      return;
    }

    const pourArea =
      document.getElementById("pourArea");

    const color =
      moodColors[selectedMood];

    /* Pour drop */

    const drop =
      document.createElement("div");

    drop.className = "liquid-drop";
    drop.style.background = color;
    drop.style.left = "50%";

    pourArea.appendChild(drop);

    /* After pour, add a new liquid band + update counts */

    setTimeout(() => {

      addLiquidBand(color);

      moodCounts[selectedMood]++;
      addRecentMood(selectedMood);
      updateJarSideUI();

      const noteEl =
        document.getElementById("diaryText");
      const note =
        noteEl && noteEl.value
          ? noteEl.value.trim()
          : "";
      currentEntries.push({
        mood: selectedMood,
        note,
        at: new Date().toISOString()
      });
      if (noteEl) {
        noteEl.value = "";
      }

      drop.remove();

    }, 900);

});

/* Click jar → show wrap */

document
  .getElementById("jar")
  .addEventListener("click", showWrap);

/* Show wrap */

function showWrap() {

  const total = getTotalMoods();

  if (total === 0) {
    alert("Your jar is empty 🌙");
    return;
  }

  const wrapTotalLabel = document.getElementById("wrapTotalLabel");
  if (wrapTotalLabel) {
    wrapTotalLabel.textContent = `${total} mood${total === 1 ? "" : "s"} logged`;
  }

  const jarSnapshot = {
    id: currentJar.id,
    createdAt: currentJar.createdAt,
    moods: { ...moodCounts },
    layers: liquidBands.map(b => b.color),
    entries: currentEntries.slice(),
    totalEntries: total
  };

  const statsPane = document.getElementById("wrapStatsPane");
  const diaryPane = document.getElementById("wrapDiaryPane");

  renderWrapStats(statsPane, jarSnapshot);
  renderWrapDiary(diaryPane, jarSnapshot.entries);
  initWrapTabs(document.getElementById("wrapPopup"));

  document.getElementById("wrapPopup").classList.add("active");
}

function renderWrapStats(container, jar) {
  if (!container) return;
  const total = jar.totalEntries || Object.values(jar.moods || {}).reduce((a,b)=>a+b,0);

  if (!total) {
    container.innerHTML = `<p class="recent-empty">No moods yet.</p>`;
    return;
  }

  let topMood = null;
  let maxCount = 0;
  let rows = [];
  for (const key in jar.moods) {
    const count = jar.moods[key] || 0;
    const percent = Math.round((count / total) * 100);
    rows.push(`<div>${prettyMoodName(key)} — ${percent}% (${count})</div>`);
    if (count > maxCount) {
      maxCount = count;
      topMood = key;
    }
  }

  const html = `
    <h3>Most felt: ${prettyMoodName(topMood) || 'Mixed'} 💗</h3>
    <div class="wrap-stats-list">${rows.join("")}</div>
    <div style="margin-top:8px;color:#6b7280">Total drops: ${total}</div>
  `;
  container.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]);
}

function renderWrapDiary(container, entries) {
  if (!container) return;
  if (!entries || !entries.length) {
    container.innerHTML = `<p class="recent-empty">No diary entries.</p>`;
    return;
  }

  const items = entries.map(e => {
    const emoji = moodEmojiMap[e.mood] || '💭';
    const label = prettyMoodName(e.mood);
    const time = e.at ? new Date(e.at).toLocaleString() : '';
    return `
      <div class="wrap-diary-card">
        <div class="wrap-diary-emoji">${emoji}</div>
        <div class="wrap-diary-body">
          <div class="wrap-diary-head">${label}</div>
          <div class="wrap-diary-text">${escapeHtml(e.note || e.text || '')}</div>
          <div class="wrap-diary-time">${time}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
}

let wrapTabsInitialized = false;
function initWrapTabs(root) {
  if (!root || wrapTabsInitialized) return;
  wrapTabsInitialized = true;
  root.querySelectorAll('.wrap-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-wrap-tab');
      // deactivate siblings
      root.querySelectorAll('.wrap-tab').forEach(t => t.classList.toggle('active', t === tab));

      // hide/show panes
      if (target === 'stats' || target === 'archive-stats') {
        const stats = root.querySelector('#wrapStatsPane') || root.querySelector('#archiveStatsPane');
        const diary = root.querySelector('#wrapDiaryPane') || root.querySelector('#archiveDiaryPane');
        if (stats) stats.style.display = '';
        if (diary) diary.style.display = 'none';
      } else {
        const stats = root.querySelector('#wrapStatsPane') || root.querySelector('#archiveStatsPane');
        const diary = root.querySelector('#wrapDiaryPane') || root.querySelector('#archiveDiaryPane');
        if (stats) stats.style.display = 'none';
        if (diary) diary.style.display = '';
      }
    });
  });
}

/* Close popup */

function closeWrap() {

  document
    .getElementById("wrapPopup")
    .classList.remove("active");
}

/* Reset jar + archive */

function archiveCurrentJar() {
  const total = getTotalMoods();
  if (total === 0) {
    return;
  }
  const archivedAt = new Date().toISOString();

  const layersColors = liquidBands.map(band => band.color);
  const layersHTML = layersColors
    .map(c => `<div class="archive-mini-layer" style="background:${c};"></div>`)
    .join("");

  const dateLabel = formatDateRange(currentJar.createdAt, archivedAt);
  const defaultName = `Archived Jar — ${dateLabel}`;

  let nameInput = prompt('Name this archived jar (optional)\nExample: "January Reflections 🌸"', '');
  if (nameInput === null) nameInput = '';
  nameInput = nameInput.trim().slice(0, 40); // limit 40 chars
  const finalName = nameInput || defaultName;

  const snapshot = {
    id: currentJar.id,
    name: finalName,
    createdAt: currentJar.createdAt,
    startDate: currentJar.createdAt,
    endDate: archivedAt,
    archivedAt: archivedAt,
    totalEntries: total,
    moods: { ...moodCounts },
    layers: layersColors,
    layersHTML: layersHTML,
    entries: currentEntries.slice()
  };

  archivedJars.unshift(snapshot);
  saveArchives();
  renderArchiveGrid();
}

function resetCurrentJarState() {
  // Clear liquid
  liquidBands.length = 0;
  waveTime = 0;
  dropImpulse = 0;
  jarCtx.clearRect(
    0,
    0,
    jarCanvas.width,
    jarCanvas.height
  );

  // Reset counts
  for (const key in moodCounts) {
    moodCounts[key] = 0;
  }

  currentEntries = [];
  currentJar = {
    id: `jar_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  updateJarSideUI();
  renderRecentMoods();
}

const resetModal =
  document.getElementById("resetModal");

document
  .getElementById("resetJarBtn")
  .addEventListener("click", () => {
    if (!resetModal) return;
    resetModal.classList.add("active");
  });

document
  .getElementById("cancelResetBtn")
  .addEventListener("click", () => {
    if (!resetModal) return;
    resetModal.classList.remove("active");
  });

document
  .getElementById("confirmResetBtn")
  .addEventListener("click", () => {
    if (!resetModal) return;
    archiveCurrentJar();
    resetCurrentJarState();
    resetModal.classList.remove("active");
  });

/* Archive detail modal */

const archiveModal =
  document.getElementById("archiveModal");

function openArchiveDetail(jar) {
  if (!archiveModal) return;

  const titleEl =
    document.getElementById("archiveDetailTitle");
  const subEl =
    document.getElementById("archiveDetailSub");
  const layersEl =
    document.getElementById("archiveDetailLayers");
  const statsPane =
    document.getElementById("archiveStatsPane");
  const diaryPane =
    document.getElementById("archiveDiaryPane");

  const total = jar.totalEntries || 0;

  const range =
    formatDateRange(jar.createdAt, jar.archivedAt);

  if (titleEl) {
    titleEl.textContent = jar.name || "Archived Mood Jar";
  }

  if (subEl) {
    subEl.textContent = `${range || "Unknown range"} · ${total} mood${total === 1 ? "" : "s"}`;
  }

  if (layersEl) {
    const layers =
      Array.isArray(jar.layers)
        ? jar.layers
        : [];
    layersEl.innerHTML = layers
      .map(
        c =>
          `<div class="archive-mini-layer" style="background:${c};"></div>`
      )
      .join("");
  }

  // Render stats + diary into archive panes
  renderWrapStats(statsPane, {
    moods: jar.moods || {},
    totalEntries: jar.totalEntries || total
  });

  renderWrapDiary(diaryPane, jar.entries || []);

  initWrapTabs(document.getElementById('archiveModal'));

  archiveModal.classList.add("active");
}

/* Delete modal handlers */
const deleteModal = document.getElementById('deleteModal');
if (deleteModal) {
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      deleteModal.classList.remove('active');
      deleteModal.removeAttribute('data-pending-id');
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      const pendingId = deleteModal.getAttribute('data-pending-id');
      if (!pendingId) {
        deleteModal.classList.remove('active');
        return;
      }

      // Find the DOM card for animation
      const itemBtn = document.querySelector(`.archive-item[data-archive-id="${pendingId}"]`);
      const cardEl = itemBtn ? itemBtn.closest('.archive-card') : null;

      if (cardEl) {
        cardEl.classList.add('deleting');
      }

      // after animation, remove from data + re-render
      setTimeout(() => {
        const idx = archivedJars.findIndex(j => j.id === pendingId);
        if (idx >= 0) {
          archivedJars.splice(idx, 1);
          saveArchives();
        }
        deleteModal.classList.remove('active');
        deleteModal.removeAttribute('data-pending-id');
        renderArchiveGrid();
      }, 320);
    });
  }
}

document
  .getElementById("archiveDetailClose")
  .addEventListener("click", () => {
    if (!archiveModal) return;
    archiveModal.classList.remove("active");
  });

document
  .getElementById("archiveGrid")
  .addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // Rename flow: if edit icon clicked
    const editBtn = target.closest('.archive-edit');
    if (editBtn) {
      const id = editBtn.getAttribute('data-archive-id');
      if (!id) return;
      const jar = archivedJars.find(j => j.id === id);
      if (!jar) return;
      let newName = prompt('Rename archived jar (max 40 chars):', jar.name || '');
      if (newName === null) return; // cancelled
      newName = newName.trim().slice(0,40);
      if (!newName) newName = jar.name || `Archived Jar — ${formatDateRange(jar.startDate||jar.createdAt, jar.endDate||jar.archivedAt)}`;
      jar.name = newName;
      saveArchives();
      renderArchiveGrid();
      return;
    }

    // Delete flow: if delete icon clicked
    const deleteBtn = target.closest('.archive-delete');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-archive-id');
      if (!id) return;
      const jar = archivedJars.find(j => j.id === id);
      if (!jar) return;
      // show custom delete modal
      const deleteModal = document.getElementById('deleteModal');
      if (!deleteModal) return;
      deleteModal.classList.add('active');
      // store pending id
      deleteModal.setAttribute('data-pending-id', id);
      return;
    }

    const item = target.closest('.archive-item');
    if (!item) return;

    const id = item.getAttribute('data-archive-id');
    if (!id) return;

    const jar = archivedJars.find(j => j.id === id);
    if (!jar) return;

    openArchiveDetail(jar);
  });

/* Tabs */

document
  .querySelectorAll(".tab")
  .forEach(tab => {
    tab.addEventListener("click", () => {
      const target =
        tab.getAttribute("data-tab");
      if (!target) return;

      document
        .querySelectorAll(".tab")
        .forEach(t => {
          t.classList.toggle(
            "active",
            t === tab
          );
        });

      const currentView =
        document.getElementById("currentView");
      const archiveView =
        document.getElementById("archiveView");

      if (!currentView || !archiveView) return;

      const isCurrent =
        target === "current";

      currentView.classList.toggle(
        "active",
        isCurrent
      );
      archiveView.classList.toggle(
        "active",
        !isCurrent
      );
    });
  });

/* Initial UI state */

loadArchives();
renderArchiveGrid();
updateJarSideUI();
renderRecentMoods();
