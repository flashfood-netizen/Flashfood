import React, { useState, useMemo, useRef, useEffect } from "react";

/* ══════════════════════════════════════════════════════════════
   لوحة التاجر — Flashordo
   القواعد المطبّقة فعلياً (لا كتعليقات):
   • المخزون لا يصبح سالباً أبداً.
   • لا خصم من المخزون إلا بعد تأكيد الدفع — والمطبخ لا يرى الطلب قبله.
   • سعر بيع المنتج ≥ تكلفة مكوّناته، وإلا يُرفض الحفظ.
   • رصيد العامل لا يصبح سالباً.
   • الأرباح = المبيعات − تكلفة المواد − الأجور.
   • المسمّيات: تُقبل الأرقام داخل الاسم، ويُرفض الاسم المكوّن من أرقام فقط.
   • الكميات والأسعار: أرقام فقط.
   ══════════════════════════════════════════════════════════════ */

const UNITS = ["كغ", "غ", "ل", "مل", "علبة", "قطعة"];
const money = (n) => String(Math.round(n * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const qty = (n) => Math.round(n * 1000) / 1000;

/* ── التحقّق ── */
const NAME_CHARS = /^[\u0621-\u064A\u0660-\u0669a-zA-Z0-9 .'\-()]+$/;
const ONLY_DIGITS = /^[\d\s.,\u0660-\u0669]+$/;

const vName = (v, label) => {
  const s = v.trim();
  if (!s) return `${label} مطلوب`;
  if (!NAME_CHARS.test(s)) return `${label} يقبل الحروف والأرقام فقط`;
  if (ONLY_DIGITS.test(s)) return `${label} لا يكون أرقاماً فقط`;
  if (s.length < 2) return `${label} قصير جداً`;
  if (s.length > 60) return `${label} طويل جداً`;
  return "";
};
const vNum = (v, label, { min = 0, allowZero = false } = {}) => {
  const s = String(v).trim();
  if (!s) return `${label} مطلوب`;
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return `${label} أرقام فقط`;
  const n = Number(s);
  if (!allowZero && n <= 0) return `${label} أكبر من صفر`;
  if (n < min) return `${label} غير صالح`;
  return "";
};
const numOnly = (v) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

/* ── بيانات أولية ── */
const SEED_MATERIALS = [
  { id: "m1", name: "كوكا كولا", unit: "علبة", cost: 70, stock: 50, kind: "goods", price: 100, category: "c1" },
  { id: "m2", name: "بطاطا", unit: "كغ", cost: 80, stock: 9.9, kind: "raw" },
  { id: "m3", name: "فرماج", unit: "كغ", cost: 500, stock: 9.9, kind: "raw" },
  { id: "m4", name: "سكالوب", unit: "كغ", cost: 500, stock: 9.9, kind: "raw" },
  { id: "m5", name: "طماطم", unit: "كغ", cost: 80, stock: 9.9, kind: "raw" },
  { id: "m6", name: "اوراق طاكوس", unit: "قطعة", cost: 20, stock: 99, kind: "raw" },
];
const SEED_CATS = [
  { id: "c1", name: "مشروبات غازية", parent: null, sauces: false },
  { id: "c2", name: "بيتزا", parent: null, sauces: true },
  { id: "c3", name: "طاكوس", parent: null, sauces: true },
];
const SEED_PRODUCTS = [
  { id: "p1", name: "مينيطاكوي", price: 200, category: "c3",
    parts: [{ mid: "m6", q: 1 }, { mid: "m2", q: 0.1 }, { mid: "m4", q: 0.05 }] },
];
const SEED_WORKERS = [
  { id: "w1", name: "ياسين مرابط", job: "طاهٍ", wageType: "fixed", wage: 2500, paid: 0, earned: 7500 },
  { id: "w2", name: "أمينة حداد", job: "كاشير", wageType: "fixed", wage: 2000, paid: 4000, earned: 6000 },
];
const SEED_ORDERS = [
  { id: "o4", no: 4, at: "21:34", status: "unpaid",
    lines: [{ pid: "p1", q: 1, sauces: ["كاتشب"] }] },
  { id: "o3", no: 3, at: "21:12", status: "cooking",
    lines: [{ pid: "p1", q: 1, sauces: [] }] },
  { id: "o2", no: 2, at: "20:48", status: "served",
    lines: [{ pid: "p1", q: 1, sauces: ["مايونيز"] }] },
];

/* ════════════════════════════ الأنماط ════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@500;600;700;800&family=Alexandria:wght@300;400;500;600&display=swap');

.mr *, .mr *::before, .mr *::after { box-sizing:border-box; }
.mr {
  --night:#14213D; --bolt:#FFB703; --flame:#FB5607; --good:#12805C; --bad:#C0341C;
  --bg:#F6F8FC; --card:#FFFFFF; --mute:#68738C; --hair:#E4E9F2;
  --flameGrad:linear-gradient(135deg,#FB5607,#FFB703);
  direction:rtl; min-height:100vh; background:var(--bg); color:var(--night);
  font-family:'Alexandria', system-ui, sans-serif; font-size:15px; line-height:1.75;
  font-weight:300; -webkit-font-smoothing:antialiased; padding-bottom:86px;
}
.mr h1,.mr h2,.mr h3 { font-family:'Baloo Bhaijaan 2', system-ui, sans-serif; font-weight:700; line-height:1.45; margin:0; }
.mr p { margin:0; }
.mr button { font:inherit; color:inherit; cursor:pointer; border:none; background:none; }
.mr :focus-visible { outline:3px solid var(--bolt); outline-offset:2px; border-radius:8px; }
.mr .ltr { direction:ltr; unicode-bidi:isolate; display:inline-block; }
.mr .wrap { max-width:560px; margin:0 auto; padding:0 18px; }

/* ترويسة */
.mr .top { display:flex; align-items:center; justify-content:space-between; padding:20px 0 6px; }
.mr .brand { display:flex; align-items:center; gap:10px; }
  font-weight:800; font-size:20px; letter-spacing:-.02em; line-height:1; direction:ltr; unicode-bidi:isolate; }
.mr .shop { font-size:12.5px; color:var(--mute); }
.mr .out { display:inline-flex; align-items:center; gap:6px; background:var(--card); border-radius:99px;
  padding:8px 14px; font-size:13.5px; box-shadow:0 2px 8px rgba(20,33,61,.08); }
.mr .out:hover { background:#FFE8DC; color:var(--bad); }

.mr .pagehead { margin:16px 0 4px; }
.mr .pagehead h1 { font-size:24px; }
.mr .pagehead p { color:var(--mute); font-size:14px; }

/* بطاقات */
.mr .card { background:var(--card); border-radius:20px; padding:18px; margin-top:14px;
  box-shadow:0 3px 14px rgba(20,33,61,.06); }
.mr .card > h2 { font-size:17.5px; display:flex; align-items:center; gap:8px; }
.mr .card > h2::before { content:''; width:9px; height:9px; border-radius:50%; background:var(--flame); flex:none; }
.mr .card .lead { font-size:13.5px; color:var(--mute); margin-top:4px; }
.mr .empty { text-align:center; color:var(--mute); font-size:14px; padding:26px 8px; }
.mr .sec { margin-top:26px; font-size:13px; color:var(--mute); }

/* حقول */
.mr .f { margin-top:14px; }
.mr .row2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.mr label { display:block; font-size:13.5px; font-weight:500; margin-bottom:6px; }
.mr input, .mr select { width:100%; padding:12px 14px; border:none; border-radius:13px; background:#F8FAFD;
  box-shadow:inset 0 0 0 1.5px var(--hair); color:var(--night); font:inherit; font-weight:400;
  font-size:14.5px; transition:box-shadow .18s ease; }
.mr input::placeholder { color:#A9B3C7; font-weight:300; }
.mr input:focus, .mr select:focus { outline:none; box-shadow:inset 0 0 0 2px var(--night); background:#fff; }
.mr input.bad, .mr select.bad { box-shadow:inset 0 0 0 2px var(--flame); }
.mr .err { font-size:12.5px; color:var(--bad); font-weight:500; margin-top:6px; }
.mr .hint { font-size:12.5px; color:var(--mute); margin-top:6px; }

/* مفاتيح ثنائية */
.mr .seg2 { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:14px; }
.mr .seg2 button { padding:12px; border-radius:14px; background:#F8FAFD; font-weight:500; font-size:14px;
  box-shadow:inset 0 0 0 1.5px var(--hair); }
.mr .seg2 button.on { background:var(--night); color:#fff; box-shadow:none; }

/* أزرار */
.mr .save { display:block; width:100%; margin-top:16px; padding:15px; border-radius:16px;
  background:var(--flameGrad); color:#fff; font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:16px;
  box-shadow:0 6px 16px rgba(251,86,7,.28); transition:transform .12s ease; }
.mr .save:active { transform:scale(.985); }
.mr .ghost { display:block; width:100%; margin-top:10px; padding:13px; border-radius:14px;
  background:#F8FAFD; box-shadow:inset 0 0 0 1.5px var(--hair); font-weight:500; font-size:14.5px; }
.mr .mini { padding:8px 14px; border-radius:11px; font-size:13px; font-weight:500;
  background:#F8FAFD; box-shadow:inset 0 0 0 1.5px var(--hair); }
.mr .mini.red { color:var(--bad); background:#FFF1EC; box-shadow:inset 0 0 0 1.5px #FFD9CB; }
.mr .mini.flame { background:var(--flameGrad); color:#fff; box-shadow:none; }

/* بلاغات */
.mr .flash { border-radius:14px; padding:11px 15px; font-size:13.5px; margin-top:14px; }
.mr .flash.ok { background:#E7F5EF; color:var(--good); }
.mr .flash.no { background:#FFF1EC; color:var(--bad); }
.mr .flash.warn { background:#FFF6E0; color:#8A6212; }

/* صفوف قوائم */
.mr .item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 0; }
.mr .item + .item { border-top:1px solid var(--hair); }
.mr .item .nm { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:15.5px; }
.mr .item .sb { font-size:12.5px; color:var(--mute); }
.mr .item .rt { text-align:left; flex:none; }
.mr .item .big { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:16px; }
.mr .tag { display:inline-block; font-size:11px; padding:2px 9px; border-radius:99px; margin-inline-start:6px; }
.mr .tag.goods { background:#FFF6E0; color:#8A6212; }
.mr .tag.low { background:#FFF1EC; color:var(--bad); }
.mr .tag.raw { background:#EEF2F9; color:#41527A; }

/* شريط المخزون */
.mr .bar { height:6px; border-radius:99px; background:#EDF1F7; margin-top:7px; overflow:hidden; }
.mr .bar i { display:block; height:100%; border-radius:99px; }

/* مكوّنات */
.mr .part { display:grid; grid-template-columns:1fr 92px 40px; gap:8px; margin-top:9px; align-items:center; }
.mr .part .x { text-align:center; color:var(--bad); font-size:19px; line-height:1; padding:10px 0; }
.mr .costbox { margin-top:14px; background:#F8FAFD; border-radius:14px; padding:12px 14px; }
.mr .costline { display:flex; justify-content:space-between; font-size:13.5px; padding:3px 0; }
.mr .costline b { font-family:'Baloo Bhaijaan 2'; }
.mr .costline.profit b { color:var(--good); }
.mr .costline.loss b { color:var(--bad); }

/* إحصاءات */
.mr .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
.mr .kpi { background:var(--card); border-radius:18px; padding:15px;
  box-shadow:0 3px 14px rgba(20,33,61,.06); }
.mr .kpi .l { font-size:12.5px; color:var(--mute); }
.mr .kpi .v { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:23px; line-height:1.3; }
.mr .kpi .v.money { color:var(--good); }
.mr .kpi .v.flame { color:var(--flame); }

/* نطاق زمني */
.mr .range { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; background:#EAEFF7;
  border-radius:14px; padding:4px; margin-top:14px; }
.mr .range b { text-align:center; font-size:13px; font-weight:400; padding:9px 0; border-radius:11px;
  color:var(--mute); cursor:pointer; }
.mr .range b.on { background:var(--card); color:var(--night); font-weight:600; box-shadow:0 2px 8px rgba(20,33,61,.1); }

/* متابعة */
.mr .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-top:14px; }
.mr .cnt { background:var(--card); border-radius:16px; padding:13px 8px; text-align:center;
  box-shadow:0 3px 14px rgba(20,33,61,.06); }
.mr .cnt .n { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:25px; line-height:1.2; }
.mr .cnt .l { font-size:11.5px; color:var(--mute); }
.mr .cnt.wait .n { color:var(--bolt); }
.mr .cnt.cook .n { color:var(--flame); }
.mr .cnt.done .n { color:var(--good); }
.mr .ord { background:#F8FAFD; border-radius:16px; padding:13px 15px; margin-top:10px;
  box-shadow:inset 0 0 0 1.5px var(--hair); }
.mr .ordtop { display:flex; align-items:center; gap:11px; }
.mr .no { width:42px; height:42px; border-radius:13px; display:grid; place-items:center; flex:none;
  font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:18px; color:#fff; }
.mr .no.wait { background:var(--bolt); color:var(--night); }
.mr .no.cook { background:var(--flame); }
.mr .no.done { background:var(--good); }
.mr .ordtot { margin-inline-start:auto; text-align:left; font-family:'Baloo Bhaijaan 2'; font-weight:700; }
.mr .lines { font-size:13px; color:var(--mute); margin-top:9px; }
.mr .lines .sauce { color:#8A6212; }

/* الشاشات */
.mr .screen { display:flex; align-items:center; gap:13px; background:var(--card); border-radius:18px;
  padding:15px; margin-top:11px; box-shadow:0 3px 14px rgba(20,33,61,.06); width:100%; text-align:right; }
.mr .sq { width:46px; height:46px; border-radius:14px; display:grid; place-items:center; color:#fff; flex:none; }
.mr .screen .t { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:15.5px; }
.mr .screen .d { font-size:12.5px; color:var(--mute); }

/* شريط التبويبات */
.mr .nav { position:fixed; inset-inline:0; bottom:0; background:rgba(255,255,255,.96);
  backdrop-filter:blur(12px); border-top:1px solid var(--hair); z-index:20; }
.mr .navin { max-width:560px; margin:0 auto; display:grid; grid-template-columns:repeat(6,1fr);
  padding:7px 6px calc(7px + env(safe-area-inset-bottom)); }
.mr .nb { display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 2px;
  border-radius:12px; color:var(--mute); font-size:11px; }
.mr .nb.on { color:var(--flame); font-weight:500; }
.mr .nb.on svg { transform:translateY(-1px); }


.mr .mark { position:relative; display:inline-grid; place-items:center; flex:none; }
.mr .ring { position:absolute; inset:0; width:100%; height:100%; }
.mr .word { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center;
  font-family:'Baloo Bhaijaan 2', system-ui, sans-serif; font-weight:800; line-height:1.02;
  direction:ltr; unicode-bidi:isolate; letter-spacing:-.02em; }
.mr .word .l1 { color:#140F0A; display:inline-flex; align-items:center; }
.mr .word .l2 { color:#9B1B00; }

@media (prefers-reduced-motion: reduce) { .mr * { animation:none !important; transition:none !important; } }
`;

/* ════════════════════════════ عناصر ════════════════════════════ */
const L = ({ children }) => <span className="ltr">{children}</span>;

const FLAME_D = "M50.00 17.00C53.08 14.73 60.16 6.98 63.78 2.98C68.16 12.35 63.95 19.21 65.34 20.78C69.11 20.20 78.99 16.63 84.06 14.77C83.58 25.10 76.66 29.22 77.16 31.25C80.77 32.50 91.17 33.93 96.53 34.63C91.30 43.56 83.26 43.99 82.76 46.02C85.38 48.80 93.93 54.90 98.34 58.02C89.56 63.49 82.25 60.13 80.86 61.70C81.88 65.38 86.62 74.76 89.08 79.56C78.76 80.33 73.84 73.96 71.88 74.70C71.08 78.44 70.92 88.94 70.86 94.34C61.37 90.22 59.98 82.29 57.90 82.04C55.45 84.98 50.43 94.20 47.87 98.95C41.38 90.90 43.83 83.23 42.10 82.04C38.57 83.51 29.84 89.33 25.36 92.36C23.36 82.21 29.09 76.56 28.12 74.70C24.31 74.36 13.87 75.46 8.50 76.06C11.44 66.14 19.14 63.80 19.14 61.70C15.93 59.63 6.18 55.75 1.15 53.79C8.36 46.37 16.27 47.88 17.24 46.02C15.36 42.70 8.52 34.73 4.98 30.65C14.82 27.43 21.12 32.44 22.84 31.25C22.72 27.44 20.37 17.20 19.13 11.94C29.33 13.67 32.58 21.03 34.66 20.78C36.33 17.34 39.01 7.19 40.35 1.96C48.59 8.22 48.04 16.26 50.00 17.00Z";

function Logo({ d = 48 }) {
  return (
    <span className="mark" style={{ width: d, height: d }}>
      <svg className="ring" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="foDisc" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#FFA92B" />
            <stop offset="0.55" stopColor="#FB7A07" />
            <stop offset="1" stopColor="#F35D02" />
          </linearGradient>
          <linearGradient id="foTongue" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0" stopColor="#FF9E14" />
            <stop offset="1" stopColor="#D93A00" />
          </linearGradient>
        </defs>
        <path d={FLAME_D} fill="url(#foTongue)" />
        <circle cx="50" cy="50" r="34" fill="url(#foDisc)" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="#140F0A" strokeWidth="3" />
        <circle cx="50" cy="50" r="28.5" fill="none" stroke="#140F0A" strokeWidth="0.9" opacity="0.45" />
      </svg>
      <span className="word" style={{ fontSize: d * 0.215 }}>
        <span className="l1">
          fla
          <svg width={d * 0.115} height={d * 0.2} viewBox="0 0 24 34" fill="none"
            style={{ margin: "0 .04em", transform: "translateY(9%)" }} aria-hidden="true">
            <path d="M15.5 1 2 19.2h7.4L8.5 33 22 14.6h-7.4L15.5 1Z" fill="#9B1B00" />
          </svg>
          h
        </span>
        <span className="l2">ordo</span>
      </span>
    </span>
  );
}

function F({ label, error, hint, children }) {
  return (
    <div className="f">
      {label && <label>{label}</label>}
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

const ic = {
  stock: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 10h18M8 5V3M16 5V3"/></svg>,
  prod: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v8a2 2 0 004 0V3M9 11v10M17 3c-1.5 1.5-2 3.5-2 6s.5 3 2 3v9"/></svg>,
  team: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>,
  rep: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>,
  watch: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  disp: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/></svg>,
};

/* ════════════════════════ تبويب المخزون ════════════════════════ */
function StockTab({ mats, setMats, cats, setCats }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("كغ");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [kind, setKind] = useState("raw");
  const [price, setPrice] = useState("");
  const [cat, setCat] = useState("");
  const [newCat, setNewCat] = useState("");
  const [e, setE] = useState({});
  const [flash, setFlash] = useState(null);

  const addCat = () => {
    const err = vName(newCat, "اسم القسم");
    if (err) return setE({ ...e, newCat: err });
    const id = "c" + Date.now();
    setCats([...cats, { id, name: newCat.trim(), parent: null, sauces: false }]);
    setCat(id); setNewCat(""); setE({ ...e, newCat: "" });
  };

  const save = () => {
    const errs = {
      name: vName(name, "اسم المادة"),
      cost: vNum(cost, "سعر الوحدة"),
      stock: vNum(stock, "الكمية الحالية", { allowZero: true }),
      price: kind === "goods" ? vNum(price, "سعر البيع") : "",
    };
    // القاعدة: سعر البيع يغطي التكلفة
    if (kind === "goods" && !errs.price && !errs.cost && Number(price) < Number(cost))
      errs.price = "سعر البيع لا يقل عن سعر الشراء";
    setE(errs);
    if (Object.values(errs).some(Boolean)) return setFlash({ k: "no", t: "راجع الحقول المعلّمة." });

    setMats([...mats, {
      id: "m" + Date.now(), name: name.trim(), unit, cost: +cost, stock: +stock, kind,
      ...(kind === "goods" ? { price: +price, category: cat || null } : {}),
    }]);
    setName(""); setCost(""); setStock(""); setPrice("");
    setFlash({ k: "ok", t: "تمت إضافة المادة إلى مخزونك." });
  };

  const low = (m) => m.stock <= 0 ? 0 : Math.min(100, (m.stock / (m.kind === "goods" ? 50 : 10)) * 100);

  return (
    <>
      <div className="card">
        <h2>إضافة مادة</h2>
        <p className="lead">المواد الأولية ومواد التغليف التي تُصنع منها منتجاتك، أو سلع تُباع كما هي.</p>

        <F label="اسم المادة" error={e.name}>
          <input className={e.name ? "bad" : ""} value={name} placeholder="مثال: دقيق"
            onChange={(v) => { setName(v.target.value); setE({ ...e, name: "" }); }} maxLength={60} />
        </F>

        <div className="row2">
          <F label="وحدة القياس">
            <select value={unit} onChange={(v) => setUnit(v.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </F>
          <F label="سعر الوحدة (دج)" error={e.cost}>
            <input className={e.cost ? "bad" : ""} value={cost} inputMode="decimal" placeholder="0"
              onChange={(v) => { setCost(numOnly(v.target.value)); setE({ ...e, cost: "" }); }} />
          </F>
        </div>

        <F label="الكمية الحالية" error={e.stock}>
          <input className={e.stock ? "bad" : ""} value={stock} inputMode="decimal" placeholder="0"
            onChange={(v) => { setStock(numOnly(v.target.value)); setE({ ...e, stock: "" }); }} />
        </F>

        <div className="seg2">
          <button className={kind === "raw" ? "on" : ""} onClick={() => setKind("raw")}>مادة أوّلية</button>
          <button className={kind === "goods" ? "on" : ""} onClick={() => setKind("goods")}>سلعة تجارية</button>
        </div>

        {kind === "goods" && (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              سلعة تشتريها وتبيعها كما هي. ستظهر للزبون في قائمة الطلب وتُخصم من مخزونك عند تأكيد الدفع.
            </p>
            <F label="سعر البيع للزبون (دج)" error={e.price}>
              <input className={e.price ? "bad" : ""} value={price} inputMode="decimal" placeholder="0"
                onChange={(v) => { setPrice(numOnly(v.target.value)); setE({ ...e, price: "" }); }} />
            </F>
            <F label="القسم / التصنيف">
              <select value={cat} onChange={(v) => setCat(v.target.value)}>
                <option value="">— بلا تصنيف —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </F>
            <F error={e.newCat}>
              <div className="row2">
                <input className={e.newCat ? "bad" : ""} value={newCat} placeholder="مثال: غازية"
                  onChange={(v) => { setNewCat(v.target.value); setE({ ...e, newCat: "" }); }} />
                <button className="ghost" style={{ marginTop: 0 }} onClick={addCat}>إنشاء قسم</button>
              </div>
            </F>
          </>
        )}

        {flash && <div className={"flash " + flash.k}>{flash.t}</div>}
        <button className="save" onClick={save}>حفظ المادة</button>
      </div>

      <div className="card">
        <h2>المخزون الحالي</h2>
        {mats.length === 0 && <div className="empty">لا مواد بعد.</div>}
        {mats.map((m) => (
          <div className="item" key={m.id} style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span>
                <span className="nm">{m.name}</span>
                <span className={"tag " + (m.kind === "goods" ? "goods" : "raw")}>
                  {m.kind === "goods" ? "سلعة تجارية" : "مادة أوّلية"}
                </span>
                {m.stock <= 0 && <span className="tag low">نفد</span>}
                <span className="sb" style={{ display: "block" }}>
                  {money(m.cost)} دج / {m.unit}
                  {m.kind === "goods" && ` · يُباع بـ ${money(m.price)} دج`}
                </span>
              </span>
              <span className="rt">
                <span className="big">{qty(m.stock)} {m.unit}</span>
                <span className="sb" style={{ display: "block" }}>المتوفّر</span>
              </span>
            </div>
            <div className="bar">
              <i style={{ width: low(m) + "%", background: m.stock <= 0 ? "var(--bad)" : low(m) < 30 ? "var(--flame)" : "var(--good)" }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ════════════════════════ تبويب المنتجات ════════════════════════ */
function ProductsTab({ mats, cats, setCats, products, setProducts }) {
  const [cName, setCName] = useState("");
  const [cParent, setCParent] = useState("");
  const [cSauces, setCSauces] = useState(true);
  const [cErr, setCErr] = useState("");

  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat, setPCat] = useState("");
  const [parts, setParts] = useState([{ mid: "", q: "" }]);
  const [pe, setPe] = useState({});
  const [flash, setFlash] = useState(null);

  const matById = (id) => mats.find((m) => m.id === id);

  const cost = useMemo(
    () => parts.reduce((s, p) => {
      const m = matById(p.mid);
      return s + (m && Number(p.q) > 0 ? m.cost * Number(p.q) : 0);
    }, 0),
    [parts, mats]
  );
  const margin = Number(pPrice || 0) - cost;

  const saveCat = () => {
    const err = vName(cName, "الاسم");
    setCErr(err);
    if (err) return;
    setCats([...cats, { id: "c" + Date.now(), name: cName.trim(), parent: cParent || null, sauces: cSauces }]);
    setCName("");
  };

  const saveProduct = () => {
    const clean = parts.filter((p) => p.mid && Number(p.q) > 0);
    const errs = {
      name: vName(pName, "اسم المنتج"),
      price: vNum(pPrice, "السعر"),
      parts: clean.length === 0 ? "أضف مكوّناً واحداً على الأقل" : "",
    };
    // القاعدة: سعر البيع يغطي تكلفة المواد
    if (!errs.price && !errs.parts && Number(pPrice) < cost)
      errs.price = `السعر لا يغطي تكلفة المواد (${money(cost)} دج)`;
    setPe(errs);
    if (Object.values(errs).some(Boolean)) return setFlash({ k: "no", t: "لا يمكن حفظ منتج يُباع بخسارة." });

    setProducts([...products, {
      id: "p" + Date.now(), name: pName.trim(), price: +pPrice, category: pCat || null,
      parts: clean.map((p) => ({ mid: p.mid, q: Number(p.q) })),
    }]);
    setPName(""); setPPrice(""); setParts([{ mid: "", q: "" }]);
    setFlash({ k: "ok", t: "تم حفظ المنتج." });
  };

  const catName = (id) => cats.find((c) => c.id === id)?.name || "بلا تصنيف";

  return (
    <>
      <div className="card">
        <h2>الأقسام والتصنيفات</h2>
        <p className="lead">قسم رئيسي (مثل المشروبات) قد يحتوي تصنيفات، وكل تصنيف قد يحتوي منتجات.</p>

        <F label="يوضع داخل">
          <select value={cParent} onChange={(v) => setCParent(v.target.value)}>
            <option value="">— قسم رئيسي —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </F>
        <F label="الاسم" error={cErr}>
          <input className={cErr ? "bad" : ""} value={cName} placeholder="مثال: المشروبات / غازية / شاورما"
            onChange={(v) => { setCName(v.target.value); setCErr(""); }} maxLength={60} />
        </F>
        <F label="الصلصات">
          <div className="seg2" style={{ marginTop: 0 }}>
            <button className={cSauces ? "on" : ""} onClick={() => setCSauces(true)}>تظهر</button>
            <button className={!cSauces ? "on" : ""} onClick={() => setCSauces(false)}>لا تظهر</button>
          </div>
        </F>
        <button className="save" onClick={saveCat}>حفظ القسم</button>

        <p className="sec">الأقسام الحالية</p>
        {cats.map((c) => (
          <div className="item" key={c.id}>
            <span>
              <span className="nm">{c.name}</span>
              <span className="sb" style={{ display: "block" }}>
                {c.parent ? `داخل ${catName(c.parent)}` : "قسم رئيسي"} · {c.sauces ? "بصلصات" : "بلا صلصات"}
              </span>
            </span>
            <button className="mini red" onClick={() => setCats(cats.filter((x) => x.id !== c.id))}>حذف</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>إضافة منتج</h2>
        <p className="lead">المنتج يُكوَّن من مواد المخزون التي تُطرح تلقائياً عند تأكيد الدفع.</p>

        <F label="اسم المنتج" error={pe.name}>
          <input className={pe.name ? "bad" : ""} value={pName} placeholder="مثال: بيتزا مارغريتا"
            onChange={(v) => { setPName(v.target.value); setPe({ ...pe, name: "" }); }} maxLength={60} />
        </F>
        <div className="row2">
          <F label="السعر (دج)" error={pe.price}>
            <input className={pe.price ? "bad" : ""} value={pPrice} inputMode="decimal" placeholder="0"
              onChange={(v) => { setPPrice(numOnly(v.target.value)); setPe({ ...pe, price: "" }); }} />
          </F>
          <F label="القسم / التصنيف">
            <select value={pCat} onChange={(v) => setPCat(v.target.value)}>
              <option value="">— بلا تصنيف —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </F>
        </div>

        <F label="مكوّنات المنتج (من المخزون)" error={pe.parts}>
          {parts.map((p, i) => (
            <div className="part" key={i}>
              <select value={p.mid} onChange={(v) => {
                const n = [...parts]; n[i] = { ...n[i], mid: v.target.value }; setParts(n); setPe({ ...pe, parts: "" });
              }}>
                <option value="">اختر مادة…</option>
                {mats.filter((m) => m.kind === "raw").map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
              <input value={p.q} inputMode="decimal" placeholder="الكمية"
                onChange={(v) => { const n = [...parts]; n[i] = { ...n[i], q: numOnly(v.target.value) }; setParts(n); }} />
              <button className="x" onClick={() => setParts(parts.length > 1 ? parts.filter((_, j) => j !== i) : [{ mid: "", q: "" }])}>✕</button>
            </div>
          ))}
        </F>
        <button className="ghost" onClick={() => setParts([...parts, { mid: "", q: "" }])}>أضف مكوّناً</button>

        <div className="costbox">
          <div className="costline"><span>تكلفة المواد</span><b>{money(cost)} دج</b></div>
          <div className="costline"><span>سعر البيع</span><b>{money(Number(pPrice || 0))} دج</b></div>
          <div className={"costline " + (margin >= 0 ? "profit" : "loss")}>
            <span>الربح لكل وحدة</span><b>{money(margin)} دج</b>
          </div>
        </div>
        {Number(pPrice) > 0 && margin < 0 && (
          <div className="flash no">سعر البيع أقل من تكلفة المواد — لا يمكن الحفظ.</div>
        )}
        {flash && <div className={"flash " + flash.k}>{flash.t}</div>}
        <button className="save" onClick={saveProduct}>حفظ المنتج</button>

        <p className="sec">المنتجات الحالية</p>
        {products.length === 0 && <div className="empty">لا منتجات بعد.</div>}
        {products.map((p) => {
          const c = p.parts.reduce((s, x) => s + (matById(x.mid)?.cost || 0) * x.q, 0);
          return (
            <div className="item" key={p.id}>
              <span>
                <span className="nm">{p.name}</span>
                <span className="sb" style={{ display: "block" }}>
                  {catName(p.category)} · تكلفة {money(c)} دج · ربح {money(p.price - c)} دج
                </span>
              </span>
              <span className="rt"><span className="big">{money(p.price)} دج</span></span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ════════════════════════ تبويب العمّال ════════════════════════ */
function WorkersTab({ workers, setWorkers }) {
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [wageType, setWageType] = useState("fixed");
  const [wage, setWage] = useState("");
  const [e, setE] = useState({});
  const [flash, setFlash] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [amount, setAmount] = useState("");

  const save = () => {
    const errs = { name: vName(name, "اسم العامل"), job: vName(job, "الوظيفة"), wage: vNum(wage, "قيمة الأجر") };
    setE(errs);
    if (Object.values(errs).some(Boolean)) return;
    setWorkers([...workers, {
      id: "w" + Date.now(), name: name.trim(), job: job.trim(), wageType, wage: +wage, paid: 0, earned: 0,
    }]);
    setName(""); setJob(""); setWage("");
    setFlash({ k: "ok", t: "تمت إضافة العامل." });
  };

  const pay = (w) => {
    const err = vNum(amount, "المبلغ");
    if (err) return setE({ ...e, pay: err });
    const due = w.earned - w.paid;
    // القاعدة: رصيد العامل لا يصبح سالباً
    if (Number(amount) > due)
      return setE({ ...e, pay: `المستحقّ ${money(due)} دج فقط — لا يمكن تجاوزه` });
    setWorkers(workers.map((x) => x.id === w.id ? { ...x, paid: x.paid + Number(amount) } : x));
    setAmount(""); setPayFor(null); setE({ ...e, pay: "" });
    setFlash({ k: "ok", t: "تم تسجيل الدفع." });
  };

  return (
    <>
      <div className="card">
        <h2>إضافة عامل</h2>
        <F label="اسم العامل" error={e.name}>
          <input className={e.name ? "bad" : ""} value={name} placeholder="الاسم الكامل"
            onChange={(v) => { setName(v.target.value); setE({ ...e, name: "" }); }} maxLength={60} />
        </F>
        <F label="نوع العامل / الوظيفة" error={e.job}>
          <input className={e.job ? "bad" : ""} value={job} placeholder="مثال: طاهٍ، كاشير"
            onChange={(v) => { setJob(v.target.value); setE({ ...e, job: "" }); }} maxLength={60} />
        </F>
        <F label="نوع الأجر">
          <div className="seg2" style={{ marginTop: 0 }}>
            <button className={wageType === "fixed" ? "on" : ""} onClick={() => setWageType("fixed")}>ثابت</button>
            <button className={wageType === "var" ? "on" : ""} onClick={() => setWageType("var")}>متغيّر</button>
          </div>
        </F>
        <F label={wageType === "fixed" ? "قيمة الأجر اليومي (دج)" : "الأجر لكل مناوبة (دج)"} error={e.wage}>
          <input className={e.wage ? "bad" : ""} value={wage} inputMode="decimal" placeholder="0"
            onChange={(v) => { setWage(numOnly(v.target.value)); setE({ ...e, wage: "" }); }} />
        </F>
        {flash && <div className={"flash " + flash.k}>{flash.t}</div>}
        <button className="save" onClick={save}>حفظ العامل</button>
      </div>

      <div className="card">
        <h2>العمّال</h2>
        {workers.length === 0 && <div className="empty">لا يوجد عمّال بعد.</div>}
        {workers.map((w) => {
          const due = w.earned - w.paid;
          return (
            <div className="item" key={w.id} style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span>
                  <span className="nm">{w.name}</span>
                  <span className="sb" style={{ display: "block" }}>
                    {w.job} · {w.wageType === "fixed" ? "أجر ثابت" : "أجر متغيّر"} {money(w.wage)} دج
                  </span>
                </span>
                <span className="rt">
                  <span className="big" style={{ color: due > 0 ? "var(--flame)" : "var(--good)" }}>
                    {money(due)} دج
                  </span>
                  <span className="sb" style={{ display: "block" }}>المستحقّ</span>
                </span>
              </div>
              {payFor === w.id ? (
                <>
                  <F error={e.pay}>
                    <div className="row2">
                      <input value={amount} inputMode="decimal" placeholder={`حتى ${money(due)} دج`}
                        onChange={(v) => { setAmount(numOnly(v.target.value)); setE({ ...e, pay: "" }); }} />
                      <button className="mini flame" onClick={() => pay(w)}>تأكيد الدفع</button>
                    </div>
                  </F>
                  <button className="ghost" onClick={() => { setPayFor(null); setE({ ...e, pay: "" }); }}>إلغاء</button>
                </>
              ) : (
                <button className="ghost" disabled={due <= 0} style={{ opacity: due <= 0 ? .45 : 1 }}
                  onClick={() => setPayFor(w.id)}>
                  {due <= 0 ? "لا مستحقّات" : "دفع للعامل"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ════════════════════════ تبويب التقارير ════════════════════════ */
const RANGES = [["day", "اليوم"], ["week", "الأسبوع"], ["month", "الشهر"], ["custom", "مخصّص"]];

function ReportsTab({ orders, products, mats, workers }) {
  const [range, setRange] = useState("day");

  const paid = orders.filter((o) => o.status === "cooking" || o.status === "served");
  const prodById = (id) => products.find((p) => p.id === id);
  const matById = (id) => mats.find((m) => m.id === id);

  const unitCost = (p) => p.parts.reduce((s, x) => s + (matById(x.mid)?.cost || 0) * x.q, 0);

  const sales = paid.reduce((s, o) =>
    s + o.lines.reduce((t, l) => t + (prodById(l.pid)?.price || 0) * l.q, 0), 0);
  const matCost = paid.reduce((s, o) =>
    s + o.lines.reduce((t, l) => { const p = prodById(l.pid); return t + (p ? unitCost(p) * l.q : 0); }, 0), 0);
  const wages = workers.reduce((s, w) => s + (w.wageType === "fixed" ? w.wage : 0), 0);
  const profit = sales - matCost - wages;

  const top = useMemo(() => {
    const map = {};
    paid.forEach((o) => o.lines.forEach((l) => { map[l.pid] = (map[l.pid] || 0) + l.q; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [paid]);

  const consumed = useMemo(() => {
    const map = {};
    paid.forEach((o) => o.lines.forEach((l) => {
      const p = prodById(l.pid);
      p?.parts.forEach((x) => { map[x.mid] = (map[x.mid] || 0) + x.q * l.q; });
    }));
    return Object.entries(map);
  }, [paid, products]);

  return (
    <>
      <div className="range">
        {RANGES.map(([k, t]) => (
          <b key={k} className={range === k ? "on" : ""} onClick={() => setRange(k)}>{t}</b>
        ))}
      </div>

      <div className="grid2">
        <div className="kpi"><div className="l">المبيعات</div><div className="v money">{money(sales)} دج</div></div>
        <div className="kpi"><div className="l">عدد الطلبات</div><div className="v">{paid.length}</div></div>
        <div className="kpi"><div className="l">تكلفة المواد</div><div className="v flame">{money(matCost)} دج</div></div>
        <div className="kpi"><div className="l">أجور العمّال</div><div className="v">{money(wages)} دج</div></div>
      </div>

      <div className="card">
        <h2>الأرباح</h2>
        <div className="costbox" style={{ marginTop: 12 }}>
          <div className="costline"><span>المبيعات</span><b>{money(sales)} دج</b></div>
          <div className="costline"><span>− تكلفة المواد</span><b>{money(matCost)} دج</b></div>
          <div className="costline"><span>− الأجور</span><b>{money(wages)} دج</b></div>
          <div className={"costline " + (profit >= 0 ? "profit" : "loss")}
            style={{ borderTop: "1.5px solid var(--hair)", marginTop: 6, paddingTop: 9 }}>
            <span>صافي الربح</span><b style={{ fontSize: 17 }}>{money(profit)} دج</b>
          </div>
        </div>
        <p className="hint">تُحسب من الطلبات المدفوعة فقط. الطلبات غير المدفوعة لا تدخل في أي رقم هنا.</p>
      </div>

      <div className="card">
        <h2>المنتجات الأكثر مبيعاً</h2>
        {top.length === 0 && <div className="empty">لا مبيعات بعد.</div>}
        {top.map(([pid, q]) => (
          <div className="item" key={pid}>
            <span className="nm">{prodById(pid)?.name || "—"}</span>
            <span className="big">{q} قطعة</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>المواد المستهلكة من المخزون</h2>
        {consumed.length === 0 && <div className="empty">لا استهلاك بعد.</div>}
        {consumed.map(([mid, q]) => (
          <div className="item" key={mid}>
            <span className="nm">{matById(mid)?.name || "—"}</span>
            <span className="big">{qty(q)} {matById(mid)?.unit}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ════════════════════════ تبويب المتابعة ════════════════════════ */
function WatchTab({ orders, setOrders, products, mats, setMats }) {
  const [flash, setFlash] = useState(null);
  const prodById = (id) => products.find((p) => p.id === id);
  const total = (o) => o.lines.reduce((t, l) => t + (prodById(l.pid)?.price || 0) * l.q, 0);

  /* تأكيد الدفع: هنا فقط يُخصم المخزون، وهنا فقط يظهر الطلب للمطبخ. */
  const confirmPay = (o) => {
    const need = {};
    o.lines.forEach((l) => prodById(l.pid)?.parts.forEach((x) => {
      need[x.mid] = (need[x.mid] || 0) + x.q * l.q;
    }));
    const short = Object.entries(need).find(([mid, q]) => (mats.find((m) => m.id === mid)?.stock || 0) < q);
    if (short) {
      const m = mats.find((x) => x.id === short[0]);
      return setFlash({ k: "no", t: `المخزون لا يكفي: ${m?.name}. لا يمكن تمرير الطلب.` });
    }
    setMats(mats.map((m) => need[m.id] ? { ...m, stock: qty(m.stock - need[m.id]) } : m));
    setOrders(orders.map((x) => x.id === o.id ? { ...x, status: "cooking" } : x));
    setFlash({ k: "ok", t: `تم تأكيد الدفع — الطلب ${o.no} انتقل للمطبخ وخُصمت مواده.` });
  };

  const serve = (o) => {
    setOrders(orders.map((x) => x.id === o.id ? { ...x, status: "served" } : x));
    setFlash({ k: "ok", t: `تم تسليم الطلب ${o.no}.` });
  };
  const reject = (o) => {
    setOrders(orders.map((x) => x.id === o.id ? { ...x, status: "rejected" } : x));
    setFlash({ k: "warn", t: `رُفض الطلب ${o.no} — لم يُخصم أي شيء من المخزون.` });
  };

  const g = (s) => orders.filter((o) => o.status === s);
  const Card = ({ o, kind, children }) => (
    <div className="ord">
      <div className="ordtop">
        <span className={"no " + kind}>{o.no}</span>
        <span>
          <span style={{ fontFamily: "'Baloo Bhaijaan 2'", fontWeight: 700 }}>طلب رقم {o.no}</span>
          <span className="sb" style={{ display: "block", fontSize: 12.5, color: "var(--mute)" }}>الساعة {o.at}</span>
        </span>
        <span className="ordtot">{money(total(o))} دج</span>
      </div>
      <div className="lines">
        {o.lines.map((l, i) => (
          <div key={i}>
            {prodById(l.pid)?.name} × {l.q}
            {l.sauces?.length > 0 && <span className="sauce"> · صلصات: {l.sauces.join("، ")}</span>}
          </div>
        ))}
      </div>
      {children}
    </div>
  );

  return (
    <>
      <div className="grid3">
        <div className="cnt wait"><div className="n">{g("unpaid").length}</div><div className="l">ينتظر الدفع</div></div>
        <div className="cnt cook"><div className="n">{g("cooking").length}</div><div className="l">قيد التحضير</div></div>
        <div className="cnt done"><div className="n">{g("served").length}</div><div className="l">سُلّم اليوم</div></div>
      </div>

      {flash && <div className={"flash " + flash.k}>{flash.t}</div>}

      <div className="card">
        <h2>عند الكاشير — بانتظار الدفع</h2>
        <p className="lead">المطبخ لا يرى الطلب قبل تأكيد الدفع، والمخزون لا يُمسّ.</p>
        {g("unpaid").length === 0 && <div className="empty">لا شيء الآن.</div>}
        {g("unpaid").map((o) => (
          <Card o={o} kind="wait" key={o.id}>
            <button className="save" onClick={() => confirmPay(o)}>تأكيد الدفع وتمرير للمطبخ</button>
            <button className="ghost" style={{ color: "var(--bad)" }} onClick={() => reject(o)}>رفض الطلب</button>
          </Card>
        ))}
      </div>

      <div className="card">
        <h2>في المطبخ — قيد التحضير</h2>
        {g("cooking").length === 0 && <div className="empty">لا شيء الآن.</div>}
        {g("cooking").map((o) => (
          <Card o={o} kind="cook" key={o.id}>
            <button className="save" onClick={() => serve(o)}>تم التسليم ✓</button>
          </Card>
        ))}
      </div>

      <div className="card">
        <h2>سُلّم اليوم</h2>
        {g("served").length === 0 && <div className="empty">لا شيء بعد.</div>}
        {g("served").map((o) => <Card o={o} kind="done" key={o.id} />)}
      </div>
    </>
  );
}

/* ════════════════════════ تبويب الشاشات ════════════════════════ */
function ScreensTab() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [e, setE] = useState({});
  const [made, setMade] = useState(false);

  const save = () => {
    const errs = {
      email: !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(email.trim())
        ? "أدخل بريداً إلكترونياً صحيحاً" : "",
      pass: pass.length < 8 ? "كلمة السر لا تقل عن 8 رموز"
        : !/[a-zA-Z\u0621-\u064A]/.test(pass) || !/\d/.test(pass) ? "تجمع بين حروف وأرقام" : "",
    };
    setE(errs);
    if (Object.values(errs).some(Boolean)) return;
    setMade(true);
  };

  const screens = [
    ["شاشة الزبون", "على تابلت المحل — لإنشاء الطلبات", "#FFB703", "#14213D",
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M7 3v8a2 2 0 004 0V3M9 11v10M17 3c-1.5 1.5-2 3.5-2 6s.5 3 2 3v9"/></svg>],
    ["شاشة الكاشير", "على جهاز الصندوق — لاستلام الدفع", "#12805C", "#fff",
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>],
    ["شاشة المطبخ", "على شاشة الطهاة — للتحضير والتسليم", "#FB5607", "#fff",
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13h12v4a3 3 0 01-3 3H9a3 3 0 01-3-3v-4Z"/><path d="M7 13a3.2 3.2 0 01.3-5.6A3.4 3.4 0 0112 5a3.4 3.4 0 014.7 2.4A3.2 3.2 0 0117 13"/></svg>],
  ];

  return (
    <>
      <div className="card">
        <h2>دخول الكاشير والمطبخ</h2>
        <p className="lead">
          حساب منفصل عن حسابك — يستلم الطلبات ويسلّمها فقط، ولا يرى المخزون ولا التقارير ولا الأرباح.
        </p>
        <div className="item" style={{ paddingBottom: 4 }}>
          <span className="sb">الحالة</span>
          <span className="big" style={{ color: made ? "var(--good)" : "var(--bolt)" }}>
            {made ? "مُفعّل" : "لم يُنشأ بعد"}
          </span>
        </div>
        <F label="البريد الإلكتروني لحساب الموظّفين" error={e.email}>
          <input className={e.email ? "bad" : ""} value={email} placeholder="staff@example.com"
            onChange={(v) => { setEmail(v.target.value); setE({ ...e, email: "" }); }} />
        </F>
        <F label="كلمة السر" error={e.pass} hint="8 رموز فأكثر، تجمع حروفاً وأرقاماً">
          <input className={e.pass ? "bad" : ""} type="password" value={pass} placeholder="8 رموز على الأقل"
            onChange={(v) => { setPass(v.target.value); setE({ ...e, pass: "" }); }} />
        </F>
        {made && <div className="flash ok">تم حفظ حساب الموظّفين.</div>}
        <button className="save" onClick={save}>حفظ حساب الموظّفين</button>
      </div>

      <div className="card">
        <h2>نسخة احتياطية</h2>
        <p className="lead">
          نزّل نسخة من كل بياناتك (المخزون، المنتجات، الأقسام، العمّال، الطلبات) كملف واحد.
          احفظه في مكان آمن، وكرّره أسبوعياً.
        </p>
        <button className="save">تنزيل نسخة احتياطية</button>
      </div>

      <div className="card">
        <h2>شاشات المحل</h2>
        <p className="lead">كل زر يفتح الشاشة في تبويب جديد حاملاً معرّف مطعمك تلقائياً — بلا نسخ يدوي.</p>
        {screens.map(([t, d, bg, fg, icon]) => (
          <button className="screen" key={t}>
            <span className="sq" style={{ background: bg, color: fg }}>{icon}</span>
            <span>
              <span className="t" style={{ display: "block" }}>{t}</span>
              <span className="d">{d}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ════════════════════════ الجذر ════════════════════════ */
const TABS = [
  ["stock", "المخزون", ic.stock],
  ["prod", "المنتجات", ic.prod],
  ["team", "العمّال", ic.team],
  ["rep", "التقارير", ic.rep],
  ["watch", "متابعة", ic.watch],
  ["disp", "الشاشات", ic.disp],
];

const HEADS = {
  stock: ["المخزون", "موادك وسلعك، وما تبقّى منها لحظة بلحظة."],
  prod: ["المنتجات", "أقسام قائمتك ومنتجاتها ومكوّنات كل منتج."],
  team: ["العمّال", "فريقك وأجورهم ومستحقّاتهم."],
  rep: ["التقارير", "مبيعاتك وتكاليفك وأرباحك."],
  watch: ["متابعة", "الطلبات من الكاشير إلى المطبخ إلى التسليم."],
  disp: ["الشاشات", "حساب الموظّفين وشاشات المحل ونسختك الاحتياطية."],
};

export default function App() {
  const [tab, setTab] = useState("stock");
  const [mats, setMats] = useState(SEED_MATERIALS);
  const [cats, setCats] = useState(SEED_CATS);
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [workers, setWorkers] = useState(SEED_WORKERS);
  const [orders, setOrders] = useState(SEED_ORDERS);
  const top = useRef(null);

  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, [tab]);

  return (
    <div className="mr">
      <style>{CSS}</style>
      <div className="wrap" ref={top}>
        <div className="top">
          <div className="brand">
            <Logo d={46} />
            <span className="shop">لوحة التاجر · نيتي</span>
          </div>
          <button className="out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 17l5-5-5-5M20 12H9M12 4H7a3 3 0 00-3 3v10a3 3 0 003 3h5" />
            </svg>
            خروج
          </button>
        </div>

        <div className="pagehead">
          <h1>{HEADS[tab][0]}</h1>
          <p>{HEADS[tab][1]}</p>
        </div>

        {tab === "stock" && <StockTab mats={mats} setMats={setMats} cats={cats} setCats={setCats} />}
        {tab === "prod" && <ProductsTab mats={mats} cats={cats} setCats={setCats} products={products} setProducts={setProducts} />}
        {tab === "team" && <WorkersTab workers={workers} setWorkers={setWorkers} />}
        {tab === "rep" && <ReportsTab orders={orders} products={products} mats={mats} workers={workers} />}
        {tab === "watch" && <WatchTab orders={orders} setOrders={setOrders} products={products} mats={mats} setMats={setMats} />}
        {tab === "disp" && <ScreensTab />}
      </div>

      <nav className="nav">
        <div className="navin">
          {TABS.map(([k, t, icon]) => (
            <button key={k} className={"nb" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
              {icon}<span>{t}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
