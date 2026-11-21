// Пчёлки 67: мир 1 000 000 × 1 000 000 пикселей.
// Мир не хранится целиком: каждый кусок (чанк) рисуется на лету из шума по одному и тому же зерну,
// поэтому у всех игроков одинаковая карта.
(() => {
  const WORLD = 1_000_000;
  const CHUNK = 512;       // размер чанка в пикселях
  const CELL = 16;         // шаг заливки земли
  const TILE = 32;         // шаг расстановки растений
  const SEED = 67;
  const MAX_CHUNKS = 160;

  // ---------- шум ----------
  function hash(x, y, s) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s + SEED, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
    const c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct, s) {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * vnoise(x * f, y * f, s + i * 31);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return sum / norm;
  }

  // ---------- биомы ----------
  const B = { DEEP: 0, SHALLOW: 1, SAND: 2, MEADOW: 3, FLOWERS: 4, FOREST: 5, SAKURA: 6, GOLDEN: 7, ROCK: 8, SNOW: 9 };
  const NAMES = ["Глубокое озеро", "Мелководье", "Пляж", "Зелёный луг", "Цветочная долина",
    "Тихий лес", "Сакуровая роща", "Золотое поле", "Скалы", "Снежная вершина"];

  function biome(x, y) {
    const cont = fbm(x / 70000, y / 70000, 3, 7);
    const e = fbm(x / 9000, y / 9000, 5, 1) * 0.65 + cont * 0.35;
    const m = fbm(x / 5200 + 100, y / 5200, 4, 3);
    const f = fbm(x / 3600, y / 3600 + 50, 3, 5);
    let b;
    if (e < 0.40) b = B.DEEP;
    else if (e < 0.43) b = B.SHALLOW;
    else if (e < 0.445) b = B.SAND;
    else if (e > 0.665) b = B.SNOW;
    else if (e > 0.615) b = B.ROCK;
    else if (m > 0.56) b = f > 0.53 ? B.SAKURA : B.FOREST;
    else if (m < 0.42) b = B.GOLDEN;
    else if (f > 0.52) b = B.FLOWERS;
    else b = B.MEADOW;
    return { b, e, m, f };
  }

  // ---------- цвета ----------
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgb = (c, k = 1) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const C = {
    deep: hex("#2b78b6"), mid: hex("#3fa3c9"), shallow: hex("#74d6d2"),
    sand: hex("#f4e3b5"), sandDark: hex("#e6cf98"),
    meadow: hex("#8fd36b"), meadowDark: hex("#6dbd59"),
    flowers: hex("#9bd877"), forest: hex("#4e9b52"), forestDark: hex("#3d8447"),
    sakura: hex("#a9d97e"), golden: hex("#d8d670"), goldenDark: hex("#c3c25a"),
    rock: hex("#a9a39b"), rockDark: hex("#8d877f"), snow: hex("#f3f7fc"),
  };
  const FLOWER_COLORS = ["#b58cf0", "#ff9ec7", "#ff5f6d", "#ffd84d", "#7fb8ff", "#fff6ec"];

  const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  function groundRGB(x, y, info) {
    const n = vnoise(x / 90, y / 90, 11) * 0.75 + vnoise(x / 35, y / 35, 12) * 0.25;
    const k = 0.94 + n * 0.12;
    switch (info.b) {
      case B.DEEP: return scale(mix(C.deep, C.mid, clamp01((info.e - 0.345) / 0.055)), k * 0.98);
      case B.SHALLOW: return scale(mix(C.mid, C.shallow, clamp01((info.e - 0.40) / 0.03)), k);
      case B.SAND: return mix(C.sand, C.sandDark, n);
      case B.MEADOW: return scale(mix(C.meadow, C.meadowDark, n * 0.8), k);
      case B.FLOWERS: return scale(C.flowers, k);
      case B.FOREST: return scale(mix(C.forest, C.forestDark, n), k);
      case B.SAKURA: return scale(C.sakura, k);
      case B.GOLDEN: return scale(mix(C.golden, C.goldenDark, n), k);
      case B.ROCK: return scale(mix(C.rock, C.rockDark, n), 0.95 + (info.e - 0.615) * 2);
      default: return scale(C.snow, 0.97 + n * 0.04);
    }
  }
  const groundColor = (x, y, info) => rgb(groundRGB(x, y, info));

  // ---------- растения и предметы ----------
  function shadow(ctx, x, y, w, h) {
    ctx.fillStyle = "rgba(20,40,30,0.22)";
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
  }
  function tuft(ctx, x, y, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 5, y - 6, x - 7, y - 9);
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - 8, x + 1, y - 12);
    ctx.moveTo(x + 4, y); ctx.quadraticCurveTo(x + 5, y - 6, x + 8, y - 8);
    ctx.stroke();
  }
  function flower(ctx, x, y, col, r) {
    ctx.strokeStyle = "#4f9a45"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + r * 2.4); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ffcf3f";
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  function sunflower(ctx, x, y) {
    ctx.strokeStyle = "#5c9a3c"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y - 18); ctx.stroke();
    ctx.fillStyle = "#6fae47";
    ctx.beginPath(); ctx.ellipse(x + 5, y - 6, 5, 2.5, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffc93c";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 6, y - 22 + Math.sin(a) * 6, 4, 2.2, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#7a4a1e";
    ctx.beginPath(); ctx.arc(x, y - 22, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  function bush(ctx, x, y, col, hi) {
    shadow(ctx, x, y + 3, 14, 5);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x - 7, y - 4, 8, 0, Math.PI * 2); ctx.arc(x + 7, y - 4, 8, 0, Math.PI * 2); ctx.arc(x, y - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hi;
    ctx.beginPath(); ctx.arc(x - 3, y - 14, 4, 0, Math.PI * 2); ctx.fill();
  }
  function tree(ctx, x, y, s, leaf, leafHi, berry) {
    shadow(ctx, x + 4 * s, y + 2, 26 * s, 9 * s);
    ctx.fillStyle = "#8a5a35";
    ctx.beginPath(); ctx.moveTo(x - 5 * s, y); ctx.lineTo(x - 3 * s, y - 26 * s); ctx.lineTo(x + 3 * s, y - 26 * s); ctx.lineTo(x + 5 * s, y); ctx.fill();
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.arc(x - 14 * s, y - 34 * s, 15 * s, 0, Math.PI * 2);
    ctx.arc(x + 14 * s, y - 34 * s, 15 * s, 0, Math.PI * 2);
    ctx.arc(x, y - 48 * s, 19 * s, 0, Math.PI * 2);
    ctx.arc(x, y - 30 * s, 15 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = leafHi;
    ctx.beginPath();
    ctx.arc(x - 6 * s, y - 54 * s, 8 * s, 0, Math.PI * 2);
    ctx.arc(x - 18 * s, y - 38 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    if (berry) {
      ctx.fillStyle = berry;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.arc(x + (i * 9 - 18) * s, y - (30 + ((i * 7) % 20)) * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function rock(ctx, x, y, s, col) {
    shadow(ctx, x + 2, y + 2, 13 * s, 5 * s);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y); ctx.lineTo(x - 9 * s, y - 10 * s); ctx.lineTo(x - 1 * s, y - 15 * s);
    ctx.lineTo(x + 9 * s, y - 10 * s); ctx.lineTo(x + 12 * s, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath(); ctx.moveTo(x - 8 * s, y - 9 * s); ctx.lineTo(x - 1 * s, y - 14 * s); ctx.lineTo(x + 1 * s, y - 8 * s); ctx.closePath(); ctx.fill();
  }
  function mushroom(ctx, x, y) {
    ctx.fillStyle = "#fff3e0"; ctx.fillRect(x - 2, y - 7, 4, 7);
    ctx.fillStyle = "#e8483f";
    ctx.beginPath(); ctx.ellipse(x, y - 7, 7, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x - 3, y - 9, 1.3, 0, Math.PI * 2); ctx.arc(x + 2, y - 10, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  function lily(ctx, x, y, lotus) {
    ctx.fillStyle = "#4fae5c";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 9, 0.3, Math.PI * 2 - 0.1); ctx.closePath(); ctx.fill();
    if (lotus) {
      ctx.fillStyle = "#ffb3d1";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 3.5, y - 3 + Math.sin(a) * 2.5, 3.5, 2, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(x, y - 3, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  function petals(ctx, x, y, r) {
    ctx.fillStyle = "#ffc4dc";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(x + (hash(x, i, 3) - 0.5) * 26, y + (hash(i, y, 4) - 0.5) * 26, 2.4, 1.4, r + i, 0, Math.PI * 2); ctx.fill();
    }
  }
  function shell(ctx, x, y) {
    ctx.fillStyle = "#fbd3c0";
    ctx.beginPath(); ctx.arc(x, y, 3.5, Math.PI, 0); ctx.fill();
  }

  function decorate(ctx, wx, wy, lx, ly, info, r, r2) {
    switch (info.b) {
      case B.MEADOW:
        if (r < 0.012) tree(ctx, lx, ly, 0.9 + r2 * 0.3, "#5fb35a", "#86d374");
        else if (r < 0.03) bush(ctx, lx, ly, "#5aa851", "#7fcc6c");
        else if (r < 0.16) flower(ctx, lx, ly, r2 < 0.5 ? "#fff6ec" : "#ffd84d", 2.6);
        else if (r < 0.5) tuft(ctx, lx, ly, "#5ea94b");
        break;
      case B.FLOWERS: {
        const h = clamp01((fbm(wx / 1100, wy / 1100, 2, 9) - 0.3) / 0.4);
        const col = FLOWER_COLORS[Math.min(5, (h * 6) | 0)];
        if (r < 0.006) tree(ctx, lx, ly, 0.85, "#62b55a", "#8ad676");
        else if (r < 0.85) {
          flower(ctx, lx - 6, ly - 4, col, 3 + r2 * 1.5);
          if (r < 0.6) flower(ctx, lx + 7, ly + 5, col, 2.8);
          if (r < 0.3) flower(ctx, lx + 1, ly + 12, r2 < 0.2 ? "#fff6ec" : col, 2.6);
        } else tuft(ctx, lx, ly, "#5ea94b");
        break;
      }
      case B.FOREST:
        if (r < 0.2) tree(ctx, lx, ly, 1 + r2 * 0.45, r2 < 0.5 ? "#3f8f4a" : "#4a9c50", "#69ba62", r2 > 0.92 ? "#e8483f" : null);
        else if (r < 0.26) bush(ctx, lx, ly, "#3e8a45", "#5daa58");
        else if (r < 0.29) mushroom(ctx, lx, ly);
        else if (r < 0.55) tuft(ctx, lx, ly, "#3a7d3f");
        break;
      case B.SAKURA:
        if (r < 0.13) tree(ctx, lx, ly, 1 + r2 * 0.35, "#ffb3d1", "#ffd6e6");
        else if (r < 0.4) petals(ctx, lx, ly, r2 * 6);
        else if (r < 0.48) flower(ctx, lx, ly, "#fff6ec", 2.6);
        else if (r < 0.7) tuft(ctx, lx, ly, "#6aae55");
        break;
      case B.GOLDEN:
        if (r < 0.08) sunflower(ctx, lx, ly);
        else if (r < 0.1) bush(ctx, lx, ly, "#9eaa47", "#c4cc5f");
        else if (r < 0.55) tuft(ctx, lx, ly, "#b3a43d");
        break;
      case B.SAND:
        if (r < 0.05) shell(ctx, lx, ly);
        else if (r < 0.08) rock(ctx, lx, ly, 0.5, "#cdbf9f");
        break;
      case B.SHALLOW:
        if (r < 0.06) lily(ctx, lx, ly, r2 < 0.4);
        break;
      case B.ROCK:
        if (r < 0.12) rock(ctx, lx, ly, 0.9 + r2 * 0.9, r2 < 0.5 ? "#9a948c" : "#b3ada5");
        else if (r < 0.16) tuft(ctx, lx, ly, "#7f9a64");
        break;
      case B.SNOW:
        if (r < 0.04) rock(ctx, lx, ly, 0.8, "#cfd6de");
        break;
    }
  }

  // ---------- чанки ----------
  const chunks = new Map();
  let genQueue = [];
  const groundBuf = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = CHUNK / CELL + 2;
    return { cv, ctx: cv.getContext("2d") };
  })();

  function makeChunk(cx, cy) {
    const cv = document.createElement("canvas");
    cv.width = CHUNK; cv.height = CHUNK;
    const ctx = cv.getContext("2d");
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const water = [];

    // Землю считаем в маленькой картинке (1 точка = 1 клетка, плюс рамка) и растягиваем
    // со сглаживанием: получаются мягкие переходы цвета вместо квадратов.
    const N = CHUNK / CELL + 2;
    const img = groundBuf.ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const wx = x0 + (i - 1) * CELL + CELL / 2, wy = y0 + (j - 1) * CELL + CELL / 2;
        const info = biome(wx, wy);
        const c = groundRGB(wx, wy, info);
        const o = (j * N + i) * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
        const inside = i > 0 && j > 0 && i < N - 1 && j < N - 1;
        if (inside && info.b <= B.SHALLOW && hash(wx, wy, 21) < 0.08) water.push([wx, wy, hash(wy, wx, 22) * 6.28]);
      }
    }
    groundBuf.ctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(groundBuf.cv, 0, 0, N, N, -CELL, -CELL, N * CELL, N * CELL);
    // растения рисуем с запасом за краями: деревья соседних чанков свисают внутрь
    const t0x = Math.floor(x0 / TILE) - 2, t1x = Math.floor((x0 + CHUNK) / TILE) + 2;
    const t0y = Math.floor(y0 / TILE) - 1, t1y = Math.floor((y0 + CHUNK) / TILE) + 4;
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const r = hash(tx, ty, 41), r2 = hash(tx, ty, 42);
        const wx = tx * TILE + 6 + hash(tx, ty, 43) * 20;
        const wy = ty * TILE + 6 + hash(tx, ty, 44) * 20;
        if (wx < 0 || wy < 0 || wx > WORLD || wy > WORLD) continue;
        const info = biome(wx, wy);
        decorate(ctx, wx, wy, wx - x0, wy - y0, info, r, r2);
      }
    }
    return { cv, water, last: 0 };
  }

  function getChunk(cx, cy, now) {
    const key = cx + "," + cy;
    const c = chunks.get(key);
    if (c) { c.last = now; return c; }
    if (!genQueue.some((q) => q.key === key)) genQueue.push({ key, cx, cy });
    return null;
  }

  function placeholder(cx, cy) {
    const info = biome(cx * CHUNK + CHUNK / 2, cy * CHUNK + CHUNK / 2);
    return groundColor(cx * CHUNK + CHUNK / 2, cy * CHUNK + CHUNK / 2, info);
  }

  function pumpQueue(now, budgetMs) {
    const start = performance.now();
    genQueue.sort((a, b) => dist2(a) - dist2(b));
    while (genQueue.length && performance.now() - start < budgetMs) {
      const q = genQueue.shift();
      if (dist2(q) > 9) continue; // игрок уже улетел
      const c = makeChunk(q.cx, q.cy);
      c.last = now;
      chunks.set(q.key, c);
    }
    if (chunks.size > MAX_CHUNKS) {
      const arr = [...chunks.entries()].sort((a, b) => a[1].last - b[1].last);
      for (let i = 0; i < chunks.size - MAX_CHUNKS; i++) chunks.delete(arr[i][0]);
    }
  }
  function dist2(q) {
    const dx = q.cx - Math.floor(player.x / CHUNK), dy = q.cy - Math.floor(player.y / CHUNK);
    return dx * dx + dy * dy;
  }

  // ---------- игрок ----------
  const player = { x: WORLD / 2, y: WORLD / 2, vx: 0, vy: 0, face: 1, nick: "" };
  const keys = new Set();
  const stick = { on: false, ox: 0, oy: 0, dx: 0, dy: 0 };

  function findSpawn() {
    for (let r = 0; r < 60000; r += 400) {
      for (let a = 0; a < 6.28; a += 0.5) {
        const x = WORLD / 2 + Math.cos(a) * r, y = WORLD / 2 + Math.sin(a) * r;
        const b = biome(x, y).b;
        if (b === B.FLOWERS || b === B.MEADOW) return { x, y };
      }
    }
    return { x: WORLD / 2, y: WORLD / 2 };
  }

  // ---------- карта открытых мест (как в Террарии) ----------
  const EXP = 1024;
  let explored = new Set();
  function loadExplored() {
    try { explored = new Set(JSON.parse(localStorage.getItem("pchelki_explored") || "[]")); } catch (e) { explored = new Set(); }
  }
  function saveState() {
    try {
      localStorage.setItem("pchelki_pos", JSON.stringify({ x: player.x | 0, y: player.y | 0 }));
      const arr = [...explored]; if (arr.length > 30000) arr.splice(0, arr.length - 30000);
      localStorage.setItem("pchelki_explored", JSON.stringify(arr));
    } catch (e) {}
  }

  const MM = 150, MM_STEP = 160; // мини-карта: 150×150 точек, 1 точка = 160 px мира
  const mmCanvas = document.createElement("canvas"); mmCanvas.width = MM; mmCanvas.height = MM;
  const mmCtx = mmCanvas.getContext("2d");
  let mmCenter = null, mmRow = MM;
  const MM_COL = ["#2b78b6", "#5cc3cf", "#f4e3b5", "#8fd36b", "#d79be8", "#4e9b52", "#ffb3d1", "#d8d670", "#a9a39b", "#f3f7fc"];
  function pumpMinimap(budgetMs) {
    if (!mmCenter || Math.abs(player.x - mmCenter.x) > 2500 || Math.abs(player.y - mmCenter.y) > 2500) {
      mmCenter = { x: player.x, y: player.y }; mmRow = 0;
      mmCtx.fillStyle = "#0d1020"; mmCtx.fillRect(0, 0, MM, MM);
    }
    const start = performance.now();
    while (mmRow < MM && performance.now() - start < budgetMs) {
      const wy = mmCenter.y + (mmRow - MM / 2) * MM_STEP;
      for (let i = 0; i < MM; i++) {
        const wx = mmCenter.x + (i - MM / 2) * MM_STEP;
        if (!explored.has(((wx / EXP) | 0) + "," + ((wy / EXP) | 0))) continue;
        mmCtx.fillStyle = MM_COL[biome(wx, wy).b];
        mmCtx.fillRect(i, mmRow, 1, 1);
      }
      mmRow++;
    }
  }

  // ---------- частицы пыльцы ----------
  const motes = Array.from({ length: 46 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.6, p: Math.random() * 6 }));

  // ---------- отрисовка ----------
  let canvas, ctx, dpr = 1, W = 0, H = 0, running = false, lastT = 0, saveT = 0, onExit = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
  }

  function drawBee(x, y, t, face, nick, me) {
    const bob = Math.sin(t * 6) * 3;
    shadow(ctx, x, y + 22, 14, 5);
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(face, 1);
    const flap = Math.abs(Math.sin(t * 40));
    ctx.fillStyle = "rgba(210,240,255,0.85)"; ctx.strokeStyle = "#2b1d0e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-4, -14, 8, 11 * (0.5 + flap * 0.5), -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(5, -15, 8, 11 * (0.5 + flap * 0.5), 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffb703";
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = "#2b1d0e"; ctx.fillRect(-9, -12, 5, 24); ctx.fillRect(1, -12, 5, 24);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#2b1d0e"; ctx.beginPath(); ctx.arc(10, -3, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(10.8, -3.8, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.arc(12, 3, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2b1d0e"; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-23, 2); ctx.lineTo(-17, 4); ctx.fill();
    ctx.restore();
    if (nick) {
      ctx.font = "600 13px Rubik, sans-serif"; ctx.textAlign = "center";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.strokeText(nick, x, y - 34 + bob);
      ctx.fillStyle = me ? "#fff" : "#ffe08a"; ctx.fillText(nick, x, y - 34 + bob);
    }
  }

  // ---------- мультиплеер (Supabase Realtime) ----------
  // Каждый игрок 5 раз в секунду рассылает свою позицию, когда летит. Остальные плавно её догоняют.
  const others = new Map(); // ник -> {x, y, tx, ty, face, seen}
  let chan = null, sendT = 0, lastSent = null, online = 1;
  function netStart(sb) {
    if (!sb || !player.nick) return;
    chan = sb.channel("world", { config: { broadcast: { self: false }, presence: { key: player.nick } } });
    chan.on("broadcast", { event: "pos" }, ({ payload: p }) => {
      if (!p || typeof p.n !== "string" || p.n === player.nick || !isFinite(p.x) || !isFinite(p.y)) return;
      let o = others.get(p.n);
      if (!o) { o = { x: p.x, y: p.y }; others.set(p.n, o); }
      o.tx = p.x; o.ty = p.y; o.face = p.f === -1 ? -1 : 1; o.seen = performance.now();
    });
    chan.on("presence", { event: "sync" }, () => { online = Math.max(1, Object.keys(chan.presenceState()).length); });
    chan.on("presence", { event: "leave" }, ({ key }) => others.delete(key));
    // новичок спрашивает, кто где: все отвечают своей позицией
    chan.on("broadcast", { event: "hello" }, () => sendPos(true));
    chan.subscribe((st) => {
      if (st !== "SUBSCRIBED" || !chan) return;
      chan.track({ n: player.nick });
      chan.send({ type: "broadcast", event: "hello", payload: {} });
      sendPos(true);
    });
  }
  function sendPos(force) {
    if (!chan) return;
    const x = Math.round(player.x), y = Math.round(player.y);
    if (!force && lastSent && Math.abs(lastSent.x - x) < 2 && Math.abs(lastSent.y - y) < 2) return;
    lastSent = { x, y };
    chan.send({ type: "broadcast", event: "pos", payload: { n: player.nick, x, y, f: player.face } });
  }
  function netStop() {
    if (chan) { const c = chan; chan = null; c.untrack(); c.unsubscribe(); }
    others.clear(); online = 1; lastSent = null;
  }
  function netTick(t, dt) {
    if (t - sendT > 0.2) { sendT = t; sendPos(false); }
    const now = performance.now();
    for (const [n, o] of others) {
      if (now - o.seen > 15000) { others.delete(n); continue; }
      o.x += (o.tx - o.x) * Math.min(1, dt * 8);
      o.y += (o.ty - o.y) * Math.min(1, dt * 8);
    }
  }

  function frame(tms) {
    if (!running) return;
    const t = tms / 1000;
    const dt = Math.min(0.05, lastT ? t - lastT : 0.016);
    lastT = t;

    // движение
    let ax = 0, ay = 0;
    if (keys.has("a") || keys.has("arrowleft") || keys.has("ф")) ax -= 1;
    if (keys.has("d") || keys.has("arrowright") || keys.has("в")) ax += 1;
    if (keys.has("w") || keys.has("arrowup") || keys.has("ц")) ay -= 1;
    if (keys.has("s") || keys.has("arrowdown") || keys.has("ы")) ay += 1;
    if (stick.on) { ax += stick.dx; ay += stick.dy; }
    const len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; }
    const speed = keys.has("shift") ? 620 : 340;
    player.vx += (ax * speed - player.vx) * Math.min(1, dt * 8);
    player.vy += (ay * speed - player.vy) * Math.min(1, dt * 8);
    player.x = Math.max(0, Math.min(WORLD, player.x + player.vx * dt));
    player.y = Math.max(0, Math.min(WORLD, player.y + player.vy * dt));
    if (Math.abs(player.vx) > 20) player.face = player.vx > 0 ? 1 : -1;
    for (let ex = ((player.x - W / 2) / EXP) | 0; ex <= ((player.x + W / 2) / EXP) | 0; ex++)
      for (let ey = ((player.y - H / 2) / EXP) | 0; ey <= ((player.y + H / 2) / EXP) | 0; ey++) explored.add(ex + "," + ey);

    const camX = player.x - W / 2, camY = player.y - H / 2;
    const now = performance.now();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0d1020"; ctx.fillRect(0, 0, W, H);

    // чанки в зоне видимости
    const c0x = Math.floor(camX / CHUNK), c1x = Math.floor((camX + W) / CHUNK);
    const c0y = Math.floor(camY / CHUNK), c1y = Math.floor((camY + H) / CHUNK);
    const visible = [];
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const sx = Math.round(cx * CHUNK - camX), sy = Math.round(cy * CHUNK - camY);
        const c = getChunk(cx, cy, now);
        if (c) { ctx.drawImage(c.cv, sx, sy); visible.push(c); }
        else { ctx.fillStyle = placeholder(cx, cy); ctx.fillRect(sx, sy, CHUNK, CHUNK); }
      }
    }
    // заранее готовим соседние чанки
    for (let cy = c0y - 1; cy <= c1y + 1; cy++) for (let cx = c0x - 1; cx <= c1x + 1; cx++) getChunk(cx, cy, now);
    pumpQueue(now, 8);

    // блики на воде
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const c of visible) {
      for (const w of c.water) {
        const a = Math.sin(t * 2 + w[2]);
        if (a < 0.55) continue;
        const sx = w[0] - camX, sy = w[1] - camY;
        ctx.globalAlpha = (a - 0.55) * 2.2;
        ctx.fillRect(sx - 5, sy, 10, 1.6); ctx.fillRect(sx - 1, sy - 3, 2, 1.4);
      }
    }
    ctx.globalAlpha = 1;

    // пыльца
    for (const m of motes) {
      const mx = ((m.x * W - camX * 0.15 + t * 12 * m.s) % W + W) % W;
      const my = ((m.y * H - camY * 0.15 + Math.sin(t + m.p) * 14) % H + H) % H;
      ctx.fillStyle = `rgba(255,240,170,${0.35 + 0.35 * Math.sin(t * 2 + m.p)})`;
      ctx.beginPath(); ctx.arc(mx, my, m.s * 1.4, 0, Math.PI * 2); ctx.fill();
    }

    // другие пчёлки
    netTick(t, dt);
    for (const [n, o] of others) {
      const sx = o.x - camX, sy = o.y - camY;
      if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
      drawBee(sx, sy, t + n.length, o.face, n, false);
    }
    drawBee(W / 2, H / 2, t, player.face, player.nick, true);

    // мягкий солнечный свет
    const sun = ctx.createRadialGradient(W * 0.15, -H * 0.1, 0, W * 0.15, -H * 0.1, Math.max(W, H));
    sun.addColorStop(0, "rgba(255,236,170,0.28)"); sun.addColorStop(1, "rgba(255,236,170,0)");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

    // лёгкое затемнение по краям экрана, весь экран видно
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) / 2);
    vig.addColorStop(0, "rgba(20,30,40,0)"); vig.addColorStop(1, "rgba(20,30,40,0.18)");
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

    // мини-карта
    pumpMinimap(3);
    const mmX = W - MM - 14, mmY = 14;
    ctx.fillStyle = "rgba(8,10,24,0.7)"; ctx.fillRect(mmX - 4, mmY - 4, MM + 8, MM + 8);
    ctx.save();
    ctx.beginPath(); ctx.rect(mmX, mmY, MM, MM); ctx.clip();
    ctx.drawImage(mmCanvas, mmX + (mmCenter.x - player.x) / MM_STEP, mmY + (mmCenter.y - player.y) / MM_STEP);
    ctx.restore();
    ctx.strokeStyle = "#ffb703"; ctx.lineWidth = 2; ctx.strokeRect(mmX - 4, mmY - 4, MM + 8, MM + 8);
    ctx.fillStyle = "#fff";
    for (const o of others.values()) {
      const px = mmX + MM / 2 + (o.x - player.x) / MM_STEP, py = mmY + MM / 2 + (o.y - player.y) / MM_STEP;
      if (px > mmX && py > mmY && px < mmX + MM && py < mmY + MM) { ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = "#ffb703"; ctx.beginPath(); ctx.arc(mmX + MM / 2, mmY + MM / 2, 3, 0, Math.PI * 2); ctx.fill();

    // подписи
    const here = biome(player.x, player.y);
    document.getElementById("world-biome").textContent = NAMES[here.b];
    document.getElementById("world-pos").textContent = `X ${(player.x / TILE) | 0} · Y ${(player.y / TILE) | 0}`;
    document.getElementById("world-online").textContent = `🐝 в игре: ${online}`;

    if (t - saveT > 3) { saveT = t; saveState(); }
    requestAnimationFrame(frame);
  }

  // ---------- управление ----------
  function onKey(e) {
    const k = e.key.toLowerCase();
    if (e.type === "keydown") { keys.add(k); if (k.startsWith("arrow") || k === " ") e.preventDefault(); }
    else keys.delete(k);
    if (e.type === "keydown" && k === "escape") stop();
  }
  function onDown(e) {
    stick.on = true; stick.ox = e.clientX; stick.oy = e.clientY; stick.dx = stick.dy = 0;
    canvas.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!stick.on) return;
    const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy);
    const k = l > 60 ? 60 / l : 1;
    stick.dx = (dx * k) / 60; stick.dy = (dy * k) / 60;
  }
  function onUp() { stick.on = false; stick.dx = stick.dy = 0; }

  function start(opts = {}) {
    canvas = document.getElementById("world");
    ctx = canvas.getContext("2d");
    player.nick = opts.nick || "";
    onExit = opts.onExit || null;
    loadExplored();
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem("pchelki_pos") || "null"); } catch (e) {}
    const p = pos && pos.x ? pos : findSpawn();
    player.x = p.x; player.y = p.y; player.vx = player.vy = 0;
    document.getElementById("world-wrap").classList.add("on");
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    running = true; lastT = 0;
    netStart(opts.sb);
    requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    saveState();
    netStop();
    keys.clear(); onUp();
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    document.getElementById("world-wrap").classList.remove("on");
    if (onExit) onExit();
  }

  window.BeeWorld = { start, stop, biome, B, NAMES };
})();
