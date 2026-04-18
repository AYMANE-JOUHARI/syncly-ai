import * as React from "react";

export type Question = {
  id: string;
  question: string;
  options: { key: string; text: string }[];
  correct_answer: string;
};
export type Section = {
  id: string;
  title: string;
  content: string;
  summary: string;
  order_index: number;
  questions: Question[];
};
export type Course = {
  id: string;
  course_title: string;
  learner_goal: string;
  sections: Section[];
};
export type SectionProgress = {
  completed: boolean;
  quizScore?: number; // 0..1
  answers?: Record<string, string>;
};
export type ChatMsg = { role: "user" | "assistant"; content: string };

type State = {
  course: Course | null;
  progress: Record<string, SectionProgress>;
  chat: ChatMsg[];
};
type Ctx = State & {
  setCourse: (c: Course | null) => void;
  setProgress: (sectionId: string, p: SectionProgress) => void;
  addChat: (m: ChatMsg) => void;
  updateLastAssistant: (text: string) => void;
  resetProgress: () => void;
};

const CourseContext = React.createContext<Ctx | null>(null);
const KEY = "syncly:state:v1";

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>({ course: null, progress: {}, chat: [] });
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state, hydrated]);

  const setCourse = React.useCallback((course: Course | null) => {
    setState((s) => {
      // Preserve progress/chat if same course is being re-set
      if (course && s.course?.id === course.id) return { ...s, course };
      return { ...s, course, progress: {}, chat: [] };
    });
  }, []);
  const setProgress = React.useCallback((id: string, p: SectionProgress) => {
    setState((s) => ({ ...s, progress: { ...s.progress, [id]: { ...s.progress[id], ...p } } }));
  }, []);
  const addChat = React.useCallback((m: ChatMsg) => {
    setState((s) => ({ ...s, chat: [...s.chat, m] }));
  }, []);
  const updateLastAssistant = React.useCallback((text: string) => {
    setState((s) => {
      const chat = [...s.chat];
      const last = chat[chat.length - 1];
      if (last?.role === "assistant") chat[chat.length - 1] = { ...last, content: text };
      else chat.push({ role: "assistant", content: text });
      return { ...s, chat };
    });
  }, []);
  const resetProgress = React.useCallback(() => {
    setState((s) => ({ ...s, progress: {}, chat: [] }));
  }, []);

  const value: Ctx = {
    ...state,
    setCourse,
    setProgress,
    addChat,
    updateLastAssistant,
    resetProgress,
  };
  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

export function useCourse() {
  const ctx = React.useContext(CourseContext);
  if (!ctx) throw new Error("useCourse must be used inside CourseProvider");
  return ctx;
}
