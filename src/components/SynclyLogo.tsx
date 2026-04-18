export function SynclyLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const dot = size === "lg" ? "h-9 w-9" : size === "sm" ? "h-6 w-6" : "h-8 w-8";
  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`${dot} rounded-xl shadow-sm`}
        style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
      />
      <span className={`${text} font-bold tracking-tight text-slate-900`}>
        Syncly<span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">.ai</span>
      </span>
    </div>
  );
}
