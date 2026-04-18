import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Upload, FileText, Sparkles, X } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { extractPdfText } from "@/lib/pdf";

export const Route = createFileRoute("/")({
  component: Intake,
});

const LEVELS = [
  { value: "new_to_industry", label: "New to industry" },
  { value: "switching_roles", label: "Switching roles" },
  { value: "experienced_company_context", label: "Experienced but needs company context" },
];

function Intake() {
  const navigate = useNavigate();
  const [role, setRole] = React.useState("");
  const [level, setLevel] = React.useState(LEVELS[0].value);
  const [goal, setGoal] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFile = async (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!role.trim()) {
      setError("Please describe the role.");
      return;
    }
    setParsing(true);
    let pdfText = "";
    if (file) {
      try {
        pdfText = await extractPdfText(file);
      } catch (err: any) {
        console.error("PDF extract failed:", err);
        // Non-fatal: continue without PDF context rather than blocking the user
        pdfText = "";
      }
    }
    sessionStorage.setItem(
      "syncly:intake",
      JSON.stringify({ role, experienceLevel: level, goal, pdfText }),
    );
    navigate({ to: "/generating" });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-6 py-5 sm:px-10">
        <SynclyLogo />
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-20">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-100">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered onboarding
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Turn your docs into a course in 60 seconds
          </h1>
          <p className="mt-3 text-slate-600">
            Describe the role, drop in an internal PDF, and get a structured learning path with quizzes and an AI tutor.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-100"
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
            className="w-full rounded-2xl px-5 py-4 text-base font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
          >
            {parsing ? "Reading PDF…" : "Generate My Course"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-indigo-600">*</span>}
      </label>
      {children}
    </div>
  );
}
