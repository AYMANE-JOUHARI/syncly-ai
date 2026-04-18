import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, CheckCircle2, Lock, Play, Clock } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId")({
  component: CourseHome,
});

function readTime(text: string) {
  const words = text.split(/\s+/).length;
  return Math.max(2, Math.round(words / 220));
}

function CourseHome() {
  const { courseId } = Route.useParams();
  const { course, setCourse, progress } = useCourse();
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

        {/* Progress bar */}
        <div className="px-5 sm:px-8 pt-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Course progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--brand-from), var(--brand-to))" }}
              />
            </div>
          </div>
        </div>

        <main className="px-5 sm:px-8 pb-24 pt-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              {course.course_title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {course.learner_goal && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                  🎯 Goal: {course.learner_goal}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                <Clock className="h-3 w-3" /> {totalTime} min total
              </span>
            </div>

            <div className="mt-8 space-y-3">
              {course.sections.map((s, i) => {
                const isComplete = progress[s.id]?.completed;
                const prevDone = i === 0 || progress[course.sections[i - 1].id]?.completed;
                const locked = !prevDone && !isComplete;
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-100 hover:shadow-md transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900">{s.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{s.summary}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {readTime(s.content)} min read
                          </span>
                          {progress[s.id]?.quizScore != null && (
                            <span>Quiz: {Math.round((progress[s.id]!.quizScore ?? 0) * 100)}%</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isComplete ? (
                          <Link
                            to="/course/$courseId/section/$sectionId"
                            params={{ courseId, sectionId: s.id }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Completed
                          </Link>
                        ) : locked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400">
                            <Lock className="h-4 w-4" /> Locked
                          </span>
                        ) : (
                          <Link
                            to="/course/$courseId/section/$sectionId"
                            params={{ courseId, sectionId: s.id }}
                            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                            style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
                          >
                            <Play className="h-3.5 w-3.5" /> Start
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {allDone && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => navigate({ to: "/course/$courseId/complete", params: { courseId } })}
                  className="rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-md"
                  style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
                >
                  See your final score →
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
