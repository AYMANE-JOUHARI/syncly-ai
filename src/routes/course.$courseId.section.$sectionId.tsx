import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/section/$sectionId")({
  component: Reader,
});

function Reader() {
  const { courseId, sectionId } = Route.useParams();
  const { course, setCourse, progress, setProgress } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const navigate = useNavigate();

  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } })
        .then((c) => { setCourse(c); setLoadError(null); })
        .catch((e) => setLoadError(e?.message ?? "Failed to load section"));
    }
  }, [course, courseId, fetchC, setCourse]);

  const idx = course?.sections.findIndex((s) => s.id === sectionId) ?? -1;
  const section = idx >= 0 ? course!.sections[idx] : null;
  const isComplete = section ? !!progress[section.id]?.completed : false;

  if (!course || !section) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading section…
      </div>
    );
  }

  const total = course.sections.length;
  const next = idx + 1 < total ? course.sections[idx + 1] : null;

  const markComplete = () => {
    setProgress(section.id, { completed: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="flex-1 min-w-0">
        <header className="border-b border-slate-200 bg-white px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link
            to="/course/$courseId"
            params={{ courseId }}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to course
          </Link>
          <span className="text-xs text-slate-500">
            Section {idx + 1} of {total}
          </span>
          <SynclyLogo size="sm" />
        </header>

        <main className="mx-auto max-w-2xl px-5 sm:px-8 pt-10 pb-24">
          <div className="mb-8">
            <div className="mb-3 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
              Section {idx + 1}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              {section.title}
            </h1>
          </div>

          <article className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-700 prose-strong:text-indigo-700">
            {section.content.split(/\n\n+/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>

          <div className="mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 pt-8">
            <button
              onClick={markComplete}
              disabled={isComplete}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold ${
                isComplete
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "text-white shadow-md"
              }`}
              style={
                !isComplete
                  ? { background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }
                  : undefined
              }
            >
              {isComplete ? (
                <><CheckCircle2 className="h-4 w-4" /> Completed</>
              ) : (
                "Mark as Complete"
              )}
            </button>

            {isComplete && (
              <button
                onClick={() =>
                  navigate({
                    to: "/course/$courseId/section/$sectionId/quiz",
                    params: { courseId, sectionId: section.id },
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
              >
                Take quiz <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {isComplete && next && (
            <div className="mt-6 text-right text-sm">
              <Link
                to="/course/$courseId/section/$sectionId"
                params={{ courseId, sectionId: next.id }}
                className="text-indigo-600 hover:underline"
              >
                Skip to next section →
              </Link>
            </div>
          )}
        </main>
      </div>
      <ChatSidebar courseId={courseId} />
    </div>
  );
}
