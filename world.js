// Пчёлки 67: мир 2 000 000 × 2 000 000 пикселей, улей в центре, координаты от −1 000 000 до 1 000 000.
// Мир не хранится целиком: каждый кусок (чанк) рисуется на лету из шума по одному и тому же зерну,
// поэтому у всех игроков одинаковая карта.
(() => {
  const WORLD = 2_000_000;
  const OFF = 500_000;      // сдвиг шума: местность вокруг улья осталась прежней
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
  const B = { DEEP: 0, SHALLOW: 1, SAND: 2, MEADOW: 3, FLOWERS: 4, FOREST: 5, SAKURA: 6, GOLDEN: 7, ROCK: 8, SNOW: 9,
    LAVENDER: 10, AUTUMN: 11, SWAMP: 12, MUSHROOM: 13, DESERT: 14, JUNGLE: 15, ICE: 16, VOLCANO: 17, CRYSTAL: 18 };
  const NAMES = ["Глубокое озеро", "Мелководье", "Пляж", "Зелёный луг", "Цветочная долина",
    "Тихий лес", "Сакуровая роща", "Золотое поле", "Скалы", "Снежная вершина",
    "Лавандовое поле", "Осенний лес", "Болото", "Грибной лес", "Медовые дюны",
    "Джунгли", "Ледяное озеро", "Вулканы", "Хрустальные холмы"];

  // e — высота, m — влажность, f — «цветочность», T — тепло
  function biome(x, y) {
    const nx = x - OFF, ny = y - OFF;
    const cont = fbm(nx / 70000, ny / 70000, 3, 7);
    let e = fbm(nx / 9000, ny / 9000, 5, 1) * 0.65 + cont * 0.35;
    let m = fbm(nx / 5200 + 100, ny / 5200, 4, 3);
    const f = fbm(nx / 3600, ny / 3600 + 50, 3, 5);
    let T = fbm(nx / 16000 + 300, ny / 16000 - 200, 3, 13);
    // вокруг улья (центр мира) всегда цветочная поляна
    const hd = Math.hypot(x - WORLD / 2, y - WORLD / 2);
    if (hd < 3000) {
      const k = hd < 1200 ? 0 : (hd - 1200) / 1800, kk = k * k * (3 - 2 * k);
      e = 0.52 + (e - 0.52) * kk; m = 0.5 + (m - 0.5) * kk; T = 0.5 + (T - 0.5) * kk;
    }
    let b;
    if (e < 0.40) b = T < 0.38 ? B.ICE : B.DEEP;
    else if (e < 0.43) b = T < 0.38 ? B.ICE : B.SHALLOW;
    else if (e < 0.445) b = B.SAND;
    else if (e > 0.665) b = T > 0.6 ? B.VOLCANO : B.SNOW;
    else if (e > 0.615) b = f > 0.58 ? B.CRYSTAL : B.ROCK;
    else if (m > 0.6 && e < 0.49) b = B.SWAMP;
    else if (T > 0.6) b = m < 0.45 ? B.DESERT : m > 0.54 ? B.JUNGLE : B.GOLDEN;
    else if (T < 0.4) b = m > 0.53 ? B.AUTUMN : m < 0.46 ? B.LAVENDER : B.MEADOW;
    else if (m > 0.56) b = f > 0.6 ? B.MUSHROOM : f > 0.53 ? B.SAKURA : B.FOREST;
    else if (m < 0.42) b = B.GOLDEN;
    else if (f > 0.52) b = B.FLOWERS;
    else b = B.MEADOW;
    return { b, e, m, f, T };
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
    lav: hex("#a9c983"), lavDark: hex("#98b877"), autumn: hex("#d0a85c"), autumnDark: hex("#bd8c44"),
    swamp: hex("#6b8a50"), swampDark: hex("#587a45"), swampWater: hex("#4e6e5c"),
    mush: hex("#6e5f8e"), mushDark: hex("#5a4c78"), desert: hex("#f3d282"), desertDark: hex("#e3b660"),
    jungle: hex("#3f9a4a"), jungleDark: hex("#2f8040"), ice: hex("#d6eefa"), iceDark: hex("#b5dcef"),
    ash: hex("#4d403d"), ashDark: hex("#3b302e"), lava: hex("#ff6a1f"), lavaHot: hex("#ffd34a"),
    crys: hex("#a39dc0"), crysDark: hex("#8a84a8"),
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
      case B.LAVENDER: return scale(mix(C.lav, C.lavDark, n), k);
      case B.AUTUMN: return scale(mix(C.autumn, C.autumnDark, n), k);
      case B.SWAMP: return vnoise(x / 140, y / 140, 15) > 0.62 ? scale(C.swampWater, k) : scale(mix(C.swamp, C.swampDark, n), k);
      case B.MUSHROOM: return scale(mix(C.mush, C.mushDark, n), k);
      case B.DESERT: {
        const dune = 0.5 + 0.5 * Math.sin(x / 70 + y / 260 + vnoise(x / 400, y / 400, 16) * 8);
        return scale(mix(C.desert, C.desertDark, dune * 0.6), k);
      }
      case B.JUNGLE: return scale(mix(C.jungle, C.jungleDark, n), k);
      case B.ICE: return mix(C.ice, C.iceDark, n);
      case B.VOLCANO: return scale(mix(C.ash, C.ashDark, n), k);
      case B.CRYSTAL: return scale(mix(C.crys, C.crysDark, n), k);
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

  // ---------- растения новых локаций ----------
  function lavender(ctx, x, y, s) {
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      const bx = x + i * 5;
      ctx.strokeStyle = "#6f8f4f"; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + i, y - 15 * s); ctx.stroke();
      ctx.fillStyle = i === 0 ? "#9b6fd6" : "#b48be6";
      for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(bx + i, y - 10 * s - j * 3.2, 2.2, 1.8, 0, 0, 6.283); ctx.fill(); }
    }
  }
  function leaves(ctx, x, y, r) {
    const cols = ["#e0782f", "#f2a541", "#d9534f", "#e8b04a"];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.ellipse(x + (hash(x, i, 5) - 0.5) * 24, y + (hash(i, y, 6) - 0.5) * 24, 3.2, 1.8, r + i, 0, 6.283); ctx.fill();
    }
  }
  function cattail(ctx, x, y) {
    ctx.strokeStyle = "#6d8f4a"; ctx.lineWidth = 1.6;
    for (const [dx, h] of [[-4, 18], [0, 24], [4, 16]]) {
      ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.lineTo(x + dx * 1.3, y - h); ctx.stroke();
      ctx.fillStyle = "#7a4a22"; ctx.beginPath(); ctx.ellipse(x + dx * 1.3, y - h + 3, 2.2, 5, 0, 0, 6.283); ctx.fill();
    }
  }
  function puddle(ctx, x, y, s) {
    ctx.fillStyle = "rgba(40,70,60,0.55)"; ctx.beginPath(); ctx.ellipse(x, y, 15 * s, 6 * s, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.ellipse(x - 4 * s, y - 1.5, 5 * s, 1.2, 0, 0, 6.283); ctx.fill();
  }
  function bigMushroom(ctx, x, y, s, cap) {
    shadow(ctx, x + 3, y + 2, 20 * s, 7 * s);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.arc(x, y - 22 * s, 30 * s, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#efe3d0"; ctx.beginPath(); ctx.roundRect(x - 5 * s, y - 22 * s, 10 * s, 22 * s, 4 * s); ctx.fill();
    ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(x, y - 22 * s, 22 * s, 15 * s, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(x, y - 22 * s, 22 * s, 3.5 * s, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const [dx, dy, r] of [[-9, -29, 3], [4, -33, 2.4], [11, -25, 2], [-2, -25, 1.8]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.283); ctx.fill(); }
  }
  function glowShroom(ctx, x, y, col) {
    const g = ctx.createRadialGradient(x, y - 4, 0, x, y - 4, 14); g.addColorStop(0, col + "88"); g.addColorStop(1, col + "00");
    ctx.fillStyle = g; ctx.fillRect(x - 14, y - 18, 28, 28);
    ctx.fillStyle = "#e9e1f0"; ctx.fillRect(x - 1.2, y - 5, 2.4, 5);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y - 5, 5, 3.5, 0, Math.PI, 0); ctx.fill();
  }
  function cactus(ctx, x, y, s) {
    shadow(ctx, x + 3, y + 2, 10 * s, 4 * s);
    ctx.fillStyle = "#5aa557"; ctx.strokeStyle = "#3f7d3c"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x - 5 * s, y - 32 * s, 10 * s, 32 * s, 5 * s); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - 14 * s, y - 22 * s, 6 * s, 12 * s, 3 * s); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 10 * s, y - 13 * s, 6 * s, 4 * s);
    ctx.beginPath(); ctx.roundRect(x + 8 * s, y - 27 * s, 6 * s, 12 * s, 3 * s); ctx.fill(); ctx.stroke();
    ctx.fillRect(x + 4 * s, y - 18 * s, 6 * s, 4 * s);
    ctx.fillStyle = "#ff7fb0"; ctx.beginPath(); ctx.arc(x, y - 33 * s, 3 * s, 0, 6.283); ctx.fill();
  }
  function palm(ctx, x, y, s) {
    shadow(ctx, x + 14 * s, y + 2, 24 * s, 8 * s);
    ctx.strokeStyle = "#a8743f"; ctx.lineWidth = 6 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * s, y - 24 * s, x + 12 * s, y - 44 * s); ctx.stroke();
    const tx = x + 12 * s, ty = y - 46 * s;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.75;
      ctx.fillStyle = i % 2 ? "#3fae4f" : "#2f9a42";
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a - 0.3) * 20 * s, ty + Math.sin(a - 0.3) * 20 * s, tx + Math.cos(a) * 30 * s, ty + Math.sin(a) * 30 * s + 8 * s);
      ctx.quadraticCurveTo(tx + Math.cos(a + 0.3) * 16 * s, ty + Math.sin(a + 0.3) * 16 * s, tx, ty); ctx.fill();
    }
    ctx.fillStyle = "#7a4a1e";
    ctx.beginPath(); ctx.arc(tx - 3 * s, ty + 4 * s, 3 * s, 0, 6.283); ctx.arc(tx + 3 * s, ty + 5 * s, 3 * s, 0, 6.283); ctx.fill();
  }
  function iceChunk(ctx, x, y, s) {
    shadow(ctx, x + 2, y + 2, 12 * s, 4 * s);
    ctx.fillStyle = "#eef9ff"; ctx.strokeStyle = "#9fd0ea"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 11 * s, y); ctx.lineTo(x - 8 * s, y - 14 * s); ctx.lineTo(x + 2 * s, y - 19 * s);
    ctx.lineTo(x + 11 * s, y - 9 * s); ctx.lineTo(x + 9 * s, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c4e7f7"; ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 19 * s); ctx.lineTo(x + 11 * s, y - 9 * s); ctx.lineTo(x + 9 * s, y); ctx.lineTo(x + 1 * s, y); ctx.closePath(); ctx.fill();
  }
  function crack(ctx, x, y, r) {
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 3);
    ctx.lineTo(x - 4, y + 2 - r * 4); ctx.lineTo(x + 3, y - 2); ctx.lineTo(x + 12, y + 3 + r * 3);
    ctx.moveTo(x + 3, y - 2); ctx.lineTo(x + 5, y - 9); ctx.stroke();
  }
  function lavaPool(ctx, x, y, s) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 30 * s);
    g.addColorStop(0, "rgba(255,150,40,0.45)"); g.addColorStop(1, "rgba(255,90,20,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 30 * s, y - 30 * s, 60 * s, 60 * s);
    ctx.fillStyle = "#2c2220"; ctx.beginPath(); ctx.ellipse(x, y, 21 * s, 12 * s, 0.2, 0, 6.283); ctx.fill();
    const lg = ctx.createRadialGradient(x - 3 * s, y - 2 * s, 1, x, y, 18 * s);
    lg.addColorStop(0, "#ffe46a"); lg.addColorStop(0.5, "#ff9a2a"); lg.addColorStop(1, "#e8451a");
    ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(x, y, 17 * s, 9 * s, 0.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = "rgba(255,255,200,0.6)"; ctx.beginPath(); ctx.arc(x + 5 * s, y - 2 * s, 2 * s, 0, 6.283); ctx.arc(x - 7 * s, y + 2 * s, 1.4 * s, 0, 6.283); ctx.fill();
  }
  function lavaRock(ctx, x, y, s) {
    rock(ctx, x, y, s, "#3d3230");
    ctx.strokeStyle = "#ff7a2a"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x - 6 * s, y - 3 * s); ctx.lineTo(x - 1 * s, y - 9 * s); ctx.lineTo(x + 4 * s, y - 5 * s); ctx.stroke();
    ctx.fillStyle = "rgba(255,120,40,0.25)"; ctx.beginPath(); ctx.arc(x, y - 6 * s, 14 * s, 0, 6.283); ctx.fill();
  }
  function crystal(ctx, x, y, s, col) {
    shadow(ctx, x + 2, y + 2, 13 * s, 5 * s);
    ctx.fillStyle = col + "33"; ctx.beginPath(); ctx.arc(x, y - 14 * s, 22 * s, 0, 6.283); ctx.fill();
    for (const [dx, h, w, a] of [[-7, 18, 5, -0.35], [0, 28, 6, 0], [7, 16, 4.5, 0.4]]) {
      ctx.save(); ctx.translate(x + dx * s, y); ctx.rotate(a);
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(-w * s, 0); ctx.lineTo(-w * s, -h * s); ctx.lineTo(0, -(h + 7) * s); ctx.lineTo(w * s, -h * s); ctx.lineTo(w * s, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath();
      ctx.moveTo(-w * s, 0); ctx.lineTo(-w * s, -h * s); ctx.lineTo(0, -(h + 7) * s); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
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
      case B.LAVENDER:
        if (r < 0.01) tree(ctx, lx, ly, 0.85, "#7fb069", "#a3cf8a");
        else if (r < 0.7) lavender(ctx, lx, ly, 0.9 + r2 * 0.4);
        else if (r < 0.8) tuft(ctx, lx, ly, "#7f9a5a");
        break;
      case B.AUTUMN:
        if (r < 0.18) tree(ctx, lx, ly, 1 + r2 * 0.4, r2 < 0.33 ? "#e0782f" : r2 < 0.66 ? "#f2a541" : "#d9534f", "#ffc36b");
        else if (r < 0.45) leaves(ctx, lx, ly, r2 * 6);
        else if (r < 0.5) mushroom(ctx, lx, ly);
        else if (r < 0.6) tuft(ctx, lx, ly, "#a08a45");
        break;
      case B.SWAMP:
        if (r < 0.05) tree(ctx, lx, ly, 0.9, "#5c7a3e", "#7c9a52");
        else if (r < 0.25) cattail(ctx, lx, ly);
        else if (r < 0.33) puddle(ctx, lx, ly, 0.8 + r2);
        else if (r < 0.4) lily(ctx, lx, ly, r2 < 0.3);
        else if (r < 0.6) tuft(ctx, lx, ly, "#4f6a3a");
        break;
      case B.MUSHROOM:
        if (r < 0.1) bigMushroom(ctx, lx, ly, 1 + r2 * 0.6, r2 < 0.33 ? "#b36bd6" : r2 < 0.66 ? "#5f8fe8" : "#e8607a");
        else if (r < 0.3) glowShroom(ctx, lx, ly, r2 < 0.5 ? "#7ff0ff" : "#d38bff");
        else if (r < 0.45) tuft(ctx, lx, ly, "#4f3f6a");
        break;
      case B.DESERT:
        if (r < 0.04) cactus(ctx, lx, ly, 0.9 + r2 * 0.5);
        else if (r < 0.07) rock(ctx, lx, ly, 0.6, "#d9b26a");
        else if (r < 0.14) tuft(ctx, lx, ly, "#c2a053");
        break;
      case B.JUNGLE:
        if (r < 0.14) palm(ctx, lx, ly, 1 + r2 * 0.4);
        else if (r < 0.3) bush(ctx, lx, ly, "#2f8a3e", "#4fb05a");
        else if (r < 0.4) flower(ctx, lx, ly, r2 < 0.5 ? "#ff5f3d" : "#ff3d9a", 3.6);
        else if (r < 0.75) tuft(ctx, lx, ly, "#2f7a38");
        break;
      case B.ICE:
        if (r < 0.04) iceChunk(ctx, lx, ly, 0.8 + r2 * 0.6);
        else if (r < 0.12) crack(ctx, lx, ly, r2);
        break;
      case B.VOLCANO:
        if (r < 0.04) lavaPool(ctx, lx, ly, 0.9 + r2 * 0.9);
        else if (r < 0.1) lavaRock(ctx, lx, ly, 0.9 + r2 * 0.8);
        else if (r < 0.14) rock(ctx, lx, ly, 0.7, "#4a3e3b");
        break;
      case B.CRYSTAL:
        if (r < 0.09) crystal(ctx, lx, ly, 0.8 + r2 * 0.7, ["#ff8fd0", "#7fe0ff", "#b48bff", "#9fffc8"][(r2 * 4) | 0]);
        else if (r < 0.14) rock(ctx, lx, ly, 0.8, "#9c96b8");
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
        if (Math.hypot(wx - WORLD / 2, wy - WORLD / 2) < 340) continue;
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

  // ---------- карта открытых мест (как в Террарии) ----------
  const EXP = 1024;
  let explored = new Set();
  function loadExplored() {
    try { explored = new Set(JSON.parse(localStorage.getItem("pchelki_explored2") || "[]")); } catch (e) { explored = new Set(); }
  }
  function saveState() {
    try {
      const arr = [...explored]; if (arr.length > 30000) arr.splice(0, arr.length - 30000);
      localStorage.setItem("pchelki_explored2", JSON.stringify(arr));
    } catch (e) {}
  }

  const MM = 150, MM_STEP = 160; // мини-карта: 150×150 точек, 1 точка = 160 px мира
  const mmCanvas = document.createElement("canvas"); mmCanvas.width = MM; mmCanvas.height = MM;
  const mmCtx = mmCanvas.getContext("2d");
  let mmCenter = null, mmRow = MM;
  const MM_COL = ["#2b78b6", "#5cc3cf", "#f4e3b5", "#8fd36b", "#d79be8", "#4e9b52", "#ffb3d1", "#d8d670", "#a9a39b", "#f3f7fc",
    "#b48be6", "#e0782f", "#587a45", "#8a6bc0", "#f3d282", "#2f8040", "#cfeefa", "#ff6a1f", "#c4b8f0"];
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

  // ---------- улей и пыльца ----------
  // Улей стоит в центре мира, это координаты 0 0. Пыльцевые цветы стоят по сетке 256 px.
  const HX = WORLD / 2, HY = WORLD / 2, HIVE_R = 300, PCELL = 256;
  const TIER_DIST = [0, 60000, 200000, 450000, 750000];   // с какого расстояния от улья встречается
  const TIER_CHANCE = [1, 0.30, 0.16, 0.08, 0.04];
  const TIER_MULT = [1, 2, 3, 5, 10];
  const TIER_NAMES = ["Солнечник", "Лунный колокольчик", "Огненная лилия", "Хрустальная роза", "Радужный лотос"];
  const TIER_GLOW = ["255,214,80", "150,180,255", "255,110,50", "130,235,255", "255,225,130"];
  const BAG_CAPS = [100, 150, 225, 325, 450, 600, 800, 1000];
  const pcache = new Map();

  function pollenAt(gx, gy) {
    const key = gx + "," + gy;
    if (pcache.has(key)) return pcache.get(key);
    let f = null;
    if (hash(gx, gy, 77) < 0.33) {
      const x = gx * PCELL + 40 + hash(gx, gy, 78) * (PCELL - 80);
      const y = gy * PCELL + 40 + hash(gx, gy, 79) * (PCELL - 80);
      if (x > 0 && y > 0 && x < WORLD && y < WORLD && Math.hypot(x - HX, y - HY) > HIVE_R + 40 && biome(x, y).b > B.SHALLOW && biome(x, y).b !== B.ICE) {
        const d = Math.hypot(gx * PCELL + PCELL / 2 - HX, gy * PCELL + PCELL / 2 - HY);
        const r = hash(gx, gy, 80);
        let tier = 0;
        for (let t = 4; t >= 1; t--) if (d >= TIER_DIST[t] && r < TIER_CHANCE[t]) { tier = t; break; }
        f = { gx, gy, x, y, tier, key, ph: hash(gx, gy, 81) * 6.28 };
      }
    }
    if (pcache.size > 6000) pcache.clear();
    pcache.set(key, f);
    return f;
  }

  function star(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
  }

  // Головки цветов рисуются в точке (0, 0)
  const HEADS = [
    // 0. Солнечник: большой жёлтый цветок
    (t) => {
      ctx.fillStyle = "#ffc93c";
      for (let i = 0; i < 10; i++) { const a = i * 0.628; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 7, 3.6, a, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = "#ffe680";
      for (let i = 0; i < 10; i++) { const a = i * 0.628 + 0.31; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 4.5, 2.4, a, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = "#e8801a"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#ffd75e";
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.26) * 2.5, Math.sin(i * 1.26) * 2.5, 0.9, 0, 6.283); ctx.fill(); }
    },
    // 1. Лунный колокольчик: три светящихся сиреневых колокольчика
    (t) => {
      ctx.strokeStyle = "#4f8f6a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(0, -10, 12, -8); ctx.moveTo(0, -4); ctx.quadraticCurveTo(-4, -12, -12, -8); ctx.stroke();
      const bells = [[-12, -4], [0, 2], [12, -4]];
      for (let i = 0; i < 3; i++) {
        const [bx, by] = bells[i], sw = Math.sin(t * 2 + i) * 0.12;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(sw);
        const g = ctx.createLinearGradient(0, -7, 0, 8); g.addColorStop(0, "#c9b6ff"); g.addColorStop(1, "#7f9dff");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-5, -6); ctx.quadraticCurveTo(-5, 3, -8, 7);
        ctx.quadraticCurveTo(0, 4, 8, 7); ctx.quadraticCurveTo(5, 3, 5, -6); ctx.quadraticCurveTo(0, -11, -5, -6); ctx.fill();
        ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(0, 7, 1.8, 0, 6.283); ctx.fill();
        ctx.restore();
      }
    },
    // 2. Огненная лилия: острые красно-оранжевые лепестки и тычинки
    (t) => {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 17); g.addColorStop(0, "#ffe14d"); g.addColorStop(0.5, "#ff7a1f"); g.addColorStop(1, "#e8262a");
      ctx.fillStyle = g;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047 + Math.sin(t * 3 + i) * 0.05;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a - 0.4) * 11, Math.sin(a - 0.4) * 11, Math.cos(a) * 17, Math.sin(a) * 17);
        ctx.quadraticCurveTo(Math.cos(a + 0.4) * 11, Math.sin(a + 0.4) * 11, 0, 0); ctx.fill();
      }
      ctx.strokeStyle = "#7a2a10"; ctx.lineWidth = 1; ctx.fillStyle = "#3a1206";
      for (let i = 0; i < 5; i++) {
        const a = i * 1.256 + 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.stroke();
        ctx.beginPath(); ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8, 1.3, 0, 6.283); ctx.fill();
      }
    },
    // 3. Хрустальная роза: прозрачные голубые кристаллы
    (t) => {
      for (let layer = 0; layer < 3; layer++) {
        const r = 17 - layer * 5, n = 5, off = layer * 0.6;
        ctx.fillStyle = ["rgba(120,220,255,0.85)", "rgba(170,240,255,0.9)", "rgba(230,252,255,0.95)"][layer];
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          const a = off + i * 1.2566;
          const c = Math.cos(a), s = Math.sin(a), pc = Math.cos(a + 1.57), ps = Math.sin(a + 1.57);
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(c * r * 0.5 + pc * r * 0.28, s * r * 0.5 + ps * r * 0.28);
          ctx.lineTo(c * r, s * r);
          ctx.lineTo(c * r * 0.5 - pc * r * 0.28, s * r * 0.5 - ps * r * 0.28);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      ctx.fillStyle = "#fff"; star(0, 0, 4 + Math.sin(t * 4) * 1.2);
    },
    // 4. Радужный лотос: переливается всеми цветами, золотое сияние
    (t) => {
      ctx.save(); ctx.rotate(t * 0.4);
      ctx.fillStyle = "rgba(255,215,90,0.35)";
      for (let i = 0; i < 8; i++) { ctx.rotate(0.785); ctx.fillRect(-1.2, 12, 2.4, 14); }
      ctx.restore();
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785;
        ctx.fillStyle = `hsl(${(t * 70 + i * 45) % 360},90%,68%)`;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * 11, Math.sin(a) * 11, 9, 4.5, a, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = "#fff0f6";
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.5; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 5.5, 3, a, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = "#ffc93c"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.283); ctx.fill();
    },
  ];

  function drawPollenFlower(f, sx, sy, t, empty) {
    const glow = TIER_GLOW[f.tier];
    const S = 1.55 + f.tier * 0.12;           // пыльцевые цветы крупнее обычных
    if (!empty) {
      const R = (46 + f.tier * 6) * S * 0.8, pulse = 0.5 + 0.2 * Math.sin(t * 2.5 + f.ph);
      const hy = sy - 20 * S;
      const g = ctx.createRadialGradient(sx, hy, 0, sx, hy, R);
      g.addColorStop(0, `rgba(${glow},${pulse})`); g.addColorStop(0.45, `rgba(${glow},${pulse * 0.35})`); g.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g; ctx.fillRect(sx - R, hy - R, R * 2, R * 2);
      // светлое кольцо на земле
      ctx.strokeStyle = `rgba(${glow},${0.35 + 0.25 * Math.sin(t * 3 + f.ph)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(sx, sy + 3, 20 * S * 0.7, 7 * S * 0.7, 0, 0, 6.283); ctx.stroke();
    }
    ctx.save();
    ctx.translate(sx, sy); ctx.scale(S, S);
    if (empty) ctx.globalAlpha = 0.4;
    shadow(ctx, 0, 3, 11, 4);
    ctx.strokeStyle = "#4f9a45"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 3); ctx.quadraticCurveTo(-4, -8, 0, -18); ctx.stroke();
    ctx.fillStyle = "#62b152";
    ctx.beginPath(); ctx.ellipse(5, -5, 6, 2.6, -0.5, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-5, -9, 5, 2.3, 0.5, 0, 6.283); ctx.fill();
    ctx.translate(0, -20);
    ctx.rotate(Math.sin(t * 1.6 + f.ph) * 0.06);
    if (empty) ctx.scale(0.7, 0.7);
    HEADS[f.tier](t);
    ctx.restore();
    if (!empty) {
      ctx.fillStyle = `rgba(${glow},0.95)`;
      for (let i = 0; i < 2 + f.tier; i++) {
        const a = t * (0.8 + i * 0.13) + f.ph + i * 2.1;
        const rise = f.tier === 2 ? ((t * 18 + i * 13) % 34) * S : 0;
        star(sx + Math.cos(a) * (16 + i * 3) * S, sy - 20 * S + Math.sin(a * 1.3) * 12 * S - rise, 2.6);
      }
    }
  }

  function drawHiveGround(sx, sy, t) {
    ctx.fillStyle = "rgba(255,190,40,0.14)";
    ctx.beginPath(); ctx.arc(sx, sy, HIVE_R, 0, 6.283); ctx.fill();
    ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 20;
    ctx.strokeStyle = "rgba(255,170,0,0.75)"; ctx.lineWidth = 4; ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawHive(sx, sy, t) {
    shadow(ctx, sx + 10, sy + 8, 100, 26);
    ctx.fillStyle = "#9a6434"; ctx.strokeStyle = "#5c3a17"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(sx - 86, sy - 10, 172, 20, 7); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const w = 80 - i * 9 - i * i * 0.9, y = sy - 14 - i * 21;
      ctx.fillStyle = i % 2 ? "#f2a93b" : "#f8c24f"; ctx.strokeStyle = "#8a5418"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx, y, w, 17, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.ellipse(sx - w * 0.45, y - 5, w * 0.25, 4, -0.15, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = "#8a5418"; ctx.beginPath(); ctx.arc(sx, sy - 128, 9, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#4a2a0c"; ctx.beginPath(); ctx.ellipse(sx, sy - 22, 17, 13, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(sx - 17, sy - 22, 34, 8);
    ctx.fillStyle = "#ffcf3a";
    for (const [dx, dy, l] of [[-50, -50, 14], [38, -72, 10], [-24, -94, 8]]) {
      const k = 1 + Math.sin(t * 1.5 + dx) * 0.15;
      ctx.beginPath(); ctx.moveTo(sx + dx - 5, sy + dy); ctx.quadraticCurveTo(sx + dx - 5, sy + dy + l * k, sx + dx, sy + dy + l * k + 4);
      ctx.quadraticCurveTo(sx + dx + 5, sy + dy + l * k, sx + dx + 5, sy + dy); ctx.fill();
    }
    // табличка
    ctx.fillStyle = "#b07a45"; ctx.strokeStyle = "#5c3a17"; ctx.lineWidth = 2.5;
    ctx.fillRect(sx + 88, sy - 30, 4, 34);
    ctx.beginPath(); ctx.roundRect(sx + 62, sy - 54, 58, 26, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff4d6"; ctx.font = "800 13px Rubik, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("УЛЕЙ", sx + 91, sy - 36);
    // пчёлки кружат вокруг
    for (let i = 0; i < 4; i++) {
      const a = t * 1.3 + i * 1.57, bx = sx + Math.cos(a) * 115, by = sy - 70 + Math.sin(a) * 45;
      ctx.fillStyle = "rgba(220,240,255,0.8)"; ctx.beginPath(); ctx.ellipse(bx, by - 5, 3, 4 * Math.abs(Math.sin(t * 30 + i)) + 0.5, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#ffb703"; ctx.beginPath(); ctx.ellipse(bx, by, 6, 4.5, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#2b1d0e"; ctx.fillRect(bx - 1.5, by - 4, 2.5, 8);
    }
  }

  // ---------- животные ----------
  // Животные стоят по сетке 320 px. Где именно и куда бегут, считается от времени (Date.now),
  // поэтому у всех игроков звери в тех же местах. Если пчёлка подлетит близко, звери отбегают.
  const ACELL = 280;
  const ASCALE = { butterfly: 1.5, moth: 1.6, firefly: 1.3, parrot: 1.6, snail: 1.7, crab: 1.7, frog: 1.8, hedgehog: 1.8, fish: 1.6, lizard: 1.7, salamander: 1.8 };
  // тип: [поведение, радиус прогулки, скорость]
  const KINDS = {
    butterfly: ["fly", 90, 0.5], parrot: ["fly", 170, 0.35], firefly: ["fly", 50, 0.3], moth: ["fly", 90, 0.45],
    rabbit: ["hop", 120, 1.1], frog: ["hop", 70, 0.8],
    deer: ["walk", 150, 0.06], fox: ["walk", 160, 0.09], hedgehog: ["walk", 60, 0.07], snail: ["walk", 25, 0.03],
    goat: ["walk", 90, 0.06], penguin: ["walk", 80, 0.08], lizard: ["walk", 90, 0.12], salamander: ["walk", 80, 0.1],
    crab: ["walk", 70, 0.1], duck: ["swim", 100, 0.06], fish: ["swim", 80, 0.05],
  };
  const FAUNA = {
    [B.MEADOW]: [["rabbit", 3], ["butterfly", 3], ["hedgehog", 1]],
    [B.FLOWERS]: [["butterfly", 5], ["rabbit", 1]],
    [B.FOREST]: [["deer", 2], ["fox", 1], ["hedgehog", 1], ["snail", 1]],
    [B.SAKURA]: [["butterfly", 2], ["fox", 1], ["rabbit", 1]],
    [B.GOLDEN]: [["rabbit", 2], ["butterfly", 1]],
    [B.SAND]: [["crab", 1]],
    [B.SHALLOW]: [["duck", 2], ["fish", 1], ["frog", 1]],
    [B.DEEP]: [["fish", 3], ["duck", 1]],
    [B.ROCK]: [["goat", 2], ["lizard", 1]],
    [B.SNOW]: [["penguin", 2], ["rabbit", 1]],
    [B.LAVENDER]: [["butterfly", 4], ["rabbit", 1]],
    [B.AUTUMN]: [["fox", 2], ["hedgehog", 2], ["deer", 1]],
    [B.SWAMP]: [["frog", 4], ["firefly", 1], ["duck", 1]],
    [B.MUSHROOM]: [["firefly", 3], ["snail", 2]],
    [B.DESERT]: [["lizard", 1]],
    [B.JUNGLE]: [["parrot", 3], ["frog", 1], ["butterfly", 1]],
    [B.ICE]: [["penguin", 1]],
    [B.VOLCANO]: [["salamander", 1]],
    [B.CRYSTAL]: [["moth", 1]],
  };
  const BUTTERFLY_COLS = ["#ff9ec7", "#ffd84d", "#7fb8ff", "#b58cf0", "#ff8a5c", "#fff6ec"];
  const acache = new Map();

  function animalAt(ax, ay) {
    const key = ax + "," + ay;
    if (acache.has(key)) return acache.get(key);
    let a = null;
    if (hash(ax, ay, 91) < 0.5) {
      const hx = ax * ACELL + 70 + hash(ax, ay, 92) * (ACELL - 140);
      const hy = ay * ACELL + 70 + hash(ax, ay, 93) * (ACELL - 140);
      const b = biome(hx, hy).b, list = FAUNA[b];
      if (list && Math.hypot(hx - HX, hy - HY) > 360) {
        let total = 0; for (const [, w] of list) total += w;
        let r = hash(ax, ay, 94) * total, kind = list[0][0];
        for (const [k, w] of list) { if ((r -= w) < 0) { kind = k; break; } }
        const R = KINDS[kind][1];
        // зверь не должен выходить за свою местность (рыба на сушу и т.п.)
        let ok = true;
        if (KINDS[kind][0] !== "fly") for (const [dx, dy] of [[R, 0], [-R, 0], [0, R * 0.7], [0, -R * 0.7]]) if (biome(hx + dx, hy + dy).b !== b) ok = false;
        if (ok) a = {
          key, kind, hx, hy, R, b,
          p: [0, 1, 2, 3, 4].map((i) => hash(ax, ay, 95 + i) * 6.283),
          col: BUTTERFLY_COLS[(hash(ax, ay, 100) * 6) | 0],
          ox: 0, oy: 0,
        };
      }
    }
    if (acache.size > 4000) acache.clear();
    acache.set(key, a);
    return a;
  }

  // путь прогулки: сумма синусов, плавная петля вокруг дома
  function pathPos(a, tt) {
    const p = a.p, R = a.R;
    return [
      a.hx + R * (0.65 * Math.sin(tt + p[0]) + 0.35 * Math.sin(tt * 2.3 + p[1])),
      a.hy + R * 0.7 * (0.65 * Math.cos(tt * 0.9 + p[2]) + 0.35 * Math.sin(tt * 1.7 + p[3])),
    ];
  }
  // где зверь сейчас: [x, y, направление по x, подскок, фаза]
  function animalPos(a, t) {
    const [mode, , spd] = KINDS[a.kind];
    if (mode === "hop") {
      const k = t * spd + a.p[4], fr = k - Math.floor(k);
      const move = Math.min(1, fr / 0.45), ease = move * move * (3 - 2 * move);
      const tt = (Math.floor(k) + ease) * 0.45;
      const [x, y] = pathPos(a, tt), [x2] = pathPos(a, tt + 0.05);
      return [x, y, x2 - x, fr < 0.45 ? Math.sin((fr / 0.45) * Math.PI) * (a.kind === "frog" ? 7 : 10) : 0, fr];
    }
    const tt = t * spd * (mode === "fly" ? 1 : 6);
    const [x, y] = pathPos(a, tt), [x2] = pathPos(a, tt + 0.02);
    return [x, y, x2 - x, 0, tt];
  }

  // ----- рисунки зверей (смотрят вправо, (0,0) — точка на земле) -----
  function legs(n, x0, dx, y0, len, walk, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const sw = Math.sin(walk * 12 + i * Math.PI) * 3;
      ctx.beginPath(); ctx.moveTo(x0 + i * dx, y0); ctx.lineTo(x0 + i * dx + sw, y0 + len); ctx.stroke();
    }
  }
  function eye(x, y, r = 1.6) { ctx.fillStyle = "#1d140a"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.35, r * 0.4, 0, 6.283); ctx.fill(); }
  const ANIMAL_DRAW = {
    butterfly(a, t, ph, glow) {
      const f = Math.abs(Math.sin(t * 14 + a.p[0]));
      const c = glow ? "#8ff3ff" : a.col;
      if (glow) { const g = ctx.createRadialGradient(0, -18, 0, 0, -18, 22); g.addColorStop(0, "rgba(140,240,255,0.45)"); g.addColorStop(1, "rgba(140,240,255,0)"); ctx.fillStyle = g; ctx.fillRect(-22, -40, 44, 44); }
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(-4 * f, -20, 6 * f + 1, 7, -0.3, 0, 6.283); ctx.ellipse(4 * f, -20, 6 * f + 1, 7, 0.3, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-3 * f, -13, 4 * f + 1, 4.5, 0.3, 0, 6.283); ctx.ellipse(3 * f, -13, 4 * f + 1, 4.5, -0.3, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#2b1d0e"; ctx.fillRect(-1, -24, 2, 13);
    },
    moth(a, t, ph) { ANIMAL_DRAW.butterfly(a, t, ph, true); },
    parrot(a, t) {
      const f = Math.sin(t * 12 + a.p[0]);
      ctx.fillStyle = "#e8483f"; ctx.beginPath(); ctx.ellipse(0, -26, 10, 6, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -29, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#ffcf3a"; ctx.beginPath(); ctx.moveTo(13, -30); ctx.lineTo(18, -28); ctx.lineTo(13, -26); ctx.fill();
      ctx.fillStyle = "#3d8bff"; ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(-20, -24); ctx.lineTo(-10, -23); ctx.fill();
      ctx.fillStyle = "#2fb05a"; ctx.beginPath(); ctx.ellipse(-1, -26 - f * 7, 9, 4, -0.2, 0, 6.283); ctx.fill();
      eye(10, -30, 1.3);
    },
    firefly(a, t) {
      for (let i = 0; i < 5; i++) {
        const x = Math.sin(t * 1.3 + i * 2.1 + a.p[i]) * 22, y = -20 + Math.cos(t * 1.1 + i * 1.7) * 14;
        const on = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.9);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, `rgba(210,255,120,${0.8 * on})`); g.addColorStop(1, "rgba(210,255,120,0)");
        ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18);
        ctx.fillStyle = `rgba(250,255,200,${0.6 + 0.4 * on})`; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.283); ctx.fill();
      }
    },
    rabbit(a, t, ph) {
      const white = a.b === B.SNOW;
      const c = white ? "#f7f9fc" : "#c9a27a", c2 = white ? "#e4e9f0" : "#b08a63";
      ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(7, -21, 2.2, 7, 0.2, 0, 6.283); ctx.ellipse(10, -20, 2.2, 7, 0.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(-1, -7, 9, 7, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -11, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-10, -8, 3, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.arc(12.5, -10, 1.2, 0, 6.283); ctx.fill();
      eye(10, -12, 1.3);
    },
    frog(a) {
      ctx.fillStyle = "#4caf50"; ctx.beginPath(); ctx.ellipse(0, -5, 9, 6, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#3d9142"; ctx.beginPath(); ctx.ellipse(-7, -1, 5, 2.5, 0.3, 0, 6.283); ctx.ellipse(6, -1, 4, 2.5, -0.3, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#6fd36b"; ctx.beginPath(); ctx.arc(4, -10, 3.2, 0, 6.283); ctx.arc(9, -9, 3.2, 0, 6.283); ctx.fill();
      eye(4.5, -10, 1.4); eye(9.5, -9, 1.4);
    },
    deer(a, t, ph) {
      legs(2, -8, 4, -10, 11, ph, "#8a5a35"); legs(2, 6, 4, -10, 11, ph + 0.5, "#8a5a35");
      ctx.fillStyle = "#b57a46"; ctx.beginPath(); ctx.ellipse(0, -15, 14, 7, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, -18); ctx.lineTo(15, -28); ctx.lineTo(19, -26); ctx.lineTo(14, -15); ctx.fill();
      ctx.beginPath(); ctx.ellipse(19, -29, 5, 3.5, 0.3, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "#7a4f2a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(17, -32); ctx.lineTo(15, -39); ctx.moveTo(16, -36); ctx.lineTo(12, -38); ctx.moveTo(19, -32); ctx.lineTo(21, -39); ctx.stroke();
      ctx.fillStyle = "#fff4e6"; for (const [x, y] of [[-6, -17], [-1, -19], [4, -17], [-3, -14]]) { ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(-14, -16, 3, 2, 0, 0, 6.283); ctx.fill();
      eye(20, -30, 1.2);
    },
    fox(a, t, ph) {
      legs(2, -7, 4, -7, 8, ph, "#3a2418"); legs(2, 5, 4, -7, 8, ph + 0.5, "#3a2418");
      ctx.fillStyle = "#e8762e"; ctx.beginPath(); ctx.ellipse(-16, -12, 9, 4.5, -0.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(-23, -15, 3.5, 2.5, -0.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#f07f32"; ctx.beginPath(); ctx.ellipse(0, -11, 11, 5.5, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -9); ctx.lineTo(19, -12); ctx.lineTo(10, -18); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, -16); ctx.lineTo(10, -23); ctx.lineTo(13, -17); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(19, -12); ctx.lineTo(12, -13); ctx.fill();
      eye(13, -14, 1.2);
    },
    hedgehog(a) {
      ctx.fillStyle = "#6b4a2e";
      ctx.beginPath(); ctx.moveTo(-11, -2);
      for (let i = 0; i <= 10; i++) { const ang = Math.PI + (i / 10) * Math.PI; const r = i % 2 ? 9 : 13; ctx.lineTo(Math.cos(ang) * r, -2 + Math.sin(ang) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e6c79a"; ctx.beginPath(); ctx.ellipse(10, -4, 5, 4, 0.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#1d140a"; ctx.beginPath(); ctx.arc(15, -4, 1.4, 0, 6.283); ctx.fill();
      eye(10, -6, 1.1);
    },
    snail(a) {
      ctx.fillStyle = "#b8c99a"; ctx.beginPath(); ctx.ellipse(1, -2, 11, 3, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "#b8c99a"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(13, -10); ctx.moveTo(9, -3); ctx.lineTo(10, -10); ctx.stroke();
      ctx.fillStyle = "#e08ab0"; ctx.beginPath(); ctx.arc(-1, -8, 7, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "#a8507a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-1, -8, 4, 0, 5); ctx.stroke();
    },
    goat(a, t, ph) {
      legs(2, -7, 4, -9, 10, ph, "#9b9488"); legs(2, 5, 4, -9, 10, ph + 0.5, "#9b9488");
      ctx.fillStyle = "#f2efe8"; ctx.beginPath(); ctx.ellipse(0, -14, 12, 7, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(13, -20, 5, 4, 0.4, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "#7a6a55"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(10, -26, 4, Math.PI, Math.PI * 1.8); ctx.stroke();
      ctx.fillStyle = "#d8d2c6"; ctx.beginPath(); ctx.moveTo(15, -17); ctx.lineTo(16, -12); ctx.lineTo(13, -16); ctx.fill();
      eye(14, -21, 1.1);
    },
    penguin(a, t, ph) {
      ctx.rotate(Math.sin(ph * 12) * 0.12);
      ctx.fillStyle = "#ff9f2a"; ctx.beginPath(); ctx.ellipse(-3, 0, 3, 1.5, 0, 0, 6.283); ctx.ellipse(3, 0, 3, 1.5, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#1f2630"; ctx.beginPath(); ctx.ellipse(0, -11, 8, 11, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(2, -9, 5, 8, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#ff9f2a"; ctx.beginPath(); ctx.moveTo(6, -17); ctx.lineTo(11, -16); ctx.lineTo(6, -15); ctx.fill();
      eye(4, -18, 1.2);
    },
    lizard(a, t, ph, fire) {
      const c = fire ? "#ff6a1f" : "#7cc46a", c2 = fire ? "#2a1a14" : "#4f9a45";
      if (fire) { const g = ctx.createRadialGradient(0, -3, 0, 0, -3, 22); g.addColorStop(0, "rgba(255,120,40,0.35)"); g.addColorStop(1, "rgba(255,120,40,0)"); ctx.fillStyle = g; ctx.fillRect(-22, -25, 44, 44); }
      const w = Math.sin(ph * 14) * 3;
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(-14, -3 + w, -20, -1 - w); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(-3, -3); ctx.lineTo(-5, 2 + w); ctx.moveTo(4, -3); ctx.lineTo(6, 2 - w);
      ctx.moveTo(-3, -3); ctx.lineTo(-5, -8 - w); ctx.moveTo(4, -3); ctx.lineTo(6, -8 + w); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -3, 8, 3.5, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, -3, 4, 3, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = c2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 4, -3, 1.2, 0, 6.283); ctx.fill(); }
      eye(11, -4, 1);
    },
    salamander(a, t, ph) { ANIMAL_DRAW.lizard(a, t, ph, true); },
    crab(a, t, ph) {
      ctx.strokeStyle = "#c2382f"; ctx.lineWidth = 1.6;
      for (let i = -1; i <= 1; i++) { const s = Math.sin(ph * 16 + i) * 2; ctx.beginPath(); ctx.moveTo(-6, -3 + i * 2); ctx.lineTo(-11, -1 + i * 3 + s); ctx.moveTo(6, -3 + i * 2); ctx.lineTo(11, -1 + i * 3 - s); ctx.stroke(); }
      ctx.fillStyle = "#e8483f"; ctx.beginPath(); ctx.ellipse(0, -4, 8, 5, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(-10, -10, 3.2, 0, 6.283); ctx.arc(10, -10, 3.2, 0, 6.283); ctx.fill();
      eye(-2.5, -8, 1.2); eye(2.5, -8, 1.2);
    },
    duck(a, t) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(-4, 2, 14 + Math.sin(t * 3) * 2, 4, 0, 0, 6.283); ctx.stroke();
      ctx.fillStyle = "#f4efe2"; ctx.beginPath(); ctx.ellipse(-2, -3, 11, 6, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#2f8a55"; ctx.beginPath(); ctx.arc(8, -10, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#ffb03a"; ctx.beginPath(); ctx.ellipse(14, -9, 4, 1.8, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#d8cfbd"; ctx.beginPath(); ctx.ellipse(-4, -4, 6, 3, -0.2, 0, 6.283); ctx.fill();
      eye(9, -11, 1.1);
    },
    fish(a, t) {
      const ph = (t * 0.22 + a.p[4] / 6.283) % 1;
      if (ph < 0.1) {               // прыжок из воды
        const k = ph / 0.1, h = Math.sin(k * Math.PI) * 18;
        ctx.save(); ctx.translate((k - 0.5) * 26, -h); ctx.rotate((k - 0.5) * 1.6);
        ctx.fillStyle = "#ff9a3c"; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-12, -4); ctx.lineTo(-12, 4); ctx.fill();
        eye(4, -1, 1); ctx.restore();
      }
      if (ph < 0.2) {
        const r = ph < 0.1 ? 4 : (ph - 0.1) * 160 + 4;
        ctx.strokeStyle = `rgba(255,255,255,${ph < 0.1 ? 0.6 : 0.6 - (ph - 0.1) * 6})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(13, 0, r, r * 0.4, 0, 0, 6.283); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(20,50,80,0.25)"; ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.5, 0, 0, 6.283); ctx.fill();
      }
    },
  };

  function drawAnimals(camX, camY, t, dt) {
    const wt = Date.now() / 1000;          // общее время для всех игроков
    const a0x = Math.floor((camX - 200) / ACELL), a1x = Math.floor((camX + W + 200) / ACELL);
    const a0y = Math.floor((camY - 200) / ACELL), a1y = Math.floor((camY + H + 200) / ACELL);
    const list = [];
    for (let ay = a0y; ay <= a1y; ay++) for (let ax = a0x; ax <= a1x; ax++) {
      const a = animalAt(ax, ay);
      if (!a) continue;
      const [x, y, vx, hop, ph] = animalPos(a, wt);
      const mode = KINDS[a.kind][0];
      // убегают от пчёлки (кроме летающих и рыб)
      if (mode !== "fly" && a.kind !== "fish") {
        const dx = x + a.ox - player.x, dy = y + a.oy - player.y, d = Math.hypot(dx, dy);
        if (d < 110 && d > 0.1) { const k = Math.min(1, (110 - d) / 110) * 220 * dt; a.ox += (dx / d) * k; a.oy += (dy / d) * k; }
        else { a.ox *= 0.985; a.oy *= 0.985; }
        const ol = Math.hypot(a.ox, a.oy); if (ol > 140) { a.ox *= 140 / ol; a.oy *= 140 / ol; }
      }
      list.push([a, x + a.ox, y + a.oy, vx, hop, ph, mode]);
    }
    list.sort((p, q) => p[2] - q[2]);
    for (const [a, x, y, vx, hop, ph, mode] of list) {
      const sx = x - camX, sy = y - camY;
      if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
      const S = ASCALE[a.kind] || 1.9;
      if (mode === "fly") shadow(ctx, sx, sy + 2, (a.kind === "parrot" ? 9 : 5) * S, 2.5 * S);
      else if (mode !== "swim") shadow(ctx, sx, sy + 1, 11 * S, 3.5 * S);
      ctx.save();
      ctx.translate(sx, sy - hop * S);
      ctx.scale(S, S);
      if (mode === "fly") ctx.translate(0, Math.sin(wt * 3 + a.p[1]) * 4);
      if (vx < 0 && a.kind !== "crab" && a.kind !== "firefly") ctx.scale(-1, 1);
      ANIMAL_DRAW[a.kind](a, wt, ph);
      ctx.restore();
    }
  }

  // ---------- мини-игра сбора ----------
  // По полоске бегает метка. Нужно 3 раза нажать, когда она в зелёной зоне. Чем реже цветок, тем быстрее.
  let mg = null, near = null, busy = false, sellBusy = false, sellRetry = 0, posBusy = false, posT = 0, lastSaved = null;
  let net = { sb: null, token: null }, user = null, onUser = null;
  const taken = new Map();
  const toasts = [];
  const cleanErr = (e) => ((e && e.message) || "Ошибка").replace(/^.*?ERROR:\s*/, "");
  const isTaken = (f) => (taken.get(f.key) || 0) > Date.now();
  function setUser(u) { user = u; if (onUser) onUser(u); }
  function toast(text, color, at) {
    toasts.push({ text, color, x: at ? at.x : player.x, y: at ? at.y - 46 : player.y - 60, t0: performance.now() });
  }

  function action() {
    if (mg) return mgPress();
    if (!near || busy || !user) return;
    if (user.pollen >= user.bag_cap) return toast("Мешочек полон! Лети в улей", "#ff9a6b");
    const tier = near.tier;
    mg = { f: near, hits: 0, need: 3, pos: 0, dir: 1, speed: 0.7 + tier * 0.16, zoneC: 0.3 + Math.random() * 0.4, zoneW: 0.26 - tier * 0.025, flash: 0 };
  }
  function mgPress() {
    const hit = Math.abs(mg.pos - mg.zoneC) <= mg.zoneW / 2;
    if (!hit) {
      taken.set(mg.f.key, Date.now() + 8000);
      toast("Промах! Цветок закрылся", "#ff9a6b", mg.f);
      mg = null; return;
    }
    mg.hits++; mg.flash = performance.now();
    if (mg.hits >= mg.need) { const f = mg.f; mg = null; collect(f); return; }
    mg.speed *= 1.3; mg.zoneW *= 0.85; mg.zoneC = 0.15 + Math.random() * 0.7;
  }
  async function collect(f) {
    if (!net.sb) return;
    busy = true;
    const { data, error } = await net.sb.rpc("collect_pollen", {
      p_token: net.token, p_gx: f.gx, p_gy: f.gy, p_tier: f.tier, p_x: Math.round(player.x), p_y: Math.round(player.y),
    });
    busy = false;
    if (error || !data) {
      const m = cleanErr(error); toast(m, "#ff9a6b", f);
      if (/пуст/.test(m)) taken.set(f.key, Date.now() + 300000);
      return;
    }
    taken.set(f.key, Date.now() + 300000);
    setUser(data.user);
    toast(`+${data.got} пыльцы`, f.tier ? `rgb(${TIER_GLOW[f.tier]})` : "#ffe066", f);
  }
  async function sell() {
    sellBusy = true;
    const { data, error } = await net.sb.rpc("sell_pollen", { p_token: net.token, p_x: Math.round(player.x), p_y: Math.round(player.y) });
    sellBusy = false;
    if (error || !data) { sellRetry = performance.now() + 4000; toast(cleanErr(error), "#ff9a6b"); return; }
    setUser(data.user);
    if (data.jars > 0) toast(`+${data.jars} 🍯 мёда`, "#ffd23f");
  }
  async function upgrade() {
    if (!net.sb || busy) return;
    busy = true;
    const { data, error } = await net.sb.rpc("upgrade_bag", { p_token: net.token });
    busy = false;
    if (error || !data) return toast(cleanErr(error), "#ff9a6b");
    setUser(data);
    toast(`Мешочек: ${data.bag_cap} пыльцы!`, "#9fe870");
  }
  async function savePos(force) {
    if (!net.sb || posBusy) return;
    const x = Math.round(player.x), y = Math.round(player.y);
    if (!force && lastSaved && Math.abs(lastSaved.x - x) < 4 && Math.abs(lastSaved.y - y) < 4) return;
    posBusy = true;
    const { data } = await net.sb.rpc("save_pos", { p_token: net.token, p_x: x, p_y: y });
    posBusy = false;
    if (!data) return;
    if (data.ok) lastSaved = { x, y };
    else if (running) { player.x = data.x; player.y = data.y; player.vx = player.vy = 0; lastSaved = { x: data.x, y: data.y }; }
  }

  function drawMinigame(t) {
    const pw = Math.min(380, W - 32), ph = 128, px = (W - pw) / 2, py = H - ph - 120;
    ctx.fillStyle = "rgba(255,253,245,0.97)"; ctx.strokeStyle = "#2b1d0e"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.fill(); ctx.stroke();
    const f = mg.f;
    ctx.fillStyle = "#2b1d0e"; ctx.font = "800 16px Rubik, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(TIER_NAMES[f.tier] + (f.tier ? `  ×${TIER_MULT[f.tier]}` : ""), W / 2, py + 26);
    const bx = px + 22, bw = pw - 44, by = py + 42, bh = 26;
    ctx.fillStyle = "#f0d98a"; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
    ctx.fillStyle = performance.now() - mg.flash < 150 ? "#c8ff9a" : "#7bd36b";
    ctx.beginPath(); ctx.roundRect(bx + (mg.zoneC - mg.zoneW / 2) * bw, by, mg.zoneW * bw, bh, 8); ctx.fill();
    ctx.strokeStyle = "#2b1d0e"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.stroke();
    const mx = bx + mg.pos * bw;
    ctx.fillStyle = "#2b1d0e"; ctx.fillRect(mx - 2.5, by - 6, 5, bh + 12);
    ctx.beginPath(); ctx.moveTo(mx - 8, by - 12); ctx.lineTo(mx + 8, by - 12); ctx.lineTo(mx, by - 3); ctx.fill();
    for (let i = 0; i < mg.need; i++) {
      ctx.fillStyle = i < mg.hits ? "#ffb703" : "#e8dcc0";
      ctx.beginPath(); ctx.arc(W / 2 + (i - 1) * 26, py + 90, 9, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "#2b1d0e"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = "#7a6650"; ctx.font = "600 12px Rubik, sans-serif";
    ctx.fillText("Жми ПРОБЕЛ или на экран, когда метка в зелёном", W / 2, py + 118);
  }

  function drawHiveHud(t) {
    const d = Math.hypot(player.x - HX, player.y - HY);
    const mmX = W - MM - 14, y0 = 14 + MM + 10;
    ctx.fillStyle = "rgba(8,10,24,0.7)"; ctx.beginPath(); ctx.roundRect(mmX - 4, y0, MM + 8, 42, 10); ctx.fill();
    ctx.textAlign = "left"; ctx.fillStyle = "#ffd166"; ctx.font = "800 13px Rubik, sans-serif";
    ctx.fillText("🏠 Улей: X 0 · Y 0", mmX + 4, y0 + 17);
    ctx.fillStyle = "#fff4d6"; ctx.font = "400 12px Rubik, sans-serif";
    ctx.fillText(`до улья: ${Math.round(d)}`, mmX + 4, y0 + 34);
    // стрелка к улью, если он за экраном
    const sx = HX - player.x + W / 2, sy = HY - player.y + H / 2;
    if (sx > -40 && sy > 0 && sx < W + 40 && sy < H + 140) return;
    const a = Math.atan2(HY - player.y, HX - player.x);
    const rx = W / 2 - 60, ry = H / 2 - 110;
    const k = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6));
    const ax = W / 2 + Math.cos(a) * k;
    let ay = H / 2 + Math.sin(a) * k;
    if (ax > W - MM - 100 && ay < 250) ay = 250;   // не залезать на мини-карту
    ctx.save(); ctx.translate(ax, ay);
    ctx.fillStyle = "rgba(8,10,24,0.65)"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.283); ctx.fill();
    ctx.rotate(a); ctx.fillStyle = "#ffb703";
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff4d6"; ctx.font = "600 11px Rubik, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🏠 " + Math.round(d), ax, ay + 36);
  }

  const $id = (id) => document.getElementById(id);
  function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
  function setShown(el, on) { if (el.hidden === on) el.hidden = !on; }

  // ---------- админ-панель ----------
  // Кнопка видна только админам. Все действия проверяет сервер (admin_give, admin_teleport, admin_where).
  let adminWired = false;
  function admMsg(text, ok) { const el = $id("admin-msg"); el.textContent = text; el.className = "admin-msg " + (ok ? "ok" : "err"); }
  function pingPlayer(ev, nick) { if (chan) chan.send({ type: "broadcast", event: ev, payload: { n: nick } }); }
  function teleportLocal(x, y) { player.x = x; player.y = y; player.vx = player.vy = 0; lastSaved = { x, y }; mg = null; sendPos(true); }
  function refreshOnline() {
    const dl = $id("admin-online"); dl.innerHTML = "";
    for (const n of [player.nick, ...others.keys()]) { const o = document.createElement("option"); o.value = n; dl.appendChild(o); }
  }
  function openAdmin(on) {
    setShown($id("admin-panel"), on);
    if (on) { refreshOnline(); keys.clear(); onUp(); }
  }
  async function adm(kind) {
    if (!net.sb) return;
    const rpc = (fn, args) => net.sb.rpc(fn, { p_token: net.token, ...args });
    const nick = $id("admin-nick").value.trim();
    if (["honey", "pollen", "bag", "goto", "bring"].includes(kind) && !nick) return admMsg("Впиши ник игрока");
    admMsg("…", true);
    try {
      if (kind === "honey" || kind === "pollen" || kind === "bag") {
        const v = kind === "bag" ? +$id("admin-bag").value : parseInt($id("admin-" + kind).value, 10);
        if (!Number.isFinite(v) || (kind !== "bag" && v === 0)) return admMsg("Впиши число (минус — забрать)");
        const r = await rpc("admin_give", { p_nick: nick, p_honey: kind === "honey" ? v : 0, p_pollen: kind === "pollen" ? v : 0, p_bag: kind === "bag" ? v : null });
        if (r.error) return admMsg(cleanErr(r.error));
        const u = r.data;
        if (u.nickname === player.nick) setUser(u); else pingPlayer("refresh", u.nickname);
        return admMsg(`${u.nickname}: 🍯 ${u.honey} · пыльца ${u.pollen}/${u.bag_cap} · мешочек ур. ${u.bag_level}`, true);
      }
      if (kind === "tp" || kind === "hive") {
        const X = kind === "hive" ? 0 : parseInt($id("admin-x").value, 10);
        const Y = kind === "hive" ? 0 : parseInt($id("admin-y").value, 10);
        if (!Number.isFinite(X) || !Number.isFinite(Y)) return admMsg("Впиши X и Y");
        const r = await rpc("admin_teleport", { p_nick: null, p_x: Math.round(HX + X), p_y: Math.round(HY + Y + (kind === "hive" ? 170 : 0)) });
        if (r.error) return admMsg(cleanErr(r.error));
        teleportLocal(r.data.x, r.data.y);
        return admMsg(`Ты на X ${r.data.x - HX} · Y ${r.data.y - HY}`, true);
      }
      if (kind === "goto") {
        let pos;
        const o = [...others.entries()].find(([n]) => n.toLowerCase() === nick.toLowerCase());
        if (o) pos = { x: Math.round(o[1].tx), y: Math.round(o[1].ty) };
        else {
          const w = await rpc("admin_where", { p_nick: nick });
          if (w.error) return admMsg(cleanErr(w.error));
          pos = w.data;
        }
        const r = await rpc("admin_teleport", { p_nick: null, p_x: pos.x + 70, p_y: pos.y });
        if (r.error) return admMsg(cleanErr(r.error));
        teleportLocal(r.data.x, r.data.y);
        return admMsg(`Ты прилетел к ${o ? o[0] : pos.nick}`, true);
      }
      if (kind === "bring") {
        const r = await rpc("admin_teleport", { p_nick: nick, p_x: Math.round(player.x) - 70, p_y: Math.round(player.y) });
        if (r.error) return admMsg(cleanErr(r.error));
        if (r.data.nick === player.nick) return admMsg("Это ты сам 🙂", true);
        pingPlayer("tp", r.data.nick);
        return admMsg(`${r.data.nick} перенесён к тебе`, true);
      }
    } catch (e) { admMsg("Ошибка сети"); }
  }
  function wireAdmin() {
    if (adminWired) return;
    adminWired = true;
    const sel = $id("admin-bag");
    BAG_CAPS.forEach((c, i) => { const o = document.createElement("option"); o.value = i + 1; o.textContent = `Ур. ${i + 1} (${c})`; sel.appendChild(o); });
    $id("admin-btn").addEventListener("click", () => openAdmin($id("admin-panel").hidden));
    $id("admin-close").addEventListener("click", () => openAdmin(false));
    $id("admin-nick").addEventListener("focus", refreshOnline);
    $id("admin-panel").addEventListener("click", (e) => { const b = e.target.closest("[data-adm]"); if (b) adm(b.dataset.adm); });
    $id("admin-panel").addEventListener("keydown", (e) => { if (e.key === "Escape") openAdmin(false); });
  }

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
    if (me && user) {
      const k = Math.min(1, user.pollen / user.bag_cap);
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(x - 18, y - 29 + bob, 36, 6, 3); ctx.fill();
      ctx.fillStyle = k >= 1 ? "#ff7a5c" : "#ffd23f"; ctx.beginPath(); ctx.roundRect(x - 18, y - 29 + bob, 36 * k, 6, 3); ctx.fill();
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
    // админ перенёс игрока: спрашиваем у сервера, где мы теперь (сервер сам вернёт новое место)
    chan.on("broadcast", { event: "tp" }, ({ payload: p }) => { if (p && p.n === player.nick) savePos(true); });
    // админ что-то выдал: перечитываем профиль
    chan.on("broadcast", { event: "refresh" }, async ({ payload: p }) => {
      if (!p || p.n !== player.nick || !net.sb) return;
      const { data } = await net.sb.rpc("me", { p_token: net.token });
      if (data) setUser(data);
    });
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
    if (mg) { ax = 0; ay = 0; }
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

    // улей
    const hsx = HX - camX, hsy = HY - camY;
    const hiveOn = hsx > -400 && hsy > -400 && hsx < W + 400 && hsy < H + 400;
    if (hiveOn) drawHiveGround(hsx, hsy, t);

    // пыльцевые цветы
    near = null;
    let nearD = 62;
    const g0x = Math.floor((camX - 60) / PCELL), g1x = Math.floor((camX + W + 60) / PCELL);
    const g0y = Math.floor((camY - 60) / PCELL), g1y = Math.floor((camY + H + 80) / PCELL);
    for (let gy = g0y; gy <= g1y; gy++) {
      for (let gx = g0x; gx <= g1x; gx++) {
        const f = pollenAt(gx, gy);
        if (!f) continue;
        const empty = isTaken(f);
        drawPollenFlower(f, f.x - camX, f.y - camY, t, empty);
        const d = Math.hypot(f.x - player.x, f.y - 14 - player.y);
        if (!empty && d < nearD) { nearD = d; near = f; }
      }
    }
    if (mg) {
      mg.pos += mg.dir * mg.speed * dt;
      if (mg.pos > 1) { mg.pos = 1; mg.dir = -1; } else if (mg.pos < 0) { mg.pos = 0; mg.dir = 1; }
    }
    drawAnimals(camX, camY, t, dt);
    if (hiveOn) drawHive(hsx, hsy, t);

    // в улье пыльца сама превращается в мёд
    const inHive = Math.hypot(player.x - HX, player.y - HY) < HIVE_R - 20;
    if (inHive && net.sb && user && user.pollen >= 10 && !sellBusy && now > sellRetry) sell();

    // другие пчёлки
    netTick(t, dt);
    for (const [n, o] of others) {
      const sx = o.x - camX, sy = o.y - camY;
      if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
      drawBee(sx, sy, t + n.length, o.face, n, false);
    }
    drawBee(W / 2, H / 2, t, player.face, player.nick, true);

    ctx.textAlign = "center"; ctx.font = "800 16px Rubik, sans-serif";
    for (let i = toasts.length - 1; i >= 0; i--) {
      const tt = toasts[i], age = (now - tt.t0) / 1000;
      if (age > 1.8) { toasts.splice(i, 1); continue; }
      const sx = tt.x - camX, sy = tt.y - camY - age * 30;
      ctx.globalAlpha = Math.min(1, (1.8 - age) * 2);
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.strokeText(tt.text, sx, sy);
      ctx.fillStyle = tt.color; ctx.fillText(tt.text, sx, sy);
    }
    ctx.globalAlpha = 1;

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
    const hmx = mmX + MM / 2 + (HX - player.x) / MM_STEP, hmy = mmY + MM / 2 + (HY - player.y) / MM_STEP;
    if (hmx > mmX && hmy > mmY && hmx < mmX + MM && hmy < mmY + MM) {
      ctx.fillStyle = "#ffb703"; ctx.strokeStyle = "#2b1d0e"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(hmx - 4, hmy - 4, 8, 8); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = "#ffb703"; ctx.beginPath(); ctx.arc(mmX + MM / 2, mmY + MM / 2, 3, 0, Math.PI * 2); ctx.fill();
    drawHiveHud(t);
    if (mg) drawMinigame(t);

    // подписи
    const here = biome(player.x, player.y);
    document.getElementById("world-biome").textContent = NAMES[here.b];
    setText($id("world-pos"), `X ${Math.round(player.x - HX)} · Y ${Math.round(player.y - HY)}`);
    if (user) setText($id("world-bag"), `🎒 ${user.pollen}/${user.bag_cap} · 🍯 ${user.honey}`);
    const act = $id("world-act");
    if (mg) { setShown(act, true); setText(act, "Жми! 🐝"); }
    else if (near && user) { setShown(act, true); setText(act, user.pollen >= user.bag_cap ? "Мешочек полон 🏠" : `🌼 Собрать: ${TIER_NAMES[near.tier]}`); }
    else setShown(act, false);
    const up = $id("world-upgrade");
    setShown(up, inHive && !!user && !mg);
    if (inHive && user) setText(up, user.bag_cost == null ? "Мешочек максимальный 🎒"
      : `⬆ Мешочек ${user.bag_cap} → ${BAG_CAPS[user.bag_level]} за ${user.bag_cost} 🍯`);
    if (t - posT > 2) { posT = t; savePos(false); }
    document.getElementById("world-online").textContent = `🐝 в игре: ${online}`;

    if (t - saveT > 3) { saveT = t; saveState(); }
    requestAnimationFrame(frame);
  }

  // ---------- управление ----------
  function onKey(e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.type === "keydown") { keys.add(k); if (k.startsWith("arrow") || k === " ") e.preventDefault(); }
    else keys.delete(k);
    if (e.type !== "keydown" || e.repeat) return;
    if (k === " " || k === "e" || k === "у") action();
    if (k === "escape") { if (mg) mg = null; else if (!$id("admin-panel").hidden) openAdmin(false); else stop(); }
  }
  function onDown(e) {
    if (mg) { mgPress(); return; }
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
  function onAct(e) { e.preventDefault(); action(); }
  function onUpg(e) { e.preventDefault(); upgrade(); }

  function start(opts = {}) {
    canvas = document.getElementById("world");
    ctx = canvas.getContext("2d");
    player.nick = opts.nick || "";
    onExit = opts.onExit || null;
    onUser = opts.onUser || null;
    user = opts.user || null;
    net = { sb: opts.sb || null, token: opts.token || null };
    loadExplored();
    // первый раз: появляемся у улья (0 0), потом с того места, где вышли
    if (user && user.pos_x != null) { player.x = user.pos_x; player.y = user.pos_y; }
    else { player.x = HX; player.y = HY + 170; }
    player.vx = player.vy = 0;
    mg = null; near = null; lastSaved = null; posT = 0; toasts.length = 0;
    document.getElementById("world-wrap").classList.add("on");
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    $id("world-act").addEventListener("pointerdown", onAct);
    $id("world-upgrade").addEventListener("pointerdown", onUpg);
    wireAdmin();
    setShown($id("admin-btn"), !!(user && user.is_admin && net.sb));
    openAdmin(false);
    running = true; lastT = 0;
    netStart(opts.sb);
    requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    saveState();
    savePos(true);
    if (user) setUser({ ...user, pos_x: Math.round(player.x), pos_y: Math.round(player.y) });
    mg = null;
    $id("world-act").removeEventListener("pointerdown", onAct);
    $id("world-upgrade").removeEventListener("pointerdown", onUpg);
    openAdmin(false);
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
