import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/course/$courseId/section/$sectionId/")({
  component: Reader,
});

function readTime(text: string) {
  return Math.max(2, Math.ceil(text.split(/\s+/).length / 200));
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

  // Time tracking
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
      <div
        className="flex min-h-screen items-center justify-center px-6 text-center"
        style={{ background: "var(--bg)", color: "var(--ink-3)" }}
      >
        {loadError ? `Error: ${loadError}` : "Loading section…"}
      </div>
    );
  }

  const total = course.sections.length;
  const estRead = readTime(section.content);

  const markComplete = () => setProgress(section.id, { completed: true });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50" style={{ height: 2, background: "transparent" }}>
        <div
          style={{
            height: "100%",
            width: `${readPct}%`,
            background: "#4f46e5",
            transition: "width 0.1s ease-out",
          }}
        />
      </div>

      {/* 3-column grid */}
      <div
        className="grid min-h-screen"
        style={{ gridTemplateColumns: "220px minmax(0,1fr) 380px" }}
      >
        {/* ── Left TOC sidebar ── */}
        <aside
          className="hidden lg:flex flex-col sticky top-0 h-screen overflow-y-auto"
          style={{
            borderRight: "1px solid var(--line)",
            padding: "28px 16px",
            background: "color-mix(in oklab, var(--bg) 70%, white)",
          }}
        >
          {/* Logo */}
          <div className="mb-6">
            <SynclyLogo size="sm" />
          </div>

          <p className="eyebrow-mono mb-4">Contents</p>

          <nav className="flex flex-col gap-0.5">
            {course.sections.map((s, i) => {
              const isCurrent = s.id === sectionId;
              const isDone = !!progress[s.id]?.completed;
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    navigate({
                      to: "/course/$courseId/section/$sectionId",
                      params: { courseId, sectionId: s.id },
                    })
                  }
                  className="flex gap-2.5 items-start text-left w-full rounded-lg transition"
                  style={{
                    padding: "9px 10px",
                    background: isCurrent ? "white" : "transparent",
                    boxShadow: isCurrent
                      ? "0 1px 0 rgba(20,19,26,.04), 0 1px 2px rgba(20,19,26,.04)"
                      : "none",
                    color: isCurrent ? "var(--ink)" : isDone ? "var(--ink-3)" : "var(--ink-2)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono-syncly)",
                      fontSize: 11,
                      paddingTop: 2,
                      flexShrink: 0,
                      color: isCurrent ? "#4f46e5" : isDone ? "#1f7a52" : "var(--ink-4)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.4 }}>{s.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Back link */}
          <button
            onClick={() => navigate({ to: "/course/$courseId", params: { courseId } })}
            className="mt-auto text-left transition"
            style={{ fontSize: 12.5, color: "var(--ink-4)", paddingTop: 24 }}
          >
            ← Back to course
          </button>
        </aside>

        {/* ── Center: article content ── */}
        <main
          ref={articleRef as React.RefObject<HTMLElement>}
          style={{ padding: "60px 56px 160px", maxWidth: 780, margin: "0 auto", width: "100%" }}
        >
          {/* Breadcrumb */}
          <p
            className="eyebrow-mono mb-4"
            style={{ color: "#4f46e5", letterSpacing: "0.08em" }}
          >
            {course.course_title.slice(0, 28).toUpperCase()}
            <span style={{ color: "var(--ink-4)", margin: "0 8px" }}>·</span>
            SECTION {idx + 1}
          </p>

          {/* Section title */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(36px, 5vw, 56px)",
              lineHeight: 1.0,
              letterSpacing: "-0.025em",
              color: "var(--ink)",
              margin: "0 0 20px",
              textWrap: "pretty" as any,
            }}
          >
            {section.title}
          </h1>

          {/* Meta bar */}
          <div
            className="flex items-center gap-5 flex-wrap pb-6"
            style={{
              borderTop: "1px solid var(--line)",
              paddingTop: 18,
              fontSize: 13.5,
              color: "var(--ink-3)",
            }}
          >
            <span className="inline-flex items-center gap-2">
              <span className="eyebrow-mono" style={{ color: "var(--ink-4)" }}>Section</span>
              <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{idx + 1} / {total}</strong>
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{estRead} min read</strong>
            </span>
            {isComplete && (
              <span
                className="inline-flex items-center gap-1.5"
                style={{ color: "#1f7a52" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </span>
            )}
          </div>

          {/* Summary */}
          {section.summary && (
            <div
              className="mb-8"
              style={{
                borderLeft: "2px solid #4f46e5",
                paddingLeft: 18,
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: 18,
                lineHeight: 1.5,
                color: "var(--ink-3)",
              }}
            >
              {section.summary}
            </div>
          )}

          {/* Article prose with markdown rendering */}
          <article className="prose-drop-cap prose-content">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(22px,3vw,28px)", letterSpacing: "-0.015em", color: "var(--ink)", margin: "36px 0 12px", lineHeight: 1.15 }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(18px,2.5vw,22px)", letterSpacing: "-0.01em", color: "var(--ink)", margin: "28px 0 10px", lineHeight: 1.2 }}>{children}</h3>
                ),
                p: ({ children }) => (
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 19, lineHeight: 1.65, letterSpacing: "-0.003em", color: "var(--ink)", margin: "0 0 20px", textWrap: "pretty" as any }}>{children}</p>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: "0 0 20px", paddingLeft: 0, listStyle: "none" }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ margin: "0 0 20px", paddingLeft: 0, listStyle: "none", counterReset: "item" }}>{children}</ol>
                ),
                li: ({ children }) => (
                  <li style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10, fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 18, lineHeight: 1.6, color: "var(--ink)" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#eceafd", color: "#4f46e5", fontFamily: "var(--font-mono-syncly)", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 3 }}>·</span>
                    <span>{children}</span>
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote style={{ borderLeft: "3px solid #4f46e5", paddingLeft: 20, margin: "24px 0", fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 300, fontSize: 20, lineHeight: 1.55, color: "var(--ink-2)" }}>{children}</blockquote>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 600, color: "var(--ink)" }}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em style={{ fontStyle: "italic", color: "var(--ink-2)" }}>{children}</em>
                ),
              }}
            >
              {section.content}
            </ReactMarkdown>
          </article>

          {/* Bottom actions */}
          <div
            className="mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-8"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <button
              onClick={markComplete}
              disabled={isComplete}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition"
              style={
                isComplete
                  ? { background: "#e6f3ec", color: "#1f7a52" }
                  : {
                      background: "var(--ink)",
                      color: "var(--bg)",
                      boxShadow: "0 1px 0 rgba(20,19,26,.04), 0 8px 24px -8px rgba(20,19,26,.15)",
                    }
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition"
                style={{
                  background: "white",
                  color: "#4f46e5",
                  border: "1px solid var(--line)",
                  boxShadow: "0 1px 0 rgba(20,19,26,.04)",
                }}
              >
                Take quiz <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile: back link */}
          <div className="lg:hidden mt-6">
            <button
              onClick={() => navigate({ to: "/course/$courseId", params: { courseId } })}
              style={{ fontSize: 13, color: "var(--ink-4)" }}
            >
              ← Back to course
            </button>
          </div>
        </main>

        {/* ── Right: AI sidebar ── */}
        <ChatSidebar courseId={courseId} />
      </div>
    </div>
  );
}
