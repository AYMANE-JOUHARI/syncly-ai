import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/section/$sectionId/")({
  component: Reader,
});

function readTime(text: string) {
  return Math.max(2, Math.ceil(text.split(/\s+/).length / 200));
}

function highlightKeyTerms(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text;
  const escaped = terms
    .filter((t) => t.length > 3)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const splitRegex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  const matchRegex = new RegExp(`^(${escaped.join("|")})$`, "i");
  const parts = text.split(splitRegex);
  return parts.map((part, i) =>
    matchRegex.test(part) ? (
      <mark key={i} className="bg-indigo-50 text-indigo-800 rounded px-0.5 not-italic font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function Reader() {
  const { courseId, sectionId } = Route.useParams();
  const { course, setCourse, progress, setProgress, recordSectionTime } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const navigate = useNavigate();
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [readPct, setReadPct] = React.useState(0);
  const articleRef = React.useRef<HTMLElement>(null);
  const startTimeRef = React.useRef(Date.now());
  const recordRef = React.useRef(recordSectionTime);
  recordRef.current = recordSectionTime;

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } })
        .then((c) => { setCourse(c); setLoadError(null); })
        .catch((e) => setLoadError(e?.message ?? "Failed to load section"));
    }
  }, [course, courseId, fetchC, setCourse]);

  // Scroll progress bar
  React.useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrolled = -rect.top;
      const total = el.offsetHeight - window.innerHeight;
      const pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 100;
      setReadPct(pct);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Time tracking — save elapsed time on unmount
  React.useEffect(() => {
    startTimeRef.current = Date.now();
    return () => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (elapsed > 5) recordRef.current(sectionId, elapsed);
    };
  }, [sectionId]);

  const idx = course?.sections.findIndex((s) => s.id === sectionId) ?? -1;
  const section = idx >= 0 ? course!.sections[idx] : null;
  const isComplete = section ? !!progress[section.id]?.completed : false;

  if (!course || !section) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 px-6 text-center">
        {loadError ? `Error: ${loadError}` : "Loading section…"}
      </div>
    );
  }

  const total = course.sections.length;
  const next = idx + 1 < total ? course.sections[idx + 1] : null;
  const estRead = readTime(section.content);

  const keyTerms = section.title
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .map((w) => w.replace(/[^a-zA-Z]/g, ""));

  const markComplete = () => {
    setProgress(section.id, { completed: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Fixed reading progress bar at top */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-slate-200">
        <div
          className="h-full transition-all duration-100 ease-out"
          style={{
            width: `${readPct}%`,
            background: "linear-gradient(90deg, #6366f1, #9333ea)",
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <header className="border-b border-slate-200 bg-white px-5 sm:px-8 py-4 flex items-center justify-between mt-1">
          <Link
            to="/course/$courseId"
            params={{ courseId }}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to course
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Section {idx + 1} of {total}
            </span>
            <div className="hidden sm:flex items-center gap-1">
              {course.sections.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i < idx
                      ? "w-4 bg-emerald-400"
                      : i === idx
                        ? "w-6 bg-indigo-500"
                        : "w-1.5 bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
          <SynclyLogo size="sm" />
        </header>

        <main className="mx-auto max-w-2xl px-5 sm:px-8 pt-10 pb-24">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                Section {idx + 1}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" /> {estRead} min read
              </span>
              {isComplete && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
              {section.title}
            </h1>
            {section.summary && (
              <p className="mt-3 text-base text-slate-500 italic border-l-2 border-indigo-200 pl-4">
                {section.summary}
              </p>
            )}
          </div>

          <article
            ref={articleRef}
            className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-700 prose-strong:text-indigo-700 prose-p:text-base"
          >
            {section.content.split(/\n\n+/).map((para, i) => (
              <p key={i}>{highlightKeyTerms(para, keyTerms)}</p>
            ))}
          </article>

          <div className="mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 pt-8">
            <button
              onClick={markComplete}
              disabled={isComplete}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition ${
                isComplete
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "text-white shadow-md hover:shadow-lg hover:scale-[1.01]"
              }`}
              style={
                !isComplete
                  ? { background: "linear-gradient(135deg, #6366f1, #9333ea)" }
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 transition"
              >
                Take quiz <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {isComplete && next && (
            <div className="mt-6 text-right">
              <Link
                to="/course/$courseId/section/$sectionId"
                params={{ courseId, sectionId: next.id }}
                className="text-sm text-indigo-600 hover:underline"
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
