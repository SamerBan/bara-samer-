برا السالفة — SAMER ONLINE
============================

هذه الحزمة جاهزة للنشر على خدمة استضافة Node.js.

الملفات:
- Bara_Alsalfa_SAMER_Online.html
- Bara_Alsalfa_SAMER_Online_Server.js
- package.json
- render.yaml

تشغيل محلي:
npm install
npm start
ثم افتح:
http://localhost:8787

للنشر العام:
ارفع المشروع إلى مستودع GitHub ثم اربطه بخدمة استضافة Node.js، أو استخدم Render مع render.yaml.
بعد النشر، يصبح رابط اللعبة هو رابط الخدمة نفسها، ويمكن إرساله للشباب.

مهم:
- الخادم الآن يستخدم PORT الخاص بالاستضافة.
- صفحة اللعبة والخادم يعملان من نفس الرابط.
- WebSocket يستخدم wss تلقائيًا عند HTTPS.
