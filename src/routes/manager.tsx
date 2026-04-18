import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import {
  Upload, FileText, X, ChevronDown, ChevronUp,
  Send, Plus, Check, RefreshCw, Eye, Sparkles,
} from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { useCourse } from "@/lib/course-context";
import { generateCourse, fetchCourse, refineCourse, updateSectionTitle } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";
import { extractPdfText } from "@/lib/pdf";

export const Route = createFileRoute("/manager")({
  component: Manager,
});

// ── Types ──────────────────────────────────────────────────────────────
type SourceStatus = "processing" | "ready" | "failed";
type Source = {
  id: string;
  kind: "pdf" | "paste" | "url";
  label: string;
  text: string;
  wordCount: number;
  status: SourceStatus;
};
type Phase = "intake" | "generating" | "editor";
type LogEntry = { kind: "ok" | "live" | "done"; text: string; ts: string };
type RefineMsg = { role: "user" | "claude"; text: string };
const LEVELS = ["Entry", "Mid-level", "Senior", "Lead"] as const;

function nowTs() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
function wc(t: string) {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main component ─────────────────────────────────────────────────────
function Manager() {
  const navigate = useNavigate();
  const { setCourse } = useCourse();
  const generateFn = useServerFn(generateCourse);
  const fetchFn = useServerFn(fetchCourse);
  const refineFn = useServerFn(refineCourse);
  const updateTitleFn = useServerFn(updateSectionTitle);

  // Phase
  const [phase, setPhase] = React.useState<Phase>("intake");

  // Intake form
  const [role, setRole] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [level, setLevel] = React.useState<(typeof LEVELS)[number]>("Mid-level");
  const [goals, setGoals] = React.useState("");
  const [sources, setSources] = React.useState<Source[]>([]);
  const [addingPaste, setAddingPaste] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [addingUrl, setAddingUrl] = React.useState(false);
  const [urlVal, setUrlVal] = React.useState("");
  const [drag, setDrag] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Generation
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [genProgress, setGenProgress] = React.useState(0);
  const [genError, setGenError] = React.useState<string | null>(null);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  // Editor
  const [courseId, setCourseId] = React.useState<string | null>(null);
  const [editorCourse, setEditorCourse] = React.useState<any>(null);
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);
  const [editingTitles, setEditingTitles] = React.useState<Record<string, string>>({});
  const [savedTitle, setSavedTitle] = React.useState<string | null>(null);
  const [refineMessages, setRefineMessages] = React.useState<RefineMsg[]>([]);
  const [refineInput, setRefineInput] = React.useState("");
  const [refineLoading, setRefineLoading] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [published, setPublished] = React.useState(false);
  const [changesCount, setChangesCount] = React.useState(0);
  const refineScrollRef = React.useRef<HTMLDivElement>(null);

  // Scroll log and refine chat to bottom
  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);
  React.useEffect(() => {
    refineScrollRef.current?.scrollTo({ top: refineScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [refineMessages, refineLoading]);

  // Derived values
  const readySources = sources.filter((s) => s.status === "ready");
  const totalWords = readySources.reduce((sum, s) => sum + s.wordCount, 0);
  const allSourceText = readySources
    .filter((s) => s.text)
    .map((s) => `[SOURCE: ${s.label}]\n${s.text}`)
    .join("\n\n");

  // ── Source handlers ──────────────────────────────────────────────────

  const addPdfs = async (files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf");
    if (!pdfs.length) return;

    const newSources: Source[] = pdfs.map((f) => ({
      id: crypto.randomUUID(),
      kind: "pdf",
      label: f.name,
      text: "",
      wordCount: 0,
      status: "processing",
    }));
    setSources((prev) => [...prev, ...newSources]);

    for (let i = 0; i < pdfs.length; i++) {
      const src = newSources[i];
      try {
        const text = await extractPdfText(pdfs[i]);
        setSources((prev) =>
          prev.map((s) =>
            s.id === src.id ? { ...s, text, wordCount: wc(text), status: "ready" } : s
          )
        );
      } catch {
        setSources((prev) =>
          prev.map((s) => (s.id === src.id ? { ...s, status: "failed" } : s))
        );
      }
    }
  };

  const addPasteSource = () => {
    if (!pasteText.trim()) return;
    const src: Source = {
      id: crypto.randomUUID(),
      kind: "paste",
      label: "Pasted text",
      text: pasteText,
      wordCount: wc(pasteText),
      status: "ready",
    };
    setSources((prev) => [...prev, src]);
    setPasteText("");
    setAddingPaste(false);
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const addUrlSource = () => {
    if (!urlVal.trim()) return;
    const src: Source = {
      id: crypto.randomUUID(),
      kind: "url",
      label: urlVal,
      text: `[URL reference: ${urlVal}]`,
      wordCount: 0,
      status: "ready",
    };
    setSources((prev) => [...prev, src]);
    setUrlVal("");
    setAddingUrl(false);
  };

  // ── Generate ─────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!role.trim()) { setFormError("Please describe the role."); return; }
    setFormError(null);
    setPhase("generating");
    setLog([]);
    setGenProgress(0);
    setGenError(null);

    const addLog = (kind: LogEntry["kind"], text: string) =>
      setLog((prev) => [...prev, { kind, text, ts: nowTs() }]);

    try {
      const srcCount = readySources.length;
      addLog("ok", srcCount > 0
        ? `Parsing ${totalWords.toLocaleString()} words across ${srcCount} source${srcCount !== 1 ? "s" : ""}...`
        : "Preparing role context...");
      await sleep(700);

      addLog("ok", "Mapping knowledge to onboarding structure...");
      setGenProgress(15);
      await sleep(500);

      const fullRole = company ? `${role} at ${company}` : role;
      addLog("live", `claude-sonnet-4-6 · streaming ${fullRole} curriculum...`);
      setGenProgress(25);

      const { courseId: newId } = await generateFn({
        data: {
          role: fullRole,
          experienceLevel: level,
          goal: goals || `Ramp a ${level.toLowerCase()} ${role} to full productivity`,
          pdfText: allSourceText || undefined,
        },
      });

      setGenProgress(80);
      addLog("ok", "Saving curriculum to database...");
      await sleep(400);

      const generated = await fetchFn({ data: { courseId: newId } });
      setEditorCourse(generated);
      setCourseId(newId);
      setCourse(generated);

      generated.sections.forEach((s: any, i: number) => {
        addLog("done", `Section ${i + 1} · ${s.title} — ready`);
      });

      setGenProgress(100);
      await sleep(700);
      setPhase("editor");
    } catch (e: any) {
      setGenError(e?.message ?? "Generation failed.");
      setPhase("intake");
    }
  };

  // ── Editor: title editing ────────────────────────────────────────────

  const startEditTitle = (sectionId: string, currentTitle: string) => {
    setEditingTitles((prev) => ({ ...prev, [sectionId]: currentTitle }));
  };

  const commitTitle = async (sectionId: string) => {
    const newTitle = editingTitles[sectionId]?.trim();
    if (!newTitle) {
      setEditingTitles((prev) => { const n = { ...prev }; delete n[sectionId]; return n; });
      return;
    }
    try {
      await updateTitleFn({ data: { sectionId, title: newTitle } });
      setEditorCourse((prev: any) => ({
        ...prev,
        sections: prev.sections.map((s: any) =>
          s.id === sectionId ? { ...s, title: newTitle } : s
        ),
      }));
      setSavedTitle(sectionId);
      setTimeout(() => setSavedTitle(null), 1500);
    } catch { /* revert silently */ }
    setEditingTitles((prev) => { const n = { ...prev }; delete n[sectionId]; return n; });
  };

  // ── Editor: refine ───────────────────────────────────────────────────

  const handleRefine = async (msg?: string) => {
    const text = (msg ?? refineInput).trim();
    if (!text || refineLoading || !courseId) return;
    setRefineInput("");
    setRefineMessages((prev) => [...prev, { role: "user", text }]);
    setRefineLoading(true);

    try {
      const { summary, sections: updated } = await refineFn({
        data: { courseId, instruction: text },
      });

      if (updated?.length && editorCourse) {
        setEditorCourse((prev: any) => ({
          ...prev,
          sections: prev.sections.map((s: any) => {
            const u = updated.find((x: any) => x.id === s.id);
            return u ? { ...s, title: u.title, summary: u.summary } : s;
          }),
        }));
      }
      setRefineMessages((prev) => [...prev, { role: "claude", text: summary }]);
      setChangesCount((c) => c + 1);
    } catch {
      setRefineMessages((prev) => [
        ...prev,
        { role: "claude", text: "Sorry, I had trouble applying that change. Please try again." },
      ]);
    } finally {
      setRefineLoading(false);
    }
  };

  // ── Publish ──────────────────────────────────────────────────────────

  const handlePublish = async () => {
    setPublishing(true);
    await sleep(900);
    setPublishing(false);
    setPublished(true);
    if (courseId) localStorage.setItem("syncly:lastCourseId", courseId);
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ borderBottom: "1px solid var(--line)", background: "white" }}>
        <div className="flex h-[60px] items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-4">
            <SynclyLogo size="sm" />
            <span style={{ color: "var(--line)", fontSize: 18 }}>·</span>
            <span className="eyebrow-mono">Manager View</span>
          </div>
          <Link to="/" style={{ fontSize: 13, color: "var(--ink-4)" }}>← Back to home</Link>
        </div>
      </header>

      {/* ── INTAKE PHASE ── */}
      {(phase === "intake") && (
        <div className="grid flex-1 gap-0 lg:grid-cols-2" style={{ minHeight: "calc(100vh - 60px)" }}>
          {/* Left: Form */}
          <div className="overflow-y-auto px-8 py-10" style={{ borderRight: "1px solid var(--line)" }}>
            <p className="eyebrow-mono mb-6">Curriculum brief</p>

            {/* Role + Company */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-2)" }}>Role name <span style={{ color: "#4f46e5" }}>*</span></label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Account Executive, SDR, Customer Success Manager"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ border: "1px solid var(--line)", color: "var(--ink)", background: "white", fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 16 }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-2)" }}>Company name</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme, Apex Solutions"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ border: "1px solid var(--line)", color: "var(--ink)", background: "white" }}
                />
              </div>
            </div>

            {/* Experience level */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--ink-2)" }}>Experience level</label>
              <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-deep)", border: "1px solid var(--line)" }}>
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition"
                    style={level === l
                      ? { background: "white", color: "var(--ink)", boxShadow: "0 1px 3px rgba(20,19,26,.08)" }
                      : { background: "transparent", color: "var(--ink-3)" }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Goals */}
            <div className="mb-8">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-2)" }}>Success criteria <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                rows={3}
                placeholder="What does success look like at 30 days? e.g. Ramp to full quota, close first deal..."
                className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
                style={{ border: "1px solid var(--line)", color: "var(--ink)", background: "white" }}
              />
            </div>

            {/* Sources */}
            <div className="mb-8">
              <p className="eyebrow-mono mb-4">Knowledge sources</p>

              {/* Drag-drop zone */}
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addPdfs(e.dataTransfer.files); }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition mb-4"
                style={drag ? { borderColor: "#4f46e5", background: "#eceafd" } : { borderColor: "var(--line)", background: "var(--bg)" }}
              >
                <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => addPdfs(e.target.files)} />
                <Upload className="h-6 w-6" style={{ color: "var(--ink-4)" }} />
                <div className="text-sm font-medium" style={{ color: "var(--ink-2)" }}>Drop PDFs here or click to browse</div>
                <div className="text-xs" style={{ color: "var(--ink-4)" }}>Multiple PDFs accepted</div>
              </label>

              {/* Source chips */}
              {sources.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {sources.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "white", border: "1px solid var(--line)" }}>
                      <FileText className="h-4 w-4 shrink-0" style={{ color: s.status === "failed" ? "#b91c1c" : "#4f46e5" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: "var(--ink)" }}>{s.label}</p>
                        {s.status === "ready" && (
                          <p className="text-xs" style={{ color: "var(--ink-4)" }}>{s.wordCount.toLocaleString()} words</p>
                        )}
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={s.status === "processing"
                          ? { background: "var(--bg-deep)", color: "var(--ink-4)" }
                          : s.status === "ready"
                            ? { background: "#e6f3ec", color: "#1f7a52" }
                            : { background: "#fee2e2", color: "#b91c1c" }}
                      >
                        {s.status === "processing" ? "Processing…" : s.status === "ready" ? "Ready" : "Failed"}
                      </span>
                      <button onClick={() => removeSource(s.id)} className="shrink-0 rounded-lg p-1 transition hover:bg-slate-100">
                        <X className="h-3.5 w-3.5" style={{ color: "var(--ink-4)" }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add source buttons */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => { setAddingPaste((v) => !v); setAddingUrl(false); }} className="rounded-lg px-3 py-2 text-xs font-medium transition" style={{ background: addingPaste ? "#eceafd" : "white", color: addingPaste ? "#4f46e5" : "var(--ink-3)", border: "1px solid var(--line)" }}>
                  + Paste text
                </button>
                <button onClick={() => { setAddingUrl((v) => !v); setAddingPaste(false); }} className="rounded-lg px-3 py-2 text-xs font-medium transition" style={{ background: addingUrl ? "#eceafd" : "white", color: addingUrl ? "#4f46e5" : "var(--ink-3)", border: "1px solid var(--line)" }}>
                  + Add URL
                </button>
              </div>

              {addingPaste && (
                <div className="mb-3">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={5}
                    placeholder="Paste your playbook, wiki, SOP, or any internal doc..."
                    className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none mb-2"
                    style={{ border: "1px solid var(--line)", color: "var(--ink)", background: "white" }}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--ink-4)" }}>{wc(pasteText).toLocaleString()} words</span>
                    <button onClick={addPasteSource} disabled={!pasteText.trim()} className="rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}>
                      Add source
                    </button>
                  </div>
                </div>
              )}

              {addingUrl && (
                <div className="flex gap-2 mb-3">
                  <input
                    value={urlVal}
                    onChange={(e) => setUrlVal(e.target.value)}
                    placeholder="https://notion.so/..."
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ border: "1px solid var(--line)", color: "var(--ink)", background: "white" }}
                    onKeyDown={(e) => e.key === "Enter" && addUrlSource()}
                  />
                  <button onClick={addUrlSource} disabled={!urlVal.trim()} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}>
                    Add
                  </button>
                </div>
              )}

              {totalWords > 0 && (
                <p className="text-right text-xs" style={{ color: "var(--ink-4)" }}>
                  {totalWords.toLocaleString()} words across {readySources.length} source{readySources.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{formError}</div>
            )}
            {genError && (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{genError}</div>
            )}

            <button
              onClick={handleGenerate}
              className="w-full rounded-2xl px-5 py-4 text-base font-semibold text-white shadow-md transition hover:shadow-lg hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
            >
              Generate curriculum →
            </button>
          </div>

          {/* Right: Live preview skeleton */}
          <div className="hidden lg:block px-8 py-10 overflow-y-auto">
            <p className="eyebrow-mono mb-2">Course preview</p>
            {role ? (
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", color: "var(--ink)", margin: "0 0 24px" }}>
                {company ? `${role} at ${company}` : role}
              </h2>
            ) : (
              <div className="mb-6 h-7 w-64 rounded-lg animate-pulse" style={{ background: "var(--bg-deep)" }} />
            )}

            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: "white", border: "1px solid var(--line)", opacity: role ? 1 : 0.5 }}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="eyebrow-mono">Section {i + 1}</span>
                    <div className={`h-3 rounded-full animate-pulse ${role ? "" : "opacity-0"}`} style={{ width: `${60 + i * 15}px`, background: "var(--bg-deep)", animationDelay: `${i * 100}ms` }} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2.5 rounded-full w-full animate-pulse" style={{ background: "var(--bg-deep)", animationDelay: `${i * 120}ms` }} />
                    <div className="h-2.5 rounded-full w-4/5 animate-pulse" style={{ background: "var(--bg-deep)", animationDelay: `${i * 140}ms` }} />
                  </div>
                </div>
              ))}
            </div>

            {totalWords > 0 && (
              <div className="mt-6 rounded-xl p-4" style={{ background: "#eceafd", border: "1px solid #c7c3f7" }}>
                <p className="eyebrow-mono mb-2" style={{ color: "#4f46e5" }}>Knowledge detected</p>
                <p className="text-sm" style={{ color: "#2e2890" }}>
                  {totalWords.toLocaleString()} words from {readySources.length} source{readySources.length !== 1 ? "s" : ""} will be used to ground the curriculum.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GENERATING PHASE ── */}
      {phase === "generating" && (
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg">
            <p className="eyebrow-mono mb-3 text-center">Generating curriculum</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 26, letterSpacing: "-0.015em", color: "var(--ink)", textAlign: "center", marginBottom: 32 }}>
              {company ? `${role} at ${company}` : role}
            </h2>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: "var(--bg-deep)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${genProgress}%`, background: "linear-gradient(90deg, #6366f1, #9333ea)" }} />
            </div>

            {/* Log */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line)", background: "white" }}>
              <div className="px-5 py-4 space-y-2.5 max-h-64 overflow-y-auto">
                {log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span style={{ fontFamily: "var(--font-mono-syncly)", fontSize: 10, color: "var(--ink-4)", paddingTop: 2, flexShrink: 0 }}>{entry.ts}</span>
                    <span
                      className="text-sm"
                      style={{ color: entry.kind === "done" ? "#1f7a52" : entry.kind === "live" ? "#4f46e5" : "var(--ink-2)" }}
                    >
                      {entry.kind === "done" && "✓ "}{entry.text}
                      {entry.kind === "live" && <span className="inline-block ml-1 animate-pulse">▋</span>}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDITOR PHASE ── */}
      {phase === "editor" && editorCourse && (
        <div className="flex flex-col flex-1" style={{ minHeight: "calc(100vh - 60px)" }}>
          {/* Editor header */}
          <div className="px-8 py-5 flex flex-wrap items-center justify-between gap-4" style={{ borderBottom: "1px solid var(--line)", background: "white" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 20, letterSpacing: "-0.01em", color: "var(--ink)", margin: 0 }}>
                {company ? `${role} onboarding · ${company}` : `${role} onboarding`}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--ink-3)" }}>
                {editorCourse.sections.length} sections · {readySources.length} source{readySources.length !== 1 ? "s" : ""} · {changesCount} refinement{changesCount !== 1 ? "s" : ""} applied
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPhase("intake")}
                className="rounded-xl px-4 py-2 text-sm font-medium transition"
                style={{ background: "white", color: "var(--ink-2)", border: "1px solid var(--line)" }}
              >
                ← Back to brief
              </button>
              {courseId && (
                <Link
                  to="/course/$courseId"
                  params={{ courseId }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition"
                  style={{ background: "white", color: "#4f46e5", border: "1px solid #c7c3f7" }}
                >
                  <Eye className="h-3.5 w-3.5" /> Preview as learner
                </Link>
              )}
              {!published ? (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  {publishing ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Publishing…</>
                  ) : (
                    "Save & publish"
                  )}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "#e6f3ec", color: "#1f7a52" }}>
                  <Check className="h-3.5 w-3.5" /> Published
                </span>
              )}
            </div>
          </div>

          {/* 2-col editor body */}
          <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "1fr 380px" }}>
            {/* Left: Curriculum accordion */}
            <div className="overflow-y-auto px-8 py-8">
              <p className="eyebrow-mono mb-5">Curriculum</p>
              <div className="space-y-3">
                {editorCourse.sections.map((s: any, i: number) => {
                  const isExpanded = expandedSection === s.id;
                  const isEditing = s.id in editingTitles;
                  return (
                    <div key={s.id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line)", background: "white" }}>
                      {/* Section header */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        <span className="eyebrow-mono shrink-0" style={{ color: "#4f46e5" }}>{String(i + 1).padStart(2, "0")}</span>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingTitles[s.id]}
                              onChange={(e) => setEditingTitles((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              onBlur={() => commitTitle(s.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") commitTitle(s.id); if (e.key === "Escape") setEditingTitles((prev) => { const n = { ...prev }; delete n[s.id]; return n; }); }}
                              className="w-full rounded-lg px-2 py-1 text-sm font-semibold outline-none"
                              style={{ border: "1px solid #4f46e5", color: "var(--ink)" }}
                            />
                          ) : (
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{s.title}</p>
                          )}
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--ink-3)" }}>{s.summary}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {savedTitle === s.id && (
                            <span className="text-xs font-medium" style={{ color: "#1f7a52" }}>Saved ✓</span>
                          )}
                          <button
                            onClick={() => startEditTitle(s.id, s.title)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
                            style={{ background: "var(--bg)", color: "var(--ink-3)", border: "1px solid var(--line)" }}
                          >
                            Edit
                          </button>
                          <button onClick={() => setExpandedSection(isExpanded ? null : s.id)} style={{ color: "var(--ink-4)" }}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded: quiz questions */}
                      {isExpanded && s.questions?.length > 0 && (
                        <div className="px-5 pb-5 pt-1" style={{ borderTop: "1px solid var(--line)" }}>
                          <p className="eyebrow-mono mb-3">Quiz · {s.questions.length} questions</p>
                          <ul className="space-y-2">
                            {s.questions.map((q: any, qi: number) => (
                              <li key={q.id} className="rounded-xl px-4 py-3" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                                <p className="text-xs font-medium mb-1" style={{ color: "var(--ink-4)", fontFamily: "var(--font-mono-syncly)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Q{qi + 1}</p>
                                <p className="text-sm" style={{ color: "var(--ink)" }}>{q.question}</p>
                                <div className="mt-2 grid grid-cols-2 gap-1">
                                  {q.options.map((opt: any) => (
                                    <div key={opt.key} className="flex items-start gap-1.5">
                                      <span className="shrink-0 text-xs font-bold mt-0.5" style={{ color: opt.key === q.correct_answer ? "#1f7a52" : "var(--ink-4)", fontFamily: "var(--font-mono-syncly)" }}>{opt.key}</span>
                                      <span className="text-xs" style={{ color: opt.key === q.correct_answer ? "#1f7a52" : "var(--ink-3)" }}>{opt.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Refine chat */}
            <div className="flex flex-col overflow-hidden" style={{ borderLeft: "1px solid var(--line)", background: "color-mix(in oklab, var(--bg) 60%, white)" }}>
              {/* Refine header */}
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}>
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Refine with Claude</p>
                  <p className="text-xs" style={{ color: "var(--ink-4)" }}>Give instructions to reshape the curriculum</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={refineScrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                {refineMessages.length === 0 && (
                  <div>
                    <p className="text-xs mb-3" style={{ color: "var(--ink-4)" }}>Suggested prompts:</p>
                    {[
                      "Make section 2 shorter and more focused",
                      "Add more emphasis on practical application",
                      "Reorder sections for a better learning flow",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleRefine(prompt)}
                        className="w-full text-left rounded-xl px-4 py-3 text-sm mb-2 transition"
                        style={{ background: "white", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                      >
                        "{prompt}"
                      </button>
                    ))}
                  </div>
                )}

                {refineMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                      style={m.role === "user"
                        ? { background: "linear-gradient(135deg, #6366f1, #9333ea)", color: "white" }
                        : { background: "white", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                    >
                      {m.role === "claude" && m.text === "..." ? (
                        <div className="flex gap-1.5 items-center py-0.5">
                          {[0, 150, 300].map((d, i) => (
                            <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                        </div>
                      ) : m.text}
                    </div>
                  </div>
                ))}

                {refineLoading && refineMessages[refineMessages.length - 1]?.text !== "..." && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center" style={{ background: "white", border: "1px solid var(--line)" }}>
                      {[0, 150, 300].map((d, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Refine input */}
              <div className="p-4" style={{ borderTop: "1px solid var(--line)" }}>
                <div className="flex items-end gap-2 rounded-2xl p-2 transition" style={{ border: "1px solid var(--line)", background: "white" }}>
                  <textarea
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                    placeholder="Describe a change..."
                    rows={1}
                    disabled={refineLoading}
                    className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none max-h-24"
                    style={{ color: "var(--ink)" }}
                  />
                  <button
                    onClick={() => handleRefine()}
                    disabled={!refineInput.trim() || refineLoading}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky bottom bar */}
          <div className="flex items-center justify-between px-8 py-4" style={{ borderTop: "1px solid var(--line)", background: "white" }}>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              {readySources.length > 0 ? `${totalWords.toLocaleString()} words · ${readySources.length} source${readySources.length !== 1 ? "s" : ""}` : "No sources attached"}
              {changesCount > 0 && ` · ${changesCount} refinement${changesCount !== 1 ? "s" : ""} applied`}
            </p>
            <div className="flex gap-2">
              {courseId && (
                <Link
                  to="/course/$courseId"
                  params={{ courseId }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition"
                  style={{ background: "white", color: "#4f46e5", border: "1px solid #c7c3f7" }}
                >
                  <Eye className="h-3.5 w-3.5" /> Preview as learner
                </Link>
              )}
              {!published ? (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  {publishing ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Publishing…</> : "Save & publish"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "#e6f3ec", color: "#1f7a52" }}>
                  <Check className="h-3.5 w-3.5" /> Published · ready to assign
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
