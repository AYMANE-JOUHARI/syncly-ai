import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import { Upload, FileText, Sparkles, X, BookOpen, Target, MessageCircle, ArrowRight, CheckCircle, Zap } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { extractPdfText } from "@/lib/pdf";
import { useLastCourseId } from "@/lib/course-context";

export const Route = createFileRoute("/")({
  component: Intake,
});

const LEVELS = [
  { value: "new_to_industry", label: "New to industry" },
  { value: "switching_roles", label: "Switching roles" },
  { value: "experienced_company_context", label: "Experienced but needs company context" },
];

const FEATURES = [
  {
    icon: BookOpen,
    title: "AI-Structured Content",
    description:
      "Claude AI reads your role description and internal docs to produce a tailored 5-6 section learning path — no manual authoring required.",
  },
  {
    icon: Target,
    title: "Built-in Quizzes",
    description:
      "Each section ends with 4 comprehension questions that test real understanding. Results are scored server-side and tracked throughout the course.",
  },
  {
    icon: MessageCircle,
    title: "Ask Your AI Tutor",
    description:
      "An always-visible AI sidebar answers questions, gives hints on quiz questions, and keeps new hires unblocked — without giving away answers directly.",
  },
];

const SOCIAL_PROOF = [
  "Charter Aviation",
  "SaaS Sales",
  "Financial Services",
  "Healthcare Ops",
  "Logistics & Freight",
  "Customer Success",
];

function Intake() {
  const navigate = useNavigate();
  const lastCourseId = useLastCourseId();
  const [role, setRole] = React.useState("");
  const [level, setLevel] = React.useState(LEVELS[0].value);
  const [goal, setGoal] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFile = async (f: File | null) => {
    setError(null);
    if (!f) { setFile(null); return; }
    if (f.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!role.trim()) { setError("Please describe the role."); return; }
    setParsing(true);
    let pdfText = "";
    if (file) {
      try { pdfText = await extractPdfText(file); }
      catch (err) { console.error("PDF extract failed:", err); pdfText = ""; }
    }
    sessionStorage.setItem(
      "syncly:intake",
      JSON.stringify({ role, experienceLevel: level, goal, pdfText }),
    );
    navigate({ to: "/generating" });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-slate-950 pb-24 pt-8">
        {/* Subtle radial gradient background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.25) 0%, transparent 70%)",
          }}
        />

        {/* Header */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-2 sm:px-10">
          <SynclyLogo size="md" />
          <nav className="flex items-center gap-4">
            {lastCourseId && (
              <Link
                to="/course/$courseId"
                params={{ courseId: lastCourseId }}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 hover:bg-white/15 transition"
              >
                Resume last course <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            <a
              href="#get-started"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
            >
              Get started free
            </a>
          </nav>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-3xl px-6 pt-16 text-center sm:px-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-indigo-300 ring-1 ring-white/10">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by Claude AI — builds your course in under 60 seconds
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Build any onboarding course
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #818cf8, #c084fc)" }}
            >
              in 60 seconds
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
            Describe the role, drop in an internal PDF, and get a structured learning path with quizzes and an AI tutor — ready before your new hire's first day.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="#get-started"
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:shadow-indigo-500/25 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
            >
              Build a course free <ArrowRight className="h-4 w-4" />
            </a>
            {lastCourseId && (
              <Link
                to="/course/$courseId"
                params={{ courseId: lastCourseId }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-medium text-white transition hover:bg-white/10"
              >
                Resume my last course
              </Link>
            )}
          </div>

          {/* Social proof chips */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {SOCIAL_PROOF.map((role) => (
              <span
                key={role}
                className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-white/10"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Everything a new hire needs, generated instantly
            </h2>
            <p className="mt-3 text-slate-500">
              No course authoring. No manual quiz creation. Just upload what your team knows and let AI do the rest.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.description}</p>
              </div>
            ))}
          </div>

          {/* How it works strip */}
          <div className="mt-12 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
            <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-slate-400">
              How it works
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: FileText, step: "1", label: "Describe the role", desc: "Tell Claude what this person will do day-to-day and their starting experience level." },
                { icon: Zap, step: "2", label: "AI builds the course", desc: "Claude structures a 5-6 section learning path, writes content, and generates 4 quiz questions per section." },
                { icon: CheckCircle, step: "3", label: "New hire learns & gets certified", desc: "They read, take quizzes, ask the AI tutor anything, and earn a completion certificate." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── INTAKE FORM ── */}
      <section id="get-started" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-2xl px-5">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Build your first course — free
            </h2>
            <p className="mt-2 text-slate-500">
              Describe the role and optional context document. Claude handles the rest.
            </p>
          </div>

          {/* Resume banner */}
          {lastCourseId && (
            <div className="mb-6 flex items-center justify-between rounded-2xl bg-indigo-50 px-5 py-4 ring-1 ring-indigo-100">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Resume where you left off</p>
                <p className="text-xs text-indigo-600 mt-0.5">Your previous course is still saved</p>
              </div>
              <Link
                to="/course/$courseId"
                params={{ courseId: lastCourseId }}
                className="flex-shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
              >
                Resume →
              </Link>
            </div>
          )}

          <form
            onSubmit={submit}
            className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8"
          >
            <Field label="Describe the role" required>
              <textarea
                value={role}
                onChange={(e) => setRole(e.target.value)}
                rows={4}
                placeholder="e.g. Charter Broker responsible for quoting private jet charters, client communication, and FAA compliance"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </Field>

            <Field label="Experience Level">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Learning Goal">
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Ready to quote first charter in 2 weeks"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </Field>

            <Field label="Upload internal document (optional)">
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  handleFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                  drag ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <span className="text-slate-800">{file.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setFile(null); }}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-slate-400" />
                    <div className="text-sm font-medium text-slate-700">
                      Drag & drop a PDF, or click to browse
                    </div>
                    <div className="text-xs text-slate-500">PDF only, up to ~30 pages</div>
                  </>
                )}
              </label>
            </Field>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={parsing}
              className="w-full rounded-2xl px-5 py-4 text-base font-semibold text-white shadow-md transition hover:shadow-lg hover:scale-[1.01] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
            >
              {parsing ? "Reading PDF…" : "Generate My Course →"}
            </button>

            <p className="text-center text-xs text-slate-400">
              Free to use · No account required · Powered by Claude AI
            </p>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <SynclyLogo size="sm" />
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Syncly.ai — AI-powered employee onboarding
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-indigo-600">*</span>}
      </label>
      {children}
    </div>
  );
}
