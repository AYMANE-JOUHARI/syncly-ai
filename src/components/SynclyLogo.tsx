type Props = { size?: "sm" | "md" | "lg"; dark?: boolean };

function Rings({ size, dark }: { size: "sm" | "md" | "lg"; dark?: boolean }) {
  const r  = size === "lg" ? 11 : size === "sm" ? 6  : 9;
  const sw = size === "lg" ? 2   : size === "sm" ? 1.5 : 2;
  const gap = Math.round(r * 1.35);
  const cx1 = r + sw;
  const cx2 = cx1 + gap;
  const cy  = r + sw;
  const w   = cx2 + r + sw;
  const h   = cy + r + sw;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <circle cx={cx1} cy={cy} r={r} stroke={dark ? "white" : "#14131a"} strokeWidth={sw} />
      <circle cx={cx2} cy={cy} r={r} stroke="#5b5ef4" strokeWidth={sw} />
    </svg>
  );
}

export function SynclyLogo({ size = "md", dark = false }: Props) {
  const textSize =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const textColor = dark ? "text-white" : "text-slate-900";
  const accentColor = dark ? "from-indigo-300 to-purple-300" : "from-indigo-600 to-purple-600";
  return (
    <div className="inline-flex items-center gap-2.5">
      <Rings size={size} dark={dark} />
      <span className={`${textSize} font-bold tracking-tight ${textColor}`}>
        Syncly
        <span className={`bg-gradient-to-r ${accentColor} bg-clip-text text-transparent`}>
          .ai
        </span>
      </span>
    </div>
  );
}
