import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import {
  ArrowLeft, CheckCircle2, Lock, Play, Clock,
  BookOpen, Target, Lightbulb, Zap, Star, CheckSquare,
} from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/")({
  component: CourseHome,
});

const SECTION_ICONS = [BookOpen, Target, Lightbulb, Zap, Star, CheckSquare];

function readTime(text: string) {
  const words = text.split(/\s+/).length;
  return Math.max(2, Math.round(words / 220));
}

function CircularProgress({ pct }: { pct: number }) {
  const size = 112;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-label={`${pct}% complete`}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#e2e8f0" strokeWidth={8}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="url(#brandGrad)"
        strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <defs>
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <text
        x="50%" y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-900 text-xl font-bold"
        style={{
          transform: "rotate(90deg)",
          transformOrigin: `${size / 2}px ${size / 2}px`,
          fontSize: "20px",
          fontWeight: "700",
        }}
      >
        {pct}%
      </text>
    </svg>
  );
}

function CourseHome() {
  const { courseId } = Route.useParams();
  const { course, setCourse, progress, sectionTimes } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  if (!course || course.id !== courseId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading course…
      </div>
    );
  }

  const total = course.sections.length;
  const completed = course.sections.filter((s) => progress[s.id]?.completed).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const totalTime = course.sections.reduce((sum, s) => sum + readTime(s.content), 0);
  const allDone = completed === total && total > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="flex-1 min-w-0">
        <header className="border-b border-slate-200 bg-white px-5 sm:px-8 py-4 flex items-center justify-between">
          <SynclyLogo />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> New course
          </Link>
        </header>

        <main className="px-5 sm:px-8 pb-24 pt-8">
          <div className="mx-auto max-w-3xl">
            {/* Course header card */}
            <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-slate-100 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                    {course.course_title}
                  </h1>
                  {course.learner_goal && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                      🎯 {course.learner_goal}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> {totalTime} min total
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" /> {total} sections
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {completed} of {total} complete
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <CircularProgress pct={pct} />
                  <span className="text-xs font-medium text-slate-500">Progress</span>
                </div>
              </div>

              {/* Linear progress bar below */}
              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: "linear-gradient(90deg, #6366f1, #9333ea)" }}
                  />
                </div>
                <p className="mt-1.5 text-right text-xs text-slate-400">{pct}% complete</p>
              </div>
            </div>

            {/* Section cards */}
            <div className="space-y-3">
              {course.sections.map((s, i) => {
                const SectionIcon = SECTION_ICONS[i % SECTION_ICONS.length];
                const isComplete = progress[s.id]?.completed;
                const quizScore = progress[s.id]?.quizScore;
                const prevDone = i === 0 || progress[course.sections[i - 1].id]?.completed;
                const locked = !prevDone && !isComplete;
                const sectionMins = sectionTimes?.[s.id]
                  ? Math.ceil(sectionTimes[s.id] / 60)
                  : null;

                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md ${
                      locked ? "opacity-60" : ""
                    }`}
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={
                            isComplete
                              ? { background: "linear-gradient(135deg, #10b981, #059669)" }
                              : locked
                                ? { background: "#f1f5f9" }
                                : { background: "linear-gradient(135deg, #6366f1, #9333ea)" }
                          }
                        >
                          {isComplete ? (
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          ) : locked ? (
                            <Lock className="h-5 w-5 text-slate-400" />
                          ) : (
                            <SectionIcon className="h-5 w-5 text-white" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-400">
                              Section {i + 1}
                            </span>
                            {isComplete && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                                Complete
                              </span>
                            )}
                            {quizScore != null && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                                Quiz {Math.round(quizScore * 100)}%
                              </span>
                            )}
                          </div>
                          <h3 className="mt-0.5 font-semibold text-slate-900">{s.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{s.summary}</p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {readTime(s.content)} min read
                            </span>
                            {sectionMins && (
                              <span className="inline-flex items-center gap-1">
                                ⏱ Spent {sectionMins} min
                              </span>
                            )}
                          </div>
                        </div>

                        {/* CTA */}
                        <div className="shrink-0">
                          {locked ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400">
                              <Lock className="h-3.5 w-3.5" /> Locked
                            </span>
                          ) : (
                            <Link
                              to="/course/$courseId/section/$sectionId"
                              params={{ courseId, sectionId: s.id }}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                                isComplete
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                                  : "text-white hover:shadow-sm"
                              }`}
                              style={
                                !isComplete
                                  ? { background: "linear-gradient(135deg, #6366f1, #9333ea)" }
                                  : undefined
                              }
                            >
                              {isComplete ? (
                                <><CheckCircle2 className="h-3.5 w-3.5" /> Review</>
                              ) : (
                                <><Play className="h-3.5 w-3.5" /> Start</>
                              )}
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Quiz score bar */}
                      {quizScore != null && (
                        <div className="mt-4 ml-15">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.round(quizScore * 100)}%`,
                                  background: quizScore >= 0.7 ? "#10b981" : "#f59e0b",
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              Quiz score
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {allDone && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => navigate({ to: "/course/$courseId/complete", params: { courseId } })}
                  className="rounded-2xl px-8 py-4 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  🎉 See your final score →
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
      <ChatSidebar courseId={courseId} />
    </div>
  );
}
