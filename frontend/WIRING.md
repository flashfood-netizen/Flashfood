# ربط الواجهة بـ Supabase — دليل الإكمال

كل عمليات الـ backend صارت دوالّ جاهزة في `lib/api.ts`. الواجهة تنادي هذه الدوال
فقط؛ الحماية الحقيقية في RLS ودوال القاعدة (انظر `../supabase`). لا `service_role`
في أي ملف هنا — العمليات الحسّاسة تمرّ عبر Edge Functions على السيرفر.

## التشغيل
```bash
cd frontend
cp .env.example .env.local     # املأ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```
> `.env.local` لا يُرفع لـ GitHub (مذكور في .gitignore). ضع مفتاح anon فقط.

## الشعار
الشعار صورة ثابتة شفّافة: `public/flashordo-logo.png`، ويُشار إليها في كل الصفحات
عبر `<img src="/flashordo-logo.png">` داخل مكوّن `Logo`. لا رسم برمجي.

## ما رُبط فعلاً
- **onboarding** (`flashordo-onboarding.tsx`):
  - التجربة: `auth.signUp` ← `account.startTrial`.
  - الاشتراك المدفوع: `auth.signUp` ← `account.submitSubscription`.
  - الدخول: `auth.signIn` ← `auth.myProfile` (الدور يقرّر الوجهة).

## ما تبقّى ربطه (نفس النمط، الدوال جاهزة)

| الملف / الموضع (TODO) | استبدله بـ |
|---|---|
| **admin** — دخول `Gate` | `await api.auth.signIn(email,pass)` ثم تحقّق `api.auth.myProfile().role==='admin'` |
| admin — `OrdersTab.decide` | `api.admin.reviewPayment(paymentId, approve)` |
| admin — تحميل الطلبات/المطاعم | `api.admin.requests()` / `api.admin.shops()` بدل `SEED_*` |
| admin — «عرض الوصل» | `api.admin.receiptUrl(payment.receipt_path)` (رابط موقّع دقيقتان) |
| admin — `SettingsTab.save` | `api.admin.saveSettings(rip, month, six, life)` |
| **merchant** — تحميل البيانات | `api.merchant.materials/products/categories/workers(rid)` بدل `SEED_*` |
| merchant — `StockTab.save` | `api.merchant.addMaterial(...)` |
| merchant — `ProductsTab.saveProduct` | `api.merchant.addProduct({...,parts})` (القاعدة تفرض السعر ≥ التكلفة) |
| merchant — `WorkersTab.pay` | `api.merchant.payWorker(workerId, amount)` |
| merchant — `WatchTab.confirmPay` | `api.screens.confirmPayment(orderId)` (الخصم الذرّي في القاعدة) |
| merchant — `WatchTab.serve/reject` | `api.screens.serveOrder / rejectOrder(orderId)` |
| merchant — `ReportsTab` | `api.merchant.report(rid, from, to)` |
| merchant — `ScreensTab` حساب الموظّفين | `api.merchant.createStaff(email, pass, 'cashier'|'kitchen')` |
| merchant — رفع الوصل (إن أُضيف) | `api.merchant.uploadReceipt(file)` → مسار يُخزَّن في الدفعة |

## الشاشات الثلاث (لم تُبنَ بعد)
- **الزبون** (تابلت): `api.screens.menu(code)` + `api.screens.placeOrder(code, lines)`.
- **الكاشير**: حساب `staff/cashier` → `api.screens.orders(rid,['unpaid'])` + `confirmPayment` / `rejectOrder`.
- **المطبخ**: حساب `staff/kitchen` → `api.screens.orders(rid,['cooking'])` + `serveOrder`.

## قبل النشر
- احذف `SEED_*` بعد الربط.
- احذف زر «معاينة اللوحة (عرض تجريبي)» من `admin/Gate` (بند CLAUDE.md §7).
- انشر الـ Edge Functions: `supabase functions deploy upload-receipt create-staff`.
