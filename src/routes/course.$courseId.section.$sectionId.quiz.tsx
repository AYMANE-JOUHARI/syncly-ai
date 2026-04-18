import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
      if (map[e.key]) {
        setAnswers((a) => ({ ...a, [q.id]: map[e.key] }));
      }
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
    let correct = 0;
    const wrongTopics: string[] = [];
    for (const ques of questions) {
      const sel = answers[ques.id];
      if (sel === ques.correct_answer) correct++;
      else wrongTopics.push(ques.question.slice(0, 80));
      try { await record({ data: { questionId: ques.id, selected: sel ?? "" } }); } catch {}
    }
    const finalScore = correct / questions.length;
    setProgress(sectionId, { completed: true, quizScore: finalScore, answers });

    // Fire-and-forget insight generation
    setInsightLoading(true);
    getInsight({
      data: {
        sectionTitle: section?.title ?? "this section",
        score: finalScore,
        wrongTopics,
      },
    })
      .then(({ insight: text }) => {
        setInsight(text);
        setProgress(sectionId, { completed: true, quizScore: finalScore, answers, quizInsight: text });
      })
      .catch(() => {})
      .finally(() => setInsightLoading(false));
  };

  if (!course || !section) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading…</div>;
  }

  const sectionIdx = course.sections.findIndex((s) => s.id === sectionId);
  const isLastSection = sectionIdx === course.sections.length - 1;
  const nextSection = !isLastSection ? course.sections[sectionIdx + 1] : null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="flex-1 min-w-0">
        <header className="border-b border-slate-200 bg-white px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link
            to="/course/$courseId/section/$sectionId"
            params={{ courseId, sectionId }}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to section
          </Link>
          <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Quiz</span>
        </header>

        <main className="mx-auto max-w-2xl px-5 sm:px-8 pt-10 pb-24">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-1">
            {section.title}
          </h1>

          {!submitted ? (
            <div className="mt-6">
              {/* Progress dots */}
              <div className="flex items-center gap-2 mb-6">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all ${
                      i < idx
                        ? "w-6 bg-emerald-400"
                        : i === idx
                          ? "w-8 bg-indigo-500"
                          : "w-2 bg-slate-200"
                    }`}
                  />
                ))}
                <span className="ml-2 text-xs text-slate-500">
                  {idx + 1} / {questions.length}
                </span>
              </div>

              <div
                key={`q-${idx}`}
                className="animate-in fade-in slide-in-from-right-4 duration-200"
              >
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <p className="text-lg font-medium text-slate-900 leading-snug">{q.question}</p>
                  <p className="mt-1 text-xs text-slate-400">Press 1–4 to select, Enter to continue</p>
                  <div className="mt-5 grid gap-2.5">
                    {q.options.map((opt, oi) => {
                      const selected = answers[q.id] === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => select(opt.key)}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition hover:shadow-sm ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                              selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {oi + 1}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {selected && (
                            <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <span className="text-xs text-slate-400">
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
            <div className="mt-6 animate-in fade-in duration-300">
              {/* Score card */}
              <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100 text-center">
                <p className="text-sm font-medium uppercase tracking-wide text-slate-500 mb-2">
                  Your score
                </p>
                <div
                  className="inline-block bg-clip-text text-transparent text-6xl font-extrabold mb-2"
                  style={{ backgroundImage: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  {displayPct}%
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden max-w-xs mx-auto">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 70 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #f59e0b, #d97706)",
                    }}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {pct >= 90 ? "Outstanding — you've nailed this section."
                    : pct >= 70 ? "Solid work. You're ready to move on."
                    : pct >= 50 ? "Decent start — review the section to lock in key ideas."
                    : "Worth another read-through before moving on."}
                </p>
              </div>

              {/* AI Insight card */}
              <div className="mt-4 rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-100">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    <Lightbulb className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">
                      AI Coach Insight
                    </p>
                    {insightLoading ? (
                      <div className="space-y-1.5">
                        <div className="h-3 w-3/4 rounded bg-indigo-200 animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-indigo-200 animate-pulse" />
                      </div>
                    ) : insight ? (
                      <p className="text-sm text-indigo-900 leading-relaxed">{insight}</p>
                    ) : (
                      <p className="text-sm text-indigo-600 italic">Generating feedback…</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Question breakdown */}
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">Question review</h2>
                {questions.map((qq, i) => {
                  const sel = answers[qq.id];
                  const ok = sel === qq.correct_answer;
                  return (
                    <div key={qq.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                      <div className="flex items-start gap-2">
                        {ok ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <p className="font-medium text-slate-900 text-sm">
                          {i + 1}. {qq.question}
                        </p>
                      </div>
                      <div className="mt-3 grid gap-1.5">
                        {qq.options.map((opt) => {
                          const isCorrect = opt.key === qq.correct_answer;
                          const isSelected = opt.key === sel;
                          return (
                            <div
                              key={opt.key}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                isCorrect
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                  : isSelected && !isCorrect
                                    ? "border-red-300 bg-red-50 text-red-900"
                                    : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              <span className="font-semibold w-4 shrink-0">{opt.key}.</span>
                              <span className="flex-1">{opt.text}</span>
                              {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                              {isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-end gap-3 flex-wrap">
                <Link
                  to="/course/$courseId"
                  params={{ courseId }}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition"
                >
                  Course home
                </Link>
                {nextSection ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/course/$courseId/section/$sectionId",
                        params: { courseId, sectionId: nextSection.id },
                      })
                    }
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
