// برا السالفة ONLINE SERVER • Created by SAMER
// التشغيل:
//   npm init -y
//   npm install ws
//   node Bara_Alsalfa_SAMER_Online_Server.js
//
// ثم افتح Bara_Alsalfa_SAMER_Online.html في المتصفح.

const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 8787;
const server = http.createServer((req, res) => {
  const file = path.join(__dirname, "Bara_Alsalfa_SAMER_Online.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(500); return res.end("Game file unavailable"); }
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    res.end(data);
  });
});
const wss = new WebSocket.Server({ server });
const rooms = new Map();

const categories = {
  "🍔 أكل": ["بيتزا","برجر","كبسة","آيس كريم","شاورما","سوشي"],
  "🏙️ أماكن": ["مطار","مدرسة","شاطئ","مستشفى","ملعب","سينما"],
  "🎬 أفلام ومسلسلات": ["فيلم رعب","كرتون","مسلسل","بطل خارق","محقق","سفر عبر الزمن"],
  "⚽ رياضة": ["كرة قدم","تنس","سباحة","ملاكمة","جري","كرة سلة"],
  "🧰 أشياء": ["مفتاح","هاتف","مظلة","كرسي","ساعة","حقيبة"]
};

function code(){return "SB-"+Math.floor(1000+Math.random()*9000)}
function send(ws,msg){if(ws.readyState===1)ws.send(JSON.stringify(msg))}
function broadcast(room,msg){for(const p of room.players)send(p.ws,msg)}
function mixedWord(cat){const all=Object.values(categories).flat();return (cat==="mixed"?all:categories[cat]||all)[Math.floor(Math.random()*(cat==="mixed"?all:categories[cat]||all).length)]}

wss.on("connection",ws=>{
  ws.on("message",raw=>{
    let m; try{m=JSON.parse(raw)}catch{return}
    if(m.type==="create_room"){
      let c=code(); while(rooms.has(c))c=code();
      const room={code:c,players:[],host:ws,word:"",outsiders:[],votes:{},pairIndex:0};
      rooms.set(c,room); room.players.push({ws,name:"SAMER"}); ws.room=c; ws.name="SAMER";
      send(ws,{type:"room_created",room:c}); broadcast(room,{type:"lobby",players:room.players.map(x=>x.name)});
      return;
    }
    const room=rooms.get(m.room); if(!room)return send(ws,{type:"error",message:"الغرفة غير موجودة"});
    if(m.type==="join_room"){
      if(room.players.some(p=>p.name===m.me))return send(ws,{type:"error",message:"الاسم مستخدم"});
      room.players.push({ws,name:m.me}); ws.room=m.room; ws.name=m.me;
      broadcast(room,{type:"lobby",players:room.players.map(x=>x.name)}); return;
    }
    if(m.type==="set_name"){ws.name=m.name; const p=room.players.find(x=>x.ws===ws); if(p)p.name=m.name; broadcast(room,{type:"lobby",players:room.players.map(x=>x.name)}); return}
    if(m.type==="start_game" && ws===room.host){
      room.word=mixedWord(m.category); room.outsiders=[];
      const n=Math.min(Math.max(1,m.count||1),room.players.length-1);
      const idx=[...room.players.keys()].sort(()=>Math.random()-.5).slice(0,n);
      room.outsiders=idx.map(i=>room.players[i].name);
      room.players.forEach(p=>send(p,{type:"role",outsider:room.outsiders.includes(p.name),word:room.word}));
      setTimeout(()=>broadcast(room,{type:"questions",asker:room.players[0].name,target:room.players[1%room.players.length].name}),1200);
      return;
    }
    if(m.type==="next_pair"){
      room.pairIndex=(room.pairIndex+1)%room.players.length;
      const a=room.players[room.pairIndex], b=room.players[(room.pairIndex+1)%room.players.length];
      broadcast(room,{type:"questions",asker:a.name,target:b.name}); return;
    }
    if(m.type==="start_voting"){room.votes={};broadcast(room,{type:"voting",players:room.players.map(x=>x.name)});return}
    if(m.type==="vote"){
      room.votes[ws.name]=m.target;
      if(Object.keys(room.votes).length>=room.players.length){
        const counts={}; Object.values(room.votes).forEach(x=>counts[x]=(counts[x]||0)+1);
        const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
        const correct=room.outsiders.includes(top);
        const html=correct?`🎉 تم اكتشاف برا السالفة!<br><br>🔐 الكلمة: <b>${room.word}</b>`:`😈 برا السالفة نجا!<br><br>🔐 الكلمة: <b>${room.word}</b>`;
        broadcast(room,{type:"result",html});
      }
    }
  });
  ws.on("close",()=>{
    for(const [code,room] of rooms){
      room.players=room.players.filter(p=>p.ws!==ws);
      if(room.players.length===0)rooms.delete(code);
      else broadcast(room,{type:"lobby",players:room.players.map(x=>x.name)});
    }
  });
});
server.listen(PORT, "0.0.0.0", () => console.log(`Bara Alsalfa online server running on port ${PORT}`));
