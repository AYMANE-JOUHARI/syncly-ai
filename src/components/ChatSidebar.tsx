import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { askTutor } from "@/server/ai";
import { useCourse } from "@/lib/course-context";
import { Send, MessageCircle, X, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

export function ChatSidebar({ courseId }: { courseId: string }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return (
    <>
      <aside className="hidden lg:flex sticky top-0 h-screen w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white">
        <ChatPanel courseId={courseId} />
      </aside>
      {/* Mobile FAB */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
        aria-label="Open Ask Syncly"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-[92%] max-w-[380px] bg-white flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 rounded-lg p-2 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <ChatPanel courseId={courseId} />
          </div>
        </div>
      )}
    </>
  );
}

function AiAvatar() {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
      style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
    >
      S
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 max-w-[80%]">
      <AiAvatar />
      <div className="bg-white shadow-sm ring-1 ring-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 150, 300].map((delay, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ChatPanel({ courseId }: { courseId: string }) {
  const { chat, addChat } = useCourse();
  const ask = useServerFn(askTutor);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, busy]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    addChat({ role: "user", content: text });
    setBusy(true);
    try {
      const history = chat.map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await ask({ data: { courseId, message: text, history } });
      addChat({ role: "assistant", content: reply });
    } catch (e: any) {
      addChat({ role: "assistant", content: `Sorry, I ran into an issue: ${e?.message ?? "please try again."}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Ask Syncly</h3>
          <p className="text-xs text-slate-400">AI tutor · powered by Claude</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {chat.length === 0 && (
          <div className="flex items-start gap-2">
            <AiAvatar />
            <div className="bg-white shadow-sm ring-1 ring-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
              <p className="text-sm text-slate-700 leading-relaxed">
                Hi! I'm Syncly, your AI tutor. Ask me anything about this course — concepts, context, or hints on a quiz question.
              </p>
            </div>
          </div>
        )}

        {chat.map((m, i) => {
          const ts = m.timestamp ? format(new Date(m.timestamp), "h:mm a") : null;
          return (
            <div key={i}>
              {m.role === "user" ? (
                <div className="flex flex-col items-end gap-1">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-3 text-sm text-white"
                    style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
                  >
                    {m.content}
                  </div>
                  {ts && <span className="text-xs text-slate-400 mr-1">{ts}</span>}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-end gap-2 max-w-[90%]">
                    <AiAvatar />
                    <div className="bg-white shadow-sm ring-1 ring-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:text-slate-700 prose-li:my-0 prose-strong:text-slate-900">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  {ts && <span className="text-xs text-slate-400 ml-9">{ts}</span>}
                </div>
              )}
            </div>
          );
        })}

        {busy && <TypingIndicator />}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything about this course..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400 max-h-28"
          />
          <button
            onClick={send}
            disabled={!input.trim() || busy}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40 transition hover:shadow-sm"
            style={{ background: "linear-gradient(135deg, #6366f1, #9333ea)" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-400">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
