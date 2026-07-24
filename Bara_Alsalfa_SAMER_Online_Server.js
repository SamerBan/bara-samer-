// برا السالفة ONLINE SERVER • Created by SAMER
const http=require("http");
const fs=require("fs");
const path=require("path");
const WebSocket=require("ws");
const PORT=process.env.PORT||10000;
const rooms=new Map();

const categories={
"🍔 أكل":["بيتزا","برجر","كبسة","آيس كريم","شاورما","سوشي","مندي","مكرونة"],
"🏙️ أماكن":["مطار","مدرسة","شاطئ","مستشفى","ملعب","سينما","مطعم","حديقة"],
"🎬 أفلام ومسلسلات":["فيلم رعب","كرتون","مسلسل","بطل خارق","محقق","سفر عبر الزمن","كوميديا"],
"⚽ رياضة":["كرة قدم","تنس","سباحة","ملاكمة","جري","كرة سلة","ركوب دراجات"],
"🧰 أشياء":["مفتاح","هاتف","مظلة","كرسي","ساعة","حقيبة","كتاب","نظارة","حذاء","طاولة","سرير","باب","نافذة","مصباح","شاحن"]
};
const allWords=Object.values(categories).flat();
function makeCode(){let c;do c="SB-"+Math.floor(1000+Math.random()*9000);while(rooms.has(c));return c}
function cleanName(v){return String(v||"").trim().slice(0,30)}
function send(ws,msg){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg))}
function broadcast(room,msg){room.players.forEach(p=>send(p.ws,msg))}
function lobby(room){return{type:"lobby",room:room.code,players:room.players.map(p=>p.name)}}
function chooseWord(cat){const list=cat==="mixed"?allWords:(categories[cat]||allWords);return list[Math.floor(Math.random()*list.length)]}

const server=http.createServer((req,res)=>{
 const file=path.join(__dirname,"Bara_Alsalfa_SAMER_Online.html");
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(500);return res.end("Game file unavailable")}res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(data)})
});
const wss=new WebSocket.Server({server});

wss.on("connection",ws=>{
 ws.on("message",raw=>{
  let m;try{m=JSON.parse(raw.toString())}catch{return send(ws,{type:"error",message:"رسالة غير صالحة"})}
  const data=m.data&&typeof m.data==="object"?m.data:m;
  if(m.type==="create_room"){
   const code=makeCode(),room={code,players:[],host:ws,word:"",outsiders:new Set(),votes:new Map(),pairIndex:0,phase:"lobby"};
   rooms.set(code,room);room.players.push({ws,name:"SAMER"});ws.room=code;ws.name="SAMER";
   send(ws,{type:"room_created",room:code});broadcast(room,lobby(room));return;
  }
  const room=rooms.get(m.room||ws.room);
  if(!room)return send(ws,{type:"error",message:"الغرفة غير موجودة"});
  if(m.type==="join_room"){
   const name=cleanName(m.me);
   if(!name)return send(ws,{type:"error",message:"اكتب اسمك"});
   if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return send(ws,{type:"error",message:"الاسم مستخدم، أضف حرفًا أو رقمًا"});
   room.players.push({ws,name});ws.room=room.code;ws.name=name;broadcast(room,lobby(room));return;
  }
  if(m.type==="set_name"){
   const p=room.players.find(x=>x.ws===ws),name=cleanName(data.name||m.me);
   if(p&&name&&!room.players.some(x=>x!==p&&x.name.toLowerCase()===name.toLowerCase())){p.name=name;ws.name=name;broadcast(room,lobby(room))}
   return;
  }
  if(m.type==="start_game"){
   if(ws!==room.host)return send(ws,{type:"error",message:"المضيف فقط يبدأ الجولة"});
   if(room.players.length<2)return send(ws,{type:"error",message:"تحتاج لاعبين على الأقل"});
   if(room.phase!=="lobby")return send(ws,{type:"error",message:"الجولة بدأت بالفعل"});
   room.word=chooseWord(data.category||"mixed");room.outsiders=new Set();room.votes=new Map();room.pairIndex=0;room.phase="questions";
   const count=Math.min(Math.max(1,parseInt(data.count)||1),room.players.length-1);
   [...room.players].sort(()=>Math.random()-.5).slice(0,count).forEach(p=>room.outsiders.add(p.name));
   room.players.forEach(p=>send(p.ws,{type:"role",outsider:room.outsiders.has(p.name),word:room.word}));
   setTimeout(()=>{if(room.phase==="questions"&&room.players.length>=2)broadcast(room,{type:"questions",asker:room.players[0].name,target:room.players[1].name})},700);
   return;
  }
  if(m.type==="next_pair"){
   if(room.phase!=="questions"||room.players.length<2)return;
   room.pairIndex=(room.pairIndex+1)%room.players.length;
   const a=room.players[room.pairIndex],b=room.players[(room.pairIndex+1)%room.players.length];
   broadcast(room,{type:"questions",asker:a.name,target:b.name});return;
  }
  if(m.type==="start_voting"){if(room.phase!=="questions")return;room.phase="voting";room.votes=new Map();broadcast(room,{type:"voting",players:room.players.map(p=>p.name)});return}
  if(m.type==="vote"){
   if(room.phase!=="voting")return;
   const voter=room.players.find(p=>p.ws===ws),target=cleanName(data.target);
   if(!voter||!room.players.some(p=>p.name===target)||target===voter.name)return;
   room.votes.set(voter.name,target);
   if(room.votes.size>=room.players.length){
    const counts={};for(const t of room.votes.values())counts[t]=(counts[t]||0)+1;
    const max=Math.max(...Object.values(counts)),top=Object.keys(counts).filter(n=>counts[n]===max);
    const correct=top.some(n=>room.outsiders.has(n)),winners=[...room.outsiders].join("، ");
    room.phase="result";
    const html=correct?`🎉 تم اكتشاف برا السالفة!<br><br>👤 <b>${winners}</b><br>🔐 الكلمة: <b>${room.word}</b>`:`😈 برا السالفة نجا!<br><br>👤 برا السالفة: <b>${winners}</b><br>🔐 الكلمة: <b>${room.word}</b>`;
    broadcast(room,{type:"result",html});
   }
  }
 });
 ws.on("close",()=>{const room=rooms.get(ws.room);if(!room)return;room.players=room.players.filter(p=>p.ws!==ws);if(room.players.length===0)return rooms.delete(room.code);if(room.host===ws)room.host=room.players[0].ws;broadcast(room,lobby(room))});
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Bara Alsalfa online server running on port ${PORT}`));