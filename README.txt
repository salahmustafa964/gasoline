خطوات التشغيل
1) أنشئ مشروع Firebase جديدًا مستقلًا، فعّل Authentication (بريد/كلمة مرور) وFirestore.
2) تم: بيانات مشروع gaso-line موجودة في firebase-config.js.
3) انسخ firestore.rules إلى Firestore > Rules ثم Publish.
4) أنشئ مستخدمًا في Authentication، ثم أنشئ في Firestore مستند users/{UID} بالحقول:
   name (نص)، role = admin، وللمندوب repId.
5) ارفع الملفات على GitHub Pages وافتح login.html.
قاعدة التواريخ: كل حركة تحمل date (تاريخ العملية الفعلي، يختاره المستخدم) وperiodId (مثل 2026-11)
وcreatedAt (وقت التسجيل من الخادم) حتى يمكن تسجيل حركة بتاريخ سابق دون العبث بالتوثيق.
