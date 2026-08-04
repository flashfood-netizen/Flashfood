import React, { useState, useEffect, useRef } from "react";
import api from "./lib/api";

/* ──────────────────────────────────────────────────────────────
   إعدادات المنصة — مصدرها لاحقاً جدول app_settings في Supabase
   (قراءة عامة، كتابة للأدمن فقط). هنا قيم مبدئية للعرض.
   ────────────────────────────────────────────────────────────── */
const SETTINGS = {
  rip: "007799999002070490038",
  plans: {
    month: { id: "month", title: "شهر", note: "اشتراك شهري", price: 1700, unit: "كل شهر" },
    six: { id: "six", title: "6 أشهر", note: "وفّر أكثر", price: 6800, unit: "كل 6 أشهر" },
    life: { id: "life", title: "مدى الحياة", note: "دفعة واحدة", price: 14990, unit: "نهائي" },
  },
};

const money = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/* ──────────────────────────────────────────────────────────────
   التحقّق من المدخلات
   المبدأ: كل مدخل يُعامل كنصّ. لا نحاول "كشف الكود" — بل نسمح
   بقائمة محارف محدّدة فقط، فيُرفض أي شيء خارجها تلقائياً.
   ────────────────────────────────────────────────────────────── */
const NAME_OK = /^[\u0621-\u064A\u0660-\u0669a-zA-Z0-9 .'\-]+$/;
const EMAIL_OK = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

const V = {
  name(v, label) {
    const s = v.trim();
    if (!s) return `${label} مطلوب`;
    if (!NAME_OK.test(s)) return `${label} يقبل الحروف والأرقام فقط`;
    if (s.length < 4) return `${label} لا يقل عن 4 رموز`;
    if (s.length > 60) return `${label} طويل جداً`;
    return "";
  },
  phone(v) {
    const s = v.trim();
    if (!s) return "رقم الهاتف مطلوب";
    if (!/^\d{10}$/.test(s)) return "رقم الهاتف يتكوّن من 10 أرقام";
    if (!/^0[567]/.test(s)) return "رقم الهاتف يبدأ بـ 05 أو 06 أو 07";
    return "";
  },
  email(v) {
    const s = v.trim();
    if (!s) return "البريد الإلكتروني مطلوب";
    if (s.length > 254 || !EMAIL_OK.test(s)) return "أدخل بريداً إلكترونياً صحيحاً";
    return "";
  },
  password(v) {
    if (!v) return "كلمة السر مطلوبة";
    if (v.length < 8) return "كلمة السر لا تقل عن 8 رموز";
    if (!/[a-zA-Z\u0621-\u064A]/.test(v) || !/\d/.test(v)) return "كلمة السر تجمع بين حروف وأرقام";
    if (/\s/.test(v)) return "كلمة السر بدون مسافات";
    return "";
  },
  confirm(v, pass) {
    if (!v) return "أعد كتابة كلمة السر";
    if (v !== pass) return "كلمتا السر غير متطابقتين";
    return "";
  },
  reference(v) {
    const s = v.trim();
    if (!s) return "مرجع التحويل مطلوب";
    if (!/^\d+$/.test(s)) return "مرجع التحويل أرقام فقط";
    if (s.length < 10) return "مرجع التحويل لا يقل عن 10 أرقام";
    return "";
  },
};

/* ────────────────────────────  الأنماط  ──────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@500;600;700;800&family=Alexandria:wght@300;400;500;600&display=swap');

.fo *, .fo *::before, .fo *::after { box-sizing:border-box; }
.fo {
  --night:#14213D; --night2:#1E2F52; --bolt:#FFB703; --flame:#FB5607;
  --bg:#F6F8FC; --card:#FFFFFF; --mute:#68738C; --hair:#E4E9F2;
  --good:#12805C;
  direction:rtl; min-height:100vh; background:var(--bg); color:var(--night);
  font-family:'Alexandria', system-ui, sans-serif; font-size:15.5px; line-height:1.8;
  font-weight:300; -webkit-font-smoothing:antialiased;
}
.fo h1,.fo h2,.fo h3,.fo .disp { font-family:'Baloo Bhaijaan 2', system-ui, sans-serif; font-weight:700; line-height:1.45; margin:0; }
.fo p { margin:0; }
.fo button { font:inherit; color:inherit; cursor:pointer; border:none; background:none; }
.fo :focus-visible { outline:3px solid var(--bolt); outline-offset:3px; border-radius:8px; }

.fo .wrap { max-width:520px; margin:0 auto; padding:0 22px 90px; }
.fo .screen { animation:rise .34s ease both; }
@keyframes rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }

/* الترويسة — الشعار في الوسط */
.fo .bar { position:relative; display:flex; align-items:center; justify-content:center; padding:24px 0 0; min-height:64px; }
.fo .back { position:absolute; inset-inline-start:0; display:inline-flex; align-items:center; gap:6px;
  font-size:14.5px; color:var(--mute); padding:10px 4px; }
.fo .back:hover { color:var(--night); }
  font-weight:800; letter-spacing:-.02em; line-height:1;
  direction:ltr; unicode-bidi:isolate; }

/* البطل — متمركز */
.fo .center { text-align:center; }
.fo .tag { display:inline-block; font-size:13.5px; font-weight:500; color:var(--night);
  background:#FFF0CC; padding:6px 18px; border-radius:99px; margin-top:26px; }
.fo .tag.green { background:#DCF2EA; color:var(--good); }
.fo .tag.orange { background:#FFE8DC; color:#C33F05; }
.fo h1.big { font-size:31px; margin:18px 0 14px; letter-spacing:-.01em; }
.fo h1.mid { font-size:27px; margin:16px 0 12px; }
.fo .lede { font-size:16px; color:var(--mute); }
.fo .lede.tight { max-width:400px; margin-inline:auto; }

/* سير العملية — ثلاث محطات موصولة، بلا أرقام */
.fo .track { position:relative; margin:38px 0 0; }
.fo .track::before { content:''; position:absolute; top:31px; inset-inline:16%;
  border-top:2px dashed var(--hair); }
.fo .stations { position:relative; display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.fo .stn { text-align:center; }
.fo .orb { width:62px; height:62px; border-radius:22px; margin:0 auto 12px; display:grid; place-items:center;
  background:var(--card); color:var(--mute); box-shadow:0 2px 10px rgba(20,33,61,.07);
  transition:background .5s ease, color .5s ease, transform .5s ease, box-shadow .5s ease; }
.fo .stn.live .orb { background:var(--night); color:var(--bolt); transform:translateY(-5px);
  box-shadow:0 10px 22px rgba(20,33,61,.22); }
.fo .stn .nm { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:16.5px; display:block; }
.fo .stn .ds { font-size:13px; color:var(--mute); line-height:1.7; display:block; margin-top:2px; }

/* أزرار */
.fo .btn { display:block; width:100%; max-width:360px; margin-inline:auto; text-align:center;
  padding:16px 22px; border-radius:16px; font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:17px;
  transition:transform .12s ease, opacity .2s; }
.fo .btn:active { transform:scale(.98); }
.fo .btn-night { background:var(--night); color:#fff; }
.fo .btn-bolt { background:var(--bolt); color:var(--night); }
.fo .btn-flame { background:var(--flame); color:#fff; }
.fo .btn-line { background:var(--card); color:var(--night); box-shadow:inset 0 0 0 2px var(--hair); }
.fo .gap { margin-top:34px; }
.fo .foot { text-align:center; font-size:15px; color:var(--mute); margin-top:22px; }
.fo .link { font-weight:600; color:var(--flame); text-decoration:underline; text-underline-offset:5px; text-decoration-thickness:2px; }

/* المزايا — لقطات كبيرة من داخل المنتج */
.fo .fx { border-radius:28px; padding:28px 20px 24px; margin-top:22px; }
.fo .fx.a { background:#FFF1E9; }
.fo .fx.b { background:#FFF6E0; }
.fo .fx.c { background:#E7F5EF; }
.fo .fxlabel { display:inline-block; font-size:12.5px; font-weight:500; padding:5px 14px;
  border-radius:99px; background:rgba(255,255,255,.75); }
.fo .fx h3 { font-size:23px; margin:14px 0 8px; letter-spacing:-.01em; }
.fo .fx > p { font-size:15px; color:#5A6478; line-height:1.75; }
.fo .frame { background:var(--night); border-radius:24px; padding:9px; margin-top:22px;
  box-shadow:0 18px 40px rgba(20,33,61,.26); }
.fo .glass { background:#fff; border-radius:17px; padding:14px; overflow:hidden; }
.fo .bezel { width:44px; height:4px; border-radius:99px; background:rgba(255,255,255,.3);
  margin:7px auto 2px; }
.fo .ticks { list-style:none; padding:0; margin:20px 0 0; }
.fo .ticks li { display:flex; gap:9px; align-items:flex-start; font-size:14.5px;
  color:#3B4559; padding:5px 0; }
.fo .ticks svg { flex:none; margin-top:5px; }

/* شريط علوي داخل اللقطات */
.fo .mhead { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.fo .mtitle { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:14px; }
.fo .mnote { font-size:11px; color:var(--mute); }

/* لقطة 1 — قائمة الزبون */
.fo .chips { display:flex; gap:6px; margin-bottom:12px; }
.fo .chipx { font-size:11px; padding:4px 11px; border-radius:99px; background:#F1F4F9; color:var(--mute); }
.fo .chipx.on { background:var(--night); color:#fff; }
.fo .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
.fo .dishc { border:1.5px solid #EDF1F7; border-radius:13px; padding:8px; position:relative; }
.fo .dishc.on { border-color:var(--flame); background:#FFF6F2; }
.fo .dishc .ph { height:42px; border-radius:9px; margin-bottom:7px; }
.fo .dishc .nm2 { font-family:'Baloo Bhaijaan 2'; font-weight:600; font-size:12.5px; }
.fo .dishc .sz { font-size:10.5px; color:var(--mute); }
.fo .qbadge { position:absolute; top:-7px; inset-inline-start:-7px; width:22px; height:22px;
  border-radius:50%; background:var(--flame); color:#fff; font-size:11px; font-weight:600;
  display:grid; place-items:center; box-shadow:0 3px 8px rgba(251,86,7,.4); }
.fo .sendbar { margin-top:12px; background:var(--night); color:#fff; border-radius:12px;
  padding:10px; text-align:center; font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:13.5px; }

/* لقطة 2 — المخزون */
.fo .srow { padding:9px 0; }
.fo .srow + .srow { border-top:1px solid #F1F4F9; }
.fo .stop { display:flex; justify-content:space-between; align-items:center; font-size:12.5px; }
.fo .stop b { font-family:'Baloo Bhaijaan 2'; font-weight:600; }
.fo .stag { font-size:10px; padding:2px 8px; border-radius:99px; }
.fo .stag.low { background:#FFE8DC; color:#C33F05; }
.fo .stag.ok { background:#E7F5EF; color:var(--good); }
.fo .sbar { height:6px; border-radius:99px; background:#EDF1F7; margin-top:6px; overflow:hidden; }
.fo .sbar span { display:block; height:100%; border-radius:99px; }
.fo .autonote { display:flex; align-items:center; gap:6px; margin-top:12px; font-size:11px;
  color:var(--good); background:#E7F5EF; border-radius:10px; padding:7px 10px; }

/* لقطة 3 — التقارير */
.fo .seg { display:flex; gap:4px; background:#F1F4F9; border-radius:10px; padding:3px; }
.fo .seg b { flex:1; text-align:center; font-size:11px; font-weight:400; padding:4px 0; border-radius:8px; color:var(--mute); }
.fo .seg b.on { background:#fff; color:var(--night); font-weight:600; box-shadow:0 1px 4px rgba(20,33,61,.1); }
.fo .cols { display:flex; align-items:flex-end; gap:7px; height:88px; margin-top:16px; }
.fo .cols i { flex:1; border-radius:6px 6px 3px 3px; background:#E3EAF3; }
.fo .cols i.mid { background:#B9C9DF; }
.fo .cols i.top2 { background:var(--night); }
.fo .cols i.peak { background:var(--good); }
.fo .days { display:flex; gap:7px; margin-top:7px; }
.fo .days span { flex:1; text-align:center; font-size:9.5px; color:var(--mute); }
.fo .growth { display:inline-flex; align-items:center; gap:5px; margin-top:12px; font-size:11.5px;
  color:var(--good); background:#E7F5EF; padding:4px 11px; border-radius:99px; font-weight:500; }

/* بطاقات المسار */
.fo .pick { display:block; width:100%; text-align:right; background:var(--card); border-radius:22px;
  padding:24px; box-shadow:0 3px 16px rgba(20,33,61,.06); margin-top:16px;
  transition:box-shadow .2s ease, transform .12s ease; }
.fo .pick:hover { box-shadow:0 8px 24px rgba(20,33,61,.13); }
.fo .pick:active { transform:scale(.99); }
.fo .pick h3 { font-size:21px; margin-top:10px; }
.fo .pick p { font-size:15px; color:var(--mute); margin-top:8px; }
.fo .chip { display:inline-block; font-size:13px; font-weight:500; padding:4px 14px; border-radius:99px; color:#fff; }
.fo .chip.green { background:var(--good); }
.fo .chip.bolt { background:var(--bolt); color:var(--night); }

/* الحقول — متوسطة ومتمركزة */
.fo .form { max-width:380px; margin:0 auto; }
.fo .field { margin-top:20px; }
.fo label { display:block; font-size:14.5px; font-weight:500; margin-bottom:7px; }
.fo .inbox { position:relative; }
.fo input { width:100%; padding:13px 16px; border:none; border-radius:14px; background:var(--card);
  box-shadow:inset 0 0 0 1.5px var(--hair); color:var(--night); font:inherit; font-weight:400;
  font-size:15px; transition:box-shadow .18s ease; }
.fo input::placeholder { color:#A9B3C7; font-weight:300; }
.fo input:focus { outline:none; box-shadow:inset 0 0 0 2px var(--night); }
.fo input.bad { box-shadow:inset 0 0 0 2px var(--flame); }
.fo input.wide { letter-spacing:.07em; }
.fo .haseye input { padding-inline-start:48px; }
.fo .eye { position:absolute; inset-inline-start:8px; top:50%; transform:translateY(-50%);
  padding:9px; color:var(--mute); border-radius:10px; }
.fo .eye:hover { color:var(--night); }
.fo .hint { font-size:13px; color:var(--mute); margin-top:7px; line-height:1.65; }
.fo .err { font-size:13px; color:var(--flame); font-weight:500; margin-top:7px; }

/* الباقات */
.fo .plan { display:flex; width:100%; max-width:380px; margin:12px auto 0; text-align:right;
  align-items:center; justify-content:space-between; gap:14px; background:var(--card);
  border-radius:18px; padding:18px 20px; box-shadow:inset 0 0 0 1.5px var(--hair); transition:box-shadow .2s ease; }
.fo .plan.on { box-shadow:inset 0 0 0 2.5px var(--bolt); background:#FFFCF4; }
.fo .plan .t { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:18px; display:block; }
.fo .plan .n { font-size:13px; color:var(--mute); }
.fo .plan .p { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:20px; white-space:nowrap; display:block; text-align:left; }
.fo .plan .u { font-size:12.5px; color:var(--mute); display:block; text-align:left; }

/* ملخّص */
.fo .sum { max-width:380px; margin:26px auto 0; background:var(--night); color:#fff;
  border-radius:22px; padding:6px 22px; }
.fo .line { display:flex; justify-content:space-between; align-items:center; padding:14px 0; font-size:15px; }
.fo .line + .line { border-top:1px solid rgba(255,255,255,.13); }
.fo .line .k { color:#9FB0CC; }
.fo .line .v { font-family:'Baloo Bhaijaan 2'; font-weight:700; }
.fo .line .v.gold { color:var(--bolt); }
.fo .ripbox { max-width:380px; margin:14px auto 0; background:var(--card); border-radius:18px;
  padding:18px 20px; box-shadow:0 3px 16px rgba(20,33,61,.06); }
.fo .ripbox .cap { font-size:13px; color:var(--mute); }
.fo .ripline { display:flex; align-items:center; gap:12px; margin-top:8px; }
.fo .ripline .val { font-size:17px; font-weight:500; letter-spacing:.05em; flex:1; word-break:break-all; line-height:1.5; }
.fo .copy { background:var(--night); color:#fff; border-radius:12px; padding:10px 18px;
  font-size:14px; font-weight:500; white-space:nowrap; }
.fo .copy.ok { background:var(--good); }

/* الحالة */
.fo .badge { width:74px; height:74px; border-radius:24px; display:grid; place-items:center;
  margin:44px auto 24px; }
.fo .badge.wait { background:var(--bolt); color:var(--night); }
.fo .badge.done { background:var(--good); color:#fff; }

@media (max-width:400px) {
  .fo h1.big { font-size:27px; }
  .fo .orb { width:54px; height:54px; border-radius:19px; }
  .fo .track::before { top:27px; }
  .fo .stn .nm { font-size:15px; }
  .fo .stn .ds { font-size:12px; }
}

.fo .mark { position:relative; display:inline-grid; place-items:center; flex:none; }
.fo .ring { position:absolute; inset:0; width:100%; height:100%; }
.fo .word { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center;
  font-family:'Baloo Bhaijaan 2', system-ui, sans-serif; font-weight:800; line-height:1.02;
  direction:ltr; unicode-bidi:isolate; letter-spacing:-.02em; }
.fo .word .l1 { color:#140F0A; display:inline-flex; align-items:center; }
.fo .word .l2 { color:#9B1B00; }

@media (prefers-reduced-motion: reduce) {
  .fo *, .fo *::before, .fo *::after { animation:none !important; transition:none !important; }
}
`;


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

/* ────────────────────────────  عناصر  ──────────────────────── */
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

function Tick({ small }) {
  const s = small ? 12 : 15;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#0F6B4C"
      strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Field({ label, hint, error, type = "text", value, onChange, placeholder, wide, maxLength, inputMode }) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div className="field">
      <label>{label}</label>
      <div className={"inbox" + (isPass ? " haseye" : "")}>
        <input
          type={isPass && show ? "text" : type}
          className={(error ? "bad " : "") + (wide ? "wide" : "")}
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} maxLength={maxLength} inputMode={inputMode}
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

function Bar({ onBack, size = 22 }) {
  return (
    <div className="bar">
      {onBack && (
        <button className="back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
          رجوع
        </button>
      )}
      <Logo d={46} />
    </div>
  );
}

/* أيقونات المحطات والمزايا */
const I = {
  order: (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" /><path d="M8 7h8M8 11h8M8 15h4" />
    </svg>
  ),
  pay: (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" />
    </svg>
  ),
  cook: (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13h12v4a3 3 0 01-3 3H9a3 3 0 01-3-3v-4Z" />
      <path d="M7 13a3.2 3.2 0 01.3-5.6A3.4 3.4 0 0112 5a3.4 3.4 0 014.7 2.4A3.2 3.2 0 0117 13" />
    </svg>
  ),
};

/* ────────────────────────────  الشاشات  ──────────────────────── */

function Landing({ go }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((s) => (s + 1) % 3), 2200);
    return () => clearInterval(t);
  }, []);

  const stations = [
    { nm: "الطلب", ds: "الزبون يختار من التابلت", ic: I.order },
    { nm: "الدفع", ds: "الكاشير يستلم ويؤكّد", ic: I.pay },
    { nm: "التحضير", ds: "المطبخ يبدأ فوراً", ic: I.cook },
  ];

  return (
    <div className="screen">
      <div className="bar"><Logo d={110} /></div>

      <div className="center">
        <h1 className="big">نظّم مطعمك من الطلب إلى الطبخ في نظام واحد</h1>
        <p className="lede tight">
          الزبون يطلب من التابلت، يدفع عند الكاشير، فيظهر للطبّاخين ويتجهّز فوراً — وأنت
          تراقب كل شيء بالأرقام.
        </p>
      </div>

      <div className="track">
        <div className="stations">
          {stations.map((s, n) => (
            <div key={s.nm} className={"stn" + (n === i ? " live" : "")}>
              <span className="orb">{s.ic}</span>
              <span className="nm">{s.nm}</span>
              <span className="ds">{s.ds}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="gap">
        <button className="btn btn-flame" onClick={() => go("choose")}>ابدأ الآن</button>
      </div>
      <p className="foot">
        لديك حساب؟ <button className="link" onClick={() => go("login")}>سجّل الدخول</button>
      </p>

      <p className="eyebrow">ما الذي يعمل من أجلك</p>

      <article className="fx a">
        <span className="fxlabel" style={{ color: "#C33F05" }}>على تابلت الزبون</span>
        <h3>الزبون يطلب بنفسه</h3>
        <p>يتصفّح القائمة، يختار الكميّة والصلصة، ويرسل الطلب مباشرةً للمطبخ — بلا نادل يكتب ولا أخطاء في النقل.</p>
        <div className="frame">
          <div className="glass">
            <div className="mhead">
              <span className="mtitle">قائمة الطعام</span>
              <span className="mnote">طاولة 4</span>
            </div>
            <div className="chips">
              <span className="chipx on">برغر</span>
              <span className="chipx">بيتزا</span>
              <span className="chipx">مشروبات</span>
            </div>
            <div className="grid2">
              <div className="dishc on">
                <span className="qbadge">2</span>
                <div className="ph" style={{ background: "linear-gradient(135deg,#FB5607,#FFB703)" }} />
                <div className="nm2">برغر دجاج</div>
                <div className="sz">صلصة حارّة</div>
              </div>
              <div className="dishc">
                <div className="ph" style={{ background: "linear-gradient(135deg,#F2994A,#F2C94C)" }} />
                <div className="nm2">برغر لحم</div>
                <div className="sz">حجم كبير</div>
              </div>
              <div className="dishc">
                <div className="ph" style={{ background: "linear-gradient(135deg,#56AB7B,#A8D5BA)" }} />
                <div className="nm2">سلطة</div>
                <div className="sz">جانبي</div>
              </div>
              <div className="dishc">
                <div className="ph" style={{ background: "linear-gradient(135deg,#4A6FA5,#7FA3D1)" }} />
                <div className="nm2">مشروب بارد</div>
                <div className="sz">علبة</div>
              </div>
            </div>
            <div className="sendbar">أرسل الطلب</div>
          </div>
          <div className="bezel" />
        </div>
        <ul className="ticks">
          <li><Tick />الكميّات والإضافات يختارها الزبون بنفسه</li>
          <li><Tick />الطلب يصل المطبخ كما كُتب تماماً</li>
        </ul>
      </article>

      <article className="fx b">
        <span className="fxlabel" style={{ color: "#9A6B08" }}>في المخزون</span>
        <h3>المواد تُخصم وحدها</h3>
        <p>تربط كل طبق بمكوّناته مرّة واحدة، فيُطرح المستهلك من مخزونك مع كل بيع — وينبّهك قبل أن ينفد.</p>
        <div className="frame">
          <div className="glass">
            <div className="mhead">
              <span className="mtitle">المخزون</span>
              <span className="mnote">تحديث لحظي</span>
            </div>
            {[
              ["صدر دجاج", 26, "low", "منخفض", "var(--flame)"],
              ["جبن موزاريلا", 68, "ok", "كافٍ", "var(--bolt)"],
              ["طماطم", 84, "ok", "كافٍ", "var(--good)"],
            ].map(([nm, pc, tag, txt, col]) => (
              <div className="srow" key={nm}>
                <div className="stop">
                  <b>{nm}</b>
                  <span className={"stag " + tag}>{txt}</span>
                </div>
                <div className="sbar"><span style={{ width: pc + "%", background: col }} /></div>
              </div>
            ))}
            <div className="autonote">
              <Tick small />
              يُخصم تلقائياً عند كل بيع — بلا إدخال يدوي
            </div>
          </div>
          <div className="bezel" />
        </div>
        <ul className="ticks">
          <li><Tick />تنبيه قبل نفاد أي مادة</li>
          <li><Tick />لا جرد يدوي ولا دفاتر</li>
        </ul>
      </article>

      <article className="fx c">
        <span className="fxlabel" style={{ color: "#0F6B4C" }}>في لوحتك</span>
        <h3>تعرف أين تربح</h3>
        <p>مبيعاتك وأرباحك وأجور عمّالك محسوبة لحظة بلحظة، وتقرأ أداء كل يوم وكل طبق دون حاسبة.</p>
        <div className="frame">
          <div className="glass">
            <div className="mhead">
              <span className="mtitle">الأداء</span>
              <span className="mnote">هذا الأسبوع</span>
            </div>
            <div className="seg"><b>اليوم</b><b className="on">الأسبوع</b><b>الشهر</b></div>
            <div className="cols">
              <i style={{ height: "34%" }} />
              <i className="mid" style={{ height: "52%" }} />
              <i style={{ height: "41%" }} />
              <i className="mid" style={{ height: "63%" }} />
              <i className="top2" style={{ height: "78%" }} />
              <i className="top2" style={{ height: "71%" }} />
              <i className="peak" style={{ height: "100%" }} />
            </div>
            <div className="days">
              <span>سبت</span><span>أحد</span><span>إثن</span><span>ثلا</span>
              <span>أرب</span><span>خمي</span><span>جمع</span>
            </div>
            <span className="growth">▲ الجمعة أعلى أيامك</span>
          </div>
          <div className="bezel" />
        </div>
        <ul className="ticks">
          <li><Tick />أداء كل طبق على حدة</li>
          <li><Tick />الأرباح بعد خصم التكاليف والأجور</li>
        </ul>
      </article>

      <p className="foot">جرّب 3 أيام مجاناً بلا دفع مسبق — ثم اختر باقتك للمتابعة.</p>
    </div>
  );
}

function Choose({ go, back }) {
  return (
    <div className="screen">
      <Bar onBack={back} />
      <div className="center">
        <h1 className="mid" style={{ marginTop: 30 }}>كيف تريد أن تبدأ؟</h1>
        <p className="lede tight">اختر ما يناسبك — يمكنك الاشتراك في أي وقت لاحقاً.</p>
      </div>

      <button className="pick" onClick={() => go("trial")} style={{ marginTop: 28 }}>
        <span className="chip green">3 أيام مجاناً</span>
        <h3>جرّب أولاً</h3>
        <p>بلا بطاقة ولا دفع مسبق — يُفتح حسابك فوراً. بياناتك تبقى محفوظة بعد التجربة.</p>
      </button>

      <button className="pick" onClick={() => go("signup")}>
        <span className="chip bolt">اشتراك</span>
        <h3>اشترك الآن مباشرة</h3>
        <p>تختار باقتك وتحوّل عبر RIP بريدي موب، ونفعّل حسابك بعد تأكيد الدفع.</p>
      </button>

      <p className="foot">
        لديك حساب؟ <button className="link" onClick={() => go("login")}>سجّل الدخول</button>
      </p>
    </div>
  );
}

const emptyForm = { restaurant: "", owner: "", phone: "", email: "", pass: "", confirm: "" };

const validateForm = (f) => ({
  restaurant: V.name(f.restaurant, "اسم المطعم"),
  owner: V.name(f.owner, "اسم المالك"),
  phone: V.phone(f.phone),
  email: V.email(f.email),
  pass: V.password(f.pass),
  confirm: V.confirm(f.confirm, f.pass),
});

function AccountFields({ f, set, err }) {
  return (
    <>
      <Field label="اسم المطعم" value={f.restaurant} onChange={(v) => set("restaurant", v)}
        placeholder="مطعم النخيل" error={err.restaurant} maxLength={60} />
      <Field label="اسم المالك" value={f.owner} onChange={(v) => set("owner", v)}
        placeholder="محمد الأمين" error={err.owner} maxLength={60} />
      <Field label="رقم الهاتف" value={f.phone} wide inputMode="numeric" maxLength={10}
        onChange={(v) => set("phone", v.replace(/\D/g, ""))}
        placeholder="0XXXXXXXXX" error={err.phone} hint="يبدأ بـ 05 أو 06 أو 07 — 10 أرقام" />
      <Field label="البريد الإلكتروني" value={f.email} onChange={(v) => set("email", v)}
        placeholder="you@example.com" error={err.email}
        hint="ستستعمل هذا البريد وكلمة السر لتسجيل الدخول لاحقاً." />
      <Field label="كلمة السر" type="password" value={f.pass} onChange={(v) => set("pass", v)}
        placeholder="8 رموز على الأقل" error={err.pass} hint="8 رموز فأكثر، تجمع حروفاً وأرقاماً" />
      <Field label="إعادة كلمة السر" type="password" value={f.confirm} onChange={(v) => set("confirm", v)}
        placeholder="أعد كتابتها" error={err.confirm} />
    </>
  );
}

function Trial({ go, back }) {
  const [f, setF] = useState(emptyForm);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF({ ...f, [k]: v }); if (err[k]) setErr({ ...err, [k]: "" }); };
  const submit = async () => {
    const e = validateForm(f);
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    setBusy(true);
    try {
      // إنشاء الحساب ثم فتح تجربة 3 أيام في القاعدة (RLS/الدوال تفرض القواعد).
      await api.auth.signUp(f.email.trim(), f.pass);
      // بعض المشاريع تطلب تأكيد البريد ⇒ لا تُنشأ جلسة فوراً. نحاول الدخول لضمان الجلسة.
      const s = await api.auth.session();
      if (!s) {
        try { await api.auth.signIn(f.email.trim(), f.pass); }
        catch { throw new Error("فعّل حسابك من رابط التأكيد في بريدك، أو اطلب من المشرف تعطيل تأكيد البريد."); }
      }
      await api.account.startTrial(f.restaurant.trim(), f.owner.trim(), f.phone.trim());
      go("trialDone", { form: f });
    } catch (ex) { setErr({ form: api.safeError(ex) }); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <Bar onBack={back} />
      <div className="center">
        <span className="tag green">3 أيام مجاناً</span>
        <h1 className="mid">ابدأ تجربتك</h1>
        <p className="lede tight">يُفتح حسابك فور التسجيل، بلا دفع.</p>
      </div>
      <div className="form"><AccountFields f={f} set={set} err={err} /></div>
      {err.form && <p className="err" style={{ textAlign: "center", marginTop: 14 }}>{err.form}</p>}
      <div className="gap">
        <button className="btn btn-night" onClick={submit} disabled={busy}>
          {busy ? "جارٍ إنشاء الحساب…" : "ابدأ التجربة"}
        </button>
      </div>
      <p className="foot">
        لديك حساب؟ <button className="link" onClick={() => go("login")}>سجّل الدخول</button>
      </p>
    </div>
  );
}

function Signup({ go, back }) {
  const [f, setF] = useState(emptyForm);
  const [plan, setPlan] = useState("month");
  const [err, setErr] = useState({});
  const set = (k, v) => { setF({ ...f, [k]: v }); if (err[k]) setErr({ ...err, [k]: "" }); };
  const submit = () => {
    const e = validateForm(f);
    setErr(e);
    if (!Object.values(e).some(Boolean)) go("pay", { form: f, plan });
  };

  return (
    <div className="screen">
      <Bar onBack={back} />
      <div className="center">
        <span className="tag orange">اشتراك</span>
        <h1 className="mid">اشترك الآن</h1>
        <p className="lede tight">أدخل بيانات مطعمك، ثم اختر باقتك.</p>
      </div>

      <div className="form"><AccountFields f={f} set={set} err={err} /></div>

      <p className="eyebrow" style={{ margin: "44px 0 4px" }}>اختر خطتك</p>
      {Object.values(SETTINGS.plans).map((p) => (
        <button key={p.id} className={"plan" + (plan === p.id ? " on" : "")} onClick={() => setPlan(p.id)}>
          <span>
            <span className="t">{p.title}</span>
            <span className="n">{p.note}</span>
          </span>
          <span>
            <span className="p">{money(p.price)} دج</span>
            <span className="u">{p.unit}</span>
          </span>
        </button>
      ))}

      <div className="gap">
        <button className="btn btn-flame" onClick={submit}>التالي — الدفع</button>
      </div>
      <p className="foot">
        لديك حساب؟ <button className="link" onClick={() => go("login")}>سجّل الدخول</button>
      </p>
    </div>
  );
}

function Pay({ go, back, data }) {
  const plan = SETTINGS.plans[data.plan] || SETTINGS.plans.month;
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(SETTINGS.rip); }
    catch {
      const t = document.createElement("textarea");
      t.value = SETTINGS.rip; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(t);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e = V.reference(ref);
    setErr(e);
    if (e) return;
    setBusy(true);
    try {
      const f = data.form;
      // إنشاء الحساب ثم تقديم اشتراك مدفوع (يُنشئ دفعة pending للمراجعة).
      await api.auth.signUp(f.email.trim(), f.pass);
      await api.account.submitSubscription(
        f.restaurant.trim(), f.owner.trim(), f.phone.trim(), data.plan, ref, null);
      go("pending", { ...data, ref });
    } catch (ex) { setErr(api.safeError(ex)); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <Bar onBack={back} />
      <div className="center">
        <h1 className="mid" style={{ marginTop: 26 }}>إتمام الدفع</h1>
        <p className="lede tight">حوّل قيمة الاشتراك عبر RIP بريدي موب، ثم أدخل مرجع التحويل.</p>
      </div>

      <div className="sum">
        <div className="line"><span className="k">الخطة</span><span className="v">{plan.title}</span></div>
        <div className="line">
          <span className="k">المبلغ</span>
          <span className="v gold" style={{ fontSize: 20 }}>{money(plan.price)} دج</span>
        </div>
      </div>

      <div className="ripbox">
        <span className="cap">حساب RIP بريدي موب</span>
        <div className="ripline">
          <span className="val">{SETTINGS.rip}</span>
          <button className={"copy" + (copied ? " ok" : "")} onClick={copy}>
            {copied ? "تم النسخ" : "نسخ"}
          </button>
        </div>
      </div>

      <div className="form">
        <Field label="مرجع التحويل" value={ref} wide inputMode="numeric" maxLength={24}
          onChange={(v) => { setRef(v.replace(/\D/g, "")); if (err) setErr(""); }}
          placeholder="أرقام فقط" error={err}
          hint="أدخل رقم مرجع التحويل ليتحقّق منه فريقنا ويفعّل حسابك — 10 أرقام فأكثر." />
      </div>

      <div className="gap">
        <button className="btn btn-flame" onClick={submit} disabled={busy}>
          {busy ? "جارٍ الإرسال…" : "إنشاء الحساب وإرسال الطلب"}
        </button>
      </div>
    </div>
  );
}

function Pending({ go, data }) {
  return (
    <div className="screen">
      <Bar />
      <div className="center">
        <div className="badge wait">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h1 className="mid">طلبك قيد المراجعة</h1>
        <p className="lede tight">استلمنا مرجع تحويلك. نتحقّق منه ونفعّل حسابك — وتدخل لوحة مطعمك فور التأكيد.</p>
      </div>

      <div className="sum">
        <div className="line"><span className="k">المطعم</span><span className="v">{data.form.restaurant}</span></div>
        <div className="line"><span className="k">الخطة</span><span className="v">{SETTINGS.plans[data.plan].title}</span></div>
        <div className="line"><span className="k">مرجع التحويل</span><span className="v">{data.ref}</span></div>
      </div>

      <div className="gap">
        <button className="btn btn-line" onClick={() => go("login")}>الذهاب لتسجيل الدخول</button>
      </div>
    </div>
  );
}

function TrialDone({ go, data }) {
  const end = new Date(Date.now() + 3 * 864e5);
  const fmt = end.toLocaleDateString("ar", { day: "numeric", month: "long" });
  return (
    <div className="screen">
      <Bar />
      <div className="center">
        <div className="badge done">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1 className="mid">حسابك جاهز</h1>
        <p className="lede tight">
          تجربتك تعمل الآن لـ 3 أيام وتنتهي يوم {fmt}. بياناتك تبقى محفوظة بعدها، وتكمل
          بالاشتراك متى شئت.
        </p>
      </div>

      <div className="sum">
        <div className="line"><span className="k">المطعم</span><span className="v">{data.form.restaurant}</span></div>
        <div className="line"><span className="k">الدخول بـ</span><span className="v" style={{ fontSize: 14 }}>{data.form.email}</span></div>
      </div>

      <div className="gap">
        <button className="btn btn-night" onClick={() => { window.location.href = "/app.html"; }}>ادخل للوحة مطعمك</button>
      </div>
    </div>
  );
}

function Login({ go, back }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = { email: V.email(email), pass: V.password(pass) };
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    setBusy(true);
    try {
      await api.auth.signIn(email.trim(), pass);
      // الدور يقرّر الوجهة: الأدمن للوحة الإدارة، غيره للوحة التاجر.
      const p = await api.auth.myProfile();
      window.location.href = p?.role === "admin" ? "/admin.html" : "/app.html";
    } catch (ex) { setErr({ form: api.safeError(ex) }); setBusy(false); }
  };

  return (
    <div className="screen">
      <Bar onBack={back} />
      <div className="center">
        <h1 className="mid" style={{ marginTop: 30 }}>تسجيل الدخول</h1>
        <p className="lede tight">ادخل ببريدك وكلمة السر التي سجّلت بهما.</p>
      </div>

      <div className="form">
        <Field label="البريد الإلكتروني" value={email} error={err.email}
          onChange={(v) => { setEmail(v); setErr({}); }} placeholder="you@example.com" />
        <Field label="كلمة السر" type="password" value={pass} error={err.pass}
          onChange={(v) => { setPass(v); setErr({}); }} placeholder="كلمة السر" />
        {err.form && <p className="err" style={{ marginTop: 14 }}>{err.form}</p>}
      </div>

      <div className="gap">
        <button className="btn btn-night" onClick={submit} disabled={busy}>
          {busy ? "جارٍ الدخول…" : "دخول"}
        </button>
      </div>
      <p className="foot">
        ليس لديك حساب؟ <button className="link" onClick={() => go("choose")}>ابدأ الآن</button>
      </p>
    </div>
  );
}

/* ────────────────────────────  التنقّل  ──────────────────────── */
export default function App() {
  const [stack, setStack] = useState(["landing"]);
  const [data, setData] = useState({});
  const topRef = useRef(null);
  const screen = stack[stack.length - 1];

  const go = (next, payload) => {
    if (payload) setData((d) => ({ ...d, ...payload }));
    setStack((s) => (next === "landing" ? ["landing"] : [...s, next]));
  };
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  useEffect(() => { topRef.current?.scrollIntoView({ block: "start" }); }, [screen]);

  const screens = {
    landing: <Landing go={go} />,
    choose: <Choose go={go} back={back} />,
    trial: <Trial go={go} back={back} />,
    trialDone: <TrialDone go={go} data={data} />,
    signup: <Signup go={go} back={back} />,
    pay: <Pay go={go} back={back} data={data} />,
    pending: <Pending go={go} data={data} />,
    login: <Login go={go} back={back} />,
  };

  return (
    <div className="fo">
      <style>{CSS}</style>
      <div className="wrap" ref={topRef}>{screens[screen]}</div>
    </div>
  );
}
