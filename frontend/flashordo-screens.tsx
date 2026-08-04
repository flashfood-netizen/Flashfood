import React, { useState, useEffect, useRef, useMemo } from "react";
import api from "./lib/api";
import { supabase } from "./lib/supabaseClient";

/* ══════════════════════════════════════════════════════════════
   شاشات المحل — Flashordo
   • الزبون (تابلت): بلا حساب، يدخل بكود المطعم، يبني الطلب ويرسله.
   • الكاشير: حساب staff/cashier — يؤكّد الدفع (خصم ذرّي) أو يرفض.
   • المطبخ: حساب staff/kitchen — يرى المدفوع فقط ويسلّم.
   الوصول للكود عبر ?code=XXXX (شاشة الزبون) أو دخول الموظّف.
   ══════════════════════════════════════════════════════════════ */

const money = (n) => String(Math.round(n * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const SAUCES = ["كاتشب", "مايونيز", "حار", "أبيض"];

const CSS = `
.sc *, .sc *::before, .sc *::after { box-sizing:border-box; }
.sc {
  --night:#14213D; --flame:#FB5607; --bolt:#FFB703; --good:#12805C; --bad:#C0341C;
  --bg:#F6F8FC; --card:#FFFFFF; --mute:#68738C; --hair:#E4E9F2;
  --grad:linear-gradient(135deg,#FB5607,#FFB703);
  direction:rtl; min-height:100vh; background:var(--bg); color:var(--night);
  font-family:'Alexandria',system-ui,sans-serif; font-weight:300; }
.sc h1,.sc h2,.sc h3 { font-family:'Baloo Bhaijaan 2',system-ui,sans-serif; font-weight:700; margin:0; }
.sc button { font:inherit; color:inherit; cursor:pointer; border:none; background:none; }
.sc :focus-visible { outline:3px solid var(--bolt); outline-offset:2px; border-radius:8px; }
.sc .ltr { direction:ltr; unicode-bidi:isolate; display:inline-block; }
.sc .wrap { max-width:1000px; margin:0 auto; padding:18px; }
.sc .top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.sc .brand { display:flex; align-items:center; gap:10px; }
.sc .brand b { font-family:'Baloo Bhaijaan 2'; font-size:15px; }
.sc .out { background:var(--card); border-radius:99px; padding:8px 14px; font-size:13px;
  box-shadow:0 2px 8px rgba(20,33,61,.08); }
.sc .card { background:var(--card); border-radius:20px; padding:18px; box-shadow:0 3px 14px rgba(20,33,61,.06); }
.sc label { display:block; font-size:13.5px; font-weight:500; margin-bottom:6px; }
.sc input { width:100%; padding:12px 14px; border:none; border-radius:13px; background:#F8FAFD;
  box-shadow:inset 0 0 0 1.5px var(--hair); font:inherit; font-size:15px; }
.sc input:focus { outline:none; box-shadow:inset 0 0 0 2px var(--night); background:#fff; }
.sc .btn { display:block; width:100%; margin-top:14px; padding:14px; border-radius:14px;
  background:var(--grad); color:#fff; font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:16px;
  box-shadow:0 6px 16px rgba(251,86,7,.28); }
.sc .btn.dark { background:var(--night); box-shadow:none; }
.sc .btn:disabled { opacity:.5; }
.sc .err { color:var(--bad); font-size:13px; font-weight:500; margin-top:10px; }
.sc .ok  { color:var(--good); font-size:13px; font-weight:500; margin-top:10px; }
.sc .center { max-width:400px; margin:8vh auto 0; text-align:center; }
.sc .center .card { text-align:right; margin-top:20px; }
.sc .logo { width:76px; height:76px; object-fit:contain; margin:0 auto; display:block; }

/* قائمة الزبون */
.sc .chips { display:flex; gap:8px; flex-wrap:wrap; margin:14px 0; }
.sc .chip { font-size:14px; font-weight:500; padding:9px 18px; border-radius:99px; background:var(--card);
  color:var(--mute); box-shadow:inset 0 0 0 1.5px var(--hair); }
.sc .chip.on { background:var(--night); color:#fff; box-shadow:none; }
.sc .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
.sc .dish { background:var(--card); border-radius:16px; padding:12px; box-shadow:0 3px 14px rgba(20,33,61,.06);
  border:2px solid transparent; }
.sc .dish.on { border-color:var(--flame); }
.sc .dish .ph { height:76px; border-radius:12px; margin-bottom:8px; background:var(--grad); }
.sc .dish .nm { font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:15px; }
.sc .dish .pr { font-size:12.5px; color:var(--mute); }
.sc .step { display:flex; align-items:center; justify-content:space-between; margin-top:10px; }
.sc .step button { width:34px; height:34px; border-radius:10px; box-shadow:inset 0 0 0 1.5px var(--hair);
  font-size:19px; font-weight:700; display:grid; place-items:center; }
.sc .step .q { font-family:'Baloo Bhaijaan 2'; font-weight:700; direction:ltr; unicode-bidi:isolate; }
.sc .add { width:100%; margin-top:10px; padding:9px; border-radius:11px; background:#FFF1EC; color:var(--flame);
  font-weight:600; font-size:13.5px; }
.sc .sauces { display:flex; gap:5px; flex-wrap:wrap; margin-top:8px; }
.sc .sauce { font-size:11px; padding:4px 10px; border-radius:99px; background:#F8FAFD;
  box-shadow:inset 0 0 0 1px var(--hair); color:var(--mute); }
.sc .sauce.on { background:var(--bolt); color:var(--night); box-shadow:none; }
.sc .cartbar { position:sticky; bottom:14px; margin-top:18px; display:flex; align-items:center;
  justify-content:space-between; background:var(--night); color:#fff; border-radius:16px; padding:14px 20px;
  box-shadow:0 10px 30px rgba(20,33,61,.28); }
.sc .cartbar .send { background:var(--grad); border-radius:12px; padding:11px 22px;
  font-family:'Baloo Bhaijaan 2'; font-weight:700; }
.sc .big-ok { text-align:center; padding:40px 20px; }
.sc .big-ok .no { font-family:'Baloo Bhaijaan 2'; font-weight:800; font-size:64px; color:var(--flame);
  direction:ltr; unicode-bidi:isolate; }

/* طلبات الكاشير/المطبخ */
.sc .ohead { display:flex; align-items:center; justify-content:space-between; margin:18px 0 8px; }
.sc .orders { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
.sc .ord { background:var(--card); border-radius:18px; padding:16px; box-shadow:0 3px 14px rgba(20,33,61,.06); }
.sc .ord .no { width:46px; height:46px; border-radius:13px; display:grid; place-items:center; color:#fff;
  font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:20px; direction:ltr; }
.sc .ord.wait .no { background:var(--bolt); color:var(--night); }
.sc .ord.cook .no { background:var(--flame); }
.sc .ordtop { display:flex; align-items:center; gap:12px; }
.sc .ordtot { margin-inline-start:auto; font-family:'Baloo Bhaijaan 2'; font-weight:700; }
.sc .lines { margin:12px 0; font-size:14px; }
.sc .lines .l { padding:4px 0; }
.sc .lines .sauce2 { color:#8A6212; font-size:12.5px; }
.sc .acts { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.sc .act { padding:12px; border-radius:13px; font-family:'Baloo Bhaijaan 2'; font-weight:700; font-size:14.5px; }
.sc .act.ok { background:var(--good); color:#fff; }
.sc .act.no { background:#fff; color:var(--bad); box-shadow:inset 0 0 0 2px #FFD4C2; }
.sc .act.full { grid-column:1 / -1; background:var(--grad); color:#fff; }
.sc .flash { border-radius:13px; padding:11px 15px; font-size:13.5px; margin-bottom:12px; }
.sc .flash.ok { background:#E7F5EF; color:var(--good); }
.sc .flash.no { background:#FFF1EC; color:var(--bad); }
.sc .empty { text-align:center; color:var(--mute); padding:40px; }
`;

const Logo = ({ d = 40 }) => (
  <img src="/flashordo-logo.png" alt="flash ordo" width={d} height={d}
    style={{ width: d, height: d, objectFit: "contain", display: "block", flex: "none" }} />
);

/* ════════════════════ شاشة الزبون ════════════════════ */
function CustomerScreen({ code }) {
  const [menu, setMenu] = useState(null);
  const [cat, setCat] = useState(null);
  const [cart, setCart] = useState({});           // pid -> { qty, sauces[] }
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);          // رقم الطلب
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.screens.menu(code)
      .then((m) => {
        if (!m || !m.products) { setErr("المطعم غير متاح للطلب حالياً."); return; }
        setMenu(m);
        setCat(m.categories?.[0]?.id ?? null);
      })
      .catch((e) => setErr(api.safeError(e)));
  }, [code]);

  const cats = menu?.categories ?? [];
  const saucesOn = cats.find((c) => c.id === cat)?.sauces_enabled;
  const dishes = (menu?.products ?? []).filter((p) => (cat ? p.category_id === cat : true));
  const items = Object.values(cart).reduce((s, x) => s + x.qty, 0);
  const total = Object.entries(cart).reduce((s, [pid, x]) => {
    const p = menu.products.find((z) => z.id === pid); return s + (p ? p.price * x.qty : 0);
  }, 0);

  const bump = (pid, d) => setCart((c) => {
    const cur = c[pid]?.qty || 0; const nq = Math.max(0, cur + d);
    const next = { ...c };
    if (nq === 0) delete next[pid]; else next[pid] = { qty: nq, sauces: c[pid]?.sauces || [] };
    return next;
  });
  const toggleSauce = (pid, s) => setCart((c) => {
    if (!c[pid]) return c;
    const has = c[pid].sauces.includes(s);
    return { ...c, [pid]: { ...c[pid], sauces: has ? c[pid].sauces.filter((x) => x !== s) : [...c[pid].sauces, s] } };
  });

  const send = async () => {
    setErr(""); setBusy(true);
    try {
      const lines = Object.entries(cart).map(([pid, x]) => ({ product_id: pid, qty: x.qty, sauces: x.sauces }));
      if (lines.length === 0) { setBusy(false); return; }
      const no = await api.screens.placeOrder(code, lines);
      setDone(no); setCart({});
    } catch (e) { setErr(api.safeError(e)); }
    finally { setBusy(false); }
  };

  if (done !== null) return (
    <div className="card big-ok">
      <Logo d={72} />
      <h2 style={{ marginTop: 16 }}>تم إرسال طلبك</h2>
      <p style={{ color: "var(--mute)", marginTop: 6 }}>رقمك عند الكاشير</p>
      <div className="no">{done}</div>
      <button className="btn" style={{ maxWidth: 260, margin: "18px auto 0" }} onClick={() => setDone(null)}>
        طلب جديد
      </button>
    </div>
  );

  if (err && !menu) return <div className="card empty">{err}</div>;
  if (!menu) return <div className="card empty">جارٍ تحميل القائمة…</div>;

  return (
    <>
      <div className="chips">
        {cats.map((c) => (
          <button key={c.id} className={"chip" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>{c.name}</button>
        ))}
      </div>
      <div className="grid">
        {dishes.map((p) => {
          const q = cart[p.id]?.qty || 0;
          return (
            <div key={p.id} className={"dish" + (q > 0 ? " on" : "")}>
              <div className="ph" />
              <div className="nm">{p.name}</div>
              <div className="pr"><span className="ltr">{money(p.price)}</span> دج</div>
              {q > 0 ? (
                <>
                  <div className="step">
                    <button onClick={() => bump(p.id, -1)}>−</button>
                    <span className="q">{q}</span>
                    <button onClick={() => bump(p.id, 1)}>+</button>
                  </div>
                  {saucesOn && (
                    <div className="sauces">
                      {SAUCES.map((s) => (
                        <button key={s} className={"sauce" + (cart[p.id].sauces.includes(s) ? " on" : "")}
                          onClick={() => toggleSauce(p.id, s)}>{s}</button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button className="add" onClick={() => bump(p.id, 1)}>＋ أضف</button>
              )}
            </div>
          );
        })}
        {dishes.length === 0 && <div className="empty">لا أصناف في هذا القسم.</div>}
      </div>
      {err && <div className="err">{err}</div>}
      {items > 0 && (
        <div className="cartbar">
          <span><b className="ltr">{items}</b> أصناف · <b className="ltr">{money(total)}</b> دج</span>
          <button className="send" onClick={send} disabled={busy}>{busy ? "جارٍ الإرسال…" : "أرسل الطلب"}</button>
        </div>
      )}
    </>
  );
}

/* ════════════════════ شاشة الكاشير / المطبخ ════════════════════ */
function StaffOrders({ rid, screen }) {
  const [orders, setOrders] = useState([]);
  const [flash, setFlash] = useState(null);
  const wanted = screen === "cashier" ? ["unpaid"] : ["cooking"];

  const load = () => api.screens.orders(rid, wanted).then(setOrders).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [rid, screen]);

  const total = (o) => (o.order_lines || []).reduce((s, l) => s + Number(l.unit_price) * Number(l.qty), 0);

  const act = async (fn, o, okMsg) => {
    try { await fn(o.id); setFlash({ k: "ok", t: okMsg }); load(); }
    catch (e) { setFlash({ k: "no", t: api.safeError(e) }); }
  };

  return (
    <>
      <div className="ohead">
        <h2>{screen === "cashier" ? "بانتظار الدفع" : "قيد التحضير"}</h2>
        <span className="out">{orders.length} طلب</span>
      </div>
      {flash && <div className={"flash " + flash.k}>{flash.t}</div>}
      {orders.length === 0 && <div className="empty">لا طلبات الآن.</div>}
      <div className="orders">
        {orders.map((o) => (
          <div key={o.id} className={"ord " + (screen === "cashier" ? "wait" : "cook")}>
            <div className="ordtop">
              <span className="no">{o.no}</span>
              <span style={{ fontFamily: "'Baloo Bhaijaan 2'", fontWeight: 700 }}>طلب {o.no}</span>
              <span className="ordtot"><span className="ltr">{money(total(o))}</span> دج</span>
            </div>
            <div className="lines">
              {(o.order_lines || []).map((l, i) => (
                <div className="l" key={i}>
                  {l.product_name || "صنف"} × <span className="ltr">{l.qty}</span>
                  {l.sauces?.length > 0 && <span className="sauce2"> · {l.sauces.join("، ")}</span>}
                </div>
              ))}
            </div>
            {screen === "cashier" ? (
              <div className="acts">
                <button className="act ok" onClick={() => act(api.screens.confirmPayment, o, `تم تأكيد الطلب ${o.no}`)}>
                  تأكيد الدفع
                </button>
                <button className="act no" onClick={() => act(api.screens.rejectOrder, o, `رُفض الطلب ${o.no}`)}>
                  رفض
                </button>
              </div>
            ) : (
              <div className="acts">
                <button className="act full" onClick={() => act(api.screens.serveOrder, o, `سُلّم الطلب ${o.no}`)}>
                  تم التسليم ✓
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ════════════════════ دخول الموظّف ════════════════════ */
function StaffGate({ onIn }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      await api.auth.signIn(email.trim(), pass);
      const p = await api.auth.myProfile();
      if (p?.role !== "staff" || !p.restaurant_id || !p.screen) {
        await api.auth.signOut();
        throw new Error("هذا الحساب ليس حساب موظّف.");
      }
      onIn(p);
    } catch (e) { setErr(api.safeError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="center">
      <Logo d={76} />
      <h1 style={{ marginTop: 14 }}>دخول الموظّف</h1>
      <p style={{ color: "var(--mute)", fontSize: 14 }}>الكاشير أو المطبخ — بكلمة السر من صاحب المطعم.</p>
      <div className="card">
        <label>البريد الإلكتروني</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" autoComplete="off" />
        <label style={{ marginTop: 14 }}>كلمة السر</label>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="كلمة السر" />
        {err && <div className="err">{err}</div>}
        <button className="btn dark" onClick={submit} disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول"}</button>
      </div>
    </div>
  );
}

/* ════════════════════ الجذر ════════════════════ */
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const [profile, setProfile] = useState(null);
  const top = useRef(null);

  useEffect(() => { if (!code) api.auth.myProfile().then((p) => p?.role === "staff" && setProfile(p)).catch(() => {}); }, [code]);

  const logout = async () => { await api.auth.signOut(); setProfile(null); };

  let body, title;
  if (code) { body = <CustomerScreen code={code} />; title = "قائمة الطعام"; }
  else if (!profile) body = <StaffGate onIn={setProfile} />;
  else {
    title = profile.screen === "cashier" ? "شاشة الكاشير" : "شاشة المطبخ";
    body = <StaffOrders rid={profile.restaurant_id} screen={profile.screen} />;
  }

  return (
    <div className="sc">
      <style>{CSS}</style>
      <div className="wrap" ref={top}>
        {(code || profile) && (
          <div className="top">
            <div className="brand"><Logo d={38} /><b>{title}</b></div>
            {profile && <button className="out" onClick={logout}>خروج</button>}
          </div>
        )}
        {body}
      </div>
    </div>
  );
}
