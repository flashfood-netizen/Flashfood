-- ══════════════════════════════════════════════════════════════
-- Flashordo — كل SQL في ملف واحد. الصقه كاملاً في Supabase SQL Editor واضغط Run.
-- (مجمّع آلياً من supabase/migrations/ بالترتيب الصحيح)
-- ══════════════════════════════════════════════════════════════

-- ▼▼▼ 1) المخطّط: الجداول + RLS + القيود + الدوال الذرّية ▼▼▼
-- ══════════════════════════════════════════════════════════════════════════
--  Flashordo — المخطّط الكامل لقاعدة البيانات (Supabase / PostgreSQL)
--  نظام طلب ودفع وتحضير للمطاعم في الجزائر.
--
--  هذا الملف يُنشئ في التزام واحد: الجداول + القيود (CHECK) + RLS +
--  الدوال الذرّية — كما يفرضه CLAUDE.md (القسم 0) و TESTS.md (الأقسام 1‑3، 6).
--
--  المبدأ الحاكم: الحماية الحقيقية في القاعدة، لا في الواجهة.
--    • المخزون لا يصبح سالباً أبداً.            (CHECK stock >= 0)
--    • لا خصم من المخزون قبل تأكيد الدفع.        (confirm_payment وحدها تخصم)
--    • سعر البيع ≥ تكلفة المواد.                 (trigger + CHECK)
--    • رصيد العامل لا يصبح سالباً.               (CHECK paid <= earned)
--    • الطلب غير المدفوع يُلغى بعد 15 دقيقة.       (expire_stale_orders)
--    • الأرباح = المبيعات − تكلفة المواد − الأجور. (تكلفة مجمّدة وقت البيع)
--    • ممنوع service_role في الواجهة — كل شيء هنا يعمل بمفتاح anon عبر RLS/RPC.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto  with schema extensions;   -- gen_random_uuid
create extension if not exists citext     with schema extensions;   -- بريد بلا حساسية حالة

set search_path = public, extensions;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 1) دوال التحقّق (immutable) — تُستعمل في CHECK وفي الواجهة معاً        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- اسم مقبول: 2‑60 محرفاً، محارف مسموحة فقط، وليس أرقاماً فقط (عربية أو لاتينية).
create or replace function public.is_valid_name(p text)
returns boolean language sql immutable as $$
  select p is not null
     and char_length(btrim(p)) between 2 and 60
     -- قائمة محارف مسموحة (حروف عربية/لاتينية، أرقام، مسافة، . ' ( ) -)
     and btrim(p) ~ '^[ء-ي٠-٩a-zA-Z0-9 .''()\-]+$'
     -- يُرفض المكوّن من أرقام/فراغات/فواصل فقط (١٢٣ أو 123 أو "  ")
     and btrim(p) !~ '^[٠-٩0-9 .,]+$';
$$;

create or replace function public.is_valid_phone(p text)
returns boolean language sql immutable as $$
  select p ~ '^0[567][0-9]{8}$';
$$;

create or replace function public.is_valid_email(p text)
returns boolean language sql immutable as $$
  select p is not null and char_length(p) <= 254
     and p ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$';
$$;

create or replace function public.is_valid_reference(p text)
returns boolean language sql immutable as $$
  select p ~ '^[0-9]{10,}$';                       -- مرجع التحويل: أرقام فقط، 10 فأكثر
$$;

create or replace function public.is_valid_rip(p text)
returns boolean language sql immutable as $$
  select p ~ '^[0-9]{20}$';                         -- RIP بريدي موب: 20 رقماً بالضبط
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 2) الملفات الشخصية والأدوار                                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- الدور في جدول profiles، لا في user_metadata (الأخير قابل للتعديل من العميل).
-- staff: حساب كاشير/مطبخ مرتبط بمطعم واحد وبشاشة واحدة، صلاحيته الطلبات فقط.

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'merchant'
                  check (role in ('admin','merchant','staff')),
  -- تُملأ لحسابات الموظّفين فقط:
  restaurant_id uuid,                                -- مطعم الموظّف (FK يُضاف بعد جدول restaurants)
  screen        text check (screen in ('cashier','kitchen')),
  created_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 3) إعدادات المنصّة (صفّ واحد) — قراءة عامة، كتابة للأدمن               ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create table public.app_settings (
  id             smallint primary key default 1 check (id = 1),   -- Singleton
  rip_account    text not null check (is_valid_rip(rip_account)),
  price_month    integer not null check (price_month    > 0),
  price_six      integer not null check (price_six      > 0),
  price_life     integer not null check (price_life     > 0),
  updated_at     timestamptz not null default now()
);
alter table public.app_settings enable row level security;

insert into public.app_settings (id, rip_account, price_month, price_six, price_life)
values (1, '00779999900207049003', 1700, 6800, 14990);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 4) المطاعم                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create table public.restaurants (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null unique references auth.users(id) on delete cascade,
  name                 text not null check (is_valid_name(name)),
  owner_name           text not null check (is_valid_name(owner_name)),
  phone                text not null check (is_valid_phone(phone)),
  email                citext not null check (is_valid_email(email)),
  account_type         text not null default 'trial' check (account_type in ('trial','paid')),
  status               text not null default 'pending'
                         check (status in ('pending','active','rejected','expired')),
  -- كود عام قصير تُفتح به الشاشات داخل المحل دون كشف معرّف UUID في الرابط.
  screen_code          text not null unique default encode(gen_random_bytes(6),'hex'),
  order_seq            integer not null default 0,          -- عدّاد أرقام الطلبات لكل مطعم
  trial_ends_at        timestamptz,
  subscription_ends_at timestamptz,                          -- null في «مدى الحياة» = بلا انتهاء
  created_at           timestamptz not null default now(),
  constraint restaurants_phone_key unique (phone),
  constraint restaurants_email_key unique (email)
);
alter table public.restaurants enable row level security;

-- الآن نربط profiles.restaurant_id بالمطاعم.
alter table public.profiles
  add constraint profiles_restaurant_fk
  foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

create index on public.restaurants (status);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 5) اشتراكات الدفع (تاجر ← منصّة)                                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants(id) on delete cascade,
  plan               text not null check (plan in ('month','six','life')),
  amount             integer not null check (amount > 0),
  transfer_reference text not null check (is_valid_reference(transfer_reference)),
  receipt_path       text,                                   -- مسار الوصل في التخزين الخاص
  status             text not null default 'pending'
                       check (status in ('pending','confirmed','rejected')),
  is_renewal         boolean not null default false,
  reviewed_by        uuid references auth.users(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);
alter table public.payments enable row level security;
create index on public.payments (restaurant_id);
create index on public.payments (status);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 6) الأقسام / التصنيفات                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null check (is_valid_name(name)),
  parent_id      uuid references public.categories(id) on delete set null,
  sauces_enabled boolean not null default false,
  created_at     timestamptz not null default now()
);
alter table public.categories enable row level security;
create index on public.categories (restaurant_id);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 7) المواد (أوّلية «raw» أو سلع تجارية «goods»)                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- المادة الأوّلية: مكوّن يُستهلك في المنتجات، بلا سعر بيع.
-- السلعة التجارية: تُباع كما هي؛ لها سعر بيع ≥ التكلفة، وتظهر للزبون مباشرة.
create table public.materials (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null check (is_valid_name(name)),
  unit           text not null check (unit in ('كغ','غ','ل','مل','علبة','قطعة')),
  cost           numeric(12,3) not null check (cost >= 0),      -- سعر شراء الوحدة
  stock          numeric(12,3) not null default 0 check (stock >= 0),
  kind           text not null default 'raw' check (kind in ('raw','goods')),
  price          numeric(12,2) check (price is null or price > 0),  -- سعر البيع (goods)
  category_id    uuid references public.categories(id) on delete set null,
  created_at     timestamptz not null default now(),
  -- سلعة تجارية يجب أن يكون لها سعر بيع يغطّي التكلفة (المساواة مسموحة).
  constraint goods_needs_price     check (kind = 'raw' or price is not null),
  constraint goods_price_ge_cost   check (kind = 'raw' or price >= cost)
);
alter table public.materials enable row level security;
create index on public.materials (restaurant_id);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 8) المنتجات ومكوّناتها                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- كل منتج يُكوَّن من مواد أوّلية تُخصم عند تأكيد الدفع.
-- السلع التجارية تُمثَّل بمنتج آلي (source_material_id) مكوّنه = وحدة واحدة من نفسه،
-- فتبقى الطلبات والخصم موحّدة (order_lines.product_id دائماً).
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants(id) on delete cascade,
  name               text not null check (is_valid_name(name)),
  price              numeric(12,2) not null check (price > 0),
  category_id        uuid references public.categories(id) on delete set null,
  source_material_id uuid unique references public.materials(id) on delete cascade,
  created_at         timestamptz not null default now()
);
alter table public.products enable row level security;
create index on public.products (restaurant_id);

create table public.product_parts (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  qty         numeric(12,3) not null check (qty > 0),
  unique (product_id, material_id)
);
alter table public.product_parts enable row level security;
create index on public.product_parts (product_id);
create index on public.product_parts (material_id);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 9) العمّال ومدفوعاتهم                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create table public.workers (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (is_valid_name(name)),
  job           text not null check (is_valid_name(job)),
  wage_type     text not null default 'fixed' check (wage_type in ('fixed','var')),
  wage          numeric(12,2) not null check (wage >= 0),
  earned        numeric(12,2) not null default 0 check (earned >= 0),
  paid          numeric(12,2) not null default 0 check (paid  >= 0),
  created_at    timestamptz not null default now(),
  -- رصيد العامل لا يصبح سالباً: المدفوع لا يتجاوز المستحقّ.
  constraint paid_le_earned check (paid <= earned)
);
alter table public.workers enable row level security;
create index on public.workers (restaurant_id);

-- سجلّ الدفعات: يعطي الأجور بُعداً زمنياً لتقارير الفترات.
create table public.wage_payments (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  worker_id     uuid not null references public.workers(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  paid_at       timestamptz not null default now()
);
alter table public.wage_payments enable row level security;
create index on public.wage_payments (restaurant_id, paid_at);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 10) الطلبات وأسطرها + سجلّ حركة المخزون                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  no            integer not null,                            -- رقم الطلب داخل المطعم
  status        text not null default 'unpaid'
                  check (status in ('unpaid','cooking','served','rejected','expired')),
  total         numeric(12,2) not null default 0 check (total >= 0),
  created_at    timestamptz not null default now(),
  paid_at       timestamptz,                                 -- لحظة تأكيد الدفع
  unique (restaurant_id, no)
);
alter table public.orders enable row level security;
create index on public.orders (restaurant_id, status);
create index on public.orders (restaurant_id, created_at);

create table public.order_lines (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id),
  product_name text,                                            -- اسم المنتج مجمّد (تراه الشاشات دون قراءة products)
  qty          numeric(12,3) not null check (qty > 0),
  sauces       text[] not null default '{}',
  unit_price   numeric(12,2) not null check (unit_price >= 0)   -- سعر البيع مجمّد وقت الطلب
);
alter table public.order_lines enable row level security;
create index on public.order_lines (order_id);

-- سجلّ حركة المخزون: كل خصم يُثبَّت بتكلفته وقت البيع ⇒ التقارير القديمة لا تتغيّر (T2.8).
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  material_id   uuid not null references public.materials(id) on delete cascade,
  order_id      uuid references public.orders(id) on delete set null,
  qty_delta     numeric(12,3) not null,                      -- سالب = استهلاك
  unit_cost     numeric(12,3) not null check (unit_cost >= 0),
  created_at    timestamptz not null default now()
);
alter table public.stock_movements enable row level security;
create index on public.stock_movements (restaurant_id, created_at);
create index on public.stock_movements (order_id);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 11) دوال الصلاحيات (SECURITY DEFINER) — تتخطّى RLS لتفادي التكرار     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;

create or replace function public.owns_restaurant(p_rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants
                 where id = p_rid and owner_id = auth.uid());
$$;

-- موظّف مُسنَد لهذا المطعم (اختيارياً بشاشة محدّدة).
create or replace function public.is_staff_of(p_rid uuid, p_screen text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'staff'
                   and restaurant_id = p_rid
                   and (p_screen is null or screen = p_screen));
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 12) سياسات RLS                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- profiles: كلٌّ يرى ملفّه، والأدمن يرى الكل. لا ترقية دور من العميل (تُفرض بمُطلِق أدناه).
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- منع أي مستخدم عادي من تغيير دوره/مطعمه/شاشته بنفسه (T3.4).
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;                                    -- الأدمن وحده يعدّل الأدوار
  end if;
  if new.role is distinct from old.role
     or new.restaurant_id is distinct from old.restaurant_id
     or new.screen is distinct from old.screen then
    raise exception 'PRIVILEGE_LOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger trg_guard_profile before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- app_settings: قراءة عامة (السعر وRIP لصفحة الاشتراك)، كتابة للأدمن فقط.
create policy settings_read  on public.app_settings for select using (true);
create policy settings_write on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- restaurants: المالك يرى مطعمه، الموظّف يرى مطعمه، الأدمن يرى الكل.
create policy rest_select on public.restaurants for select
  using (public.is_admin() or owner_id = auth.uid()
         or public.is_staff_of(id));
create policy rest_write on public.restaurants for all
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

-- payments: المالك يرى دفعات مطعمه، الأدمن الكل. (الإدراج عبر دوال RPC.)
create policy pay_select on public.payments for select
  using (public.is_admin() or public.owns_restaurant(restaurant_id));
create policy pay_admin_write on public.payments for all
  using (public.is_admin()) with check (public.is_admin());

-- جداول المطعم الخاصّة بالمالك/الأدمن فقط (لا الموظّف) → T3.2 صفر صفوف للموظّف.
do $$
declare t text;
begin
  foreach t in array array['categories','materials','products','workers','wage_payments','stock_movements']
  loop
    execute format($f$
      create policy %1$s_owner on public.%1$s for all
        using (public.is_admin() or public.owns_restaurant(restaurant_id))
        with check (public.is_admin() or public.owns_restaurant(restaurant_id));
    $f$, t);
  end loop;
end $$;

-- product_parts: عبر مطعم المنتج الأب.
create policy parts_owner on public.product_parts for all
  using (exists (select 1 from public.products p
                 where p.id = product_id
                   and (public.is_admin() or public.owns_restaurant(p.restaurant_id))))
  with check (exists (select 1 from public.products p
                 where p.id = product_id
                   and (public.is_admin() or public.owns_restaurant(p.restaurant_id))));

-- orders: المالك + الأدمن (كل شيء) والموظّف (قراءة فقط لمطعمه) → T3.2.
create policy orders_read on public.orders for select
  using (public.is_admin() or public.owns_restaurant(restaurant_id)
         or public.is_staff_of(restaurant_id));
create policy orders_owner_write on public.orders for all
  using (public.is_admin() or public.owns_restaurant(restaurant_id))
  with check (public.is_admin() or public.owns_restaurant(restaurant_id));

create policy lines_read on public.order_lines for select
  using (exists (select 1 from public.orders o
                 where o.id = order_id
                   and (public.is_admin() or public.owns_restaurant(o.restaurant_id)
                        or public.is_staff_of(o.restaurant_id))));
create policy lines_owner_write on public.order_lines for all
  using (exists (select 1 from public.orders o
                 where o.id = order_id
                   and (public.is_admin() or public.owns_restaurant(o.restaurant_id))))
  with check (exists (select 1 from public.orders o
                 where o.id = order_id
                   and (public.is_admin() or public.owns_restaurant(o.restaurant_id))));


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 13) مُطلِقات القواعد (Triggers)                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- (أ) عند إنشاء مستخدم في auth.users → أنشئ ملفّاً بدور «merchant».
--     الدور لا يُقرأ من user_metadata (قابل للتلاعب) — يُضبط هنا افتراضياً،
--     ويُرقّى إلى admin/staff من السيرفر فقط.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role) values (new.id, 'merchant')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- (ب) سعر المنتج ≥ تكلفة مكوّناته (المساواة مسموحة) — يُفحص بعد أي تغيير.
create or replace function public.assert_product_margin(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_price numeric; v_cost numeric;
begin
  select p.price,
         coalesce(sum(pp.qty * m.cost), 0)
    into v_price, v_cost
    from public.products p
    left join public.product_parts pp on pp.product_id = p.id
    left join public.materials     m  on m.id = pp.material_id
   where p.id = p_product_id
   group by p.price;

  if v_price is not null and v_cost > v_price then
    raise exception 'PRODUCT_SOLD_AT_LOSS' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.trg_product_margin()
returns trigger language plpgsql as $$
begin
  perform public.assert_product_margin(
    coalesce(new.product_id, old.product_id, new.id, old.id));
  return null;
end;
$$;
create constraint trigger trg_parts_margin
  after insert or update or delete on public.product_parts
  deferrable initially immediate
  for each row execute function public.trg_product_margin();
create constraint trigger trg_price_margin
  after update of price on public.products
  deferrable initially immediate
  for each row execute function public.trg_product_margin();

-- (ج) مزامنة السلع التجارية ↔ منتج آلي قابل للطلب.
create or replace function public.sync_goods_product()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  if tg_op in ('INSERT','UPDATE') and new.kind = 'goods' then
    select id into v_pid from public.products where source_material_id = new.id;
    if v_pid is null then
      insert into public.products (restaurant_id, name, price, category_id, source_material_id)
        values (new.restaurant_id, new.name, new.price, new.category_id, new.id)
        returning id into v_pid;
      insert into public.product_parts (product_id, material_id, qty)
        values (v_pid, new.id, 1);
    else
      update public.products
         set name = new.name, price = new.price, category_id = new.category_id
       where id = v_pid;
    end if;
  elsif tg_op = 'UPDATE' and new.kind = 'raw' and old.kind = 'goods' then
    delete from public.products where source_material_id = new.id;   -- cascade يزيل الجزء
  end if;
  return new;
end;
$$;
create trigger trg_sync_goods after insert or update on public.materials
  for each row execute function public.sync_goods_product();


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 14) دورة حياة الحساب: التجربة / الاشتراك / المراجعة                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- المطعم «مفتوح» للطلبات إن كانت التجربة سارية أو الاشتراك نشِطاً.
create or replace function public.is_restaurant_open(p_rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurants r
     where r.id = p_rid
       and r.status = 'active'
       and (
         (r.account_type = 'trial' and r.trial_ends_at > now())
         or (r.account_type = 'paid'
             and (r.subscription_ends_at is null or r.subscription_ends_at > now()))
       )
  );
$$;

-- بدء تجربة مجّانية 3 أيام (بعد إنشاء الحساب في auth). يستدعيها التاجر المصادَق.
create or replace function public.start_trial(
  p_name text, p_owner_name text, p_phone text)
returns public.restaurants language plpgsql security definer set search_path = public as $$
declare v_email text; v_row public.restaurants;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select email into v_email from auth.users where id = auth.uid();

  insert into public.restaurants
    (owner_id, name, owner_name, phone, email, account_type, status, trial_ends_at)
  values
    (auth.uid(), p_name, p_owner_name, p_phone, v_email,
     'trial', 'active', now() + interval '3 days')
  returning * into v_row;
  return v_row;
end;
$$;

-- تقديم اشتراك مدفوع: ينشئ المطعم (pending) ودفعة (pending) بمبلغ الباقة من app_settings.
create or replace function public.submit_subscription(
  p_name text, p_owner_name text, p_phone text,
  p_plan text, p_reference text, p_receipt_path text default null)
returns public.payments language plpgsql security definer set search_path = public as $$
declare v_email text; v_amount integer; v_rid uuid; v_pay public.payments;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_plan not in ('month','six','life') then raise exception 'BAD_PLAN'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select case p_plan when 'month' then price_month when 'six' then price_six
                     else price_life end
    into v_amount from public.app_settings where id = 1;

  insert into public.restaurants
    (owner_id, name, owner_name, phone, email, account_type, status)
  values
    (auth.uid(), p_name, p_owner_name, p_phone, v_email, 'paid', 'pending')
  returning id into v_rid;

  insert into public.payments
    (restaurant_id, plan, amount, transfer_reference, receipt_path, status, is_renewal)
  values (v_rid, p_plan, v_amount, p_reference, p_receipt_path, 'pending', false)
  returning * into v_pay;
  return v_pay;
end;
$$;

-- تجديد اشتراك قائم (تاجر مصادَق يملك مطعماً).
create or replace function public.submit_renewal(
  p_plan text, p_reference text, p_receipt_path text default null)
returns public.payments language plpgsql security definer set search_path = public as $$
declare v_amount integer; v_rid uuid; v_pay public.payments;
begin
  select id into v_rid from public.restaurants where owner_id = auth.uid();
  if v_rid is null then raise exception 'NO_RESTAURANT'; end if;
  if p_plan not in ('month','six','life') then raise exception 'BAD_PLAN'; end if;
  select case p_plan when 'month' then price_month when 'six' then price_six
                     else price_life end
    into v_amount from public.app_settings where id = 1;

  insert into public.payments
    (restaurant_id, plan, amount, transfer_reference, receipt_path, status, is_renewal)
  values (v_rid, p_plan, v_amount, p_reference, p_receipt_path, 'pending', true)
  returning * into v_pay;
  return v_pay;
end;
$$;

-- مراجعة الدفع (أدمن): تأكيد ⇒ تفعيل + تجديد تراكمي، أو رفض.
create or replace function public.review_subscription_payment(
  p_payment_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay public.payments; v_ivl interval;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY' using errcode='42501'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_pay.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;

  if p_approve then
    update public.payments
       set status='confirmed', reviewed_by=auth.uid(), reviewed_at=now()
     where id = p_payment_id;

    v_ivl := case v_pay.plan when 'month' then interval '1 month'
                             when 'six'   then interval '6 months'
                             else null end;          -- life = بلا انتهاء

    update public.restaurants
       set status = 'active',
           account_type = 'paid',
           -- التجديد تراكمي: البدء المبكر لا يُضيّع الأيام المتبقّية.
           subscription_ends_at = case
             when v_pay.plan = 'life' then null
             else greatest(now(), coalesce(subscription_ends_at, now())) + v_ivl
           end
     where id = v_pay.restaurant_id;
  else
    update public.payments
       set status='rejected', reviewed_by=auth.uid(), reviewed_at=now()
     where id = p_payment_id;
    -- يُرفض فقط إن لم يكن للمطعم اشتراك نشِط سابق.
    update public.restaurants
       set status = 'rejected'
     where id = v_pay.restaurant_id
       and status = 'pending';
  end if;
end;
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 15) قائمة الزبون وإنشاء الطلب (تابلت داخل المحل، بلا حساب)             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- قائمة الطعام العامة لمطعم عبر كوده — تُرجع الأسعار فقط، لا التكاليف ولا المكوّنات.
create or replace function public.get_menu(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  with r as (select id from public.restaurants
              where screen_code = p_code and public.is_restaurant_open(id))
  select coalesce(jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'parent_id', c.parent_id,
        'sauces_enabled', c.sauces_enabled) order by c.name), '[]'::jsonb)
      from public.categories c where c.restaurant_id = (select id from r)),
    'products', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price,
        'category_id', p.category_id) order by p.name), '[]'::jsonb)
      from public.products p where p.restaurant_id = (select id from r))
  ), '{}'::jsonb)
  where exists (select 1 from r);
$$;

-- إنشاء طلب غير مدفوع. لا يمسّ المخزون. يحسب الإجمالي من أسعار السيرفر (لا يثق بالعميل).
-- المدخل: p_lines = [{"product_id":"…","qty":1,"sauces":["كاتشب"]}, …]
create or replace function public.place_order(p_code text, p_lines jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_rid uuid; v_no integer; v_oid uuid; v_total numeric(12,2) := 0;
  v_line jsonb; v_pid uuid; v_qty numeric; v_price numeric; v_name text; v_sauces text[];
begin
  select id into v_rid from public.restaurants where screen_code = p_code;
  if v_rid is null or not public.is_restaurant_open(v_rid) then
    raise exception 'RESTAURANT_CLOSED' using errcode='42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  -- رقم الطلب: عدّاد ذرّي لكل مطعم.
  update public.restaurants set order_seq = order_seq + 1
   where id = v_rid returning order_seq into v_no;

  insert into public.orders (restaurant_id, no, status, total)
    values (v_rid, v_no, 'unpaid', 0) returning id into v_oid;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    v_sauces := coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(v_line->'sauces','[]')) x),
      '{}');
    if v_qty is null or v_qty <= 0 then raise exception 'BAD_QTY'; end if;

    select price, name into v_price, v_name from public.products
      where id = v_pid and restaurant_id = v_rid;      -- المنتج من نفس المطعم فقط
    if v_price is null then raise exception 'BAD_PRODUCT'; end if;

    insert into public.order_lines (order_id, product_id, product_name, qty, sauces, unit_price)
      values (v_oid, v_pid, v_name, v_qty, v_sauces, v_price);
    v_total := v_total + v_price * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_oid;
  return v_no;
end;
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 16) الدالة الذرّية: تأكيد الدفع وخصم المخزون                          ║
-- ║     ← أخطر جزء في النظام. معاملة واحدة، أقفال FOR UPDATE.             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- 1) اقفل الطلب؛ يجب أن يكون unpaid (النقر المزدوج لا يخصم مرّتين — T1.3).
-- 2) اجمع حاجة كل مادة، اقفل صفوفها FOR UPDATE (تسلسل التزامن — T1.1).
-- 3) إن نقصت مادة واحدة، أجهض العملية كلها وأعد اسمها (T1.4/T2.2).
-- 4) اخصم، سجّل الحركة بالتكلفة الحالية، حوّل الطلب إلى cooking.
create or replace function public.confirm_payment(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rid uuid; v_status text; v_short text; r record;
begin
  -- (1) اقفل الطلب واقرأ حالته.
  select restaurant_id, status into v_rid, v_status
    from public.orders where id = p_order_id for update;
  if v_rid is null then raise exception 'ORDER_NOT_FOUND'; end if;

  -- الصلاحية: مالك المطعم أو كاشير الموظّفين أو الأدمن.
  if not (public.is_admin() or public.owns_restaurant(v_rid)
          or public.is_staff_of(v_rid, 'cashier')) then
    raise exception 'NOT_ALLOWED' using errcode='42501';
  end if;

  if v_status <> 'unpaid' then
    raise exception 'ORDER_NOT_PENDING' using errcode='55000';   -- لا خصم مزدوج
  end if;

  -- (2) اقفل كل مواد الطلب بترتيب ثابت (تسلسل التزامن، تفادي الجمود) — T1.1.
  perform 1 from public.materials m
   where m.id in (
     select distinct pp.material_id
       from public.order_lines ol
       join public.product_parts pp on pp.product_id = ol.product_id
      where ol.order_id = p_order_id)
   order by m.id
   for update;

  -- (3) تحقّق من كفاية كل مادة قبل أي خصم — أوّل مادة ناقصة تُجهض العملية كلها (T1.4).
  select m.name into v_short
    from public.order_lines ol
    join public.product_parts pp on pp.product_id = ol.product_id
    join public.materials m on m.id = pp.material_id
   where ol.order_id = p_order_id
   group by m.id, m.name, m.stock
  having m.stock < sum(pp.qty * ol.qty)
   order by m.id
   limit 1;
  if v_short is not null then
    raise exception 'INSUFFICIENT_STOCK:%', v_short using errcode='55000';
  end if;

  -- (4) اخصم + سجّل الحركة بالتكلفة وقت البيع (تُجمّد للتقارير) + حوّل الحالة.
  for r in
    select m.id as mid, m.cost as cost, sum(pp.qty * ol.qty) as need
      from public.order_lines ol
      join public.product_parts pp on pp.product_id = ol.product_id
      join public.materials m on m.id = pp.material_id
     where ol.order_id = p_order_id
     group by m.id, m.cost
  loop
    update public.materials set stock = stock - r.need where id = r.mid;  -- CHECK حارس
    insert into public.stock_movements
      (restaurant_id, material_id, order_id, qty_delta, unit_cost)
      values (v_rid, r.mid, p_order_id, -r.need, r.cost);
  end loop;

  update public.orders
     set status = 'cooking', paid_at = now()
   where id = p_order_id;
end;
$$;

-- المطبخ يسلّم الطلب: cooking → served (مطبخ/مالك/أدمن).
create or replace function public.serve_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_status text;
begin
  select restaurant_id, status into v_rid, v_status
    from public.orders where id = p_order_id for update;
  if v_rid is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (public.is_admin() or public.owns_restaurant(v_rid)
          or public.is_staff_of(v_rid, 'kitchen')) then
    raise exception 'NOT_ALLOWED' using errcode='42501';
  end if;
  if v_status <> 'cooking' then raise exception 'ORDER_NOT_COOKING'; end if;
  update public.orders set status = 'served' where id = p_order_id;
end;
$$;

-- رفض طلب غير مدفوع: unpaid → rejected. لا يمسّ المخزون أبداً (T2.6).
create or replace function public.reject_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_status text;
begin
  select restaurant_id, status into v_rid, v_status
    from public.orders where id = p_order_id for update;
  if v_rid is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (public.is_admin() or public.owns_restaurant(v_rid)
          or public.is_staff_of(v_rid, 'cashier')) then
    raise exception 'NOT_ALLOWED' using errcode='42501';
  end if;
  if v_status <> 'unpaid' then raise exception 'ORDER_NOT_PENDING'; end if;
  update public.orders set status = 'rejected' where id = p_order_id;
end;
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 17) دفع أجور العمّال (رصيد لا يصبح سالباً)                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
create or replace function public.pay_worker(p_worker_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_due numeric;
begin
  select restaurant_id, earned - paid into v_rid, v_due
    from public.workers where id = p_worker_id for update;
  if v_rid is null then raise exception 'WORKER_NOT_FOUND'; end if;
  if not (public.is_admin() or public.owns_restaurant(v_rid)) then
    raise exception 'NOT_ALLOWED' using errcode='42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'BAD_AMOUNT'; end if;
  if p_amount > v_due then raise exception 'OVER_DUE';   -- لا يتجاوز المستحقّ
  end if;

  update public.workers set paid = paid + p_amount where id = p_worker_id;  -- CHECK حارس
  insert into public.wage_payments (restaurant_id, worker_id, amount)
    values (v_rid, p_worker_id, p_amount);
end;
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 18) تقرير الأرباح: المبيعات − تكلفة المواد − الأجور (المدفوع فقط)     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- التكلفة من سجلّ الحركة (مجمّدة وقت البيع) ⇒ تعديل تكلفة مادة لاحقاً لا يغيّر الماضي.
create or replace function public.restaurant_report(
  p_rid uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sales numeric; v_matcost numeric; v_wages numeric;
begin
  if not (public.is_admin() or public.owns_restaurant(p_rid)) then
    raise exception 'NOT_ALLOWED' using errcode='42501';
  end if;

  select coalesce(sum(ol.qty * ol.unit_price), 0) into v_sales
    from public.orders o
    join public.order_lines ol on ol.order_id = o.id
   where o.restaurant_id = p_rid
     and o.status in ('cooking','served')
     and o.paid_at >= p_from and o.paid_at < p_to;

  select coalesce(sum(-sm.qty_delta * sm.unit_cost), 0) into v_matcost
    from public.stock_movements sm
    join public.orders o on o.id = sm.order_id
   where sm.restaurant_id = p_rid
     and o.paid_at >= p_from and o.paid_at < p_to;

  select coalesce(sum(amount), 0) into v_wages
    from public.wage_payments
   where restaurant_id = p_rid and paid_at >= p_from and paid_at < p_to;

  return jsonb_build_object(
    'sales', v_sales, 'material_cost', v_matcost,
    'wages', v_wages, 'profit', v_sales - v_matcost - v_wages);
end;
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 19) المهام المجدولة (تُستدعى من pg_cron — انظر ملف cron)              ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- إلغاء الطلبات غير المدفوعة بعد 15 دقيقة، دون مسّ المخزون (T2.7).
create or replace function public.expire_stale_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.orders set status = 'expired'
   where status = 'unpaid' and created_at < now() - interval '15 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- إنهاء التجارب المنتهية والاشتراكات المنقضية.
create or replace function public.expire_accounts()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.restaurants set status = 'expired'
   where status = 'active'
     and ((account_type = 'trial' and trial_ends_at <= now())
       or (account_type = 'paid'  and subscription_ends_at is not null
                                   and subscription_ends_at <= now()));
  get diagnostics n = row_count;
  return n;
end;
$$;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 20) الصلاحيات على الدوال (anon مقابل authenticated)                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- الزبون (anon): قراءة القائمة وإنشاء الطلب فقط.
grant execute on function public.get_menu(text)               to anon, authenticated;
grant execute on function public.place_order(text, jsonb)     to anon, authenticated;

-- عمليات تتطلّب مصادقة (مالك/موظّف/أدمن) — لا تُمنح لـ anon.
revoke execute on function public.confirm_payment(uuid)                       from public, anon;
revoke execute on function public.serve_order(uuid)                           from public, anon;
revoke execute on function public.reject_order(uuid)                          from public, anon;
revoke execute on function public.pay_worker(uuid, numeric)                   from public, anon;
revoke execute on function public.start_trial(text,text,text)                 from public, anon;
revoke execute on function public.submit_subscription(text,text,text,text,text,text) from public, anon;
revoke execute on function public.submit_renewal(text,text,text)              from public, anon;
revoke execute on function public.review_subscription_payment(uuid, boolean)  from public, anon;
revoke execute on function public.restaurant_report(uuid,timestamptz,timestamptz) from public, anon;
grant  execute on function public.confirm_payment(uuid)                       to authenticated;
grant  execute on function public.serve_order(uuid)                           to authenticated;
grant  execute on function public.reject_order(uuid)                          to authenticated;
grant  execute on function public.pay_worker(uuid, numeric)                   to authenticated;
grant  execute on function public.start_trial(text,text,text)                 to authenticated;
grant  execute on function public.submit_subscription(text,text,text,text,text,text) to authenticated;
grant  execute on function public.submit_renewal(text,text,text)              to authenticated;
grant  execute on function public.review_subscription_payment(uuid, boolean)  to authenticated;
grant  execute on function public.restaurant_report(uuid,timestamptz,timestamptz) to authenticated;

-- المهام المجدولة تعمل بدور المجدوِل فقط.
revoke execute on function public.expire_stale_orders() from public, anon, authenticated;
revoke execute on function public.expire_accounts()     from public, anon, authenticated;

-- صلاحيات الجداول: RLS هو البوّابة الحقيقية. المستخدم المصادَق يملك DML على كل
-- الجداول لكن RLS يُرشّح الصفوف؛ أما anon فلا يقرأ سوى الإعدادات العامة.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.app_settings from anon;
grant  select on public.app_settings to anon;   -- السعر وRIP لصفحة الاشتراك فقط

-- ══════════════════════════════════════════════════════════════════════════
--  نهاية المخطّط.
-- ══════════════════════════════════════════════════════════════════════════

-- ▼▼▼ 2) تخزين وصولات الدفع ▼▼▼
-- ══════════════════════════════════════════════════════════════════════════
--  تخزين وصولات الدفع — دلو خاص + سياسات صارمة (يُشغَّل على Supabase).
--  الرفع الفعلي يمرّ عبر Edge Function «upload-receipt» التي:
--    • تمنع SVG وتفحص البايتات الأولى (لا الامتداد).
--    • تعيد ترميز الصورة (تقتل أي حمولة مدسوسة).
--    • تستبدل الاسم بـ UUID، وتخزّن بـ service_role (سيرفر فقط).
--  هذه السياسات حاجز إضافي: لا كتابة عامة، والقراءة عبر روابط موقّعة مؤقّتة.
-- ══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- لا سياسات عامة (anon) على الإطلاق ⇒ الدلو غير مقروء علناً.

-- الأدمن يقرأ كل الوصولات (لمراجعة الدفع) — عادةً عبر رابط موقّع مؤقّت.
drop policy if exists receipts_admin_read on storage.objects;
create policy receipts_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin());

-- المالك يقرأ وصولاته هو فقط: المسار receipts/<owner_uid>/<uuid>.jpg
drop policy if exists receipts_owner_read on storage.objects;
create policy receipts_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ملاحظة: لا سياسة INSERT/UPDATE/DELETE للعميل هنا عمداً — الكتابة تتمّ من
-- الـ Edge Function بـ service_role (سيرفر). هكذا لا يرفع أحد ملفاً خاماً مباشرة.

-- ▼▼▼ 3) المهام المجدولة (إلغاء الطلبات/التجارب المنتهية) ▼▼▼
-- ══════════════════════════════════════════════════════════════════════════
--  المهام المجدولة (pg_cron) — تُشغَّل على Supabase.
--  • إلغاء الطلبات غير المدفوعة بعد 15 دقيقة (كل دقيقة).
--  • إنهاء التجارب المنتهية والاشتراكات المنقضية (كل 10 دقائق).
--  الوقت من السيرفر دائماً (now()) — لا يتأثّر بساعة جهاز المستخدم.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- أزل الجدولة القديمة إن وُجدت (تشغيل الملف أكثر من مرّة آمن).
do $$
begin
  perform cron.unschedule('flashordo_expire_orders');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('flashordo_expire_accounts');
exception when others then null;
end $$;

select cron.schedule('flashordo_expire_orders',   '* * * * *',
                     $$ select public.expire_stale_orders(); $$);
select cron.schedule('flashordo_expire_accounts', '*/10 * * * *',
                     $$ select public.expire_accounts(); $$);
