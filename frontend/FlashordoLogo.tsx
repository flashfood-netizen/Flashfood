import React from "react";

/* ══════════════════════════════════════════════════════════════
   شعار flash ordo — نجمة لهب بالأحمر والأبيض.
   • <FlashordoLogo size={44} />              اللافتة الكاملة (نجمة + كلمة)
   • <FlashordoMark size={32} />              الأيقونة وحدها (فافيكون/أحجام صغيرة)
   لون كلمة «flash» يتبع النصّ الحالي (currentColor) فيعمل في الوضعين الفاتح
   والداكن تلقائياً؛ «ordo» بالأحمر دائماً. مرّر dark للتحكّم اليدوي إن رغبت.
   ══════════════════════════════════════════════════════════════ */

const TONGUE =
  "M50 5 C46 20 48 30 43.5 38 C40 44 41 50.5 50 55 C59 50.5 60 44 56.5 38 C52 30 54 20 50 5 Z";
const INNER =
  "M50 20 C47.5 30 48.5 36 46 41 C44 45 44.5 49 50 51.5 C55.5 49 56 45 54 41 C51.5 36 52.5 30 50 20 Z";
const ANGLES = [0, 72, 144, 216, 288];

/* أيقونة نجمة اللهب — قابلة للتوسّع، تُقرأ حتى عند 32 بكسل. */
export function FlashordoMark({ size = 40, title }: { size?: number; title?: string }) {
  const gid = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ filter: "drop-shadow(0 4px 12px rgba(224,27,36,.28))", flex: "none" }}
    >
      <defs>
        <radialGradient id={`${gid}c`} cx="50%" cy="52%" r="52%">
          <stop offset="0" stopColor="#FFE9A8" />
          <stop offset=".4" stopColor="#FFC24B" />
          <stop offset="1" stopColor="#FF6A2B" />
        </radialGradient>
        <linearGradient id={`${gid}t`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#FFB43C" />
          <stop offset=".45" stopColor="#FF5A22" />
          <stop offset="1" stopColor="#E01B24" />
        </linearGradient>
        <linearGradient id={`${gid}i`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#FFF0C2" />
          <stop offset="1" stopColor="#FFB43C" />
        </linearGradient>
      </defs>
      {ANGLES.map((a) => (
        <path key={a} d={TONGUE} fill={`url(#${gid}t)`} transform={`rotate(${a} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="17" fill={`url(#${gid}c)`} />
      {[0, 144, 288].map((a) => (
        <path key={a} d={INNER} fill={`url(#${gid}i)`} opacity="0.95" transform={`rotate(${a} 50 50)`} />
      ))}
    </svg>
  );
}

/* اللافتة الكاملة: نجمة + «flash ordo». */
export function FlashordoLogo({
  size = 40,
  dark,
  redAccent = "#E01B24",
}: {
  size?: number;
  dark?: boolean;          // اتركه فارغاً ليتبع لون النصّ الحالي
  redAccent?: string;
}) {
  const flash = dark === undefined ? "currentColor" : dark ? "#FFF3F0" : "#171012";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.22,
        direction: "ltr",
        unicodeBidi: "isolate",
      }}
    >
      <FlashordoMark size={size} title="flash ordo" />
      <span
        style={{
          fontFamily: "'Baloo Bhaijaan 2', system-ui, sans-serif",
          fontWeight: 800,
          fontStyle: "italic",
          letterSpacing: "-.035em",
          lineHeight: 1,
          fontSize: size * 0.52,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: flash }}>flash</span>{" "}
        <span style={{ color: redAccent }}>ordo</span>
      </span>
    </span>
  );
}

export default FlashordoLogo;
