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
  "Analyzing role and learning objectives...",
  "Structuring your learning path...",
  "Writing section content...",
  "Generating quiz questions...",
  "Finalizing and saving your course...",
];

const STEP_INTERVAL = 5000; // ~25s total for 5 steps
const TOTAL_PROGRESS_MS = 28000;

function Generating() {
  const navigate = useNavigate();
  const { setCourse } = useCourse();
  const generate = useServerFn(generateCourse);
  const fetchC = useServerFn(fetchCourse);

  const [step, setStep] = React.useState(0);
  const [barPct, setBarPct] = React.useState(0);
  const [longWait, setLongWait] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ranRef = React.useRef(false);
  const startRef = React.useRef(Date.now());

  // Animate progress bar
  React.useEffect(() => {
    const start = Date.now();
    startRef.current = start;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(95, (elapsed / TOTAL_PROGRESS_MS) * 100);
      setBarPct(pct);
      if (pct < 95) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const intake = (() => {
      try { return JSON.parse(sessionStorage.getItem("syncly:intake") ?? "null"); }
      catch { return null; }
    })();
    if (!intake) { navigate({ to: "/" }); return; }

    const stepInterval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, STEP_INTERVAL);
    const longTimer = setTimeout(() => setLongWait(true), 22000);

    (async () => {
      try {
        const { courseId } = await generate({ data: intake });
        const course = await fetchC({ data: { courseId } });
        setCourse(course);
        setStep(STEPS.length - 1);
        setBarPct(100);
        clearInterval(stepInterval);
        clearTimeout(longTimer);
        setTimeout(() => {
          navigate({ to: "/course/$courseId", params: { courseId } });
        }, 700);
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
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-6 bg-brand-animated">
      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <SynclyLogo size="lg" />
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-100">
          {/* Progress bar at top */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${barPct}%`,
                background: "linear-gradient(90deg, #6366f1, #9333ea)",
              }}
            />
          </div>

          <div className="p-7">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Building your course</h2>
            <p className="text-sm text-slate-500 mb-7">Claude is crafting a tailored learning path for this role.</p>

            {/* Steps with vertical connector */}
            <ul className="space-y-0">
              {STEPS.map((label, i) => {
                const done = i < step;
                const active = i === step && !error;
                const pending = i > step;
                return (
                  <li key={label} className="flex gap-4">
                    {/* Step indicator column */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-500 ${
                          done
                            ? "text-white"
                            : active
                              ? "bg-indigo-100 text-indigo-600"
                              : "bg-slate-100 text-slate-400"
                        }`}
                        style={
                          done
                            ? { background: "linear-gradient(135deg, #6366f1, #9333ea)" }
                            : undefined
                        }
                      >
                        {/* Pulsing ring for active */}
                        {active && (
                          <span className="absolute inset-0 rounded-full bg-indigo-200 animate-ping opacity-75" />
                        )}
                        {done ? (
                          <Check className="h-4 w-4" />
                        ) : active ? (
                          <Loader2 className="h-4 w-4 animate-spin relative z-10" />
                        ) : (
                          <span className="relative z-10">{i + 1}</span>
                        )}
                      </div>
                      {/* Vertical connector line */}
                      {i < STEPS.length - 1 && (
                        <div
                          className={`w-px flex-1 my-1 transition-colors duration-500 ${
                            done ? "bg-indigo-300" : "bg-slate-200"
                          }`}
                          style={{ minHeight: "20px" }}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pb-5 pt-1.5">
                      <span
                        className={`text-sm transition-colors duration-300 ${
                          done
                            ? "font-medium text-slate-900"
                            : active
                              ? "font-medium text-slate-900"
                              : pending
                                ? "text-slate-400"
                                : "text-slate-400"
                        }`}
                      >
                        {label}
                      </span>
                      {done && (
                        <span className="ml-2 text-xs text-emerald-500 font-medium">✓ Done</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {longWait && !error && (
              <p className="mt-2 text-xs text-slate-500 text-center bg-slate-50 rounded-xl py-3 px-4">
                Almost there — complex roles take a bit longer to craft well.
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
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

        <p className="mt-4 text-center text-xs text-slate-400">
          Powered by Claude AI · Results are saved to your session
        </p>
      </div>
    </div>
  );
}
