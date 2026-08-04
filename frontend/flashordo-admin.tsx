import React, { useState, useEffect, useMemo, useRef } from "react";

/* ══════════════════════════════════════════════════════════════
   لوحة المالك — Flashordo
   واجهة فقط. كل موضع يحتاج نداءً حقيقياً على Supabase موسوم بـ TODO.
   ══════════════════════════════════════════════════════════════ */

/* ── إعدادات المنصة (جدول app_settings — قراءة عامة، كتابة للأدمن) ── */
const INITIAL_SETTINGS = {
  rip: "007799999002070490038",
  priceMonth: 1700,
  priceSix: 6800,
  priceLife: 14990,
};

const PLAN_LABEL = { month: "شهر", six: "6 أشهر", life: "مدى الحياة" };

/* ── بيانات تجريبية للعرض ── */
const SEED_REQUESTS = [
  { id: "r1", kind: "paid", restaurant: "مطعم النخيل", owner: "محمد الأمين قدور", phone: "0661234578",
    email: "nakhil.rest@gmail.com", plan: "six", amount: 6800, ref: "4471203398",
    sentAt: "2026-08-02T10:14:00", status: "pending", renewal: false },
  { id: "r2", kind: "paid", restaurant: "بيتزا روما", owner: "سفيان بلحاج", phone: "0771902244",
    email: "roma.pizza.dz@gmail.com", plan: "month", amount: 1700, ref: "9930112847",
    sentAt: "2026-08-02T08:41:00", status: "pending", renewal: true },
  { id: "r3", kind: "trial", restaurant: "سناك الوئام", owner: "ياسين مرابط", phone: "0551088712",
    email: "wiam.snack@gmail.com", sentAt: "2026-08-01T19:05:00", status: "trial" },
  { id: "r4", kind: "paid", restaurant: "مشويات الأطلس", owner: "كريم بوعلام", phone: "0698451203",
    email: "atlas.grill@gmail.com", plan: "life", amount: 14990, ref: "5580019923",
    sentAt: "2026-07-31T14:22:00", status: "confirmed", renewal: false },
  { id: "r5", kind: "paid", restaurant: "كافيتيريا الأمل", owner: "نبيل شريف", phone: "0770334411",
    email: "amal.cafe@gmail.com", plan: "month", amount: 1700, ref: "1122",
    sentAt: "2026-07-30T09:10:00", status: "rejected", renewal: false },
];

const SEED_SHOPS = [
  { id: "s1", kind: "paid", restaurant: "مشويات الأطلس", owner: "كريم بوعلام", phone: "0698451203",
    email: "atlas.grill@gmail.com", plan: "life", joined: "2026-07-31", ends: null },
  { id: "s2", kind: "paid", restaurant: "مطعم الياسمين", owner: "أمينة حداد", phone: "0664120987",
    email: "yasmin.rest@gmail.com", plan: "six", joined: "2026-03-12", ends: "2026-09-12" },
  { id: "s3", kind: "paid", restaurant: "برغر هاوس", owner: "رضا زياني", phone: "0559871200",
    email: "burger.house.dz@gmail.com", plan: "month", joined: "2026-07-09", ends: "2026-08-09" },
  { id: "s4", kind: "paid", restaurant: "مطعم الصحراء", owner: "عبد الرحمن ولد علي", phone: "0772008841",
    email: "sahara.food@gmail.com", plan: "month", joined: "2026-07-06", ends: "2026-08-06" },
  { id: "s5", kind: "trial", restaurant: "سناك الوئام", owner: "ياسين مرابط", phone: "0551088712",
    email: "wiam.snack@gmail.com", joined: "2026-08-01", ends: "2026-08-04" },
  { id: "s6", kind: "trial", restaurant: "بيت الكسكسي", owner: "فاطمة بن ناصر", phone: "0665003377",
    email: "couscous.house@gmail.com", joined: "2026-08-02", ends: "2026-08-05" },
];

const SEED_REVENUE = {
  day: { total: 8500, fresh: 1, renew: 2, daily: [["اليوم", 8500]],
    byPlan: { month: 1700, six: 6800, life: 0 } },
  week: { total: 32290, fresh: 4, renew: 3, byPlan: { month: 5100, six: 13600, life: 13590 },
    daily: [["سبت", 1700], ["أحد", 0], ["إثن", 6800], ["ثلا", 1700], ["أرب", 13590], ["خمي", 0], ["جمع", 8500]] },
  month: { total: 96470, fresh: 12, renew: 9, byPlan: { month: 20400, six: 27200, life: 48870 },
    daily: [["أسبوع 1", 18700], ["أسبوع 2", 25480], ["أسبوع 3", 20000], ["أسبوع 4", 32290]] },
  year: { total: 742300, fresh: 88, renew: 61, byPlan: { month: 178500, six: 258800, life: 305000 },
    daily: [["ج1", 121400], ["ج2", 168200], ["ج3", 210500], ["ج4", 242200]] },
};

const money = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/* ── التحقّق من مدخلات الدخول ── */
const EMAIL_OK = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
const checkEmail = (v) => {
  const s = v.trim();
  if (!s) return "البريد الإلكتروني مطلوب";
  if (s.length > 254 || !EMAIL_OK.test(s)) return "أدخل بريداً إلكترونياً صحيحاً";
  return "";
};
const checkPassword = (v) => {
  if (!v) return "كلمة السر مطلوبة";
  if (v.length < 8) return "كلمة السر لا تقل عن 8 رموز";
  if (!/[a-zA-Z]/.test(v) || !/\d/.test(v)) return "كلمة السر تجمع بين حروف وأرقام";
  if (/\s/.test(v)) return "كلمة السر بدون مسافات";
  return "";
};

/* ────────────────────────────  الأنماط  ──────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@500;600;700;800&family=Alexandria:wght@300;400;500;600&display=swap');

.ad *, .ad *::before, .ad *::after { box-sizing:border-box; }
.ad {
  --night:#14213D; --bolt:#FFB703; --flame:#FB5607; --good:#12805C;
  --bg:#F6F8FC; --card:#FFFFFF; --mute:#68738C; --hair:#E4E9F2;
  direction:rtl; min-height:100vh; background:var(--bg); color:var(--night);
  font-family:'Alexandria', system-ui, sans-serif; font-size:15px; line-height:1.8;
  font-weight:300; -webkit-font-smoothing:antialiased;
}
.ad h1,.ad h2,.ad h3 { font-family:'Baloo Bhaijaan 2', system-ui, sans-serif; font-weight:700; line-height:1.45; margin:0; }
.ad p { margin:0; }
.ad button { font:inherit; color:inherit; cursor:pointer; border:none; background:none; }
.ad :focus-visible { outline:3px solid var(--bolt); outline-offset:3px; border-radius:8px; }
.ad .ltr { direction:ltr; unicode-bidi:isolate; display:inline-block; }

.ad .wrap { max-width:560px; margin:0 auto; padding:0 20px 80px; }
.ad .fade { animation:rise .3s ease both; }
@keyframes rise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }

/* الشعار */
  font-weight:800; letter-spacing:-.02em; line-height:1; direction:ltr; unicode-bidi:isolate; }

/* ── صفحة الدخول ── */
.ad .gate { max-width:380px; margin:0 auto; text-align:center; padding-top:70px; }
.ad .adminword { display:inline-block; margin-top:14px; font-size:12.5px; letter-spacing:.3em;
  color:var(--mute); background:#EAEFF7; padding:5px 18px; border-radius:99px;
  direction:ltr; unicode-bidi:isolate; }
.ad .gate h1 { font-size:24px; margin-top:22px; }
.ad .gate .sub { color:var(--mute); font-size:14.5px; margin-top:6px; }

/* الحقول */
.ad .field { margin-top:20px; text-align:right; }
.ad label { display:block; font-size:14.5px; font-weight:500; margin-bottom:7px; }
.ad .inbox { position:relative; }
.ad input, .ad .search input { width:100%; padding:13px 16px; border:none; border-radius:14px;
  background:var(--card); box-shadow:inset 0 0 0 1.5px var(--hair); color:var(--night);
  font:inherit; font-weight:400; font-size:15px; transition:box-shadow .18s ease; }
.ad input::placeholder { color:#A9B3C7; font-weight:300; }
.ad input:focus { outline:none; box-shadow:inset 0 0 0 2px var(--night); }
.ad input.bad { box-shadow:inset 0 0 0 2px var(--flame); }
.ad input:disabled { opacity:.55; }
.ad .haseye input { padding-inline-start:48px; }
.ad .eye { position:absolute; inset-inline-start:8px; top:50%; transform:translateY(-50%);
  padding:9px; color:var(--mute); border-radius:10px; }
.ad .err { font-size:13px; color:var(--flame); font-weight:500; margin-top:7px; }
.ad .hint { font-size:13px; color:var(--mute); margin-top:7px; }

.ad .alert { margin-top:20px; border-radius:14px; padding:12px 16px; font-size:14px; text-align:right; }
.ad .alert.bad { background:#FFE8DC; color:#B33C05; }
.ad .alert.net { background:#FFF4D6; color:#8A6212; }

.ad .btn { display:block; width:100%; text-align:center; padding:16px 22px; border-radius:16px;
  font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:17px; transition:transform .12s ease, opacity .2s; }
.ad .btn:active { transform:scale(.98); }
.ad .btn-night { background:var(--night); color:#fff; }
.ad .btn[disabled] { opacity:.45; cursor:not-allowed; }
.ad .gap { margin-top:26px; }

/* ── ترويسة اللوحة ── */
.ad .topbar { display:flex; align-items:center; justify-content:space-between; padding:22px 0 0; }
.ad .out { width:42px; height:42px; border-radius:50%; background:var(--card); color:var(--night);
  display:grid; place-items:center; box-shadow:0 2px 10px rgba(20,33,61,.09); }
.ad .out:hover { background:#FFE8DC; color:#C33F05; }
.ad .title { margin-top:22px; }
.ad .title h1 { font-size:26px; }
.ad .title p { color:var(--mute); font-size:14.5px; margin-top:4px; }

/* التبويبات */
.ad .tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; background:#EAEFF7;
  border-radius:16px; padding:5px; margin-top:22px; }
.ad .tab { padding:10px 4px; border-radius:12px; font-size:13.5px; font-weight:400; color:var(--mute);
  display:flex; flex-direction:column; align-items:center; gap:3px; }
.ad .tab.on { background:var(--card); color:var(--night); font-weight:600;
  box-shadow:0 2px 8px rgba(20,33,61,.1); }
.ad .tab .cnt { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:11px;
  background:var(--flame); color:#fff; border-radius:99px; padding:0 6px; line-height:16px; }

/* بطاقات عامة */
.ad .panel { background:var(--card); border-radius:20px; padding:18px; margin-top:14px;
  box-shadow:0 3px 14px rgba(20,33,61,.06); }
.ad .sechead { display:flex; align-items:center; justify-content:space-between; margin:26px 0 2px; }
.ad .sechead h2 { font-size:18px; }
.ad .empty { text-align:center; color:var(--mute); font-size:14px; padding:34px 10px; }

/* بطاقة طلب */
.ad .reqtop { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.ad .reqtop h3 { font-size:18px; }
.ad .who { font-size:13.5px; color:var(--mute); }
.ad .badge { font-size:11.5px; font-weight:500; padding:3px 11px; border-radius:99px; white-space:nowrap; }
.ad .badge.pending { background:#FFF4D6; color:#8A6212; }
.ad .badge.confirmed { background:#E7F5EF; color:var(--good); }
.ad .badge.rejected { background:#FFE8DC; color:#C33F05; }
.ad .badge.trial { background:#EAEFF7; color:#41527A; }
.ad .badge.renew { background:#E9EDFB; color:#3B4F9E; }

.ad .kv { margin-top:14px; border-top:1px solid var(--hair); }
.ad .kv .r { display:flex; justify-content:space-between; align-items:center; gap:12px;
  padding:9px 0; font-size:14px; border-bottom:1px solid var(--hair); }
.ad .kv .r .k { color:var(--mute); flex:none; }
.ad .kv .r .v { text-align:left; word-break:break-word; }
.ad .kv .r .v.strong { font-family:'Baloo Bhaijaan 2'; font-weight:700; }

.ad .receipt { display:flex; align-items:center; justify-content:space-between; gap:10px;
  margin-top:14px; background:#F6F8FC; border-radius:14px; padding:12px 14px; }
.ad .receipt .lbl { font-size:13.5px; color:var(--mute); }
.ad .rlink { font-size:13.5px; font-weight:600; color:var(--night); text-decoration:underline;
  text-underline-offset:4px; text-decoration-color:var(--bolt); text-decoration-thickness:2px; }

.ad .acts { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
.ad .act { padding:13px; border-radius:14px; font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:15px; }
.ad .act.ok { background:var(--good); color:#fff; }
.ad .act.no { background:#fff; color:#C33F05; box-shadow:inset 0 0 0 2px #FFD4C2; }
.ad .done { margin-top:14px; font-size:13.5px; color:var(--mute); text-align:center;
  background:#F6F8FC; border-radius:12px; padding:10px; }

/* البحث والعدّادات */
.ad .search { position:relative; margin-top:16px; }
.ad .search input { padding-inline-start:44px; }
.ad .search .ic { position:absolute; inset-inline-start:14px; top:50%; transform:translateY(-50%);
  color:var(--mute); pointer-events:none; }
.ad .stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
.ad .stat { background:var(--card); border-radius:18px; padding:16px;
  box-shadow:0 3px 14px rgba(20,33,61,.06); }
.ad .stat .n { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:28px; line-height:1.2; }
.ad .stat .l { font-size:13px; color:var(--mute); }
.ad .stat.paid .n { color:var(--night); }
.ad .stat.trial .n { color:var(--bolt); }

/* قائمة منسدلة */
.ad .fold { background:var(--card); border-radius:18px; margin-top:12px; overflow:hidden;
  box-shadow:0 3px 14px rgba(20,33,61,.06); }
.ad .foldhead { display:flex; align-items:center; justify-content:space-between; width:100%;
  padding:16px 18px; text-align:right; }
.ad .foldhead h3 { font-size:16.5px; }
.ad .foldhead .c { font-size:13px; color:var(--mute); }
.ad .chev { transition:transform .25s ease; color:var(--mute); }
.ad .chev.open { transform:rotate(-180deg); }
.ad .shop { padding:14px 18px; border-top:1px solid var(--hair); }
.ad .shoptop { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.ad .shoptop b { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:15.5px; }
.ad .dates { display:flex; gap:14px; margin-top:6px; font-size:12.5px; color:var(--mute); flex-wrap:wrap; }
.ad .more { margin-top:10px; font-size:13.5px; font-weight:600; color:var(--night);
  text-decoration:underline; text-underline-offset:4px; text-decoration-color:var(--bolt);
  text-decoration-thickness:2px; }
.ad .soon { color:#C33F05; }

/* الإيرادات */
.ad .range { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; background:#EAEFF7;
  border-radius:14px; padding:4px; margin-top:16px; }
.ad .range b { text-align:center; font-size:13.5px; font-weight:400; padding:9px 0;
  border-radius:11px; color:var(--mute); cursor:pointer; }
.ad .range b.on { background:var(--card); color:var(--night); font-weight:600;
  box-shadow:0 2px 8px rgba(20,33,61,.1); }
.ad .big { background:var(--night); color:#fff; border-radius:22px; padding:22px; margin-top:14px; }
.ad .big .cap { font-size:13px; color:#9FB0CC; }
.ad .big .amount { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:34px;
  color:var(--bolt); line-height:1.3; }
.ad .split { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
.ad .split div { background:rgba(255,255,255,.07); border-radius:14px; padding:12px 14px; }
.ad .split .n { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:22px; }
.ad .split .l { font-size:12.5px; color:#9FB0CC; }
.ad .note { font-size:12.5px; color:var(--mute); margin-top:10px; text-align:center; }

.ad .bars { margin-top:6px; }
.ad .brow { display:flex; align-items:center; gap:10px; padding:7px 0; }
.ad .brow .d { width:52px; font-size:12.5px; color:var(--mute); flex:none; }
.ad .brow .t { flex:1; height:9px; background:#EDF1F7; border-radius:99px; overflow:hidden; }
.ad .brow .t i { display:block; height:100%; border-radius:99px; background:var(--night); }
.ad .brow .a { width:74px; text-align:left; font-size:12.5px; font-family:'Baloo Bhaijaan 2'; font-weight:600; flex:none; }
.ad .total { display:flex; justify-content:space-between; border-top:1.5px solid var(--hair);
  margin-top:10px; padding-top:12px; font-size:15px; }
.ad .total b { font-family:'Baloo Bhaijaan 2'; font-size:17px; }

.ad .planrow { display:flex; align-items:center; gap:10px; padding:10px 0; }
.ad .planrow + .planrow { border-top:1px solid var(--hair); }
.ad .planrow .dot { width:10px; height:10px; border-radius:50%; flex:none; }
.ad .planrow .nm { flex:1; font-size:14.5px; }
.ad .planrow .vv { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:15px; }

.ad .expiry { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:11px 0; }
.ad .expiry + .expiry { border-top:1px solid var(--hair); }
.ad .expiry .left { text-align:left; font-size:12.5px; }
.ad .days { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:15px; }
.ad .days.red { color:#C33F05; }
.ad .days.amber { color:#8A6212; }

/* الإعدادات */
.ad .saved { background:#E7F5EF; color:var(--good); border-radius:14px; padding:11px 16px;
  font-size:14px; margin-top:16px; }
.ad .warn { font-size:13px; color:var(--mute); margin-top:10px; line-height:1.7; }


.ad .mark { position:relative; display:inline-grid; place-items:center; flex:none; }
.ad .ring { position:absolute; inset:0; width:100%; height:100%; }
.ad .word { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center;
  font-family:'Baloo Bhaijaan 2', system-ui, sans-serif; font-weight:800; line-height:1.02;
  direction:ltr; unicode-bidi:isolate; letter-spacing:-.02em; }
.ad .word .l1 { color:#140F0A; display:inline-flex; align-items:center; }
.ad .word .l2 { color:#9B1B00; }

@media (prefers-reduced-motion: reduce) {
  .ad *, .ad *::before, .ad *::after { animation:none !important; transition:none !important; }
}
`;

/* ────────────────────────────  عناصر  ──────────────────────── */

function Logo({ d = 48 }) {
  // الشعار الرسمي كصورة ثابتة (asset). لا رسم برمجي إطلاقاً.
  return (
    <img
      src="/flashordo-logo.png"
      alt="flash ordo"
      width={d}
      height={d}
      style={{ width: d, height: d, objectFit: "contain", display: "block", flex: "none" }}
    />
  );
}

const L = ({ children }) => <span className="ltr">{children}</span>;

function Eye({ open }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M6.5 6.6C3.9 8.2 2 12 2 12s3.6 7 10 7c2 0 3.7-.7 5.1-1.6M21.2 15c.5-.9.8-1.6.8-1.6s-3.6-7-10-7c-.5 0-1 0-1.4.1" />
    </svg>
  );
}

function Field({ label, hint, error, type = "text", value, onChange, placeholder, disabled, inputMode, maxLength }) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div className="field">
      <label>{label}</label>
      <div className={"inbox" + (isPass ? " haseye" : "")}>
        <input
          type={isPass && show ? "text" : type}
          className={error ? "bad" : ""}
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled} inputMode={inputMode} maxLength={maxLength}
          autoComplete="off" spellCheck="false"
        />
        {isPass && (
          <button type="button" className="eye" onClick={() => setShow(!show)}
            aria-label={show ? "إخفاء كلمة السر" : "إظهار كلمة السر"}>
            <Eye open={show} />
          </button>
        )}
      </div>
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

/* ══════════════════  صفحة دخول الأدمن  ══════════════════ */
const MAX_TRIES = 8;
const LOCK_SECONDS = 300;

function Gate({ onIn }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState({});
  const [banner, setBanner] = useState(null);   // {kind:'bad'|'net', text}
  const [tries, setTries] = useState(0);
  const [lockLeft, setLockLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setInterval(() => setLockLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockLeft]);

  useEffect(() => { if (lockLeft === 0 && tries >= MAX_TRIES) setTries(0); }, [lockLeft, tries]);

  const locked = lockLeft > 0;
  const mm = String(Math.floor(lockLeft / 60)).padStart(2, "0");
  const ss = String(lockLeft % 60).padStart(2, "0");

  const submit = async () => {
    if (locked || busy) return;
    const e = { email: checkEmail(email), pass: checkPassword(pass) };
    setErr(e);
    setBanner(null);
    if (Object.values(e).some(Boolean)) return;

    setBusy(true);
    // TODO: supabase.auth.signInWithPassword({ email, password: pass })
    //       ثم التأكد من profiles.role === 'admin' قبل السماح بالدخول.
    //       أي خطأ من القاعدة يُسجَّل في السيرفر ولا يُعرض نصّه للمستخدم.
    await new Promise((r) => setTimeout(r, 450));
    setBusy(false);

    if (!navigator.onLine) {
      setBanner({ kind: "net", text: "لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة." });
      return;
    }

    const n = tries + 1;
    setTries(n);
    if (n >= MAX_TRIES) {
      setLockLeft(LOCK_SECONDS);
      setBanner({ kind: "bad", text: "تجاوزت عدد المحاولات المسموح بها. الدخول معطّل مؤقتاً." });
    } else {
      setBanner({ kind: "bad", text: "بيانات الدخول غير صحيحة." });
    }
  };

  return (
    <div className="gate fade">
      <Logo d={104} />
      <div><span className="adminword">ADMIN</span></div>
      <h1>لوحة المالك</h1>
      <p className="sub">الدخول مقتصر على حساب الأدمن.</p>

      <Field label="البريد الإلكتروني" value={email} error={err.email} disabled={locked}
        onChange={(v) => { setEmail(v); setErr({ ...err, email: "" }); setBanner(null); }}
        placeholder="admin@flashordo.com" />
      <Field label="كلمة السر" type="password" value={pass} error={err.pass} disabled={locked}
        onChange={(v) => { setPass(v); setErr({ ...err, pass: "" }); setBanner(null); }}
        placeholder="كلمة السر" hint="8 رموز فأكثر، تجمع حروفاً وأرقاماً" />

      {banner && <div className={"alert " + banner.kind}>{banner.text}</div>}
      {locked && (
        <div className="alert bad" style={{ marginTop: 10 }}>
          أعد المحاولة بعد <L>{mm}:{ss}</L>
        </div>
      )}
      {!locked && tries > 0 && tries < MAX_TRIES && (
        <p className="hint" style={{ textAlign: "right" }}>
          محاولات متبقّية: {MAX_TRIES - tries}
        </p>
      )}

      <div className="gap">
        <button className="btn btn-night" onClick={submit} disabled={locked || busy}>
          {busy ? "جارٍ التحقّق…" : "دخول"}
        </button>
      </div>

      {/* مدخل تجريبي للمعاينة فقط — يُحذف عند الربط بـ Supabase */}
      <p className="hint" style={{ textAlign: "center", marginTop: 22 }}>
        <button className="rlink" onClick={onIn}>معاينة اللوحة (عرض تجريبي)</button>
      </p>
    </div>
  );
}

/* ══════════════════  خانة الطلبات  ══════════════════ */
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ar", { day: "numeric", month: "long" }) +
    " · " + d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function trialLeft(sentAt) {
  const end = new Date(new Date(sentAt).getTime() + 3 * 864e5);
  const ms = end - Date.now();
  if (ms <= 0) return { over: true, txt: "انتهت التجربة" };
  const h = Math.floor(ms / 36e5);
  return { over: false, txt: h >= 24 ? `${Math.floor(h / 24)} يوم متبقٍ` : `${h} ساعة متبقّية` };
}

function OrdersTab({ requests, setRequests }) {
  const decide = (id, status) => {
    // TODO: تحديث payments.status و restaurants.status في Supabase،
    //       مع تسجيل reviewed_by و reviewed_at.
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const pending = requests.filter((r) => r.status === "pending");
  const rest = requests.filter((r) => r.status !== "pending");

  return (
    <div className="fade">
      <div className="sechead"><h2>بانتظار المراجعة</h2></div>
      {pending.length === 0 && <div className="panel empty">لا توجد طلبات بانتظار المراجعة.</div>}
      {pending.map((r) => <RequestCard key={r.id} r={r} decide={decide} />)}

      <div className="sechead"><h2>طلبات سابقة</h2></div>
      {rest.map((r) => <RequestCard key={r.id} r={r} decide={decide} />)}
    </div>
  );
}

function RequestCard({ r, decide }) {
  const isTrial = r.kind === "trial";
  const left = isTrial ? trialLeft(r.sentAt) : null;
  const badge = isTrial ? "trial" : r.status;
  const badgeTxt = isTrial ? "تجريبي"
    : r.status === "pending" ? "بانتظار المراجعة"
    : r.status === "confirmed" ? "مؤكّد" : "مرفوض";

  return (
    <div className="panel">
      <div className="reqtop">
        <div>
          <h3>{r.restaurant}</h3>
          <p className="who">{r.owner}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {r.renewal && <span className="badge renew">تجديد</span>}
          <span className={"badge " + badge}>{badgeTxt}</span>
        </div>
      </div>

      <div className="kv">
        <div className="r"><span className="k">الهاتف</span><span className="v"><L>{r.phone}</L></span></div>
        <div className="r"><span className="k">البريد</span><span className="v"><L>{r.email}</L></span></div>
        {!isTrial && (
          <>
            <div className="r"><span className="k">الباقة</span><span className="v strong">{PLAN_LABEL[r.plan]}</span></div>
            <div className="r"><span className="k">المبلغ</span><span className="v strong">{money(r.amount)} دج</span></div>
            <div className="r"><span className="k">مرجع التحويل</span><span className="v strong"><L>{r.ref}</L></span></div>
          </>
        )}
        <div className="r"><span className="k">أُرسل في</span><span className="v">{fmtDate(r.sentAt)}</span></div>
        {isTrial && (
          <div className="r">
            <span className="k">التجربة</span>
            <span className={"v strong" + (left.over ? " soon" : "")}>{left.txt}</span>
          </div>
        )}
      </div>

      {!isTrial && (
        <div className="receipt">
          <span className="lbl">وصل الدفع</span>
          {/* TODO: رابط موقّع من Supabase Storage صالح لدقائق معدودة */}
          <button className="rlink">عرض الوصل</button>
        </div>
      )}

      {isTrial ? (
        <div className="done">
          حساب تجريبي — يدخل مباشرةً دون موافقة، وتنتهي جلسته تلقائياً بعد 3 أيام.
        </div>
      ) : r.status === "pending" ? (
        <div className="acts">
          <button className="act ok" onClick={() => decide(r.id, "confirmed")}>تأكيد الدفع</button>
          <button className="act no" onClick={() => decide(r.id, "rejected")}>رفض</button>
        </div>
      ) : (
        <div className="done">
          {r.status === "confirmed"
            ? "مؤكّد — الحساب مفعّل ويدخل لوحة مطعمه."
            : "مرفوض — يظهر له أن الاشتراك غير مدفوع عند محاولة الدخول."}
        </div>
      )}
    </div>
  );
}

/* ══════════════════  خانة المطاعم  ══════════════════ */
function ShopsTab({ shops }) {
  const [q, setQ] = useState("");
  const [openPaid, setOpenPaid] = useState(true);
  const [openTrial, setOpenTrial] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const norm = (s) => s.toLowerCase().trim();
  const match = (s) =>
    !q.trim() ||
    norm(s.restaurant).includes(norm(q)) ||
    norm(s.phone).includes(norm(q)) ||
    norm(s.email).includes(norm(q));

  const paid = shops.filter((s) => s.kind === "paid" && match(s));
  const trial = shops.filter((s) => s.kind === "trial" && match(s));

  return (
    <div className="fade">
      <div className="search">
        <span className="ic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
          </svg>
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المطعم أو الهاتف أو البريد" />
      </div>

      <div className="stats">
        <div className="stat paid">
          <div className="n">{shops.filter((s) => s.kind === "paid").length}</div>
          <div className="l">مطعم مشترك</div>
        </div>
        <div className="stat trial">
          <div className="n">{shops.filter((s) => s.kind === "trial").length}</div>
          <div className="l">تجربة مجانية</div>
        </div>
      </div>

      <Fold title="المطاعم المشتركة" count={paid.length} open={openPaid} toggle={() => setOpenPaid(!openPaid)}
        list={paid} expanded={expanded} setExpanded={setExpanded} />
      <Fold title="التجربة المجانية" count={trial.length} open={openTrial} toggle={() => setOpenTrial(!openTrial)}
        list={trial} expanded={expanded} setExpanded={setExpanded} />
    </div>
  );
}

function Fold({ title, count, open, toggle, list, expanded, setExpanded }) {
  return (
    <div className="fold">
      <button className="foldhead" onClick={toggle}>
        <span>
          <h3>{title}</h3>
          <span className="c">{count} مطعم</span>
        </span>
        <span className={"chev" + (open ? " open" : "")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && list.length === 0 && <div className="shop empty" style={{ padding: 22 }}>لا نتائج.</div>}
      {open && list.map((s) => {
        const isOpen = expanded === s.id;
        return (
          <div className="shop" key={s.id}>
            <div className="shoptop">
              <b>{s.restaurant}</b>
              {s.plan && <span className="badge confirmed">{PLAN_LABEL[s.plan]}</span>}
              {!s.plan && <span className="badge trial">تجريبي</span>}
            </div>
            <div className="dates">
              <span>التسجيل: {s.joined}</span>
              <span>الانتهاء: {s.ends || "بلا انتهاء"}</span>
            </div>
            <button className="more" onClick={() => setExpanded(isOpen ? null : s.id)}>
              {isOpen ? "إخفاء" : "عرض المزيد"}
            </button>
            {isOpen && (
              <div className="kv">
                <div className="r"><span className="k">المالك</span><span className="v">{s.owner}</span></div>
                <div className="r"><span className="k">الهاتف</span><span className="v"><L>{s.phone}</L></span></div>
                <div className="r"><span className="k">البريد</span><span className="v"><L>{s.email}</L></span></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════  خانة الإيرادات  ══════════════════ */
const RANGES = [["day", "اليوم"], ["week", "الأسبوع"], ["month", "الشهر"], ["year", "العام"]];
const RANGE_CAP = {
  day: "إيرادات آخر 24 ساعة", week: "إيرادات آخر 7 أيام",
  month: "إيرادات آخر 30 يوماً", year: "إيرادات آخر 12 شهراً",
};

function RevenueTab({ shops }) {
  const [range, setRange] = useState("week");
  const d = SEED_REVENUE[range];
  const peak = Math.max(...d.daily.map(([, v]) => v), 1);

  const expiring = useMemo(() => {
    const now = Date.now();
    return shops
      .filter((s) => s.ends)
      .map((s) => ({ ...s, days: Math.ceil((new Date(s.ends) - now) / 864e5) }))
      .filter((s) => s.days <= 30)
      .sort((a, b) => a.days - b.days);
  }, [shops]);

  return (
    <div className="fade">
      <div className="range">
        {RANGES.map(([k, t]) => (
          <b key={k} className={range === k ? "on" : ""} onClick={() => setRange(k)}>{t}</b>
        ))}
      </div>

      <div className="big">
        <p className="cap">{RANGE_CAP[range]}</p>
        <p className="amount">{money(d.total)} دج</p>
        <div className="split">
          <div><div className="n">{d.fresh}</div><div className="l">اشتراكات جديدة</div></div>
          <div><div className="n">{d.renew}</div><div className="l">تجديدات</div></div>
        </div>
      </div>
      <p className="note">تُحسب من الدفعات المؤكّدة ضمن النافذة الزمنية المختارة.</p>

      <div className="sechead"><h2>التفصيل</h2></div>
      <div className="panel">
        <div className="bars">
          {d.daily.map(([lbl, v]) => (
            <div className="brow" key={lbl}>
              <span className="d">{lbl}</span>
              <span className="t"><i style={{ width: (v / peak) * 100 + "%" }} /></span>
              <span className="a">{money(v)} دج</span>
            </div>
          ))}
        </div>
        <div className="total"><span>المجموع</span><b>{money(d.total)} دج</b></div>
      </div>

      <div className="sechead"><h2>الإيرادات حسب الباقة</h2></div>
      <div className="panel">
        {[["month", "#14213D"], ["six", "#FFB703"], ["life", "#12805C"]].map(([k, c]) => (
          <div className="planrow" key={k}>
            <span className="dot" style={{ background: c }} />
            <span className="nm">{PLAN_LABEL[k]}</span>
            <span className="vv">{money(d.byPlan[k])} دج</span>
          </div>
        ))}
      </div>

      <div className="sechead"><h2>اشتراكات قاربت على الانتهاء</h2></div>
      <div className="panel">
        {expiring.length === 0 && <div className="empty">لا اشتراكات تنتهي خلال 30 يوماً.</div>}
        {expiring.map((s) => (
          <div className="expiry" key={s.id}>
            <span>
              <b style={{ fontFamily: "'Baloo Bhaijaan 2'", fontWeight: 700 }}>{s.restaurant}</b>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--mute)" }}>
                {s.plan ? PLAN_LABEL[s.plan] : "تجريبي"} · ينتهي {s.ends}
              </span>
            </span>
            <span className="left">
              <span className={"days " + (s.days <= 3 ? "red" : s.days <= 10 ? "amber" : "")}>
                {s.days <= 0 ? "انتهى" : `${s.days} يوم`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════  خانة الإعدادات  ══════════════════ */
function SettingsTab({ settings, setSettings }) {
  const [form, setForm] = useState(settings);
  const [err, setErr] = useState({});
  const [saved, setSaved] = useState(false);

  const set = (k, v) => { setForm({ ...form, [k]: v }); setErr({ ...err, [k]: "" }); setSaved(false); };

  const checkRip = (v) => {
    const s = String(v).trim();
    if (!s) return "رقم الحساب مطلوب";
    if (!/^\d+$/.test(s)) return "رقم الحساب أرقام فقط";
    if (s.length !== 20) return "حساب بريدي موب يتكوّن من 20 رقماً";
    return "";
  };
  const checkPrice = (v, label) => {
    const s = String(v).trim();
    if (!s) return `${label} مطلوب`;
    if (!/^\d+$/.test(s)) return `${label} أرقام فقط`;
    if (Number(s) < 1) return `${label} يجب أن يكون أكبر من صفر`;
    return "";
  };

  const save = () => {
    const e = {
      rip: checkRip(form.rip),
      priceMonth: checkPrice(form.priceMonth, "سعر الباقة الشهرية"),
      priceSix: checkPrice(form.priceSix, "سعر باقة 6 أشهر"),
      priceLife: checkPrice(form.priceLife, "سعر باقة مدى الحياة"),
    };
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    // TODO: update app_settings في Supabase (سياسة الكتابة للأدمن فقط)
    setSettings({ ...form, priceMonth: +form.priceMonth, priceSix: +form.priceSix, priceLife: +form.priceLife });
    setSaved(true);
  };

  return (
    <div className="fade">
      <div className="sechead"><h2>حساب استلام الدفع</h2></div>
      <div className="panel">
        <Field label="RIP بريدي موب" value={form.rip} error={err.rip} inputMode="numeric" maxLength={20}
          onChange={(v) => set("rip", v.replace(/\D/g, ""))} placeholder="20 رقماً" />
        <p className="warn">
          هذا هو الحساب الوحيد الذي يظهر للمشتركين في صفحة الدفع. لا يُعرض أي حساب آخر.
        </p>
      </div>

      <div className="sechead"><h2>أسعار الباقات</h2></div>
      <div className="panel">
        <Field label="باقة شهر (دج)" value={form.priceMonth} error={err.priceMonth} inputMode="numeric" maxLength={8}
          onChange={(v) => set("priceMonth", v.replace(/\D/g, ""))} />
        <Field label="باقة 6 أشهر (دج)" value={form.priceSix} error={err.priceSix} inputMode="numeric" maxLength={8}
          onChange={(v) => set("priceSix", v.replace(/\D/g, ""))} />
        <Field label="باقة مدى الحياة (دج)" value={form.priceLife} error={err.priceLife} inputMode="numeric" maxLength={8}
          onChange={(v) => set("priceLife", v.replace(/\D/g, ""))} />
        <p className="warn">
          تغيير السعر ينعكس فوراً على صفحة الاشتراك. الاشتراكات القائمة تحتفظ بسعرها وقت الشراء.
        </p>
      </div>

      {saved && <div className="saved">تم حفظ الإعدادات.</div>}
      <div className="gap">
        <button className="btn btn-night" onClick={save}>حفظ الإعدادات</button>
      </div>
    </div>
  );
}

/* ══════════════════  اللوحة  ══════════════════ */
const TABS = [["orders", "الطلبات"], ["shops", "المطاعم"], ["revenue", "الإيرادات"], ["settings", "الإعدادات"]];

function Dashboard({ onOut }) {
  const [tab, setTab] = useState("orders");
  const [requests, setRequests] = useState(SEED_REQUESTS);
  const [shops] = useState(SEED_SHOPS);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const top = useRef(null);

  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, [tab]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div ref={top}>
      <div className="topbar">
        <Logo d={46} />
        <button className="out" onClick={onOut} aria-label="تسجيل الخروج">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17l5-5-5-5M20 12H9M12 4H7a3 3 0 00-3 3v10a3 3 0 003 3h5" />
          </svg>
        </button>
      </div>

      <div className="title">
        <h1>إدارة المنصة</h1>
        <p>تابع المطاعم المشتركة، فعّل الاشتراكات وراقب إيراداتك.</p>
      </div>

      <div className="tabs">
        {TABS.map(([k, t]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
            <span>{t}</span>
            {k === "orders" && pendingCount > 0 && <span className="cnt">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {tab === "orders" && <OrdersTab requests={requests} setRequests={setRequests} />}
      {tab === "shops" && <ShopsTab shops={shops} />}
      {tab === "revenue" && <RevenueTab shops={shops} />}
      {tab === "settings" && <SettingsTab settings={settings} setSettings={setSettings} />}
    </div>
  );
}

/* ══════════════════  الجذر + حارس المسار  ══════════════════ */
export default function App() {
  /* حارس المسار: لا يُعرض أي عنصر من اللوحة قبل التأكد من وجود جلسة أدمن.
     TODO: عند الربط — تحقّق من supabase.auth.getSession() و profiles.role
     قبل أول رسم، وأعد التوجيه لصفحة الدخول إن لم توجد جلسة. */
  const [session, setSession] = useState(false);

  const logout = () => {
    // TODO: supabase.auth.signOut()
    //       ثم localStorage.clear() و sessionStorage.clear()
    //       ثم window.location.replace('/admin/login') لحذف سجل التصفح
    //       ومنع العودة بزر الرجوع.
    setSession(false);
  };

  return (
    <div className="ad">
      <style>{CSS}</style>
      <div className="wrap">
        {session ? <Dashboard onOut={logout} /> : <Gate onIn={() => setSession(true)} />}
      </div>
    </div>
  );
}
