# مهام موسوعة الكتاب المقدس

## الحالة الحالية

- [x] إصلاح بنية `encyclopedia_ar.json` ومنع JSON المتسلسل.
- [x] إضافة نظام تحقق آمن للمداخل في `create-encyclopedia-data.js`.
- [x] إضافة استخراج المرشحين في `extract-bible-terms.js`.
- [x] إنشاء `encyclopedia_n.json` بعدد 40 مدخلًا لحرف النون.
- [x] دمج مداخل النون في `encyclopedia_ar.json`.
- [x] تحديث `encyclopedia.html` لدمج فهرس النون.
- [x] تحديث `encyclopedia-letter.html` لعرض قائمة المداخل والبحث والدراسة والمراجع.
- [x] إضافة `build-encyclopedia-n.js` لإعادة بناء ملف النون بأمان.
- [x] إضافة `sync-encyclopedia-n.js` لمزامنة ملف النون مع الملف العام.
- [x] التحقق من صحة JSON وعمل عرض 40 مدخلًا محليًا.

## أوامر التحديث

```bash
node build-encyclopedia-n.js
node sync-encyclopedia-n.js
node create-encyclopedia-data.js validate
```

## النشر على GitHub

المشروع غير مرتبط حاليًا بمستودع GitHub. بعد معرفة عنوان المستودع، تُنفذ الأوامر التالية:

```bash
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git branch -M main
git push -u origin main
```

يجب استبدال `USERNAME/REPOSITORY` بعنوان المستودع الحقيقي.
