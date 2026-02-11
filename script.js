/* Mood colors */

const moodColors = {
  /* Happy – Apricot */
  happy: "#FBCEB1",

  /* Sad – Pastel Blue */
  sad: "#A7C7E7",

  /* Energetic – Nyanza */
  energetic: "#ECFFDC",

  /* Loved – Light Pink */
  loved: "#FFB6C1",

  /* Neutral – Nude */
  neutral: "#F2D2BD",

  /* Angry – Crimson */
  angry: "#DC143C"
};

/* Mood counts */

const moodCounts = {
  happy: 0,
  sad: 0,
  energetic: 0,
  loved: 0,
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

      return `
        <button class="archive-item" data-archive-id="${jar.id}">
          <div class="archive-mini-jar">
            <div class="archive-mini-glass">
              <div class="archive-mini-layers">
                ${layerDivs}
              </div>
            </div>
          </div>
          <div class="archive-meta">
            <p class="archive-meta-title">${title}</p>
            <p class="archive-meta-sub">${dateLabel || "Unknown range"} · ${total} mood${total === 1 ? "" : "s"}</p>
          </div>
        </button>
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

      drop.remove();

    }, 900);

});

/* Click jar → show wrap */

document
  .getElementById("jar")
  .addEventListener("click", showWrap);

/* Show wrap */

function showWrap() {

  const total =
    getTotalMoods();

  if (total === 0) {
    alert("Your jar is empty 🌙");
    return;
  }

  let statsHTML = "";
  let topMood = null;
  let maxCount = 0;

  for (let mood in moodCounts) {

    const count = moodCounts[mood];
    const percent =
      Math.round((count / total) * 100);

    statsHTML +=
      `<p>${prettyMoodName(mood)}: ${percent}% (${count})</p>`;

    if (count > maxCount) {
      maxCount = count;
      topMood = mood;
    }
  }

  statsHTML =
    `<h3>Most felt: ${prettyMoodName(topMood)} 💗</h3>`
    + statsHTML;

  document
    .getElementById("wrapStats")
    .innerHTML = statsHTML;

  const totalLabel =
    document.getElementById("wrapTotalLabel");
  if (totalLabel) {
    totalLabel.textContent =
      `${total} mood${total === 1 ? "" : "s"} logged`;
  }

  document
    .getElementById("wrapPopup")
    .classList.add("active");
}

/* Close popup */

function closeWrap() {

  document
    .getElementById("wrapPopup")
    .classList.remove("active");
}

/* Initial UI state */

updateJarSideUI();
renderRecentMoods();
