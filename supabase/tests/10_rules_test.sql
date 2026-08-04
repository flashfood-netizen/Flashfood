-- pgTAP: يفرض قواعد CLAUDE.md §0 و TESTS.md §1‑3، §6.
-- التشغيل: pg_prove -d fo supabase/tests/10_rules_test.sql  (بعد الشِّيم + الهجرة)

begin;
select plan(36);
\i supabase/tests/_seed.sql

-- نعمل كمالك المطعم A في عمليات الطلبات (confirm/reject) — الأدمن/الكاشير يعملان أيضاً.
select _login('00000000-0000-0000-0000-00000000000a');

-- ══════════════════ §1  الذرّية والتزامن ══════════════════

-- T1.3 — النقر المزدوج: أول تأكيد يخصم مرّة، الثاني يُرفض (لا خصم مزدوج).
insert into public.orders (id, restaurant_id, no, status, total)
  values ('dd000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000001',1013,'unpaid',900);
insert into public.order_lines (order_id, product_id, qty, unit_price)
  values ('dd000000-0000-0000-0000-000000000013','22222222-0000-0000-0000-000000000001',1,900);

select lives_ok(
  $$ select public.confirm_payment('dd000000-0000-0000-0000-000000000013') $$,
  'T1.3 التأكيد الأول ينجح');
select is( (select stock from public.materials where id='11111111-0000-0000-0000-000000000001'),
  0.000, 'T1.3 خُصم الدجاج مرّة واحدة (1→0)');
select throws_ok(
  $$ select public.confirm_payment('dd000000-0000-0000-0000-000000000013') $$,
  '55000', null, 'T1.3 التأكيد الثاني يُرفض (الحالة لم تعد unpaid)');
select is( (select stock from public.materials where id='11111111-0000-0000-0000-000000000001'),
  0.000, 'T1.3 لا خصم مزدوج — المخزون ثابت');
select is( (select status from public.orders where id='dd000000-0000-0000-0000-000000000013'),
  'cooking', 'T1.3 الطلب انتقل للمطبخ');

-- T1.4 — مادة واحدة ناقصة من ثلاث: إجهاض كامل، لا خصم للدجاج/الجبن، يُذكر «طماطم».
insert into public.orders (id, restaurant_id, no, status, total)
  values ('dd000000-0000-0000-0000-000000000014','a0000000-0000-0000-0000-000000000001',1014,'unpaid',300);
insert into public.order_lines (order_id, product_id, qty, unit_price)
  values ('dd000000-0000-0000-0000-000000000014','22222222-0000-0000-0000-000000000002',1,300);
-- نعيد للدجاج مخزوناً كي نتأكّد أنه لا يُخصم رغم توفّره.
update public.materials set stock=2 where id='11111111-0000-0000-0000-000000000001';

select throws_like(
  $$ select public.confirm_payment('dd000000-0000-0000-0000-000000000014') $$,
  '%طماطم%', 'T1.4 يُجهض ويذكر المادة الناقصة بالاسم');
select is( (select stock from public.materials where id='11111111-0000-0000-0000-000000000001'),
  2.000, 'T1.4 الدجاج (المتوفّر) لم يُخصم');
select is( (select stock from public.materials where id='11111111-0000-0000-0000-000000000002'),
  5.000, 'T1.4 الجبن (المتوفّر) لم يُخصم');
select is( (select status from public.orders where id='dd000000-0000-0000-0000-000000000014'),
  'unpaid', 'T1.4 الطلب بقي unpaid (تراجع كامل — روح T1.2)');

-- ══════════════════ §2  قيود القاعدة ══════════════════

-- T2.1 — CHECK (stock >= 0)
select throws_ok(
  $$ update public.materials set stock=-1 where id='11111111-0000-0000-0000-000000000002' $$,
  '23514', null, 'T2.1 stock=-1 مرفوض بـ CHECK');

-- T2.2 — تمرير طلب يتجاوز المتوفّر مرفوض والمخزون لم يتغيّر.
insert into public.orders (id, restaurant_id, no, status, total)
  values ('dd000000-0000-0000-0000-000000000022','a0000000-0000-0000-0000-000000000001',1022,'unpaid',900);
insert into public.order_lines (order_id, product_id, qty, unit_price)
  values ('dd000000-0000-0000-0000-000000000022','22222222-0000-0000-0000-000000000001',100,900); -- يحتاج 100كغ
select throws_like(
  $$ select public.confirm_payment('dd000000-0000-0000-0000-000000000022') $$,
  '%INSUFFICIENT_STOCK%', 'T2.2 طلب يتجاوز المتوفّر يُرفض');
select is( (select stock from public.materials where id='11111111-0000-0000-0000-000000000001'),
  2.000, 'T2.2 المخزون لم يتغيّر');

-- T2.3 — حفظ منتج سعره 100 وتكلفة مواده 150 → مرفوض.
insert into public.products (id, restaurant_id, name, price)
  values ('22222222-0000-0000-0000-000000000023','a0000000-0000-0000-0000-000000000001','خاسر',100);
select throws_ok( $$
    insert into public.product_parts (product_id, material_id, qty)
    values ('22222222-0000-0000-0000-000000000023','11111111-0000-0000-0000-000000000002',0.375) $$, -- 0.375*400=150
  '23514', null, 'T2.3 منتج يُباع بخسارة (100<150) مرفوض');

-- T2.4 — حفظ منتج سعره 150 وتكلفته 150 → مقبول (المساواة مسموحة).
insert into public.products (id, restaurant_id, name, price)
  values ('22222222-0000-0000-0000-000000000024','a0000000-0000-0000-0000-000000000001','تعادل',150);
select lives_ok( $$
    insert into public.product_parts (product_id, material_id, qty)
    values ('22222222-0000-0000-0000-000000000024','11111111-0000-0000-0000-000000000002',0.375) $$, -- =150
  'T2.4 سعر=تكلفة (150=150) مقبول');

-- T2.5 — دفع 5000 لعامل مستحقّه 3000 → مرفوض (لا يتجاوز المستحقّ).
select throws_like(
  $$ select public.pay_worker('33333333-0000-0000-0000-000000000001',5000) $$,
  '%OVER_DUE%', 'T2.5 دفع يتجاوز المستحقّ يُرفض');
select is( (select paid from public.workers where id='33333333-0000-0000-0000-000000000001'),
  0.00, 'T2.5 المدفوع لم يتغيّر');
-- CHECK نفسه حارس مباشر:
select throws_ok(
  $$ update public.workers set paid=5000 where id='33333333-0000-0000-0000-000000000001' $$,
  '23514', null, 'T2.5 CHECK (paid<=earned) يرفض 5000>3000');

-- T2.6 — رفض طلب غير مدفوع لا يمسّ المخزون إطلاقاً.
insert into public.orders (id, restaurant_id, no, status, total)
  values ('dd000000-0000-0000-0000-000000000026','a0000000-0000-0000-0000-000000000001',1026,'unpaid',900);
select lives_ok(
  $$ select public.reject_order('dd000000-0000-0000-0000-000000000026') $$, 'T2.6 رفض الطلب ينجح');
select is( (select stock from public.materials where id='11111111-0000-0000-0000-000000000001'),
  2.000, 'T2.6 المخزون لم يتغيّر بعد الرفض');
select is( (select status from public.orders where id='dd000000-0000-0000-0000-000000000026'),
  'rejected', 'T2.6 الطلب صار rejected');

-- T2.7 — انقضاء 15 دقيقة: unpaid → expired، المخزون لم يُمسّ.
insert into public.orders (id, restaurant_id, no, status, total, created_at)
  values ('dd000000-0000-0000-0000-000000000027','a0000000-0000-0000-0000-000000000001',1027,'unpaid',900, now()-interval '16 minutes');
select is( (select public.expire_stale_orders() >= 1), true, 'T2.7 المهمة ألغت طلباً قديماً');
select is( (select status from public.orders where id='dd000000-0000-0000-0000-000000000027'),
  'expired', 'T2.7 الطلب صار expired');
select is( (select stock from public.materials where id='11111111-0000-0000-0000-000000000001'),
  2.000, 'T2.7 المخزون لم يُمسّ');

-- T2.8 — تعديل تكلفة مادة بعد البيع لا يغيّر تقارير الماضي (التكلفة مجمّدة).
insert into public.orders (id, restaurant_id, no, status, total)
  values ('dd000000-0000-0000-0000-000000000028','a0000000-0000-0000-0000-000000000001',1028,'unpaid',900);
insert into public.order_lines (order_id, product_id, qty, unit_price)
  values ('dd000000-0000-0000-0000-000000000028','22222222-0000-0000-0000-000000000001',1,900);
select public.confirm_payment('dd000000-0000-0000-0000-000000000028');  -- يخصم 1كغ دجاج بتكلفة 500
-- نغيّر تكلفة المادة إلى 999 بعد البيع.
update public.materials set cost=999 where id='11111111-0000-0000-0000-000000000001';
-- التكلفة في سجلّ الحركة (مصدر التقارير) بقيت 500 ⇒ الماضي لا يتغيّر.
select is(
  (select unit_cost from public.stock_movements where order_id='dd000000-0000-0000-0000-000000000028'),
  500.000, 'T2.8 التكلفة مجمّدة على 500 في السجلّ رغم تغيّر المادة إلى 999');
select _logout();

-- ══════════════════ §3  الصلاحيات وRLS ══════════════════

-- T3.1 — عزل التجّار: المالك B لا يقرأ جداول المالك A.
select _login('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select is( (select count(*)::int from public.materials
            where restaurant_id='a0000000-0000-0000-0000-000000000001'),
  0, 'T3.1 المالك B لا يرى مواد المالك A');
select is( (select count(*)::int from public.orders
            where restaurant_id='a0000000-0000-0000-0000-000000000001'),
  0, 'T3.1 المالك B لا يرى طلبات المالك A');
select throws_ok( $$
    insert into public.materials (restaurant_id,name,unit,cost,stock,kind)
    values ('a0000000-0000-0000-0000-000000000001','تسلل','كغ',1,1,'raw') $$,
  '42501', null, 'T3.1 كتابة B في مطعم A مرفوضة (RLS)');
reset role;
select _logout();

-- T3.2 — الموظّف يرى الطلبات فقط، لا المخزون ولا العمّال.
select _login('00000000-0000-0000-0000-0000000000ca'); -- كاشير A
set local role authenticated;
select is( (select count(*)::int from public.materials), 0, 'T3.2 الموظّف لا يرى أي مادة');
select is( (select count(*)::int from public.workers),   0, 'T3.2 الموظّف لا يرى أي عامل');
select ok( (select count(*)::int from public.orders) > 0, 'T3.2 الموظّف يرى طلبات مطعمه');
reset role;
select _logout();

-- T3.3 — التاجر لا يصل للوحة المالك: كتابة app_settings مرفوضة، دفعة لمطعم آخر مرفوضة.
select _login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
update public.app_settings set price_month=1 where id=1;
select is( (select price_month from public.app_settings where id=1), 1700,
  'T3.3 تعديل app_settings من التاجر لا يؤثّر (RLS رفض الكتابة)');
select throws_ok( $$
    insert into public.payments (restaurant_id,plan,amount,transfer_reference,status)
    values ('b0000000-0000-0000-0000-000000000002','month',1700,'1234567890','pending') $$,
  '42501', null, 'T3.3 كتابة دفعة لمطعم آخر مرفوضة');
reset role;
select _logout();

-- T3.4 — ترقية الدور: مستخدم يحاول جعل نفسه admin → مرفوض.
select _login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok(
  $$ update public.profiles set role='admin' where id='00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'T3.4 المستخدم لا يرقّي نفسه إلى admin');
reset role;
select _logout();

-- T3.5 — قراءة الإعدادات: زائر (anon) يقرأ app_settings، والكتابة مرفوضة.
set local role anon;
select is( (select count(*)::int from public.app_settings), 1, 'T3.5 anon يقرأ app_settings');
select throws_ok( $$
    insert into public.app_settings (id,rip_account,price_month,price_six,price_life)
    values (1,'00000000000000000000',1,1,1) $$,
  '42501', null, 'T3.5 كتابة anon على app_settings مرفوضة');
reset role;

-- ══════════════════ §6  التجديد التراكمي ══════════════════

-- T6.4 — اشتراك ينتهي بعد 10 أيام، يُجدّد بباقة شهر ⇒ 10+30=40 يوماً (لا 30).
update public.restaurants
   set account_type='paid', status='active', subscription_ends_at = now()+interval '10 days'
 where id='b0000000-0000-0000-0000-000000000002';
insert into public.payments (id, restaurant_id, plan, amount, transfer_reference, status, is_renewal)
  values ('cc000000-0000-0000-0000-000000000064','b0000000-0000-0000-0000-000000000002',
          'month',1700,'9998887776','pending',true);
select _login('00000000-0000-0000-0000-0000000000a1'); -- الأدمن
select public.review_subscription_payment('cc000000-0000-0000-0000-000000000064', true);
select ok(
  (select subscription_ends_at from public.restaurants where id='b0000000-0000-0000-0000-000000000002')
    between now()+interval '39 days' and now()+interval '41 days',
  'T6.4 التجديد تراكمي: النهاية ≈ 40 يوماً (10 متبقّية + 30)');
select _logout();

select * from finish();
rollback;
