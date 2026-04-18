
# Syncly.ai — AI-Powered Onboarding Platform

A 6-screen flow where managers generate AI-built onboarding courses from a role description + PDF, and new hires read, quiz, and chat their way through.

## Stack & Setup
- **TanStack Start** (React 19, file-based routing) — required by this environment
- **Lovable Cloud** for database + server functions + AI Gateway (no separate Anthropic key needed; routed through Lovable AI). Server functions = TanStack `createServerFn` (equivalent to edge functions here)
- **Tailwind v4** with indigo→purple gradient design system, Inter font, slate-50 base, rounded-xl/2xl, soft shadows
- Stateless session — no auth, no user accounts

> Note: GitHub connection and Vercel deploy are user actions in Lovable (one-click Publish + GitHub connector). I'll flag these at the end rather than build them.

## Database Tables (Lovable Cloud)
- `courses` — id, role, experience_level, goal, pdf_text, course_title, learner_goal, created_at
- `sections` — id, course_id, title, content, summary, order_index
- `quiz_questions` — id, section_id, question, option_a–d, correct_answer
- `quiz_attempts` — id, section_id, selected_answer, is_correct, created_at
- `chat_messages` — id, course_id, role, content, created_at
- RLS: public read/insert (no auth) — acceptable for demo

## Server Functions
1. **`generateCourse`** — takes role/level/goal/pdfText, calls Lovable AI (Gemini/Claude-class model) with structured-output prompt, persists course + sections + questions, returns course id
2. **`chat`** — takes message + course_id, fetches course context, streams tutor response, persists messages
3. **PDF text extraction** done client-side with `pdfjs-dist` before submit (keeps server function fast)

## Screens (TanStack routes)
1. **`/`** — Intake form: logo, tagline, role textarea, experience dropdown, goal input, PDF drag-drop, gradient CTA
2. **`/generating`** — Animated checklist of 4 steps, gradient pulse, polls course readiness, auto-routes to `/course/:id`
3. **`/course/$courseId`** — Course home: title, goal pill, total time, vertical section cards (locked/start/complete states), top progress bar, **right-side Ask Syncly chat sidebar**
4. **`/course/$courseId/section/$sectionId`** — Reader view: prose, indigo key-concept highlights, Mark Complete, prev/next, chat sidebar
5. **`/course/$courseId/section/$sectionId/quiz`** — One-question-at-a-time quiz, selectable answer cards, results with green/red highlighting, score + AI feedback line, chat sidebar
6. **`/course/$courseId/complete`** — Final score, confetti if >70%, AI feedback paragraph, per-section breakdown, Retake / Download Certificate buttons (cert is stub)

## State
React Context (`CourseContext`) holding current course, section progress, quiz answers/scores, and chat history — persists in `sessionStorage` so refresh doesn't wipe progress mid-course.

## Design System
- Gradient: `from-indigo-600 to-purple-600` on CTAs, progress bars, accents
- Cards: white, `rounded-2xl`, `shadow-sm hover:shadow-md`
- Backgrounds: `bg-slate-50`
- Inter font loaded globally
- Smooth fade/slide transitions between screens via Tailwind + small framer-motion (or CSS transitions to keep deps light)
- Fully responsive: chat sidebar collapses to a floating button + sheet on mobile

## What I'll deliver
- All 6 screens wired end-to-end
- Working AI course generation + streaming tutor chat via Lovable AI
- Quiz scoring + final score persistence
- Confetti on celebration screen
- Mobile-responsive

After build, you can click **Publish** for a live URL and connect GitHub via the Connectors panel (I'll remind you).
