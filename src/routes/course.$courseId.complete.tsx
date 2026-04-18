import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import confetti from "canvas-confetti";
import { Award, RefreshCw, Clock, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
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
  const correctSections = taken.filter((b) => b.score >= 0.7).length;

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
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)", color: "var(--ink-3)" }}>
        Loading…
      </div>
    );
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
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="px-5 sm:px-8 py-4"
        style={{ borderBottom: "1px solid var(--line)", background: "white" }}
      >
        <SynclyLogo />
      </header>

      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-12">
        {/* Score card */}
        <div
          className="rounded-2xl p-8 sm:p-10 text-center"
          style={{ background: "white", border: "1px solid var(--line)", boxShadow: "0 1px 0 rgba(20,19,26,.04), 0 8px 24px -8px rgba(20,19,26,.10)" }}
        >
          <div
            className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)", boxShadow: "0 12px 32px -8px rgba(99,102,241,.4)" }}
          >
            <Award className="h-10 w-10" />
          </div>

          <p className="eyebrow-mono mb-2">Course Complete</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(18px, 3vw, 24px)",
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              margin: "4px 0 24px",
            }}
          >
            {course.course_title}
          </h1>

          {/* Big score */}
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(56px, 10vw, 80px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            {displayPct}%
          </div>
          <p className="eyebrow-mono mt-2">Final Score</p>

          {/* Score bar */}
          <div
            className="rounded-full overflow-hidden mx-auto mt-5"
            style={{ height: 10, background: "var(--bg-deep)", maxWidth: 280 }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: ready ? `${finalPct}%` : "0%",
                background: finalPct >= 70 ? "#1f7a52" : "#9a5b10",
              }}
            />
          </div>

          {/* Feedback */}
          <p
            className="mx-auto mt-5 max-w-md leading-relaxed"
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: 17,
              color: "var(--ink-2)",
            }}
          >
            {feedback}
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-6 max-w-sm mx-auto">
            {[
              { n: taken.length, l: "Quizzes" },
              { n: `${correctSections}/${taken.length}`, l: "Passing" },
              { n: totalTimeMins > 0 ? `${totalTimeMins}m` : "—", l: "Time spent" },
            ].map(({ n, l }) => (
              <div
                key={l}
                className="rounded-xl p-3 text-center"
                style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 26,
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono-syncly)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--ink-3)",
                  }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>

          {totalTimeMins > 0 && (
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs"
              style={{ background: "var(--bg)", color: "var(--ink-3)", border: "1px solid var(--line)" }}
            >
              <Clock className="h-3.5 w-3.5" /> Total time: {totalTimeMins} min
            </div>
          )}
        </div>

        {/* Section breakdown */}
        <div
          className="mt-6 rounded-2xl p-6"
          style={{ background: "white", border: "1px solid var(--line)" }}
        >
          <h2 className="font-semibold mb-4" style={{ color: "var(--ink)" }}>Section breakdown</h2>
          <ul className="space-y-2">
            {breakdown.map((b, i) => {
              const isExpanded = expandedIdx === i;
              const timeMins = b.timeSecs > 0 ? Math.ceil(b.timeSecs / 60) : null;
              return (
                <li key={b.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition"
                    style={{ background: "white" }}
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  >
                    {/* Segment dot */}
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        background: !b.taken ? "var(--bg-deep)" : b.score >= 0.7 ? "#1f7a52" : "#9a5b10",
                      }}
                    />
                    <span className="flex-1 text-sm truncate" style={{ color: "var(--ink-2)" }}>
                      {String(i + 1).padStart(2, "0")}. {b.title}
                    </span>
                    {timeMins && (
                      <span style={{ fontSize: 12, color: "var(--ink-4)", flexShrink: 0, fontFamily: "var(--font-mono-syncly)" }}>
                        {timeMins}m
                      </span>
                    )}
                    <span
                      className="text-sm font-semibold shrink-0 min-w-[3rem] text-right"
                      style={{ color: !b.taken ? "var(--ink-4)" : b.score >= 0.7 ? "#1f7a52" : "#9a5b10" }}
                    >
                      {b.taken ? `${Math.round(b.score * 100)}%` : "—"}
                    </span>
                    {b.taken && (
                      <span style={{ flexShrink: 0, color: "var(--ink-4)" }}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    )}
                  </button>

                  {/* Mini score bar */}
                  {b.taken && (
                    <div className="px-4 pb-1.5">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-deep)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.round(b.score * 100)}%`,
                            background: b.score >= 0.7 ? "#1f7a52" : "#9a5b10",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expanded insight */}
                  {isExpanded && b.insight && (
                    <div className="px-4 pb-4 pt-2" style={{ background: "#eceafd", borderTop: "1px solid #c7c3f7" }}>
                      <p className="eyebrow-mono mb-1" style={{ color: "#4f46e5" }}>AI Coach Insight</p>
                      <p className="text-sm leading-relaxed" style={{ color: "#2e2890" }}>{b.insight}</p>
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition"
            style={{ background: "white", color: "var(--ink-2)", border: "1px solid var(--line)" }}
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

        {/* Roleplay CTA */}
        <div
          className="mt-5 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background: "#eceafd", border: "1px solid #c7c3f7" }}
        >
          <div>
            <p className="eyebrow-mono mb-1" style={{ color: "#4f46e5" }}>New — AI Roleplay Practice</p>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 16, color: "#2e2890", margin: 0 }}>
              Put your knowledge to the test in a realistic simulated scenario with an AI character.
            </p>
          </div>
          <Link
            to="/course/$courseId/roleplay"
            params={{ courseId }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
          >
            <MessageSquare className="h-4 w-4" /> Start Roleplay
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" style={{ fontSize: 13, color: "var(--ink-4)" }}>
            Build another course →
          </Link>
        </div>
      </main>
    </div>
  );
}
