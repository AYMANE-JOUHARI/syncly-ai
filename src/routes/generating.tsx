import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { useServerFn } from "@tanstack/react-start";
import { fetchCourse, generateCourse } from "@/server/ai";
import { useCourse } from "@/lib/course-context";

export const Route = createFileRoute("/generating")({
  component: Generating,
});

const STEPS = [
  "Analyzing your documents...",
  "Building your learning path...",
  "Generating quiz questions...",
  "Finalizing your course...",
];

function Generating() {
  const navigate = useNavigate();
  const { setCourse } = useCourse();
  const generate = useServerFn(generateCourse);
  const fetchC = useServerFn(fetchCourse);

  const [step, setStep] = React.useState(0);
  const [longWait, setLongWait] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const intake = (() => {
      try { return JSON.parse(sessionStorage.getItem("syncly:intake") ?? "null"); } catch { return null; }
    })();
    if (!intake) {
      navigate({ to: "/" });
      return;
    }

    const stepInterval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 2200);
    const longTimer = setTimeout(() => setLongWait(true), 20000);

    (async () => {
      try {
        const { courseId } = await generate({ data: intake });
        const course = await fetchC({ data: { courseId } });
        setCourse(course);
        setStep(STEPS.length - 1);
        clearInterval(stepInterval);
        clearTimeout(longTimer);
        setTimeout(() => {
          navigate({ to: "/course/$courseId", params: { courseId } });
        }, 600);
      } catch (e: any) {
        clearInterval(stepInterval);
        clearTimeout(longTimer);
        setError(e?.message ?? "Generation failed.");
      }
    })();

    return () => {
      clearInterval(stepInterval);
      clearTimeout(longTimer);
    };
  }, [generate, fetchC, navigate, setCourse]);

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-6 bg-brand-animated"
    >
      <div className="absolute inset-0 bg-white/85 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <SynclyLogo size="lg" />
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-lg ring-1 ring-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Building your course</h2>
          <p className="text-sm text-slate-500 mb-6">This usually takes under 30 seconds.</p>
          <ul className="space-y-3">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step && !error;
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      done
                        ? "text-white"
                        : active
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-slate-100 text-slate-400"
                    }`}
                    style={done ? { background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" } : undefined}
                  >
                    {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
                  </span>
                  <span className={`text-sm ${done ? "text-slate-900 font-medium" : active ? "text-slate-900" : "text-slate-400"}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
          {longWait && !error && (
            <p className="mt-6 text-xs text-slate-500 text-center">
              Almost there — this usually takes under 30 seconds.
            </p>
          )}
          {error && (
            <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
              <p className="font-medium mb-1">Something went wrong</p>
              <p>{error}</p>
              <button
                onClick={() => navigate({ to: "/" })}
                className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
