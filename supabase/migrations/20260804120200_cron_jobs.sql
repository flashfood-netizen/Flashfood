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
