import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import confetti from "canvas-confetti";
import { Award, RefreshCw, Download } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { useCourse } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/complete")({
  component: Complete,
});

function Complete() {
  const { courseId } = Route.useParams();
  const { course, setCourse, progress, resetProgress } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  const breakdown = React.useMemo(() => {
    if (!course) return [];
    return course.sections.map((s) => ({
      title: s.title,
      score: progress[s.id]?.quizScore ?? 0,
      taken: progress[s.id]?.quizScore != null,
    }));
  }, [course, progress]);

  const taken = breakdown.filter((b) => b.taken);
  const finalPct = taken.length
    ? Math.round((taken.reduce((sum, b) => sum + b.score, 0) / taken.length) * 100)
    : 0;

  React.useEffect(() => {
    if (finalPct >= 70) {
      const end = Date.now() + 1200;
      const tick = () => {
        confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0 } });
        confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(tick);
      };
      tick();
    }
  }, [finalPct]);

  if (!course) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading…</div>;
  }

  const strong = breakdown.filter((b) => b.score >= 0.8).map((b) => b.title);
  const weak = breakdown.filter((b) => b.score < 0.7).map((b) => b.title);
  const feedback = (() => {
    const parts: string[] = [];
    if (strong.length) parts.push(`You showed strong command of ${strong.slice(0, 2).join(" and ")}.`);
    if (weak.length) parts.push(`Focus your next review on ${weak.slice(0, 2).join(" and ")} to round out your readiness.`);
    if (!parts.length) parts.push("Great effort — keep practicing to deepen your understanding.");
    return parts.join(" ");
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 sm:px-8 py-4">
        <SynclyLogo />
      </header>
      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-12">
        <div className="rounded-2xl bg-white p-8 sm:p-10 text-center shadow-sm ring-1 ring-slate-100">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
          >
            <Award className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Course complete</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{course.course_title}</h1>
          <div
            className="mt-6 inline-block bg-clip-text text-transparent text-6xl font-extrabold"
            style={{ backgroundImage: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
          >
            Final Score: {finalPct}%
          </div>
          <p className="mt-5 mx-auto max-w-md text-sm text-slate-600 leading-relaxed">{feedback}</p>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="font-semibold text-slate-900 mb-4">Section breakdown</h2>
          <ul className="space-y-3">
            {breakdown.map((b, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700 truncate">
                  {i + 1}. {b.title}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    !b.taken ? "text-slate-400" : b.score >= 0.7 ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {b.taken ? `${Math.round(b.score * 100)}%` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              resetProgress();
              navigate({ to: "/course/$courseId", params: { courseId } });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Retake Course
          </button>
          <button
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-md opacity-90 cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
          >
            <Download className="h-4 w-4" /> Download Certificate
          </button>
        </div>

        <div className="mt-10 text-center">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
            Build another course →
          </Link>
        </div>
      </main>
    </div>
  );
}
