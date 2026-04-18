import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import confetti from "canvas-confetti";
import { Award, RefreshCw, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { useCourse } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/complete")({
  component: Complete,
});

function useCountUp(target: number, duration = 1500, active: boolean) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    let raf: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return display;
}

function Complete() {
  const { courseId } = Route.useParams();
  const { course, setCourse, progress, resetProgress, sectionTimes } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const navigate = useNavigate();
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  const breakdown = React.useMemo(() => {
    if (!course) return [];
    return course.sections.map((s) => ({
      id: s.id,
      title: s.title,
      score: progress[s.id]?.quizScore ?? 0,
      taken: progress[s.id]?.quizScore != null,
      insight: progress[s.id]?.quizInsight,
      timeSecs: sectionTimes?.[s.id] ?? 0,
    }));
  }, [course, progress, sectionTimes]);

  const taken = breakdown.filter((b) => b.taken);
  const finalPct = taken.length
    ? Math.round((taken.reduce((sum, b) => sum + b.score, 0) / taken.length) * 100)
    : 0;

  const displayPct = useCountUp(finalPct, 1500, ready);

  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!ready || finalPct < 70) return;
    const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#818cf8", "#c7d2fe", "#e0e7ff"];
    const end = Date.now() + 3000;
    const tick = () => {
      confetti({ particleCount: 80, angle: 60, spread: 80, origin: { x: 0 }, colors: COLORS });
      confetti({ particleCount: 80, angle: 120, spread: 80, origin: { x: 1 }, colors: COLORS });
      if (Date.now() < end) requestAnimationFrame(tick);
    };
    tick();
  }, [ready, finalPct]);

  if (!course) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading…</div>;
  }

  const strong = breakdown.filter((b) => b.score >= 0.8).map((b) => b.title);
  const weak = breakdown.filter((b) => b.taken && b.score < 0.7).map((b) => b.title);
  const feedback = (() => {
    const parts: string[] = [];
    if (strong.length) parts.push(`You showed strong command of ${strong.slice(0, 2).join(" and ")}.`);
    if (weak.length) parts.push(`Focus your next review on ${weak.slice(0, 2).join(" and ")} to round out your readiness.`);
    if (!parts.length) parts.push("Great effort — keep practicing to deepen your understanding across all sections.");
    return parts.join(" ");
  })();

  const totalTimeMins = Math.ceil(
    Object.values(sectionTimes ?? {}).reduce((a, b) => a + b, 0) / 60
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 sm:px-8 py-4">
        <SynclyLogo />
      </header>

      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-12">
        {/* Score card */}
        <div className="rounded-2xl bg-white p-8 sm:p-10 text-center shadow-sm ring-1 ring-slate-100">
          <div
            className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
          >
            <Award className="h-10 w-10" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Course Complete</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">{course.course_title}</h1>

          <div className="mt-6">
            <div
              className="inline-block bg-clip-text text-transparent font-extrabold"
              style={{
                backgroundImage: "linear-gradient(135deg, #6366f1, #9333ea)",
                fontSize: "clamp(3rem, 10vw, 5rem)",
                lineHeight: 1,
              }}
            >
              {displayPct}%
            </div>
            <p className="text-base font-semibold text-slate-500 mt-1">Final Score</p>
          </div>

          {/* Score bar */}
          <div className="mt-5 h-2.5 rounded-full bg-slate-100 overflow-hidden max-w-xs mx-auto">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: ready ? `${finalPct}%` : "0%",
                background: finalPct >= 70 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #f59e0b, #d97706)",
              }}
            />
          </div>

          <p className="mt-5 mx-auto max-w-md text-sm text-slate-600 leading-relaxed">{feedback}</p>

          {totalTimeMins > 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-4 py-1.5 text-xs text-slate-500 ring-1 ring-slate-100">
              <Clock className="h-3.5 w-3.5" /> Total time spent: {totalTimeMins} min
            </div>
          )}
        </div>

        {/* Section breakdown */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="font-semibold text-slate-900 mb-4">Section breakdown</h2>
          <ul className="space-y-3">
            {breakdown.map((b, i) => {
              const isExpanded = expandedIdx === i;
              const timeMins = b.timeSecs > 0 ? Math.ceil(b.timeSecs / 60) : null;
              return (
                <li key={b.id} className="rounded-xl overflow-hidden ring-1 ring-slate-100">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition"
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  >
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        !b.taken ? "bg-slate-300" : b.score >= 0.7 ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="flex-1 text-sm text-slate-700 text-left truncate">
                      {i + 1}. {b.title}
                    </span>
                    {timeMins && (
                      <span className="text-xs text-slate-400 shrink-0">{timeMins} min</span>
                    )}
                    <span
                      className={`text-sm font-semibold shrink-0 min-w-[3rem] text-right ${
                        !b.taken ? "text-slate-400" : b.score >= 0.7 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {b.taken ? `${Math.round(b.score * 100)}%` : "—"}
                    </span>
                    {b.taken && (
                      <span className="shrink-0 text-slate-400">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    )}
                  </button>

                  {/* Score mini-bar */}
                  {b.taken && (
                    <div className="px-4 pb-1">
                      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.round(b.score * 100)}%`,
                            background: b.score >= 0.7 ? "#10b981" : "#f59e0b",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expanded insight */}
                  {isExpanded && b.insight && (
                    <div className="px-4 pb-4 pt-2 bg-indigo-50 border-t border-indigo-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">AI Coach Insight</p>
                      <p className="text-sm text-indigo-900 leading-relaxed">{b.insight}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              resetProgress();
              navigate({ to: "/course/$courseId", params: { courseId } });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-4 w-4" /> Retake Course
          </button>
          <Link
            to="/course/$courseId/certificate"
            params={{ courseId }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition"
            style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
          >
            <Award className="h-4 w-4" /> Download Certificate
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
            Build another course →
          </Link>
        </div>
      </main>
    </div>
  );
}
