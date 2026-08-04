// عميل Supabase — مفتاح anon فقط. ممنوع service_role في الواجهة إطلاقاً.
// المفاتيح تأتي من متغيّرات البيئة (.env.local) ولا تُكتب في الكود ولا تُرفع لـ GitHub.
import { createClient } from "@supabase/supabase-js";

const url  = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // رسالة تطوير فقط — لا تكشف شيئاً حسّاساً.
  console.warn("Supabase env vars missing: set VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env.local");
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
