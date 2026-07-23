// برا السالفة ONLINE SERVER • Created by SAMER
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8787;
const rooms = new Map();

const categories = {
  "🍔 أكل": ["بيتزا","برجر","كبسة","آيس كريم","شاورما","سوشي","مكرونة","فشار","كيك","دونات","فطيرة","سلطة","بطاطس","دجاج","سمك","تمر","شوكولاتة","قهوة","شاي","عسل","بيض","جبن","خبز","رز","نودلز","تاكو","كريب","وافل","آيس تي","عصير","ليمونادة","بسكويت","بيتزا","برجر","كبسة","آيس كريم","شاورما","سوشي","مكرونة","فشار","كيك","دونات","فطيرة","سلطة","بطاطس","دجاج","سمك","تمر","شوكولاتة","قهوة","شاي","عسل","بيض","جبن","خبز","رز","نودلز","تاكو","كريب","وافل","عصير","بسكويت","مندي","مظبي","سمبوسة","فلافل","هوت دوغ","بان كيك","كنافة","بقلاوة","آيس كريم","بيتزا","برجر","كبسة","شاورما","سوشي","مكرونة","فشار","كيك","دونات","فطيرة","سلطة","بطاطس","دجاج","سمك","تمر","شوكولاتة","قهوة","شاي","عسل","بيض","جبن","خبز","رز","نودلز","تاكو","كريب","وافل","عصير","بسكويت"],
  "🏙️ أماكن": ["مطار","مدرسة","شاطئ","مستشفى","ملعب","سينما","مطعم","مقهى","جامعة","حديقة","مول","فندق","متحف","مكتبة","مزرعة","صحراء","جزيرة","سجن","مطار","محطة قطار","محطة بنزين","بنك","مسجد","سوق","مسرح","استاد","نادي","مسبح","صالة ألعاب","مكتب","بيت","غرفة","مطبخ","سطح","مصعد","شارع","جسر","نفق","ميناء","سفينة","مخيم","منتزه","ملاهي","حديقة حيوان","مخبز","صالون","ورشة","مغسلة","مزرعة","قصر","قلعة","برج","قرية","مدينة","مطار","مدرسة","شاطئ","مستشفى","ملعب","سينما","مطعم","مقهى","جامعة","حديقة","مول","فندق","متحف","مكتبة","مزرعة","صحراء","جزيرة","سجن","محطة قطار","محطة بنزين","بنك","سوق","مسرح","استاد","نادي","مسبح","صالة ألعاب","مكتب","بيت","غرفة","مطبخ","سطح","مصعد","شارع","جسر","نفق","ميناء","مخيم","منتزه","ملاهي","حديقة حيوان","مخبز","صالون","ورشة","مغسلة","قصر","قلعة","برج","قرية","مدينة"],
  "🎬 أفلام ومسلسلات": ["فيلم رعب","كرتون","مسلسل","بطل خارق","محقق","سفر عبر الزمن","زومبي","فضاء","ساحر","نينجا","قرصان","جاسوس","روبوت","وحش","أميرة","ملك","مغامرة","كوميديا","دراما","أكشن","خيال علمي","غموض","وثائقي","رومانسية","مدرسة","مستشفى","شرطة","سجن","جزيرة","مدينة مستقبلية","قصة حب","نهاية العالم","بطل شرير","فريق أبطال","آلة زمن","مخلوق فضائي","محقق خاص","جريمة","سرقة","مطاردة","مباراة","منافسة","بطولة","أكاديمية","قصر","غابة","صحراء","بحر","جبل","فيلم رعب","كرتون","مسلسل","بطل خارق","محقق","سفر عبر الزمن","زومبي","فضاء","ساحر","نينجا","قرصان","جاسوس","روبوت","وحش","أميرة","ملك","مغامرة","كوميديا","دراما","أكشن","خيال علمي","غموض","وثائقي","رومانسية","مدرسة","مستشفى","شرطة","سجن","جزيرة","مدينة مستقبلية","قصة حب","نهاية العالم","بطل شرير","فريق أبطال","آلة زمن","مخلوق فضائي","محقق خاص","جريمة","سرقة","مطاردة","مباراة","منافسة","بطولة","أكاديمية","قصر","غابة","صحراء","بحر","جبل"],
  "⚽ رياضة": ["كرة قدم","تنس","سباحة","ملاكمة","جري","كرة سلة","كرة طائرة","غولف","ركوب خيل","تزلج","هوكي","رماية","دراجات","سباق سيارات","كاراتيه","جودو","رفع أثقال","مصارعة","جمباز","تسلق","صيد","غوص","تجديف","رمي رمح","ماراثون","ملعب","حكم","مدرب","لاعب","جمهور","بطولة","كأس","ميدالية","هدف","ركلة","ضربة","مباراة","فريق","تمرين","نادي","منتخب","كرة قدم","تنس","سباحة","ملاكمة","جري","كرة سلة","كرة طائرة","غولف","ركوب خيل","تزلج","هوكي","رماية","دراجات","سباق سيارات","كاراتيه","جودو","رفع أثقال","مصارعة","جمباز","تسلق","صيد","غوص","تجديف","رمي رمح","ماراثون","ملعب","حكم","مدرب","لاعب","جمهور","بطولة","كأس","ميدالية","هدف","ركلة","ضربة","مباراة","فريق","تمرين","نادي","منتخب"],
  "🧰 أشياء": ["مفتاح","هاتف","مظلة","كرسي","ساعة","حقيبة","قلم","كتاب","نظارة","حذاء","قبعة","طاولة","سرير","باب","نافذة","مرآة","مصباح","شاحن","سماعة","كاميرا","تلفزيون","ريموت","حاسوب","لوحة","مقص","مطرقة","مسمار","مفك","كوب","زجاجة","محفظة","نقود","بطاقة","جواز سفر","مروحة","مكيف","ثلاجة","فرشاة","منشفة","وسادة","بطانية","مفتاح","هاتف","مظلة","كرسي","ساعة","حقيبة","قلم","كتاب","نظارة","حذاء","قبعة","طاولة","سرير","باب","نافذة","مرآة","مصباح","شاحن","سماعة","كاميرا","تلفزيون","ريموت","حاسوب","لوحة","مقص","مطرقة","مسمار","مفك","كوب","زجاجة","محفظة","نقود","بطاقة","جواز سفر","مروحة","مكيف","ثلاجة","فرشاة","منشفة","وسادة","بطانية"]
};

const allWords = Object.values(categories).flat();

function makeCode() {
  let c;
  do c = "SB-" + Math.floor(1000 + Math.random() * 9000);
  while (rooms.has(c));
  return c;
}

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg) {
  room.players.forEach(p => send(p.ws, msg));
}

function getData(m) {
  return (m && m.data && typeof m.data === "object") ? m.data : m;
}

function chooseWord(category) {
  const list = category === "mixed" ? allWords : (categories[category] || allWords);
  return list[Math.floor(Math.random() * list.length)];
}

function cleanName(value) {
  return String(value || "").trim().slice(0, 30);
}

function lobby(room) {
  return { type: "lobby", room: room.code, players: room.players.map(p => p.name) };
}

const httpServer = http.createServer((req, res) => {
  const file = path.join(__dirname, "Bara_Alsalfa_SAMER_Online.html");
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(500, {"Content-Type":"text/plain; charset=utf-8"});
      return res.end("Game file unavailable");
    }
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on("connection", ws => {
  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return send(ws, {type:"error", message:"رسالة غير صالحة"}); }

    const data = getData(m);

    if (m.type === "create_room") {
      const c = makeCode();
      const room = {
        code: c, players: [], host: ws, word: "",
        outsiders: new Set(), votes: new Map(),
        pairIndex: 0, phase: "lobby", resultSent: false
      };
      rooms.set(c, room);
      const name = cleanName(data.name) || "SAMER";
      room.players.push({ws, name});
      ws.room = c;
      ws.name = name;
      send(ws, {type:"room_created", room:c});
      broadcast(room, lobby(room));
      return;
    }

    if (m.type === "join_room") {
      const code = String(m.room || "").trim().toUpperCase();
      const room = rooms.get(code);
      const name = cleanName(data.name || m.me);
      if (!room) return send(ws, {type:"error", message:"الغرفة غير موجودة"});
      if (!name) return send(ws, {type:"error", message:"اكتب اسمك"});
      if (room.phase !== "lobby") return send(ws, {type:"error", message:"الجولة بدأت بالفعل"});
      if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase()))
        return send(ws, {type:"error", message:"الاسم مستخدم"});
      room.players.push({ws, name});
      ws.room = code;
      ws.name = name;
      broadcast(room, lobby(room));
      return;
    }

    const room = rooms.get(String(m.room || "").toUpperCase());
    if (!room) return send(ws, {type:"error", message:"الغرفة غير موجودة"});

    if (m.type === "set_name") {
      const p = room.players.find(x => x.ws === ws);
      const name = cleanName(data.name || m.me);
      if (p && name) {
        const duplicate = room.players.some(x => x !== p && x.name.toLowerCase() === name.toLowerCase());
        if (!duplicate) {
          p.name = name;
          ws.name = name;
          broadcast(room, lobby(room));
        }
      }
      return;
    }

    if (m.type === "start_game") {
      if (ws !== room.host) return send(ws, {type:"error", message:"المضيف فقط يبدأ الجولة"});
      if (room.players.length < 2) return send(ws, {type:"error", message:"تحتاج لاعبين على الأقل"});
      if (room.phase !== "lobby") return send(ws, {type:"error", message:"الجولة بدأت بالفعل"});

      room.word = chooseWord(data.category || "mixed");
      room.outsiders = new Set();
      room.votes = new Map();
      room.pairIndex = 0;
      room.phase = "questions";
      room.resultSent = false;

      const count = Math.min(
        Math.max(1, Number.parseInt(data.count, 10) || 1),
        room.players.length - 1
      );

      const shuffled = [...room.players].sort(() => Math.random() - 0.5);
      shuffled.slice(0, count).forEach(p => room.outsiders.add(p.name));

      room.players.forEach(p => send(p.ws, {
        type:"role",
        outsider: room.outsiders.has(p.name),
        word: room.word
      }));

      setTimeout(() => {
        if (room.phase === "questions" && room.players.length >= 2) {
          const a = room.players[0];
          const b = room.players[1 % room.players.length];
          broadcast(room, {type:"questions", asker:a.name, target:b.name});
        }
      }, 700);
      return;
    }

    if (m.type === "next_pair") {
      if (room.phase !== "questions" || room.players.length < 2) return;
      room.pairIndex = (room.pairIndex + 1) % room.players.length;
      const a = room.players[room.pairIndex];
      const b = room.players[(room.pairIndex + 1) % room.players.length];
      broadcast(room, {type:"questions", asker:a.name, target:b.name});
      return;
    }

    if (m.type === "start_voting") {
      if (room.phase !== "questions") return;
      room.phase = "voting";
      room.votes = new Map();
      broadcast(room, {type:"voting", players:room.players.map(p => p.name)});
      return;
    }

    if (m.type === "vote") {
      if (room.phase !== "voting") return;
      const voter = room.players.find(p => p.ws === ws);
      const target = cleanName(data.target);
      if (!voter || !room.players.some(p => p.name === target) || target === voter.name) return;
      room.votes.set(voter.name, target);

      if (room.votes.size >= room.players.length) {
        const counts = {};
        for (const targetName of room.votes.values()) counts[targetName] = (counts[targetName] || 0) + 1;
        const max = Math.max(...Object.values(counts));
        const top = Object.keys(counts).filter(name => counts[name] === max);
        const correct = top.some(name => room.outsiders.has(name));
        const winners = [...room.outsiders].join("، ");
        room.phase = "result";
        room.resultSent = true;

        const html = correct
          ? `🎉 تم اكتشاف برا السالفة!<br><br>👤 <b>${winners}</b><br>🔐 الكلمة: <b>${room.word}</b>`
          : `😈 برا السالفة نجا!<br><br>👤 برا السالفة: <b>${winners}</b><br>🔐 الكلمة: <b>${room.word}</b>`;

        broadcast(room, {type:"result", html});
      }
      return;
    }
  });

  ws.on("close", () => {
    const code = ws.room;
    const room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.ws !== ws);
    if (room.players.length === 0) {
      rooms.delete(code);
      return;
    }
    if (room.host === ws) room.host = room.players[0].ws;
    broadcast(room, lobby(room));
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Bara Alsalfa online server running on port ${PORT}`);
});
