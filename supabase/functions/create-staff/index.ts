// Edge Function: create-staff
// المالك وحده يُنشئ حساب كاشير/مطبخ بكلمة سرّ يعطيها للموظّف.
// الموظّف: يرى الطلبات فقط، لا يبلغ لوحة الإدارة أبداً، ولا يغيّر كلمته (لا نكشف له ذلك).
// كلمة السرّ يضبطها المالك هنا؛ service_role يُستعمل على السيرفر فقط (ممنوع في الواجهة).
//
// النشر: supabase functions deploy create-staff
// الطلب (من لوحة التاجر، بتوكن التاجر):
//   POST { email, password, screen: "cashier" | "kitchen" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

// كلمة السرّ: 8 فأكثر، حروف وأرقام، بلا مسافات (نفس قاعدة الواجهة).
const strongPassword = (p: string) =>
  typeof p === "string" && p.length >= 8 && /[A-Za-zء-ي]/.test(p) &&
  /\d/.test(p) && !/\s/.test(p);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ code: "METHOD" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;

  // (1) هوية الطالب — يجب أن يكون تاجراً يملك مطعماً.
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: u } = await anon.auth.getUser();
  const owner = u?.user;
  if (!owner) return json({ code: "AUTH" }, 401);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const screen = String(body?.screen ?? "");
  if (!["cashier", "kitchen"].includes(screen)) return json({ code: "BAD_SCREEN" }, 400);
  if (!strongPassword(password)) return json({ code: "WEAK_PASSWORD" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // (2) تأكّد أن الطالب تاجر يملك مطعماً، واحصل على معرّف مطعمه.
  const { data: prof } = await admin.from("profiles").select("role").eq("id", owner.id).single();
  if (prof?.role !== "merchant") return json({ code: "NOT_MERCHANT" }, 403);
  const { data: rest } = await admin.from("restaurants").select("id").eq("owner_id", owner.id).single();
  if (!rest) return json({ code: "NO_RESTAURANT" }, 403);

  // (3) أنشئ حساب الموظّف (مؤكّد فوراً) — كلمة السرّ من المالك.
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created?.user) return json({ code: "CREATE_FAILED", detail: cErr?.message }, 400);

  // (4) اضبط الدور والشاشة والمطعم من السيرفر (لا من user_metadata القابل للتلاعب).
  const { error: pErr } = await admin.from("profiles")
    .update({ role: "staff", restaurant_id: rest.id, screen })
    .eq("id", created.user.id);
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id); // تراجع
    return json({ code: "PROFILE_FAILED" }, 500);
  }

  return json({ ok: true, staff_id: created.user.id, screen });
});
