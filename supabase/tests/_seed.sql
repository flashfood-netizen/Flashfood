-- بذور ثابتة للاختبار: مطعمان (A/B)، أدمن، موظّفان (كاشير/مطبخ)، مواد ومنتجات.
-- تُشغَّل داخل معاملة الاختبار (superuser يتخطّى RLS).

-- نعطّل حارس الأدوار مؤقتاً كي نضبط admin/staff أثناء البذر.
alter table public.profiles disable trigger trg_guard_profile;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin@flashordo.com'),
  ('00000000-0000-0000-0000-00000000000a','ownerA@x.com'),
  ('00000000-0000-0000-0000-00000000000b','ownerB@x.com'),
  ('00000000-0000-0000-0000-0000000000ca','cashierA@x.com'),
  ('00000000-0000-0000-0000-0000000000c1','kitchenA@x.com');

-- المطعمان (نشِطان بتجربة سارية كي تُقبل الطلبات).
insert into public.restaurants
  (id, owner_id, name, owner_name, phone, email, account_type, status, screen_code, trial_ends_at)
values
  ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',
   'مطعم ألف','مالك ألف','0661234578','ownerA@x.com','trial','active','CODEAAA', now()+interval '3 days'),
  ('b0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000b',
   'مطعم باء','مالك باء','0771902244','ownerB@x.com','trial','active','CODEBBB', now()+interval '3 days');

-- الأدوار.
update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set role='staff', restaurant_id='a0000000-0000-0000-0000-000000000001', screen='cashier'
  where id='00000000-0000-0000-0000-0000000000ca';
update public.profiles set role='staff', restaurant_id='a0000000-0000-0000-0000-000000000001', screen='kitchen'
  where id='00000000-0000-0000-0000-0000000000c1';

alter table public.profiles enable trigger trg_guard_profile;

-- مواد مطعم A.
insert into public.materials (id, restaurant_id, name, unit, cost, stock, kind) values
  ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','صدر دجاج','كغ',500,1.000,'raw'),
  ('11111111-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','جبن','كغ',400,5.000,'raw'),
  ('11111111-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','طماطم','كغ',80,0.000,'raw');

-- سلعة تجارية (تُزامَن آلياً إلى منتج قابل للطلب).
insert into public.materials (id, restaurant_id, name, unit, cost, stock, kind, price) values
  ('11111111-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','كوكا كولا','علبة',70,50,'goods',100);

-- منتج «دجاج» يستهلك 1 كغ دجاج (لاختبار الوحدة الأخيرة).
insert into public.products (id, restaurant_id, name, price) values
  ('22222222-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','دجاج كامل',900);
insert into public.product_parts (product_id, material_id, qty) values
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001',1);

-- منتج «طاكوس» يحتاج دجاجاً وجبناً وطماطم (الأخيرة ناقصة).
insert into public.products (id, restaurant_id, name, price) values
  ('22222222-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','طاكوس',300);
insert into public.product_parts (product_id, material_id, qty) values
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001',0.05),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002',0.05),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000003',0.05);

-- عامل لمطعم A (لاختبار سقف الدفع).
insert into public.workers (id, restaurant_id, name, job, wage_type, wage, earned, paid) values
  ('33333333-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','ياسين','طباخ','fixed',2500,3000,0);

-- مُساعد: انتحال هوية مستخدم (JWT) داخل الاختبار.
create or replace function _login(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true);
end $$;
create or replace function _logout() returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', '', true); end $$;
