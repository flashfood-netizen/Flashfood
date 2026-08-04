// ══════════════════════════════════════════════════════════════════════════
//  طبقة الربط بين الواجهة و Supabase — كل عمليات الـ backend كدوال جاهزة.
//  المبدأ: الواجهة تنادي هذه الدوال فقط؛ الحماية الحقيقية في RLS ودوال القاعدة.
//  رسائل الخطأ تُترجَم برموز موحّدة (safeError) — لا يُعرض نصّ Postgres الخام.
// ══════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabaseClient";

/* ── ترجمة الأخطاء إلى رسائل عربية موحّدة (بند «تسريب الأخطاء» T4.5) ── */
const MESSAGES: Record<string, string> = {
  // مصادقة
  invalid_login_credentials: "البريد الإلكتروني أو كلمة السر غير صحيحة.",
  email_exists:              "هذا البريد مسجّل بالفعل.",
  user_already_registered:   "هذا البريد مسجّل بالفعل.",
  over_email_send_rate_limit:"محاولات كثيرة، أعد المحاولة بعد قليل.",
  // دوال القاعدة
  AUTH_REQUIRED:  "يلزم تسجيل الدخول.",
  NOT_ALLOWED:    "لا تملك صلاحية هذه العملية.",
  ADMIN_ONLY:     "هذه العملية للمالك فقط.",
  RESTAURANT_CLOSED: "المطعم غير متاح للطلب حالياً.",
  ORDER_NOT_PENDING: "تغيّرت حالة الطلب، حدّث الصفحة.",
  ORDER_NOT_COOKING: "الطلب ليس قيد التحضير.",
  ORDER_NOT_FOUND:   "الطلب غير موجود.",
  OVER_DUE:       "المبلغ يتجاوز المستحقّ للعامل.",
  BAD_AMOUNT:     "أدخل مبلغاً صحيحاً.",
  EMPTY_ORDER:    "الطلب فارغ.",
  BAD_PRODUCT:    "منتج غير صالح.",
  BAD_QTY:        "كمية غير صالحة.",
  PAYMENT_NOT_FOUND: "الدفعة غير موجودة.",
  ALREADY_REVIEWED:  "روجعت هذه الدفعة من قبل.",
  NO_RESTAURANT:  "لا يوجد مطعم مرتبط بحسابك.",
  PRIVILEGE_LOCKED:  "لا يمكن تغيير هذه الصلاحية.",
  // قيود
  "23505": "قيمة مكرّرة (البريد أو الهاتف مستعمل).",
  "23514": "قيمة مرفوضة حسب قواعد النظام.",
  "42501": "لا تملك صلاحية هذه العملية.",
};

export function safeError(err: unknown): string {
  const raw =
    (err as any)?.code ??
    (err as any)?.message ??
    String(err ?? "");
  const s = String(raw);
  // INSUFFICIENT_STOCK:اسم المادة
  if (s.includes("INSUFFICIENT_STOCK")) {
    const name = s.split(":")[1]?.trim();
    return name ? `المخزون لا يكفي: ${name}.` : "المخزون لا يكفي لتمرير الطلب.";
  }
  for (const key of Object.keys(MESSAGES)) if (s.includes(key)) return MESSAGES[key];
  return "حدث خطأ ما، أعد المحاولة.";
}

function unwrap<T>({ data, error }: { data: T; error: any }): T {
  if (error) throw new Error(safeError(error));
  return data;
}

/* ════════════════════ المصادقة ════════════════════ */
export const auth = {
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(safeError(error));
    return data.user;
  },
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(safeError(error));
    return data.user;
  },
  async signOut() {
    await supabase.auth.signOut();
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  },
  async session() {
    return (await supabase.auth.getSession()).data.session;
  },
  /** الدور من جدول profiles (لا من user_metadata القابل للتلاعب). */
  async myProfile() {
    const s = await this.session();
    if (!s) return null;
    const { data, error } = await supabase
      .from("profiles").select("id, role, restaurant_id, screen").eq("id", s.user.id).single();
    if (error) throw new Error(safeError(error));
    return data as { id: string; role: "admin"|"merchant"|"staff"; restaurant_id: string|null; screen: string|null };
  },
};

/* ════════════════════ الاشتراك ودورة الحساب ════════════════════ */
export const account = {
  startTrial: (name: string, ownerName: string, phone: string) =>
    supabase.rpc("start_trial", { p_name: name, p_owner_name: ownerName, p_phone: phone }).then(unwrap),

  submitSubscription: (name: string, ownerName: string, phone: string,
                       plan: "month"|"six"|"life", reference: string, receiptPath: string|null) =>
    supabase.rpc("submit_subscription", {
      p_name: name, p_owner_name: ownerName, p_phone: phone,
      p_plan: plan, p_reference: reference, p_receipt_path: receiptPath,
    }).then(unwrap),

  submitRenewal: (plan: "month"|"six"|"life", reference: string, receiptPath: string|null) =>
    supabase.rpc("submit_renewal", { p_plan: plan, p_reference: reference, p_receipt_path: receiptPath }).then(unwrap),

  myRestaurant: () =>
    supabase.from("restaurants").select("*").maybeSingle().then(unwrap),
};

/* ════════════════════ لوحة الأدمن ════════════════════ */
export const admin = {
  requests: () =>
    supabase.from("payments").select("*, restaurants(name, owner_name, phone, email)")
      .order("created_at", { ascending: false }).then(unwrap),
  shops: () =>
    supabase.from("restaurants").select("*").order("created_at", { ascending: false }).then(unwrap),
  reviewPayment: (paymentId: string, approve: boolean) =>
    supabase.rpc("review_subscription_payment", { p_payment_id: paymentId, p_approve: approve }).then(unwrap),
  settings: () => supabase.from("app_settings").select("*").eq("id", 1).single().then(unwrap),
  saveSettings: (rip: string, month: number, six: number, life: number) =>
    supabase.from("app_settings").update({
      rip_account: rip, price_month: month, price_six: six, price_life: life, updated_at: new Date().toISOString(),
    }).eq("id", 1).then(unwrap),
  // رابط موقّع مؤقّت لوصل الدفع (دقائق معدودة).
  receiptUrl: async (path: string) => {
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 120);
    if (error) throw new Error(safeError(error));
    return data.signedUrl;
  },
};

/* ════════════════════ لوحة التاجر — مخزون/منتجات/عمّال ════════════════════ */
export const merchant = {
  materials: (rid: string) =>
    supabase.from("materials").select("*").eq("restaurant_id", rid).order("created_at").then(unwrap),
  addMaterial: (m: any) => supabase.from("materials").insert(m).select().single().then(unwrap),
  updateMaterial: (id: string, patch: any) =>
    supabase.from("materials").update(patch).eq("id", id).select().single().then(unwrap),

  categories: (rid: string) =>
    supabase.from("categories").select("*").eq("restaurant_id", rid).order("name").then(unwrap),
  addCategory: (c: any) => supabase.from("categories").insert(c).select().single().then(unwrap),
  deleteCategory: (id: string) => supabase.from("categories").delete().eq("id", id).then(unwrap),

  products: (rid: string) =>
    supabase.from("products").select("*, product_parts(material_id, qty)")
      .eq("restaurant_id", rid).order("created_at").then(unwrap),
  // حفظ منتج + مكوّناته (القاعدة تفرض سعر البيع ≥ التكلفة عبر مُطلِق).
  async addProduct(p: { restaurant_id: string; name: string; price: number; category_id: string|null;
                        parts: { material_id: string; qty: number }[] }) {
    const prod = await supabase.from("products")
      .insert({ restaurant_id: p.restaurant_id, name: p.name, price: p.price, category_id: p.category_id })
      .select().single();
    if (prod.error) throw new Error(safeError(prod.error));
    const rows = p.parts.map((x) => ({ product_id: prod.data.id, material_id: x.material_id, qty: x.qty }));
    const { error } = await supabase.from("product_parts").insert(rows);
    if (error) { await supabase.from("products").delete().eq("id", prod.data.id); throw new Error(safeError(error)); }
    return prod.data;
  },

  workers: (rid: string) =>
    supabase.from("workers").select("*").eq("restaurant_id", rid).order("created_at").then(unwrap),
  addWorker: (w: any) => supabase.from("workers").insert(w).select().single().then(unwrap),
  payWorker: (workerId: string, amount: number) =>
    supabase.rpc("pay_worker", { p_worker_id: workerId, p_amount: amount }).then(unwrap),

  report: (rid: string, from: string, to: string) =>
    supabase.rpc("restaurant_report", { p_rid: rid, p_from: from, p_to: to }).then(unwrap),

  // إنشاء حساب كاشير/مطبخ (يمرّ عبر Edge Function — service_role على السيرفر فقط).
  async createStaff(email: string, password: string, screen: "cashier"|"kitchen") {
    const s = await auth.session();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${s?.access_token ?? ""}` },
      body: JSON.stringify({ email, password, screen }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(safeError(out?.code ?? "خطأ"));
    return out;
  },

  // رفع وصل آمن (فحص + إعادة ترميز + UUID) — يُرجع المسار لتخزينه في الدفعة.
  async uploadReceipt(file: File) {
    const s = await auth.session();
    const form = new FormData(); form.append("file", file);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-receipt`, {
      method: "POST", headers: { Authorization: `Bearer ${s?.access_token ?? ""}` }, body: form,
    });
    const out = await res.json();
    if (!res.ok) throw new Error(safeError(out?.code ?? "فشل رفع الوصل"));
    return out.path as string;
  },
};

/* ════════════════════ الشاشات (زبون/كاشير/مطبخ) ════════════════════ */
export const screens = {
  // الزبون (تابلت، بلا حساب): القائمة والطلب بكود المطعم.
  menu: (code: string) => supabase.rpc("get_menu", { p_code: code }).then(unwrap),
  placeOrder: (code: string, lines: { product_id: string; qty: number; sauces: string[] }[]) =>
    supabase.rpc("place_order", { p_code: code, p_lines: lines }).then(unwrap),

  // طلبات مطعم الموظّف (RLS يقصرها على مطعمه).
  orders: (rid: string, statuses: string[]) =>
    supabase.from("orders").select("*, order_lines(*)")
      .eq("restaurant_id", rid).in("status", statuses).order("created_at").then(unwrap),

  confirmPayment: (orderId: string) => supabase.rpc("confirm_payment", { p_order_id: orderId }).then(unwrap),
  serveOrder:     (orderId: string) => supabase.rpc("serve_order",     { p_order_id: orderId }).then(unwrap),
  rejectOrder:    (orderId: string) => supabase.rpc("reject_order",    { p_order_id: orderId }).then(unwrap),
};

export const api = { auth, account, admin, merchant, screens, safeError };
export default api;
