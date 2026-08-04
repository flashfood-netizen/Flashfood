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
