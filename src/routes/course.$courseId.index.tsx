import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, Clock, MessageSquare } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCourse, useLearnerName } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/")({
  component: CourseHome,
});

function readTime(text: string) {
  return Math.max(2, Math.round(text.split(/\s+/).length / 220));
}

function CourseHome() {
  const { courseId } = Route.useParams();
  const { course, setCourse, progress, sectionTimes } = useCourse();
  const [learnerName] = useLearnerName();
  const fetchC = useServerFn(fetchCourse);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  if (!course || course.id !== courseId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--ink-3)]" style={{ background: "var(--bg)" }}>
        Loading course…
      </div>
    );
  }

  const total = course.sections.length;
  const completed = course.sections.filter((s) => progress[s.id]?.completed).length;
  const quizzesTaken = course.sections.filter((s) => progress[s.id]?.quizScore != null).length;
  const allDone = completed === total && total > 0;

  // First incomplete section index
  const currentIdx = course.sections.findIndex((s) => !progress[s.id]?.completed);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const subText = completed === 0
    ? `Let's start with Section 1.`
    : allDone
      ? "You've completed all sections!"
      : `You're on Section ${completed + 1} of ${total}.`;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <div className="flex-1 min-w-0">
        {/* Sticky topbar */}
        <header
          className="sticky top-0 z-40 flex h-[60px] items-center justify-between px-6 sm:px-8"
          style={{
            borderBottom: "1px solid var(--line)",
            background: "color-mix(in oklab, #f7f6f2 85%, white)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <SynclyLogo size="sm" />
            {learnerName && learnerName !== "Learner" && (
              <span style={{ color: "var(--ink-4)", fontSize: 13 }}>· {learnerName}</span>
            )}
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm transition"
            style={{ color: "var(--ink-3)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> New course
          </Link>
        </header>

        <main className="px-6 sm:px-8 pb-24 pt-10">
          <div className="mx-auto max-w-5xl">
            {/* Dashboard hero */}
            <div
              className="grid gap-10 items-end mb-10"
              style={{ gridTemplateColumns: "1.4fr 1fr" }}
            >
              {/* Left: greeting */}
              <div>
                <p className="eyebrow-mono mb-3">
                  DASHBOARD · {course.course_title.toUpperCase().slice(0, 36)}
                </p>
                <h1
                  className="font-display"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 400,
                    fontSize: "clamp(32px, 4.5vw, 52px)",
                    lineHeight: 1.04,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                    margin: "10px 0 0",
                  }}
                >
                  {greeting},{" "}
                  <em
                    style={{
                      fontStyle: "italic",
                      color: "#4f46e5",
                      fontVariationSettings: "'SOFT' 100",
                    }}
                  >
                    {learnerName || "Learner"}
                  </em>
                  .
                </h1>
                <p className="mt-3 text-[15.5px] leading-relaxed max-w-lg" style={{ color: "var(--ink-3)" }}>
                  {subText}
                </p>
              </div>

              {/* Right: progress card */}
              <div
                className="rounded-2xl p-6"
                style={{
                  background: "white",
                  border: "1px solid var(--line)",
                  boxShadow: "0 1px 0 rgba(20,19,26,.04), 0 8px 24px -8px rgba(20,19,26,.10)",
                }}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 300,
                      fontSize: 44,
                      letterSpacing: "-0.02em",
                      color: "var(--ink)",
                      lineHeight: 1,
                    }}
                  >
                    {completed}
                    <span style={{ fontSize: 22, color: "var(--ink-4)" }}> / {total}</span>
                  </div>
                  <span className="eyebrow-mono">PROGRESS</span>
                </div>

                {/* Segment track */}
                <div className="flex gap-1 mt-4">
                  {course.sections.map((s) => (
                    <div
                      key={s.id}
                      className="flex-1 rounded-full"
                      style={{
                        height: 6,
                        background: progress[s.id]?.completed ? "#4f46e5" : "var(--bg-deep)",
                      }}
                    />
                  ))}
                </div>

                <div className="flex justify-between mt-4" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                  <span>{completed} section{completed !== 1 ? "s" : ""} done</span>
                  <span>{quizzesTaken} quiz{quizzesTaken !== 1 ? "zes" : ""}</span>
                </div>
              </div>
            </div>

            {/* Section cards grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
              {course.sections.map((s, i) => {
                const isDone = !!progress[s.id]?.completed;
                const isCurrent = i === currentIdx;
                const isLocked = !isDone && i > 0 && !progress[course.sections[i - 1].id]?.completed;
                const quizScore = progress[s.id]?.quizScore;
                const sectionMins = sectionTimes?.[s.id] ? Math.ceil(sectionTimes[s.id] / 60) : null;

                const cardStyle: React.CSSProperties = {
                  background: "white",
                  border: isLocked
                    ? "1px dashed var(--line)"
                    : isCurrent
                      ? "1px solid var(--ink)"
                      : "1px solid var(--line)",
                  borderRadius: 16,
                  padding: "20px 18px",
                  minHeight: 200,
                  display: "flex",
                  flexDirection: "column",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.6 : 1,
                  transition: "all .2s",
                  boxShadow: isCurrent
                    ? "0 0 0 3px rgba(20,19,26,.06), 0 1px 0 rgba(20,19,26,.04), 0 8px 24px -8px rgba(20,19,26,.10)"
                    : "0 1px 0 rgba(20,19,26,.04)",
                };

                const inner = (
                  <div style={cardStyle} onClick={isLocked ? undefined : () =>
                    navigate({ to: "/course/$courseId/section/$sectionId", params: { courseId, sectionId: s.id } })
                  }>
                    {/* Top row: number + status chip */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span
                          className="block"
                          style={{
                            fontFamily: "var(--font-mono-syncly)",
                            fontSize: 10.5,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "var(--ink-4)",
                            lineHeight: 1,
                          }}
                        >
                          Section
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 300,
                            fontSize: 32,
                            letterSpacing: "-0.03em",
                            lineHeight: 1,
                            color: "var(--ink)",
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>

                      {/* Status chip */}
                      {isDone && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#e6f3ec",
                            color: "#1f7a52",
                            fontFamily: "var(--font-mono-syncly)",
                            fontSize: 10,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          DONE
                        </span>
                      )}
                      {isCurrent && !isDone && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "var(--ink)",
                            color: "var(--bg)",
                            fontFamily: "var(--font-mono-syncly)",
                            fontSize: 10,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          CURRENT
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        margin: "0 0 4px",
                        fontSize: 15,
                        fontWeight: 500,
                        letterSpacing: "-0.005em",
                        lineHeight: 1.25,
                        color: "var(--ink)",
                      }}
                    >
                      {s.title}
                    </h3>

                    {/* Summary */}
                    <p
                      className="line-clamp-2"
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        color: "var(--ink-3)",
                        lineHeight: 1.45,
                      }}
                    >
                      {s.summary}
                    </p>

                    {/* Footer */}
                    <div
                      className="flex items-center justify-between mt-auto pt-3"
                      style={{ fontSize: 11.5, color: "var(--ink-3)" }}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {readTime(s.content)} min
                      </span>
                      <div className="flex items-center gap-2">
                        {sectionMins && <span>⏱ {sectionMins}m spent</span>}
                        {quizScore != null && (
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: quizScore >= 0.7 ? "#e6f3ec" : "#f7ecd4",
                              color: quizScore >= 0.7 ? "#1f7a52" : "#9a5b10",
                              fontFamily: "var(--font-mono-syncly)",
                              fontSize: 10,
                              letterSpacing: "0.04em",
                            }}
                          >
                            {Math.round(quizScore * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );

                return <div key={s.id}>{inner}</div>;
              })}
            </div>

            {allDone && (
              <div className="mt-10 flex flex-col items-center gap-4">
                <button
                  onClick={() => navigate({ to: "/course/$courseId/complete", params: { courseId } })}
                  className="rounded-2xl px-8 py-4 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  🎉 See your final score →
                </button>
                <Link
                  to="/course/$courseId/roleplay"
                  params={{ courseId }}
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition"
                  style={{ background: "white", color: "#4f46e5", border: "1px solid #c7c3f7" }}
                >
                  <MessageSquare className="h-4 w-4" /> Practice with AI Roleplay
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
      <ChatSidebar courseId={courseId} />
    </div>
  );
}
