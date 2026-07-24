// برا السالفة ONLINE SERVER • Created by SAMER
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT) || 8787;
const rooms = new Map();

const categories = {
  '🍔 أكل': ['بيتزا','برجر','كبسة','آيس كريم','شاورما','سوشي','مكرونة','فشار','كيك','دونات','فطيرة','سلطة','بطاطس','دجاج','سمك','تمر','شوكولاتة','قهوة','شاي','عسل','بيض','جبن','خبز','رز','نودلز','تاكو','كريب','وافل','عصير','بسكويت','مندي','مظبي','سمبوسة','فلافل','هوت دوغ','بان كيك','كنافة','بقلاوة'],
  '🏙️ أماكن': ['مطار','مدرسة','شاطئ','مستشفى','ملعب','سينما','مطعم','مقهى','جامعة','حديقة','مول','فندق','متحف','مكتبة','مزرعة','صحراء','جزيرة','سجن','محطة قطار','محطة بنزين','بنك','مسجد','سوق','مسرح','استاد','نادي','مسبح','صالة ألعاب','مكتب','بيت','غرفة','مطبخ','سطح','مصعد','شارع','جسر','نفق','ميناء','سفينة','مخيم','منتزه','ملاهي','حديقة حيوان','مخبز','صالون','ورشة','مغسلة','قصر','قلعة','برج','قرية','مدينة'],
  '🎬 أفلام ومسلسلات': ['فيلم رعب','كرتون','مسلسل','بطل خارق','محقق','سفر عبر الزمن','زومبي','فضاء','ساحر','نينجا','قرصان','جاسوس','روبوت','وحش','أميرة','ملك','مغامرة','كوميديا','دراما','أكشن','خيال علمي','غموض','وثائقي','رومانسية','مدرسة','مستشفى','شرطة','سجن','جزيرة','مدينة مستقبلية','قصة حب','نهاية العالم','بطل شرير','فريق أبطال','آلة زمن','مخلوق فضائي','محقق خاص','جريمة','سرقة','مطاردة','مباراة','منافسة','بطولة','أكاديمية','قصر','غابة','صحراء','بحر','جبل'],
  '⚽ رياضة': ['كرة قدم','تنس','سباحة','ملاكمة','جري','كرة سلة','كرة طائرة','غولف','ركوب خيل','تزلج','هوكي','رماية','دراجات','سباق سيارات','كاراتيه','جودو','رفع أثقال','مصارعة','جمباز','تسلق','صيد','غوص','تجديف','رمي رمح','ماراثون','ملعب','حكم','مدرب','لاعب','جمهور','بطولة','كأس','ميدالية','هدف','ركلة','ضربة','مباراة','فريق','تمرين','نادي','منتخب'],
  '🧰 أشياء': ['مفتاح','هاتف','مظلة','كرسي','ساعة','حقيبة','قلم','كتاب','نظارة','حذاء','قبعة','طاولة','سرير','باب','نافذة','مرآة','مصباح','شاحن','سماعة','كاميرا','تلفزيون','ريموت','حاسوب','لوحة','مقص','مطرقة','مسمار','مفك','كوب','زجاجة','محفظة','نقود','بطاقة','جواز سفر','مروحة','مكيف','ثلاجة','فرشاة','منشفة','وسادة','بطانية']
};
const allWords = Object.values(categories).flat();

function send(ws, msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg) { room.players.forEach(p => send(p.ws, msg)); }
function cleanName(v) { return String(v || '').trim().replace(/\s+/g, ' ').slice(0, 30); }
function makeCode() { let c; do c = `SB-${Math.floor(1000 + Math.random() * 9000)}`; while (rooms.has(c)); return c; }
function chooseWord(category) { const list = categories[category] || allWords; return list[Math.floor(Math.random() * list.length)]; }
function getRoom(m) { return rooms.get(String(m.room || '').trim().toUpperCase()); }
function uniqueName(room, requested) {
  const base = cleanName(requested) || 'لاعب';
  if (!room.players.some(p => p.name.toLowerCase() === base.toLowerCase())) return base;
  let n = 2; while (room.players.some(p => p.name.toLowerCase() === `${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}
function hostName(room) { return room.players.find(p => p.ws === room.host)?.name || ''; }
function publicLobby(room) {
  return { type: 'lobby', room: room.code, host: hostName(room), phase: room.phase,
    players: room.players.map(p => ({ name: p.name, score: p.score })) };
}
function publicScores(room) { return room.players.map(p => ({ name: p.name, score: p.score })); }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function currentTurn(room) { return room.turns[room.turnIndex]; }
function sendTurn(room) {
  const t = currentTurn(room); if (!t) return;
  broadcast(room, { type: 'question_turn', asker: t.asker, target: t.target, turn: room.turnIndex + 1, total: room.turns.length });
}
function finishVoting(room) {
  const counts = {};
  for (const target of room.votes.values()) counts[target] = (counts[target] || 0) + 1;
  const max = Math.max(...Object.values(counts));
  const top = Object.keys(counts).filter(n => counts[n] === max);
  const caught = top.some(n => room.outsiders.has(n));
  const outsiders = [...room.outsiders];
  if (caught) room.players.forEach(p => { if (!room.outsiders.has(p.name)) p.score += 1; });
  else room.players.forEach(p => { if (room.outsiders.has(p.name)) p.score += 2; });
  room.phase = 'result';
  broadcast(room, { type: 'result', caught, outsiders, word: room.word, voted: top, scores: publicScores(room), host: hostName(room) });
}
function startRound(room, settings = {}) {
  room.word = chooseWord(settings.category || room.category || '🍔 أكل');
  room.category = settings.category || room.category || '🍔 أكل';
  room.outsiders = new Set();
  room.votes = new Map();
  room.turnIndex = 0;
  room.phase = 'questions';
  room.players.forEach(p => { p.questionsAsked = 0; });
  const count = Math.min(Math.max(1, Number.parseInt(settings.count, 10) || 1), Math.max(1, room.players.length - 1));
  shuffle(room.players).slice(0, count).forEach(p => room.outsiders.add(p.name));
  room.players.forEach(p => send(p.ws, { type: 'role', outsider: room.outsiders.has(p.name), word: room.word, scores: publicScores(room) }));
  const order = shuffle(room.players);
  room.turns = [];
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < order.length; i++) room.turns.push({ asker: order[i].name, target: order[(i + 1) % order.length] .name });
  }
  setTimeout(() => { if (room.phase === 'questions') sendTurn(room); }, 300);
}

const httpServer = http.createServer((req, res) => {
  const file = path.join(__dirname, 'Bara_Alsalfa_SAMER_Online.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Game file unavailable'); }
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(data);
  });
});
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return send(ws, { type:'error', message:'رسالة غير صالحة' }); }
    const data = m.data && typeof m.data === 'object' ? m.data : {};

    if (m.type === 'create_room') {
      const code = makeCode();
      const room = { code, players: [], host: ws, word:'', category:'🍔 أكل', outsiders:new Set(), votes:new Map(), turns:[], turnIndex:0, phase:'lobby' };
      rooms.set(code, room);
      const name = uniqueName(room, data.name);
      const player = { ws, name, score:0, questionsAsked:0 };
      room.players.push(player); ws.room = code; ws.player = player;
      send(ws, { type:'room_created', room:code, name }); broadcast(room, publicLobby(room)); return;
    }

    if (m.type === 'join_room') {
      const code = String(m.room || '').trim().toUpperCase(); const room = rooms.get(code);
      if (!room) return send(ws, { type:'error', message:'الغرفة غير موجودة' });
      if (room.phase !== 'lobby' && room.phase !== 'result') return send(ws, { type:'error', message:'الجولة بدأت بالفعل' });
      const name = uniqueName(room, data.name);
      const player = { ws, name, score:0, questionsAsked:0 };
      room.players.push(player); ws.room = code; ws.player = player;
      broadcast(room, publicLobby(room)); return;
    }

    const room = getRoom(m); if (!room) return send(ws, { type:'error', message:'الغرفة غير موجودة' });
    const player = room.players.find(p => p.ws === ws);
    if (!player) return send(ws, { type:'error', message:'أنت لست داخل الغرفة' });

    if (m.type === 'start_game') {
      if (ws !== room.host) return send(ws, { type:'error', message:'المضيف فقط يبدأ الجولة' });
      if (room.players.length < 2) return send(ws, { type:'error', message:'تحتاج لاعبين على الأقل' });
      if (room.phase !== 'lobby' && room.phase !== 'result') return send(ws, { type:'error', message:'الجولة الحالية لم تنتهِ' });
      startRound(room, { count:data.count, category:data.category }); return;
    }
    if (m.type === 'next_pair') {
      if (room.phase !== 'questions') return;
      const t = currentTurn(room);
      if (!t || t.asker !== player.name) return send(ws, { type:'error', message:'انتظر دورك في السؤال' });
      room.turnIndex++;
      if (room.turnIndex >= room.turns.length) { room.phase = 'voting'; room.votes = new Map(); return broadcast(room, { type:'voting', players:room.players.map(p=>p.name), scores:publicScores(room), host:room.host.name }); }
      sendTurn(room); return;
    }
    if (m.type === 'start_voting') {
      if (ws !== room.host) return send(ws, { type:'error', message:'المضيف فقط يبدأ التصويت' });
      if (room.phase !== 'questions') return;
      room.phase = 'voting'; room.votes = new Map(); broadcast(room, { type:'voting', players:room.players.map(p=>p.name), scores:publicScores(room), host:room.host.name }); return;
    }
    if (m.type === 'vote') {
      if (room.phase !== 'voting') return;
      const target = cleanName(data.target);
      if (!room.players.some(p => p.name === target) || target === player.name) return send(ws, { type:'error', message:'اختيار غير صالح' });
      room.votes.set(player.name, target);
      if (room.votes.size >= room.players.length) finishVoting(room); return;
      broadcast(room, { type:'vote_progress', count:room.votes.size, total:room.players.length }); return;
    }
    if (m.type === 'rematch') {
      if (ws !== room.host) return send(ws, { type:'error', message:'المضيف فقط يبدأ جولة جديدة' });
      if (room.phase !== 'result') return;
      startRound(room, { count:data.count, category:data.category }); return;
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.room); if (!room) return;
    room.players = room.players.filter(p => p.ws !== ws);
    if (!room.players.length) return rooms.delete(room.code);
    if (room.host === ws) room.host = room.players[0].ws;
    if (room.phase === 'questions') room.phase = 'lobby';
    broadcast(room, publicLobby(room));
  });
});

httpServer.listen(PORT, '0.0.0.0', () => console.log(`Bara Alsalfa online server running on port ${PORT}`));
