import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { Award, Printer, ArrowLeft } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { useCourse, useLearnerName } from "@/lib/course-context";
import { fetchCourse } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";

export const Route = createFileRoute("/course/$courseId/certificate")({
  component: Certificate,
});

function Certificate() {
  const { courseId } = Route.useParams();
  const { course, setCourse, progress } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const [learnerName, setLearnerName] = useLearnerName();
  const [editing, setEditing] = React.useState(false);
  const [inputName, setInputName] = React.useState(learnerName);

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  const breakdown = React.useMemo(() => {
    if (!course) return [];
    return course.sections.map((s) => ({
      score: progress[s.id]?.quizScore ?? 0,
      taken: progress[s.id]?.quizScore != null,
    }));
  }, [course, progress]);

  const taken = breakdown.filter((b) => b.taken);
  const finalPct = taken.length
    ? Math.round((taken.reduce((sum, b) => sum + b.score, 0) / taken.length) * 100)
    : 0;

  const today = format(new Date(), "MMMM d, yyyy");

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading…
      </div>
    );
  }

  const saveName = () => {
    if (inputName.trim()) setLearnerName(inputName.trim());
    setEditing(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 no-print-bg">
      {/* Nav — hidden on print */}
      <header className="no-print border-b border-slate-200 bg-white px-5 sm:px-8 py-4 flex items-center justify-between">
        <Link
          to="/course/$courseId/complete"
          params={{ courseId }}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                placeholder="Your name"
                autoFocus
              />
              <button
                onClick={saveName}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setInputName(learnerName); setEditing(true); }}
              className="text-sm text-indigo-600 hover:underline"
            >
              Edit name
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md"
            style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </header>

      {/* Certificate card */}
      <div className="flex justify-center px-6 py-12 no-print-padding">
        <div
          className="print-certificate w-full max-w-2xl rounded-2xl bg-white shadow-xl print:shadow-none"
          style={{ border: "6px double #e0e7ff" }}
        >
          {/* Top accent bar */}
          <div
            className="h-2 w-full"
            style={{ background: "linear-gradient(90deg, #6366f1, #9333ea)" }}
          />

          <div className="px-10 py-12 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <SynclyLogo size="md" />
            </div>

            {/* Certificate heading */}
            <div
              className="inline-flex items-center gap-2 mb-8"
            >
              <div className="h-px w-12 bg-slate-200" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Certificate of Completion
              </span>
              <div className="h-px w-12 bg-slate-200" />
            </div>

            <p className="text-sm text-slate-500 mb-2">This certifies that</p>

            {/* Learner name */}
            <div
              className="font-extrabold tracking-tight text-slate-900 mb-2"
              style={{ fontSize: "clamp(1.8rem, 5vw, 2.5rem)" }}
            >
              {learnerName}
            </div>

            <p className="text-sm text-slate-500 mb-6">has successfully completed</p>

            {/* Course title */}
            <div
              className="font-bold text-slate-900 mb-6 leading-tight"
              style={{ fontSize: "clamp(1.1rem, 3vw, 1.5rem)" }}
            >
              {course.course_title}
            </div>

            {/* Score badge */}
            <div className="inline-flex items-center gap-3 rounded-2xl bg-indigo-50 px-6 py-3 mb-8 ring-1 ring-indigo-100">
              <Award className="h-5 w-5 text-indigo-600" />
              <div className="text-left">
                <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Final Score</p>
                <p
                  className="font-extrabold text-indigo-700"
                  style={{ fontSize: "1.5rem" }}
                >
                  {finalPct}%
                </p>
              </div>
            </div>

            {/* Date and goal */}
            <div className="flex justify-center gap-8 text-sm text-slate-500 mb-10">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-0.5">Completed</p>
                <p className="font-medium text-slate-700">{today}</p>
              </div>
              {course.learner_goal && (
                <div className="text-left max-w-xs">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-0.5">Goal Achieved</p>
                  <p className="font-medium text-slate-700">{course.learner_goal}</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 mb-6" />

            {/* Signature line */}
            <div className="flex justify-center">
              <div className="text-center">
                <div
                  className="font-bold text-xl mb-1"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #6366f1, #9333ea)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Syncly.ai
                </div>
                <p className="text-xs text-slate-400">AI-Powered Employee Onboarding</p>
              </div>
            </div>
          </div>

          {/* Bottom accent bar */}
          <div
            className="h-2 w-full rounded-b-xl"
            style={{ background: "linear-gradient(90deg, #9333ea, #6366f1)" }}
          />
        </div>
      </div>

      {/* Print CTA — hidden on print */}
      <div className="no-print flex justify-center pb-12">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-md"
          style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
        >
          <Printer className="h-4 w-4" /> Print or Save as PDF
        </button>
      </div>
    </div>
  );
}
