import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, Send, Mic, MicOff } from "lucide-react";
import { SynclyLogo } from "@/components/SynclyLogo";
import { useCourse } from "@/lib/course-context";
import { fetchCourse, roleplayChat } from "@/server/ai";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/course/$courseId/roleplay")({
  component: Roleplay,
});

type Msg = { role: "user" | "assistant"; content: string };

const COACHING_TIPS = [
  "Listen actively and acknowledge what you hear before responding.",
  "Ask open-ended questions to understand the other person's perspective.",
  "Use concrete examples from your training to back up your points.",
  "Stay calm and confident — it's a practice, not an exam.",
  "If you're unsure, it's fine to say 'Let me think about that for a moment.'",
];

function useTypewriter(text: string, active: boolean) {
  const [displayed, setDisplayed] = React.useState("");
  React.useEffect(() => {
    if (!active || !text) { setDisplayed(text); return; }
    setDisplayed("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, 12);
    return () => clearInterval(iv);
  }, [text, active]);
  return displayed;
}

function AssistantBubble({ content, animate }: { content: string; animate: boolean }) {
  const displayed = useTypewriter(content, animate);
  return (
    <div className="flex items-end gap-3 max-w-[80%]">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
        style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
      >
        AI
      </div>
      <div
        className="rounded-2xl rounded-bl-sm px-5 py-3.5 text-sm leading-relaxed"
        style={{ background: "white", border: "1px solid var(--line)", color: "var(--ink)", fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 16 }}
      >
        {displayed}
        {animate && displayed.length < content.length && (
          <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

function Roleplay() {
  const { courseId } = Route.useParams();
  const { course, setCourse } = useCourse();
  const fetchC = useServerFn(fetchCourse);
  const chat = useServerFn(roleplayChat);
  const navigate = useNavigate();

  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sessionEnded, setSessionEnded] = React.useState(false);
  const [lastMsgIdx, setLastMsgIdx] = React.useState(-1);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (!course || course.id !== courseId) {
      fetchC({ data: { courseId } }).then(setCourse).catch(() => {});
    }
  }, [course, courseId, fetchC, setCourse]);

  // Auto-start the roleplay with the first AI message
  React.useEffect(() => {
    if (startedRef.current || !course || course.id !== courseId) return;
    startedRef.current = true;
    setBusy(true);
    chat({ data: { courseId, message: "start", history: [] } })
      .then(({ reply }) => {
        setMessages([{ role: "assistant", content: reply }]);
        setLastMsgIdx(0);
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: "Welcome! I'm ready to begin your roleplay practice. Let's get started." }]);
        setLastMsgIdx(0);
      })
      .finally(() => setBusy(false));
  }, [course, courseId, chat]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (overrideMsg?: string) => {
    const text = (overrideMsg ?? input).trim();
    if (!text || busy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const isEndRequest = /^(end|stop|finish|feedback|done)/i.test(text) && messages.length >= 4;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const finalMessage = isEndRequest
        ? "The learner is asking to end the session. Step out of character and give a brief, specific coaching summary: what they did well, and one concrete thing to improve. Keep it to 3-4 sentences."
        : text;
      const { reply } = await chat({ data: { courseId, message: finalMessage, history } });
      setMessages((prev) => {
        const next = [...prev, { role: "assistant" as const, content: reply }];
        setLastMsgIdx(next.length - 1);
        return next;
      });
      if (isEndRequest) setSessionEnded(true);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I had a connection issue. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const exchangeCount = Math.floor(messages.length / 2);

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)", color: "var(--ink-3)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex h-[60px] items-center justify-between px-6 sm:px-8"
        style={{ borderBottom: "1px solid var(--line)", background: "white" }}
      >
        <div className="flex items-center gap-4">
          <SynclyLogo size="sm" />
          <span style={{ color: "var(--line)", fontSize: 18 }}>·</span>
          <span style={{ fontFamily: "var(--font-mono-syncly)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)" }}>
            AI Roleplay Practice
          </span>
        </div>
        <Link
          to="/course/$courseId"
          params={{ courseId }}
          className="inline-flex items-center gap-1.5 text-sm transition"
          style={{ color: "var(--ink-3)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to course
        </Link>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 60px)" }}>

        {/* ── Left: Chat ── */}
        <div className="flex flex-1 flex-col" style={{ borderRight: "1px solid var(--line)" }}>
          {/* Scenario title */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--line)", background: "white" }}>
            <p className="eyebrow-mono mb-0.5">Practicing</p>
            <h2
              style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 18, letterSpacing: "-0.01em", color: "var(--ink)", margin: 0 }}
            >
              {course.course_title}
            </h2>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {messages.map((m, i) =>
              m.role === "assistant" ? (
                <AssistantBubble key={i} content={m.content} animate={i === lastMsgIdx} />
              ) : (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[75%] rounded-2xl rounded-br-sm px-5 py-3.5 text-sm leading-relaxed text-white"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)", fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 16 }}
                  >
                    {m.content}
                  </div>
                </div>
              )
            )}

            {busy && (
              <div className="flex items-end gap-3 max-w-[80%]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}>
                  AI
                </div>
                <div className="rounded-2xl rounded-bl-sm px-5 py-4 flex gap-1.5 items-center" style={{ background: "white", border: "1px solid var(--line)" }}>
                  {[0, 150, 300].map((d, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          {!sessionEnded ? (
            <div className="p-4" style={{ borderTop: "1px solid var(--line)", background: "white" }}>
              <div
                className="flex items-end gap-2 rounded-2xl p-2 transition"
                style={{ border: "1px solid var(--line)", background: "var(--bg)" }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  placeholder={exchangeCount >= 3 ? "Respond, or type \"end\" for feedback…" : "Type your response…"}
                  rows={1}
                  disabled={busy}
                  className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[color:var(--ink-4)] max-h-28"
                  style={{ color: "var(--ink)" }}
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || busy}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40 transition"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-xs" style={{ color: "var(--ink-4)" }}>
                Enter to send · Shift+Enter for new line{exchangeCount >= 3 ? ' · Type "end" for AI coaching feedback' : ""}
              </p>
            </div>
          ) : (
            <div className="p-6 text-center" style={{ borderTop: "1px solid var(--line)", background: "white" }}>
              <p className="text-sm mb-4" style={{ color: "var(--ink-3)" }}>Session complete. Great work!</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setMessages([]);
                    setSessionEnded(false);
                    startedRef.current = false;
                    setBusy(true);
                    chat({ data: { courseId, message: "start", history: [] } })
                      .then(({ reply }) => { setMessages([{ role: "assistant", content: reply }]); setLastMsgIdx(0); })
                      .finally(() => setBusy(false));
                  }}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold transition"
                  style={{ background: "white", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                >
                  Practice again
                </button>
                <Link
                  to="/course/$courseId"
                  params={{ courseId }}
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition"
                  style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                >
                  Back to course
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Coaching panel ── */}
        <aside
          className="hidden lg:flex flex-col w-[340px] shrink-0 overflow-y-auto"
          style={{ background: "color-mix(in oklab, var(--bg) 60%, white)", padding: "28px 20px" }}
        >
          <p className="eyebrow-mono mb-4">Session Info</p>

          {/* Progress */}
          <div
            className="rounded-xl p-4 mb-5"
            style={{ background: "white", border: "1px solid var(--line)" }}
          >
            <div className="flex justify-between items-baseline mb-2">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 28, color: "var(--ink)" }}>{exchangeCount}</span>
              <span className="eyebrow-mono">Exchanges</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-deep)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (exchangeCount / 6) * 100)}%`, background: "linear-gradient(90deg, #6366f1, #9333ea)" }}
              />
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--ink-4)" }}>
              {exchangeCount < 3 ? "Keep going to unlock coaching feedback" : exchangeCount < 6 ? "Good progress — type \"end\" when ready for feedback" : "Excellent session length!"}
            </p>
          </div>

          {/* Coaching tips */}
          <p className="eyebrow-mono mb-3">Coaching Tips</p>
          <ul className="space-y-2">
            {COACHING_TIPS.map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: "white", border: "1px solid var(--line)" }}
              >
                <span
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: "#eceafd", color: "#4f46e5", fontFamily: "var(--font-mono-syncly)" }}
                >
                  {i + 1}
                </span>
                <p className="text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>{tip}</p>
              </li>
            ))}
          </ul>

          {/* What's being tested */}
          <p className="eyebrow-mono mt-6 mb-3">Skills Being Tested</p>
          <div
            className="rounded-xl p-4"
            style={{ background: "#eceafd", border: "1px solid #c7c3f7" }}
          >
            <p className="text-sm leading-relaxed" style={{ color: "#2e2890", fontFamily: "var(--font-display)", fontWeight: 300 }}>
              This roleplay tests your ability to apply what you learned in <strong style={{ fontWeight: 600 }}>{course.course_title}</strong> in a realistic scenario — communication, knowledge recall, and adaptability under pressure.
            </p>
          </div>

          {/* End session shortcut */}
          {exchangeCount >= 3 && !sessionEnded && (
            <button
              onClick={() => send("end session and give me feedback")}
              disabled={busy}
              className="mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
              style={{ background: "white", color: "var(--ink-2)", border: "1px solid var(--line)" }}
            >
              End session & get feedback
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
