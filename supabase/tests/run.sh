#!/usr/bin/env bash
# مشغّل اختبارات القاعدة محلّياً (يحاكي بيئة Supabase عبر شِيم صغير).
# المتطلّبات: postgresql-16 + postgresql-16-pgtap + pg_prove (اختياري).
# التشغيل:  supabase/tests/run.sh
set -euo pipefail
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5433} PGUSER=${PGUSER:-postgres}
DB=${DB:-fo}
HERE="$(cd "$(dirname "$0")/../.." && pwd)"

echo "▶ تجهيز قاعدة نظيفة…"
psql -q -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null 2>&1 | true
psql -q -d "$DB" -c "create extension if not exists pgtap;" >/dev/null
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/supabase/tests/00_supabase_shim.sql" >/dev/null
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/supabase/migrations/20260804120000_flashordo_init.sql" >/dev/null
echo "  الهجرة طُبّقت بلا أخطاء."

echo "▶ فحص §8: كل جدول عليه RLS مفعّل…"
NORLS=$(psql -d "$DB" -Atq -c "select string_agg(relname,', ') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;")
[ -z "$NORLS" ] && echo "  ✓ لا جدول بلا RLS." || { echo "  ✗ جداول بلا RLS: $NORLS"; exit 1; }

echo "▶ pgTAP — §1‑3، §6:"
psql -d "$DB" -Atq -f "$HERE/supabase/tests/10_rules_test.sql" | grep -E "^(ok|not ok|1\.\.)" || true
FAIL=$(psql -d "$DB" -Atq -f "$HERE/supabase/tests/10_rules_test.sql" | grep -cE "^not ok " || true)

echo "▶ التزامن الحقيقي — T1.1:"
bash "$HERE/supabase/tests/20_concurrency_test.sh" | grep -E "T1.1|session" || true
CFAIL=${PIPESTATUS[0]:-0}

echo "──────────────────────────────"
if [ "$FAIL" = "0" ]; then echo "pgTAP: كل الاختبارات خضراء ✓"; else echo "pgTAP: $FAIL فشل ✗"; exit 1; fi
psql -q -c "drop database if exists $DB;" >/dev/null 2>&1 | true
