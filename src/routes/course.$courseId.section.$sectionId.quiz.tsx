import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse } from "@/lib/course-context";
import { fetchCourse, recordQuizAttempt } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/section/$sectionId/quiz")({
  component: Quiz,
});

function Quiz() {
  const { courseId, sectionId } = Route.useParams();
  const { course, setCourse, setProgress } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const record = useServerFn(recordQuizAttempt);
  const navigate = useNavigate();

  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  const section = course?.sections.find((s) => s.id === sectionId) ?? null;

  if (!course || !section) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading…</div>;
  }

  const questions = section.questions;
  const sectionIdx = course.sections.findIndex((s) => s.id === sectionId);
  const isLastSection = sectionIdx === course.sections.length - 1;
  const nextSection = !isLastSection ? course.sections[sectionIdx + 1] : null;
  const q = questions[idx];

  const select = (key: string) => {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [q.id]: key }));
  };

  const next = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else submit();
  };

  const submit = async () => {
    setSubmitted(true);
    let correct = 0;
    for (const ques of questions) {
      const sel = answers[ques.id];
      if (sel === ques.correct_answer) correct++;
      try { await record({ data: { questionId: ques.id, selected: sel ?? "" } }); } catch {}
    }
    const score = correct / questions.length;
    setProgress(sectionId, { completed: true, quizScore: score, answers });
  };

  const score = submitted
    ? questions.filter((qq) => answers[qq.id] === qq.correct_answer).length / questions.length
    : 0;
  const pct = Math.round(score * 100);
  const feedback =
    pct >= 90 ? "Outstanding — you've nailed this section."
    : pct >= 70 ? "Solid work. Review the missed items and you're set."
    : pct >= 50 ? "Decent start — revisit the section to lock in the key ideas."
    : "Worth another read-through before moving on.";

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
        </header>

        <main className="mx-auto max-w-2xl px-5 sm:px-8 pt-10 pb-24">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-indigo-600">
            Quiz
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {section.title}
          </h1>

          {!submitted ? (
            <div className="mt-8">
              <div className="text-sm text-slate-500 mb-4">
                Question {idx + 1} of {questions.length}
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <p className="text-lg font-medium text-slate-900">{q.question}</p>
                <div className="mt-5 grid gap-2.5">
                  {q.options.map((opt) => {
                    const selected = answers[q.id] === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => select(opt.key)}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                          selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}>
                          {opt.key}
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={next}
                  disabled={!answers[q.id]}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
                >
                  {idx === questions.length - 1 ? "Submit Quiz" : "Next Question"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-100 text-center">
                <div
                  className="mx-auto mb-3 inline-block bg-clip-text text-transparent text-5xl font-extrabold"
                  style={{ backgroundImage: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
                >
                  You scored {pct}%
                </div>
                <p className="text-sm text-slate-600">{feedback}</p>
              </div>

              <div className="mt-6 space-y-3">
                {questions.map((qq, i) => {
                  const sel = answers[qq.id];
                  const ok = sel === qq.correct_answer;
                  return (
                    <div key={qq.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                      <div className="flex items-start gap-2">
                        {ok ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        )}
                        <p className="font-medium text-slate-900">
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
                              className={`rounded-lg border px-3 py-2 text-sm ${
                                isCorrect
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                  : isSelected
                                    ? "border-red-300 bg-red-50 text-red-900"
                                    : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              <span className="font-semibold mr-2">{opt.key}.</span>
                              {opt.text}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Link
                  to="/course/$courseId"
                  params={{ courseId }}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
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
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-md"
                    style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
                  >
                    Continue to Next Section →
                  </button>
                ) : (
                  <button
                    onClick={() => navigate({ to: "/course/$courseId/complete", params: { courseId } })}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-md"
                    style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
                  >
                    See final score →
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
