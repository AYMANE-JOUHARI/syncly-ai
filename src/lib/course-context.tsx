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
  quizInsight?: string;
};
export type ChatMsg = { role: "user" | "assistant"; content: string; timestamp?: number };

const LAST_COURSE_KEY = "syncly:lastCourseId";
const LEARNER_NAME_KEY = "syncly:learnerName";

type State = {
  course: Course | null;
  progress: Record<string, SectionProgress>;
  chat: ChatMsg[];
  sectionTimes: Record<string, number>; // sectionId -> seconds
};
type Ctx = State & {
  setCourse: (c: Course | null) => void;
  setProgress: (sectionId: string, p: SectionProgress) => void;
  addChat: (m: ChatMsg) => void;
  updateLastAssistant: (text: string) => void;
  resetProgress: () => void;
  recordSectionTime: (sectionId: string, seconds: number) => void;
};

const CourseContext = React.createContext<Ctx | null>(null);
const KEY = "syncly:state:v2";

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>({
    course: null,
    progress: {},
    chat: [],
    sectionTimes: {},
  });
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ sectionTimes: {}, ...parsed });
      }
    } catch {}
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  const value: Ctx = {
    ...state,
    setCourse: (course) => {
      if (course?.id) {
        try {
          localStorage.setItem(LAST_COURSE_KEY, course.id);
        } catch {}
      }
      setState((s) => ({ ...s, course, progress: {}, chat: [], sectionTimes: {} }));
    },
    setProgress: (id, p) =>
      setState((s) => ({
        ...s,
        progress: { ...s.progress, [id]: { ...s.progress[id], ...p } },
      })),
    addChat: (m) =>
      setState((s) => ({ ...s, chat: [...s.chat, { ...m, timestamp: m.timestamp ?? Date.now() }] })),
    updateLastAssistant: (text) =>
      setState((s) => {
        const chat = [...s.chat];
        const last = chat[chat.length - 1];
        if (last?.role === "assistant") chat[chat.length - 1] = { ...last, content: text };
        else chat.push({ role: "assistant", content: text, timestamp: Date.now() });
        return { ...s, chat };
      }),
    resetProgress: () => setState((s) => ({ ...s, progress: {}, chat: [], sectionTimes: {} })),
    recordSectionTime: (sectionId, seconds) =>
      setState((s) => ({
        ...s,
        sectionTimes: {
          ...s.sectionTimes,
          [sectionId]: (s.sectionTimes[sectionId] ?? 0) + seconds,
        },
      })),
  };

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

export function useCourse() {
  const ctx = React.useContext(CourseContext);
  if (!ctx) throw new Error("useCourse must be used inside CourseProvider");
  return ctx;
}

export function useLastCourseId(): string | null {
  const [id, setId] = React.useState<string | null>(null);
  React.useEffect(() => {
    try {
      setId(localStorage.getItem(LAST_COURSE_KEY));
    } catch {}
  }, []);
  return id;
}

export function useLearnerName(): [string, (name: string) => void] {
  const [name, setNameState] = React.useState("Learner");
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LEARNER_NAME_KEY);
      if (stored) setNameState(stored);
    } catch {}
  }, []);
  const setName = (n: string) => {
    setNameState(n);
    try {
      localStorage.setItem(LEARNER_NAME_KEY, n);
    } catch {}
  };
  return [name, setName];
}
