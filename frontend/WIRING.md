# الواجهة — Flashordo (مربوطة بالكامل بـ Supabase)

تطبيق متعدّد الصفحات (Vite + React). كل عمليات الـ backend عبر `lib/api.ts`
بمفتاح anon فقط. لا `service_role` في أي ملف — العمليات الحسّاسة عبر Edge Functions.

## التشغيل
```bash
cd frontend
cp .env.example .env.local     # VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
npm install
npm run dev                    # يخدم الصفحات الأربع
npm run build                  # بناء إنتاجي (تمّ التحقّق منه)
```

## الصفحات (المسارات)
| المسار | الملف | لِمن |
|---|---|---|
| `/` (index.html) | `flashordo-onboarding.tsx` | الترحيب/التسجيل/الاشتراك/الدخول |
| `/admin.html` | `flashordo-admin.tsx` | المالك (الأدمن) |
| `/app.html` | `flashordo-merchant.tsx` | التاجر |
| `/screens.html` | `flashordo-screens.tsx` | الزبون (`?code=`) والكاشير والمطبخ |

## ما رُبط (كامل)
- **onboarding**: التجربة (`signUp`+`start_trial`)، الاشتراك (`signUp`+`submit_subscription`)، الدخول (`signIn`+الدور).
- **admin**: دخول أدمن (بالتحقّق من الدور)، تحميل الطلبات/المطاعم، مراجعة الدفع (`review_subscription_payment`)،
  عرض الوصل برابط موقّع، حفظ الإعدادات، والإيرادات تُحسب من الدفعات المؤكّدة. حُذف زر «المعاينة التجريبية».
- **merchant**: تحميل المخزون/المنتجات/الأقسام/العمّال/الطلبات من القاعدة؛ إضافة مادة/منتج/عامل؛ دفع العامل؛
  تأكيد الدفع/التسليم/الرفض (الخصم الذرّي في القاعدة)؛ التقارير؛ وإنشاء حسابات الكاشير/المطبخ عبر `create-staff`.
- **screens**: الزبون (قائمة + طلب بكود المطعم)، الكاشير (تأكيد/رفض)، المطبخ (تسليم) — بتحديث لحظي كل 4 ثوانٍ.

## الشعار
صورة ثابتة شفّافة: `public/flashordo-logo.png`، عبر `<img>` في كل الصفحات. لا رسم برمجي.

## قبل النشر
- انشر الـ Edge Functions: `supabase functions deploy upload-receipt create-staff`.
- (اختياري) رفع وصل الدفع في صفحة الاشتراك: أضف `<input type=file>` واستدعِ `api.merchant.uploadReceipt(file)`
  ثم مرّر المسار إلى `submit_subscription` (المكان جاهز، القيمة الآن `null`).
- أنشئ حساب الأدمن مرّة واحدة (انظر `../supabase/README.md`).
