#!/usr/bin/env bash
# T1.1 — طلبان متزامنان على آخر وحدة: واحد ينجح، الآخر يفشل بنقص المخزون.
# يتطلّب جلستين حقيقيتين متوازيتين (SELECT ... FOR UPDATE يُسلسلهما).
set -euo pipefail
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5433} PGUSER=${PGUSER:-postgres}
DB=${DB:-fo_conc}
HERE="$(cd "$(dirname "$0")/../.." && pwd)"

psql -q -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null 2>&1
psql -q -d "$DB" -c "create extension if not exists pgtap;" >/dev/null 2>&1
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/supabase/tests/00_supabase_shim.sql" >/dev/null 2>&1
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/supabase/migrations/20260804120000_flashordo_init.sql" >/dev/null 2>&1

# بذرة مصغّرة: مادة بوحدة واحدة، منتج يستهلكها، وطلبان unpaid يحتاج كلٌّ منهما 1 كغ.
psql -q -d "$DB" >/dev/null <<'SQL'
alter table public.profiles disable trigger trg_guard_profile;
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','o@x.com');
insert into public.restaurants (id,owner_id,name,owner_name,phone,email,account_type,status,trial_ends_at)
 values ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',
         'مطعم','مالك','0661234578','o@x.com','trial','active', now()+interval '3 days');
alter table public.profiles enable trigger trg_guard_profile;
insert into public.materials (id,restaurant_id,name,unit,cost,stock,kind)
 values ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','صدر دجاج','كغ',500,1.000,'raw');
insert into public.products (id,restaurant_id,name,price)
 values ('22222222-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','دجاج',900);
insert into public.product_parts (product_id,material_id,qty)
 values ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001',1);
insert into public.orders (id,restaurant_id,no,status,total) values
 ('dd000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-000000000001',1,'unpaid',900),
 ('dd000000-0000-0000-0000-0000000000a2','a0000000-0000-0000-0000-000000000001',2,'unpaid',900);
insert into public.order_lines (order_id,product_id,qty,unit_price) values
 ('dd000000-0000-0000-0000-0000000000a1','22222222-0000-0000-0000-000000000001',1,900),
 ('dd000000-0000-0000-0000-0000000000a2','22222222-0000-0000-0000-000000000001',1,900);
SQL

# تأكيد ضمن معاملة تُمسك القفل ~1.5s قبل الإفلات، لضمان تداخل الجلستين فعلياً.
run_confirm () {
  local oid="$1" out
  out=$(psql -d "$DB" -Atq -v ON_ERROR_STOP=1 2>&1 <<SQL || true
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',false);
begin;
select public.confirm_payment('$oid');
select pg_sleep(1.5);
commit;
select 'DONE';
SQL
)
  if echo "$out" | grep -q "DONE"; then echo "SUCCESS"
  else echo "FAIL:$(echo "$out" | grep -oE 'INSUFFICIENT_STOCK[^ ]*' | head -1)"; fi
}

tmp1=$(mktemp); tmp2=$(mktemp)
( run_confirm 'dd000000-0000-0000-0000-0000000000a1' >"$tmp1" ) &
( run_confirm 'dd000000-0000-0000-0000-0000000000a2' >"$tmp2" ) &
wait
R1=$(cat "$tmp1"); R2=$(cat "$tmp2"); rm -f "$tmp1" "$tmp2"
echo "session1: $R1"
echo "session2: $R2"

STOCK=$(psql -d "$DB" -Atq -c "select stock from public.materials where id='11111111-0000-0000-0000-000000000001';")
COOKING=$(psql -d "$DB" -Atq -c "select count(*) from public.orders where status='cooking';")
echo "final stock: $STOCK ; cooking orders: $COOKING"

succ=$(printf '%s\n%s\n' "$R1" "$R2" | grep -c "SUCCESS" || true)
fail=$(printf '%s\n%s\n' "$R1" "$R2" | grep -c "FAIL"    || true)
psql -q -c "drop database if exists $DB;" >/dev/null 2>&1
if [ "$succ" = "1" ] && [ "$fail" = "1" ] && [ "$STOCK" = "0.000" ] && [ "$COOKING" = "1" ]; then
  echo "T1.1 PASS — واحد نجح، الآخر فشل بنقص المخزون، المخزون=0، طلب واحد للمطبخ."
  exit 0
else
  echo "T1.1 FAIL — succ=$succ fail=$fail stock=$STOCK cooking=$COOKING"; exit 1
fi
