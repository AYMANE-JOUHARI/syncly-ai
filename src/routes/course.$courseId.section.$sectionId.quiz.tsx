import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse } from "@/lib/course-context";
import { fetchCourse, recordQuizAttempt, generateQuizInsight } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/section/$sectionId/quiz")({
  component: Quiz,
});

function useCountUp(target: number, duration = 1000, active: boolean) {
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

function Quiz() {
  const { courseId, sectionId } = Route.useParams();
  const { course, setCourse, setProgress } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const record = useServerFn(recordQuizAttempt);
  const getInsight = useServerFn(generateQuizInsight);
  const navigate = useNavigate();

  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [insight, setInsight] = React.useState<string | null>(null);
  const [insightLoading, setInsightLoading] = React.useState(false);

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  const section = course?.sections.find((s) => s.id === sectionId) ?? null;
  const questions = section?.questions ?? [];
  const q = questions[idx];

  // Keyboard navigation
  React.useEffect(() => {
    if (submitted || !q) return;
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
      if (map[e.key]) setAnswers((a) => ({ ...a, [q.id]: map[e.key] }));
      if (e.key === "Enter" && answers[q?.id]) {
        if (idx < questions.length - 1) setIdx((i) => i + 1);
        else void doSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submitted, q, answers, idx, questions.length]);

  const score = submitted
    ? questions.filter((qq) => answers[qq.id] === qq.correct_answer).length / questions.length
    : 0;
  const pct = Math.round(score * 100);
  const correct = submitted ? questions.filter((qq) => answers[qq.id] === qq.correct_answer).length : 0;
  const displayPct = useCountUp(pct, 1000, submitted);

  const select = (key: string) => {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [q.id]: key }));
  };

  const next = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else void doSubmit();
  };

  const doSubmit = async () => {
    setSubmitted(true);
    const wrongTopics: string[] = [];
    for (const ques of questions) {
      const sel = answers[ques.id];
      if (sel !== ques.correct_answer) wrongTopics.push(ques.question.slice(0, 80));
      try { await record({ data: { questionId: ques.id, selected: sel ?? "" } }); } catch {}
    }
    const finalScore = questions.filter((qq) => answers[qq.id] === qq.correct_answer).length / questions.length;
    setProgress(sectionId, { completed: true, quizScore: finalScore, answers });

    setInsightLoading(true);
    getInsight({
      data: { sectionTitle: section?.title ?? "this section", score: finalScore, wrongTopics },
    })
      .then(({ insight: text }) => {
        setInsight(text);
        setProgress(sectionId, { completed: true, quizScore: finalScore, answers, quizInsight: text });
      })
      .catch(() => {})
      .finally(() => setInsightLoading(false));
  };

  if (!course || !section) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)", color: "var(--ink-3)" }}>
        Loading…
      </div>
    );
  }

  const sectionIdx = course.sections.findIndex((s) => s.id === sectionId);
  const isLastSection = sectionIdx === course.sections.length - 1;
  const nextSection = !isLastSection ? course.sections[sectionIdx + 1] : null;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <div className="flex-1 min-w-0">
        {/* Header */}
        <header
          className="flex items-center justify-between px-5 sm:px-8 py-4"
          style={{ borderBottom: "1px solid var(--line)", background: "white" }}
        >
          <button
            onClick={() => navigate({ to: "/course/$courseId/section/$sectionId", params: { courseId, sectionId } })}
            className="inline-flex items-center gap-1.5 text-sm transition"
            style={{ color: "var(--ink-3)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Back to section
          </button>
          <span
            style={{
              fontFamily: "var(--font-mono-syncly)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#4f46e5",
            }}
          >
            Quiz
          </span>
        </header>

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 40px 120px" }}>
          {/* Quiz heading */}
          <div className="mb-8">
            <p
              className="eyebrow-mono mb-2"
              style={{ color: "#4f46e5" }}
            >
              QUIZ · {section.title.toUpperCase().slice(0, 40)}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: "clamp(32px, 4vw, 44px)",
                letterSpacing: "-0.02em",
                margin: "0 0 8px",
                lineHeight: 1.05,
                color: "var(--ink)",
              }}
            >
              {section.title}
            </h1>
            <p style={{ color: "var(--ink-3)", fontSize: 15.5, margin: 0 }}>
              {questions.length} questions — press 1–4 to select, Enter to continue
            </p>
          </div>

          {!submitted ? (
            <div>
              {/* Progress segments */}
              <div className="flex gap-1.5 mb-8">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                      height: 4,
                      background: i < idx ? "#4f46e5" : i === idx ? "var(--ink)" : "var(--bg-deep)",
                      transition: "background .3s",
                    }}
                  />
                ))}
              </div>

              <div key={`q-${idx}`} className="animate-in fade-in slide-in-from-right-4 duration-200">
                <div
                  className="rounded-2xl p-10"
                  style={{
                    background: "white",
                    border: "1px solid var(--line)",
                    boxShadow: "0 1px 0 rgba(20,19,26,.04), 0 8px 24px -8px rgba(20,19,26,.10)",
                  }}
                >
                  <p className="eyebrow-mono mb-2">
                    QUESTION {idx + 1} OF {questions.length}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 400,
                      fontSize: 24,
                      lineHeight: 1.25,
                      margin: "8px 0 28px",
                      letterSpacing: "-0.01em",
                      color: "var(--ink)",
                      textWrap: "pretty" as any,
                    }}
                  >
                    {q.question}
                  </p>

                  <div className="flex flex-col gap-2.5">
                    {q.options.map((opt, oi) => {
                      const selected = answers[q.id] === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => select(opt.key)}
                          className="flex items-center gap-3.5 text-left w-full transition"
                          style={{
                            padding: "16px 18px",
                            border: selected ? "1px solid var(--ink)" : "1px solid var(--line)",
                            borderRadius: 10,
                            background: selected ? "var(--bg-deep)" : "white",
                          }}
                        >
                          {/* Kbd badge */}
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 6,
                              flexShrink: 0,
                              display: "grid",
                              placeItems: "center",
                              fontFamily: "var(--font-mono-syncly)",
                              fontSize: 12,
                              fontWeight: 500,
                              background: selected ? "var(--ink)" : "var(--bg-deep)",
                              color: selected ? "var(--bg)" : "var(--ink-2)",
                            }}
                          >
                            {oi + 1}
                          </span>
                          <span style={{ flex: 1, fontSize: 15, lineHeight: 1.4, color: "var(--ink)" }}>
                            {opt.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <span style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--font-mono-syncly)" }}>
                  {Object.keys(answers).length} / {questions.length} answered
                </span>
                <button
                  onClick={next}
                  disabled={!answers[q.id]}
                  className="rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-40 transition hover:shadow-lg hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  {idx === questions.length - 1 ? "Submit Quiz" : "Next Question →"}
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              {/* Score card */}
              <div
                className="rounded-2xl p-8 text-center"
                style={{
                  background: "white",
                  border: "1px solid var(--line)",
                  boxShadow: "0 1px 0 rgba(20,19,26,.04), 0 8px 24px -8px rgba(20,19,26,.10)",
                }}
              >
                <p className="eyebrow-mono mb-3">Your Score</p>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 400,
                    fontSize: 64,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                  }}
                >
                  {displayPct}%
                </div>

                {/* Score bar */}
                <div
                  className="rounded-full overflow-hidden mx-auto mt-4"
                  style={{ height: 8, background: "var(--bg-deep)", maxWidth: 280 }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 70 ? "#1f7a52" : "#9a5b10",
                    }}
                  />
                </div>

                <p className="mt-4 text-sm" style={{ color: "var(--ink-3)", maxWidth: 360, margin: "16px auto 0" }}>
                  {pct >= 90 ? "Outstanding — you've nailed this section."
                    : pct >= 70 ? "Solid work. You're ready to move on."
                    : pct >= 50 ? "Decent start — review the section to lock in key ideas."
                    : "Worth another read-through before moving on."}
                </p>

                {/* 3-col stats grid */}
                <div className="grid grid-cols-3 gap-3 mt-6 max-w-xs mx-auto">
                  {[
                    { n: correct, l: "Correct" },
                    { n: questions.length - correct, l: "Missed" },
                    { n: `${pct}%`, l: "Score" },
                  ].map(({ n, l }) => (
                    <div
                      key={l}
                      className="rounded-xl p-3 text-center"
                      style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 28,
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
              </div>

              {/* AI Insight card */}
              <div className="mt-4 rounded-2xl p-5" style={{ background: "#eceafd", border: "1px solid #c7c3f7" }}>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    <Lightbulb className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p
                      className="eyebrow-mono mb-1"
                      style={{ color: "#4f46e5" }}
                    >
                      AI Coach Insight
                    </p>
                    {insightLoading ? (
                      <div className="space-y-1.5">
                        <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: "#c7c3f7" }} />
                        <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: "#c7c3f7" }} />
                      </div>
                    ) : insight ? (
                      <p className="text-sm leading-relaxed" style={{ color: "#2e2890" }}>{insight}</p>
                    ) : (
                      <p className="text-sm italic" style={{ color: "#4f46e5" }}>Generating feedback…</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Question breakdown */}
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--ink-2)" }}>Question review</h2>
                {questions.map((qq, i) => {
                  const sel = answers[qq.id];
                  const ok = sel === qq.correct_answer;
                  return (
                    <div
                      key={qq.id}
                      className="rounded-2xl p-5"
                      style={{ background: "white", border: "1px solid var(--line)" }}
                    >
                      <div className="flex items-start gap-2">
                        {ok ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#1f7a52" }} />
                        ) : (
                          <XCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#a3321f" }} />
                        )}
                        <p className="font-medium text-sm" style={{ color: "var(--ink)" }}>
                          {i + 1}. {qq.question}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        {qq.options.map((opt) => {
                          const isCorrect = opt.key === qq.correct_answer;
                          const isSelected = opt.key === sel;
                          return (
                            <div
                              key={opt.key}
                              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                              style={{
                                border: isCorrect
                                  ? "1px solid #6ee7b7"
                                  : isSelected && !isCorrect
                                    ? "1px solid #fca5a5"
                                    : "1px solid var(--line)",
                                background: isCorrect ? "#f0fdf4" : isSelected && !isCorrect ? "#fef2f2" : "white",
                                color: isCorrect ? "#166534" : isSelected && !isCorrect ? "#7f1d1d" : "var(--ink-3)",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--font-mono-syncly)",
                                  fontWeight: 500,
                                  width: 16,
                                  flexShrink: 0,
                                }}
                              >
                                {opt.key}.
                              </span>
                              <span className="flex-1">{opt.text}</span>
                              {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#1f7a52" }} />}
                              {isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#a3321f" }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-end gap-3 flex-wrap">
                <button
                  onClick={() => navigate({ to: "/course/$courseId", params: { courseId } })}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold transition"
                  style={{ background: "white", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                >
                  Course home
                </button>
                {nextSection ? (
                  <button
                    onClick={() => navigate({ to: "/course/$courseId/section/$sectionId", params: { courseId, sectionId: nextSection.id } })}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg transition"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    Continue to Next Section →
                  </button>
                ) : (
                  <button
                    onClick={() => navigate({ to: "/course/$courseId/complete", params: { courseId } })}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg transition"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    🎉 See final score →
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      <ChatSidebar courseId={courseId} />
    </div>
  );
}
