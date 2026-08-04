// Edge Function: upload-receipt
// رفع آمن لوصل الدفع — ينفّذ بند الأمان الأخطر (CLAUDE.md §1، TESTS §4.1):
//   1) امنع SVG نهائياً؛ اقبل jpg/png/webp فقط.
//   2) افحص البايتات الأولى (magic bytes) لا الامتداد.
//   3) أعد ترميز الصورة على السيرفر — يقتل أي حمولة مدسوسة.
//   4) استبدل الاسم بـ UUID (لا ../ ولا اسم من المستخدم).
//   5) دلو خاص، والكتابة بـ service_role هنا فقط (سيرفر — لا تظهر في الواجهة).
//
// النشر: supabase functions deploy upload-receipt
// السرّان يأتيان من بيئة Supabase تلقائياً (لا تكتبهما في أي ملف):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — يُرفض ما فوقه (T4.1)

// فحص البايتات الأولى: jpg=FFD8FF، png=89504E47، webp=RIFF....WEBP
function sniff(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null; // SVG/HTML/أي شيء آخر ⇒ مرفوض
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ code: "METHOD" }, 405);

  // هوية المُرسِل من التوكن (يجب أن يكون تاجراً مصادَقاً).
  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await anon.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ code: "AUTH" }, 401);

  // اقرأ الملف من multipart/form-data.
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ code: "NO_FILE" }, 400);
  if (file.size > MAX_BYTES) return json({ code: "TOO_LARGE" }, 413);

  const raw = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(raw);
  if (!kind) return json({ code: "BAD_TYPE" }, 415); // يشمل رفض SVG

  // أعد الترميز: فكّ الصورة إلى بكسل ثم أخرِج JPEG جديداً — أي حمولة مدسوسة تموت.
  let out: Uint8Array;
  try {
    const img = (await decode(raw)) as Image;
    out = await img.encodeJPEG(85);
  } catch {
    return json({ code: "DECODE_FAILED" }, 422);
  }

  const objectPath = `${user.id}/${crypto.randomUUID()}.jpg`; // UUID، لا اسم المستخدم
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.storage
    .from("receipts")
    .upload(objectPath, out, { contentType: "image/jpeg", upsert: false });
  if (error) return json({ code: "STORE_FAILED" }, 500);

  // نعيد المسار فقط (لا رابطاً عاماً). المراجعة تُنشئ رابطاً موقّعاً مؤقّتاً.
  return json({ path: objectPath });
});
