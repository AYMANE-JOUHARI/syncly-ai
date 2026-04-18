import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import {
  BookOpen, Target, MessageCircle, ArrowRight,
  CheckCircle, Zap, FileText, GraduationCap, Sparkles,
} from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { useLastCourseId } from "@/lib/course-context";

export const Route = createFileRoute("/")({ component: Home });

const FEATURES = [
  {
    icon: BookOpen,
    title: "AI-Structured Content",
    description:
      "Claude AI reads your role description and internal docs to produce a tailored 5-6 section learning path — no manual authoring required.",
  },
  {
    icon: Target,
    title: "Built-in Quizzes",
    description:
      "Each section ends with 4 comprehension questions that test real understanding. Results are scored server-side and tracked throughout the course.",
  },
  {
    icon: MessageCircle,
    title: "Ask Your AI Tutor",
    description:
      "An always-visible AI sidebar answers questions, gives hints on quiz questions, and keeps new hires unblocked — without giving away answers directly.",
  },
];

const SOCIAL_PROOF = [
  "Charter Aviation", "SaaS Sales", "Financial Services",
  "Healthcare Ops", "Logistics & Freight", "Customer Success",
];

/* ── Hero rings (large decorative mark) ── */
function HeroMark() {
  const r = 36;
  const sw = 2.5;
  const gap = Math.round(r * 1.35);
  const cx1 = r + sw;
  const cx2 = cx1 + gap;
  const cy  = r + sw;
  const w   = cx2 + r + sw;
  const h   = cy + r + sw;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="mx-auto mb-6 opacity-90">
      <circle cx={cx1} cy={cy} r={r} stroke="white" strokeWidth={sw} />
      <circle cx={cx2} cy={cy} r={r} stroke="#818cf8" strokeWidth={sw} />
    </svg>
  );
}

function Home() {
  const lastCourseId = useLastCourseId();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-slate-950 pb-28 pt-0">
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(99,102,241,0.28) 0%, transparent 70%)",
          }}
        />

        {/* Header */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <SynclyLogo size="md" dark />
          <nav className="flex items-center gap-4">
            {lastCourseId && (
              <Link
                to="/course/$courseId"
                params={{ courseId: lastCourseId }}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 hover:bg-white/15 transition"
              >
                Resume last course <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            <Link
              to="/manager"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
            >
              Get started free
            </Link>
          </nav>
        </header>

        {/* Hero body */}
        <div className="relative z-10 mx-auto max-w-3xl px-6 pt-14 text-center sm:px-10">
          {/* Decorative two-circle mark */}
          <HeroMark />

          {/* Eyebrow */}
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-1.5 text-xs text-indigo-300 ring-1 ring-white/10"
            style={{ fontFamily: "var(--font-mono-syncly)" }}
          >
            <Sparkles className="h-3 w-3" />
            AI ONBOARDING PLATFORM
          </div>

          {/* Wordmark */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(56px, 10vw, 120px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              color: "white",
              margin: "0 0 20px",
            }}
          >
            Syncly
          </h1>

          {/* Italic tagline */}
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(20px, 3.5vw, 32px)",
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,0.85)",
              margin: "0 0 16px",
            }}
          >
            Onboarding,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #a5b4fc, #c084fc)" }}
            >
              in sync
            </span>{" "}
            with your company.
          </p>

          <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed sm:text-lg" style={{ color: "rgba(148,163,184,0.9)" }}>
            Turn what your team already knows into a guided curriculum new hires actually finish — grounded in your docs, with practice and answers when they need them.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/manager"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-indigo-500/30"
              style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
            >
              Build a course free <ArrowRight className="h-4 w-4" />
            </Link>
            {lastCourseId && (
              <Link
                to="/course/$courseId"
                params={{ courseId: lastCourseId }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-base font-medium text-white transition hover:bg-white/10"
              >
                Resume my last course
              </Link>
            )}
          </div>

          {/* Social proof chips */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {SOCIAL_PROOF.map((item) => (
              <span
                key={item}
                className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-white/10"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20" style={{ background: "var(--bg)" }}>
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mb-12 text-center">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: "clamp(24px, 4vw, 40px)",
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Everything a new hire needs,{" "}
              <em>generated instantly</em>
            </h2>
            <p className="mt-3 text-base" style={{ color: "var(--ink-3)" }}>
              No course authoring. No manual quiz creation. Just upload what your team knows.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl bg-white p-7 transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ border: "1px solid var(--line)" }}
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--ink)" }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-3)" }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="mt-10 rounded-2xl bg-white p-8" style={{ border: "1px solid var(--line)" }}>
            <h3 className="eyebrow-mono mb-6 text-center">How it works</h3>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { icon: FileText,     step: "1", label: "Describe the role",             desc: "Tell Claude what this person will do day-to-day and their starting experience level." },
                { icon: Zap,          step: "2", label: "AI builds the course",           desc: "Claude structures a 5-6 section learning path, writes content, and generates 4 quiz questions per section." },
                { icon: CheckCircle,  step: "3", label: "New hire learns & gets certified", desc: "They read, take quizzes, ask the AI tutor anything, and earn a completion certificate." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{item.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--ink-3)" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PERSONA PICKER ── */}
      <section className="py-16" style={{ background: "var(--bg)", borderTop: "1px solid var(--line)" }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-10">
          <div className="mb-10 text-center">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontStyle: "italic",
                fontSize: "clamp(22px, 4vw, 36px)",
                letterSpacing: "-0.015em",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Who are you?
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-3)" }}>
              Syncly serves both sides of onboarding.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Manager card */}
            <Link
              to="/manager"
              className="group flex flex-col justify-between rounded-2xl bg-white p-7 transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ border: "1px solid var(--line)", textDecoration: "none" }}
            >
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  <span className="eyebrow-mono">01</span>
                </div>
                <h3
                  className="mb-2"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", color: "var(--ink)" }}
                >
                  I'm a Manager
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-3)" }}>
                  Upload your docs. Syncly builds a five-day onboarding curriculum grounded in exactly what your team actually knows.
                </p>
              </div>
              <div
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-all group-hover:gap-3"
                style={{ color: "#4f46e5" }}
              >
                Build a curriculum <ArrowRight className="h-4 w-4" />
              </div>
            </Link>

            {/* New Hire card */}
            {lastCourseId ? (
              <Link
                to="/course/$courseId"
                params={{ courseId: lastCourseId }}
                className="group flex flex-col justify-between rounded-2xl bg-white p-7 transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ border: "1px solid var(--line)", textDecoration: "none" }}
              >
                <NewHireContent />
                <div
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-all group-hover:gap-3"
                  style={{ color: "#4f46e5" }}
                >
                  Resume my course <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ) : (
              <div
                className="flex flex-col justify-between rounded-2xl bg-white p-7"
                style={{ border: "1px solid var(--line)" }}
              >
                <NewHireContent />
                <p className="mt-6 text-sm" style={{ color: "var(--ink-4)" }}>
                  Ask your manager to share a course link to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8" style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <SynclyLogo size="sm" />
            <p className="text-xs" style={{ color: "var(--ink-4)" }}>
              © {new Date().getFullYear()} Syncly.ai — AI-powered employee onboarding
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NewHireContent() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
        >
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <span className="eyebrow-mono">02</span>
      </div>
      <h3
        className="mb-2"
        style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", color: "var(--ink)" }}
      >
        I'm a New Hire
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--ink-3)" }}>
        Five days, five quizzes, and an AI assistant that knows your company. Let's get you synced.
      </p>
    </div>
  );
}
