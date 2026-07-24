// برا السالفة ONLINE SERVER • Created by SAMER
// v2 — fixed room lock-up, real host tracking, host-only phase controls,
// scoring, spy word-guess, round history, reconnect support.

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8787;
const rooms = new Map();

// ---------- word banks (deduped, shared spirit with the offline edition) ----------
const categories = {
  "🍔 أكل": ["بيتزا","برجر","كبسة","شاورما","سوشي","مندي","مظبي","سمبوسة","فلافل","كنافة","آيس كريم","مكرونة","فشار","كيك","دونات","سلطة","بطاطس","دجاج","سمك","قهوة","شاي","تمر","شوكولاتة","عسل","بيض","جبن","خبز","رز","نودلز","تاكو","كريب","وافل","آيس تي","عصير","ليمونادة","بسكويت","هوت دوغ","بان كيك","بقلاوة","مقلوبة","مطبق","بليلة","جريش","فطيرة","شكشوكة","تشيز كيك"],
  "🏙️ أماكن": ["مطار","مدرسة","شاطئ","مستشفى","ملعب","سينما","مطعم","مقهى","جامعة","حديقة","مول","فندق","متحف","مكتبة","مزرعة","صحراء","جزيرة","سجن","محطة قطار","محطة بنزين","بنك","مسجد","سوق","مسرح","استاد","نادي","مسبح","صالة ألعاب","مكتب","بيت","غرفة","مطبخ","سطح","مصعد","شارع","جسر","نفق","ميناء","سفينة","مخيم","منتزه","ملاهي","حديقة حيوان","مخبز","صالون","ورشة","مغسلة","قصر","قلعة","برج","قرية","مدينة","كورنيش","استراحة"],
  "🎬 أفلام ومسلسلات": ["فيلم رعب","كرتون","مسلسل","بطل خارق","محقق","سفر عبر الزمن","زومبي","فضاء","ساحر","نينجا","قرصان","جاسوس","روبوت","وحش","أميرة","ملك","مغامرة","كوميديا","دراما","أكشن","خيال علمي","غموض","وثائقي","رومانسية","جريمة","سرقة","مطاردة","بطولة","أكاديمية","نهاية العالم","بطل شرير","فريق أبطال","آلة زمن","مخلوق فضائي","محقق خاص"],
  "⚽ رياضة": ["كرة قدم","تنس","سباحة","ملاكمة","جري","كرة سلة","كرة طائرة","غولف","ركوب خيل","تزلج","هوكي","رماية","دراجات","سباق سيارات","كاراتيه","جودو","رفع أثقال","مصارعة","جمباز","تسلق","صيد","غوص","تجديف","رمي رمح","ماراثون","بادل","كرة يد"],
  "🧰 أشياء": ["مفتاح","هاتف","مظلة","كرسي","ساعة","حقيبة","قلم","كتاب","نظارة","حذاء","قبعة","طاولة","سرير","باب","نافذة","مرآة","مصباح","شاحن","سماعة","كاميرا","تلفزيون","ريموت","حاسوب","لوحة","مقص","مطرقة","مسمار","مفك","كوب","زجاجة","محفظة","نقود","بطاقة","جواز سفر","مروحة","مكيف","ثلاجة","فرشاة","منشفة","وسادة","بطانية"],
  "☕ أجواء خليجية": ["دلة قهوة","مبخرة","بشت","غترة وعقال","تمر","مجلس","سيارة دفع رباعي","استراحة عزاب","كشتة","شيشة","مسحراتي","عود وبخور","مطعم مشاوي","محل عود"]
};
Object.keys(categories).forEach(k => categories[k] = [...new Set(categories[k])]);
const allWords = Object.values(categories).flat();

// ---------- helpers ----------
function makeCode() {
  let c;
  do c = "SB-" + Math.floor(1000 + Math.random() * 9000);
  while (rooms.has(c));
  return c;
}
function send(ws, msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg) { room.players.forEach(p => send(p.ws, msg)); }
function getData(m) { return (m && m.data && typeof m.data === "object") ? m.data : m; }
function chooseWord(category) {
  const list = category === "mixed" ? allWords : (categories[category] || allWords);
  return list[Math.floor(Math.random() * list.length)];
}
function cleanName(value) { return String(value || "").trim().slice(0, 24); }
function normalize(s) {
  return String(s || "").trim().replace(/[إأآا]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").toLowerCase();
}
function uniqueName(room, base) {
  let name = base, n = 2;
  const taken = nm => room.players.some(p => p.name.toLowerCase() === nm.toLowerCase());
  while (taken(name)) { name = base + " " + n; n++; }
  return name;
}
function ensureStats(room, name) {
  if (!room.stats[name]) room.stats[name] = { outsiderCount: 0, caughtCount: 0, escapedCount: 0, crowdWinCount: 0, outsiderWinCount: 0 };
  if (room.scores[name] === undefined) room.scores[name] = 0;
}
function lobbyMsg(room) {
  return {
    type: "lobby",
    room: room.code,
    phase: room.phase,
    players: room.players.map(p => p.name),
    connected: room.players.map(p => p.connected !== false),
    hostName: room.hostName,
    scores: room.scores
  };
}
function makePairs(names) {
  const order = [...names].sort(() => Math.random() - 0.5);
  const n = order.length, out = [];
  for (let round = 0; round < 2; round++)
    for (let i = 0; i < n; i++) out.push([order[i], order[(i + 1) % n]]);
  return out;
}
function isHost(room, ws) { return room.host === ws; }
function needHost(room, ws) { return !isHost(room, ws); }

// ---------- round flow ----------
function beginRound(room) {
  const names = room.players.map(p => p.name);
  room.word = chooseWord(room.lastCategory || "mixed");
  const count = Math.min(Math.max(1, room.lastCount || 1), names.length - 1);
  const shuffled = [...names].sort(() => Math.random() - 0.5);
  room.outsiders = new Set(shuffled.slice(0, count));
  room.pairs = makePairs(names);
  room.pairIndex = 0;
  room.votes = new Map();
  room.caught = [];
  room.guessQueue = [];
  room.phase = "questions";

  room.players.forEach(p => send(p.ws, {
    type: "role",
    outsider: room.outsiders.has(p.name),
    word: room.word,
    category: room.lastCategory
  }));
  setTimeout(() => {
    if (room.phase === "questions") {
      const [a, b] = room.pairs[0];
      broadcast(room, { type: "questions", asker: a, target: b, index: 1, total: room.pairs.length });
    }
  }, 700);
}

function resolveVotes(room) {
  const counts = {};
  for (const target of room.votes.values()) counts[target] = (counts[target] || 0) + 1;
  const max = Math.max(...Object.values(counts));
  const top = Object.keys(counts).filter(name => counts[name] === max);
  const tie = top.length > 1;
  room.caught = top.filter(name => room.outsiders.has(name));

  if (room.caught.length === 0) {
    finishRound(room, { found: false, tie, guessedRight: false, guesser: null });
    return;
  }
  room.guessQueue = [...room.caught];
  room.phase = "guessing";
  promptGuess(room, tie);
}

function promptGuess(room, tie) {
  if (room.guessQueue.length === 0) {
    finishRound(room, { found: true, tie: !!tie, guessedRight: false, guesser: null });
    return;
  }
  const guesser = room.guessQueue[0];
  broadcast(room, { type: "guessing", guesser, tie: !!tie });
}

function finishRound(room, info) {
  const outsidersWin = !info.found || info.guessedRight;
  const roundScores = {};
  room.players.forEach(p => {
    ensureStats(room, p.name);
    const isOutsider = room.outsiders.has(p.name);
    if (isOutsider) {
      room.stats[p.name].outsiderCount++;
      if (room.caught.includes(p.name)) room.stats[p.name].caughtCount++;
      else room.stats[p.name].escapedCount++;
    }
    if (outsidersWin && isOutsider) {
      room.scores[p.name] += 2; roundScores[p.name] = 2; room.stats[p.name].outsiderWinCount++;
    } else if (!outsidersWin && !isOutsider) {
      room.scores[p.name] += 1; roundScores[p.name] = 1; room.stats[p.name].crowdWinCount++;
    }
  });

  room.roundHistory.push({
    word: room.word,
    category: room.lastCategory,
    outsiders: [...room.outsiders],
    caught: [...room.caught],
    outcome: outsidersWin ? (info.guessedRight ? "outsiders_guessed" : "outsiders_escaped") : "crowd_caught",
    guesser: info.guesser
  });

  room.phase = "result";
  let headline;
  if (outsidersWin && info.guessedRight) headline = "🎯 برا السالفة انكشف بس خمّن الكلمة صح — يفوز!";
  else if (outsidersWin) headline = "😈 برا السالفة نجا من التصويت!";
  else headline = "🎉 تم اكتشاف برا السالفة ولم يخمّن الكلمة!";

  const resultMsg = {
    type: "result",
    headline,
    outsidersWin,
    tie: !!info.tie,
    word: room.word,
    outsiders: [...room.outsiders],
    roundScores,
    scores: room.scores,
    roundNumber: room.roundHistory.length
  };
  room.lastResultMsg = resultMsg;
  broadcast(room, resultMsg);
}

// ---------- http + ws server ----------
const httpServer = http.createServer((req, res) => {
  const file = path.join(__dirname, "Bara_Alsalfa_SAMER_Online.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Game file unavailable"); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on("connection", ws => {
  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", message: "رسالة غير صالحة" }); }
    const data = getData(m);

    if (m.type === "create_room") {
      const c = makeCode();
      const room = {
        code: c, players: [], host: ws, hostName: "",
        word: "", outsiders: new Set(), votes: new Map(),
        pairs: [], pairIndex: 0, phase: "lobby",
        scores: {}, stats: {}, roundHistory: [],
        lastCategory: "mixed", lastCount: 1, caught: [], guessQueue: []
      };
      rooms.set(c, room);
      const name = cleanName(data.name) || "مضيف";
      room.players.push({ ws, name, connected: true });
      room.hostName = name;
      ensureStats(room, name);
      ws.room = c; ws.name = name;
      send(ws, { type: "room_created", room: c, name });
      broadcast(room, lobbyMsg(room));
      return;
    }

    if (m.type === "join_room") {
      const code = String(m.room || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, { type: "error", message: "الغرفة غير موجودة" });
      let name = cleanName(data.name || m.me);
      if (!name) return send(ws, { type: "error", message: "اكتب اسمك" });

      // reconnect: same name, previously disconnected, round already running
      const existing = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (existing && existing.connected === false) {
        existing.ws = ws; existing.connected = true;
        ws.room = code; ws.name = existing.name;
        send(ws, { type: "room_created", room: code, name: existing.name, rejoined: true });
        broadcast(room, lobbyMsg(room));
        // catch the rejoining player up on where the round currently is
        sendPhaseSnapshot(room, ws, existing.name);
        return;
      }

      if (room.phase !== "lobby") return send(ws, { type: "error", message: "الجولة بدأت بالفعل، انتظر الجولة الجاية" });
      name = uniqueName(room, name);
      room.players.push({ ws, name, connected: true });
      ensureStats(room, name);
      ws.room = code; ws.name = name;
      send(ws, { type: "room_created", room: code, name });
      broadcast(room, lobbyMsg(room));
      return;
    }

    const room = rooms.get(String(m.room || "").toUpperCase());
    if (!room) return send(ws, { type: "error", message: "الغرفة غير موجودة" });

    if (m.type === "start_game") {
      if (needHost(room, ws)) return send(ws, { type: "error", message: "المضيف فقط يبدأ الجولة" });
      if (room.players.length < 3) return send(ws, { type: "error", message: "تحتاجون 3 لاعبين على الأقل" });
      if (room.phase !== "lobby") return send(ws, { type: "error", message: "الجولة بدأت بالفعل" });
      const count = Math.min(Math.max(1, Number.parseInt(data.count, 10) || 1), room.players.length - 1);
      room.lastCategory = data.category || "mixed";
      room.lastCount = count;
      beginRound(room);
      return;
    }

    if (m.type === "next_pair") {
      if (needHost(room, ws)) return send(ws, { type: "error", message: "المضيف فقط يتحكم بالأسئلة" });
      if (room.phase !== "questions") return;
      room.pairIndex++;
      if (room.pairIndex >= room.pairs.length) {
        send(ws, { type: "error", message: "خلصت كل الأسئلة، انتقل للتصويت" });
        return;
      }
      const [a, b] = room.pairs[room.pairIndex];
      broadcast(room, { type: "questions", asker: a, target: b, index: room.pairIndex + 1, total: room.pairs.length });
      return;
    }

    if (m.type === "start_voting") {
      if (needHost(room, ws)) return send(ws, { type: "error", message: "المضيف فقط يبدأ التصويت" });
      if (room.phase !== "questions") return;
      room.phase = "voting";
      room.votes = new Map();
      broadcast(room, { type: "voting", players: room.players.map(p => p.name) });
      return;
    }

    if (m.type === "vote") {
      if (room.phase !== "voting") return;
      const voter = room.players.find(p => p.ws === ws);
      const target = cleanName(data.target);
      if (!voter || !room.players.some(p => p.name === target) || target === voter.name) return;
      room.votes.set(voter.name, target);
      broadcast(room, { type: "vote_progress", count: room.votes.size, total: room.players.length });
      if (room.votes.size >= room.players.length) resolveVotes(room);
      return;
    }

    if (m.type === "guess_word") {
      if (room.phase !== "guessing" || room.guessQueue.length === 0) return;
      const guesser = room.guessQueue[0];
      if (ws.name !== guesser) return;
      const guess = String(data.guess || "");
      if (normalize(guess) === normalize(room.word)) {
        finishRound(room, { found: true, guessedRight: true, guesser });
      } else {
        room.guessQueue.shift();
        promptGuess(room);
      }
      return;
    }

    if (m.type === "skip_guess") {
      if (room.phase !== "guessing" || room.guessQueue.length === 0) return;
      if (ws.name !== room.guessQueue[0]) return;
      room.guessQueue.shift();
      promptGuess(room);
      return;
    }

    if (m.type === "next_round") {
      if (needHost(room, ws)) return send(ws, { type: "error", message: "المضيف فقط يبدأ جولة جديدة" });
      if (room.phase !== "result") return;
      room.phase = "lobby";
      beginRound(room);
      return;
    }

    if (m.type === "end_game") {
      if (needHost(room, ws)) return send(ws, { type: "error", message: "المضيف فقط ينهي اللعبة" });
      room.phase = "ended";
      const ranked = [...room.players].map(p => p.name).sort((a, b) => (room.scores[b] || 0) - (room.scores[a] || 0));
      const finalMsg = { type: "final", ranked, scores: room.scores, stats: room.stats, roundHistory: room.roundHistory };
      room.lastFinalMsg = finalMsg;
      broadcast(room, finalMsg);
      return;
    }
  });

  ws.on("close", () => {
    const code = ws.room;
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players.find(x => x.ws === ws);
    if (!p) return;

    if (room.phase === "lobby" || room.phase === "ended") {
      // no active round to preserve — just remove them
      room.players = room.players.filter(x => x.ws !== ws);
    } else {
      // keep their seat/scores so they can rejoin mid-round
      p.connected = false;
    }

    if (room.players.length === 0 || room.players.every(x => x.connected === false)) {
      rooms.delete(code);
      return;
    }
    if (room.host === ws) {
      const next = room.players.find(x => x.connected !== false) || room.players[0];
      room.host = next.ws; room.hostName = next.name;
    }
    broadcast(room, lobbyMsg(room));
  });
});

function sendPhaseSnapshot(room, ws, name) {
  if (room.phase === "questions") {
    const [a, b] = room.pairs[room.pairIndex] || [];
    send(ws, { type: "role", outsider: room.outsiders.has(name), word: room.word, category: room.lastCategory });
    if (a) send(ws, { type: "questions", asker: a, target: b, index: room.pairIndex + 1, total: room.pairs.length });
  } else if (room.phase === "voting") {
    send(ws, { type: "voting", players: room.players.map(p => p.name) });
  } else if (room.phase === "guessing") {
    send(ws, { type: "guessing", guesser: room.guessQueue[0], tie: false });
  } else if (room.phase === "result") {
    if (room.lastResultMsg) send(ws, room.lastResultMsg);
  } else if (room.phase === "ended") {
    if (room.lastFinalMsg) send(ws, room.lastFinalMsg);
  }
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Bara Alsalfa online server running on port ${PORT}`);
});
