import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { askTutor } from "@/server/ai";
import { useCourse } from "@/lib/course-context";
import { Send, MessageCircle, X, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
        style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
        aria-label="Open Ask Syncly"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-[92%] max-w-[380px] bg-white flex flex-col"
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

function ChatPanel({ courseId }: { courseId: string }) {
  const { chat, addChat } = useCourse();
  const ask = useServerFn(askTutor);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    addChat({ role: "user", content: text });
    setBusy(true);
    try {
      const history = chat.map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await ask({ data: { courseId, message: text, history } });
      addChat({ role: "assistant", content: reply });
    } catch (e: any) {
      addChat({ role: "assistant", content: `⚠️ ${e?.message ?? "Something went wrong"}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Ask Syncly</h3>
          <p className="text-xs text-slate-500">Your AI tutor for this course</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chat.length === 0 && (
          <div className="text-sm text-slate-500 rounded-xl bg-slate-50 p-4">
            👋 Hi! Ask me anything about this course — concepts, examples, or hints on a quiz question.
          </div>
        )}
        {chat.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === "user"
                ? "ml-auto text-white"
                : "bg-slate-100 text-slate-800"
            }`}
            style={
              m.role === "user"
                ? { background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }
                : undefined
            }
          >
            {m.role === "assistant" ? (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}
        {busy && (
          <div className="bg-slate-100 text-slate-500 text-sm rounded-2xl px-3.5 py-2.5 max-w-[60%]">
            Thinking…
          </div>
        )}
      </div>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything about this course..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
          />
          <button
            onClick={send}
            disabled={!input.trim() || busy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
