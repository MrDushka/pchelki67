// Публичный ключ Supabase: его можно держать в коде сайта.
// Пароли и сессии лежат в закрытых таблицах, клиент только вызывает серверные функции.
const SUPABASE_URL = "https://tkyamcshnblsxbqyvqba.supabase.co";
const SUPABASE_KEY = "sb_publishable_k9B2AicjW42dXvndeJ9GJA_bOKcKT4j";
const TOKEN_KEY = "pchelki_token";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s) => document.querySelector(s);

let sessionToken = null;
let user = null;

function show(name) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $("#screen-" + name).classList.add("active");
}
function say(text, kind = "") {
  const el = $("#auth-msg");
  el.textContent = text;
  el.className = "msg " + kind;
}
const cleanError = (e) => ((e && e.message) || "Ошибка").replace(/^.*?ERROR:\s*/, "");

function saveToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
function readToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }

// ---------- вход и регистрация ----------
$("#form-auth").addEventListener("submit", async (e) => {
  e.preventDefault();
  const action = e.submitter ? e.submitter.dataset.action : "login";
  const nick = $("#username").value.trim();
  const pass = $("#password").value.trim();
  if (!nick || !pass) return say("Заполните всё!", "error");

  const buttons = e.target.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  say(action === "register" ? "Создаём пчёлку…" : "Летим…");

  const fn = action === "register" ? "register_user" : "login_user";
  const { data, error } = await sb.rpc(fn, { p_nick: nick, p_pass: pass });
  buttons.forEach((b) => (b.disabled = false));
  if (error || !data) return say(cleanError(error), "error");
  onLoggedIn(data);
});

function onLoggedIn(data) {
  sessionToken = data.token;
  user = data.user;
  saveToken(sessionToken);
  $("#password").value = "";
  say("");
  next();
}

// После входа: если ещё не отвечал на вопрос, спрашиваем, иначе сразу путешествие.
function next() {
  if (user.respects_bees === null || user.respects_bees === undefined) askQuestion();
  else renderHome();
}

// ---------- вопрос «Вы пчёлок уважаете?» ----------
let dodges = 0;
const noBtn = $("#btn-no");

function askQuestion() {
  dodges = 0;
  noBtn.style.transform = "";
  $("#question-msg").textContent = "";
  show("question");
}

async function answer(respects) {
  const { data, error } = await sb.rpc("set_respect", { p_token: sessionToken, p_respects: respects });
  if (error || !data) {
    $("#question-msg").textContent = cleanError(error);
    $("#question-msg").className = "msg error";
    return;
  }
  user = data;
  renderHome();
}
$("#btn-yes").addEventListener("click", () => answer(true));

// Кнопка «Нет» убегает. На пятый раз сдаётся.
function dodge() {
  if (dodges >= 5) return;
  dodges++;
  const x = (Math.random() - 0.5) * 160;
  const y = (Math.random() - 0.5) * 80;
  noBtn.style.transform = `translate(${x}px, ${y}px)`;
  const lines = ["Вы уверены?", "Пчёлки обидятся…", "Подумайте ещё", "Ну пожалуйста 🥺", "Ладно, жмите…"];
  $("#question-msg").textContent = lines[dodges - 1];
  $("#question-msg").className = "msg";
}
noBtn.addEventListener("pointerenter", dodge);
noBtn.addEventListener("click", (e) => {
  if (dodges < 5) { e.preventDefault(); return dodge(); }
  answer(false);
});

// ---------- путешествие ----------
function renderHome() {
  $("#home-nick").textContent = user.nickname;
  $("#home-honey").textContent = user.honey;
  $("#home-wins").textContent = user.wins;
  $("#home-respect").textContent = user.respects_bees
    ? "Вы уважаете пчёлок. Пчёлки уважают вас 🐝"
    : "Вы не уважаете пчёлок. Они это запомнили 😠";
  $("#journey-msg").textContent = "";
  show("home");
}

$("#btn-journey").addEventListener("click", () => {
  document.querySelector(".card").style.display = "none";
  window.BeeWorld.start({
    nick: user.nickname,
    sb,
    token: sessionToken,
    user,
    onUser: (u) => { user = u; },
    onExit: () => { document.querySelector(".card").style.display = ""; renderHome(); },
  });
});
$("#world-back").addEventListener("click", () => window.BeeWorld.stop());

$("#btn-logout").addEventListener("click", () => {
  if (sessionToken) sb.rpc("logout", { p_token: sessionToken });
  sessionToken = null;
  user = null;
  saveToken(null);
  $("#username").value = "";
  show("auth");
});

// ---------- автовход по сохранённому токену ----------
(async () => {
  const tk = readToken();
  if (tk) {
    const { data, error } = await sb.rpc("me", { p_token: tk });
    if (sessionToken) return; // пока проверяли, игрок уже вошёл заново
    if (!error && data) {
      sessionToken = tk;
      user = data;
      return next();
    }
    saveToken(null);
  }
  show("auth");
})();
