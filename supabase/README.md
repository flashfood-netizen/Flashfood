# Flashordo — قاعدة البيانات (Supabase)

مخطّط قاعدة البيانات الكامل الذي يفرض **قواعد CLAUDE.md §0** و**اختبارات TESTS.md**
داخل القاعدة نفسها — لا في الواجهة. الحماية الحقيقية هنا: RLS + قيود CHECK + دوال ذرّية.

> **قاعدة ذهبية:** لا تضع `service_role` أبداً في كود الواجهة. الواجهة تستعمل مفتاح
> `anon` فقط. العمليات الحسّاسة تمرّ عبر دوال `SECURITY DEFINER` أو Edge Functions.

---

## الملفّات

```
supabase/
├── migrations/
│   ├── 20260804120000_flashordo_init.sql      # الجداول + RLS + القيود + الدوال الذرّية
│   ├── 20260804120100_storage_receipts.sql    # دلو الوصولات الخاصّ + سياساته
│   └── 20260804120200_cron_jobs.sql           # إلغاء الطلبات/التجارب المنتهية
├── functions/
│   ├── upload-receipt/index.ts                # رفع آمن للوصل (فحص، إعادة ترميز، UUID)
│   └── create-staff/index.ts                  # المالك يُنشئ كاشير/مطبخ (service_role سيرفر فقط)
└── tests/
    ├── 00_supabase_shim.sql                   # محاكاة auth/roles للاختبار المحلّي
    ├── _seed.sql · 10_rules_test.sql          # pgTAP: §1‑3، §6
    ├── 20_concurrency_test.sh                 # التزامن الحقيقي T1.1
    └── run.sh                                 # مشغّل كل الاختبارات
```

---

## التطبيق على مشروع Supabase

### الطريقة أ — عبر لوحة Supabase (الأسهل)
1. افتح **SQL Editor**.
2. الصق محتوى الملفّات بالترتيب وشغّل كلّاً منها:
   `..._init.sql` ← `..._storage_receipts.sql` ← `..._cron_jobs.sql`.
3. أنشئ حساب الأدمن (انظر أدناه).

### الطريقة ب — عبر Supabase CLI
```bash
supabase link --project-ref <your-ref>
supabase db push                       # يطبّق كل ملفّات migrations
supabase functions deploy upload-receipt
supabase functions deploy create-staff
```

### إنشاء حساب الأدمن (مرّة واحدة)
سجّل مستخدماً عادياً (بريد/كلمة سر) من **Authentication**، ثم رقِّه من SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin@flashordo.com');
```
> الأدوار لا تُضبط من الواجهة ولا من `user_metadata`؛ الترقية من السيرفر فقط.

---

## نموذج الوصول (من يفعل ماذا)

| الدور | كيف يدخل | ماذا يرى/يفعل |
|---|---|---|
| **الأدمن** (المالك) | Supabase Auth، `role='admin'` | كل شيء: مراجعة الدفع، المطاعم، الإيرادات، الإعدادات |
| **التاجر** | Supabase Auth، `role='merchant'` | مطعمه فقط: المخزون، المنتجات، العمّال، التقارير، الطلبات |
| **الموظّف** (كاشير/مطبخ) | Supabase Auth، `role='staff'` + `screen` | **الطلبات فقط** لمطعمه. لا مخزون ولا تقارير ولا إدارة |
| **الزبون** | بلا حساب (تابلت) | القائمة + إنشاء طلب، عبر `get_menu`/`place_order` بكود المطعم |

- حساب الكاشير والمطبخ **يُنشئه المالك** عبر `create-staff` (كلمة السرّ يعطيها المالك للموظّف).
- الموظّف **لا يصل للوحة الإدارة أبداً** (دوره ليس `admin`)، والقاعدة تمنع ترقية الدور ذاتياً.

---

## واجهة الدوال (RPC) للواجهة الأمامية

كلّها تُستدعى بمفتاح `anon` عبر `supabase.rpc(...)`:

| الدالة | لِمن | الغرض |
|---|---|---|
| `start_trial(name, owner_name, phone)` | تاجر مصادَق | فتح تجربة 3 أيام |
| `submit_subscription(name, owner_name, phone, plan, reference, receipt_path)` | تاجر مصادَق | تقديم اشتراك مدفوع (ينشئ دفعة pending) |
| `submit_renewal(plan, reference, receipt_path)` | تاجر مصادَق | تجديد اشتراك |
| `review_subscription_payment(payment_id, approve)` | أدمن | تأكيد/رفض الدفع (تجديد تراكمي) |
| `get_menu(screen_code)` | زبون (anon) | قائمة الطعام (أسعار فقط، بلا تكاليف) |
| `place_order(screen_code, lines)` | زبون (anon) | إنشاء طلب غير مدفوع (لا يمسّ المخزون) |
| `confirm_payment(order_id)` | كاشير/مالك/أدمن | **يخصم المخزون ذرّياً** ويمرّر للمطبخ |
| `serve_order(order_id)` | مطبخ/مالك/أدمن | تسليم الطلب |
| `reject_order(order_id)` | كاشير/مالك/أدمن | رفض طلب غير مدفوع (بلا مسّ للمخزون) |
| `pay_worker(worker_id, amount)` | مالك/أدمن | دفع للعامل (≤ المستحقّ) |
| `restaurant_report(rid, from, to)` | مالك/أدمن | مبيعات/تكلفة مواد/أجور/ربح للفترة |

المخزون والمنتجات والعمّال والأقسام: قراءة/كتابة مباشرة على الجداول تحت RLS
(`supabase.from('materials')…`) — المالك يرى/يعدّل مطعمه فقط.

---

## تجربة سريعة كاملة (تسجيل ← منتج ← طلب ← دفع ← تقرير)

بعد تطبيق المخطّط، جرّب في SQL Editor محاكياً المسار (كمالك):

```sql
-- 1) بعد تسجيل الدخول كتاجر، افتح تجربة:
select public.start_trial('مطعم النخيل','محمد الأمين','0661234578');

-- 2) أضف مادة أوّلية ومنتجاً (تحت RLS، restaurant_id يُملأ من مطعمك):
--    (من الواجهة: supabase.from('materials').insert(...))
-- 3) الزبون ينشئ طلباً بكود مطعمك:
select public.place_order('<screen_code>',
  '[{"product_id":"<pid>","qty":1,"sauces":["كاتشب"]}]'::jsonb);

-- 4) الكاشير يؤكّد الدفع (هنا فقط يُخصم المخزون):
select public.confirm_payment('<order_id>');

-- 5) المطبخ يسلّم:
select public.serve_order('<order_id>');

-- 6) التقرير (المبيعات − المواد − الأجور):
select public.restaurant_report('<restaurant_id>', now()::date, now()::date + 1);
```

---

## تشغيل الاختبارات محلّياً

```bash
sudo apt-get install -y postgresql-16 postgresql-16-pgtap
# شغّل عنقود postgres محلّي على منفذ 5433، ثم:
PGHOST=/tmp PGPORT=5433 PGUSER=postgres supabase/tests/run.sh
```

الناتج المتوقّع: **36/36 pgTAP خضراء** + **T1.1 PASS** (التزامن الحقيقي).

يغطّي:
- **§1** الذرّية: خصم مرّة واحدة، لا خصم مزدوج، إجهاض كامل عند نقص مادة، تسلسل التزامن.
- **§2** القيود: `stock ≥ 0`، `price ≥ cost` (المساواة مسموحة)، `paid ≤ earned`، تجميد التكلفة.
- **§3** RLS: عزل التجّار، الموظّف يرى الطلبات فقط، منع الترقية الذاتية، قراءة الإعدادات عامّة.
- **§6** التجديد التراكمي (10+30=40).

---

## ملاحظات أمان مطبّقة

- **RLS مفعّل على كل الجداول** (13 جدولاً) — لا صفّ يُقرأ خارج نطاق صاحبه.
- **الوقت من السيرفر** (`now()`) في كل الدوال — لا يتأثّر بساعة الجهاز.
- **رسائل خطأ برمزية** (`INSUFFICIENT_STOCK:…`, `OVER_DUE`, …) تُترجم في الواجهة؛
  لا يُعرض نصّ Postgres الخام للمستخدم.
- **رفع الوصل**: SVG ممنوع، فحص magic bytes، إعادة ترميز، اسم UUID، دلو خاص، رابط موقّع مؤقّت.
- **لا `service_role` في الواجهة** — يظهر فقط داخل Edge Functions على السيرفر.
