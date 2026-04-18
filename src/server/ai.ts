import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY not configured");
  return k;
}

const clip = (s: string, n: number) => s.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, n);

export const generateCourse = createServerFn({ method: "POST" })
  .inputValidator((d: { role: string; experienceLevel: string; goal: string; pdfText?: string }) => {
    if (!d || typeof d.role !== "string" || typeof d.experienceLevel !== "string" || typeof d.goal !== "string") {
      throw new Error("Invalid input");
    }
    return {
      role: clip(d.role, 500),
      experienceLevel: clip(d.experienceLevel, 100),
      goal: clip(d.goal, 300),
      pdfText: typeof d.pdfText === "string" ? d.pdfText.slice(0, 30000) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const systemPrompt = `You are an expert onboarding course designer. Build a focused, practical learning course tailored to the role.
- Produce 4 to 6 sections in a logical learning order.
- Each section has rich, paragraph-form content (300-500 words), suitable for prose reading. Use plain text paragraphs separated by blank lines. Do not use markdown headers inside content.
- Each section has a 1-2 sentence summary and 3-5 multiple choice quiz questions.
- Each question has exactly four options labeled A, B, C, D and a single correct answer letter.
- Tailor depth to the experience level and the stated learner goal.
- If a source document is provided, ground content in it; otherwise rely on best practices.`;

    const userPrompt = `Role: ${data.role}
Experience level: ${data.experienceLevel}
Learning goal: ${data.goal}
${data.pdfText ? `\nSource document excerpt:\n"""\n${data.pdfText.slice(0, 30000)}\n"""` : ""}`;

    const tool = {
      type: "function",
      function: {
        name: "build_course",
        description: "Return a structured onboarding course",
        parameters: {
          type: "object",
          properties: {
            course_title: { type: "string" },
            learner_goal: { type: "string" },
            sections: {
              type: "array",
              minItems: 4,
              maxItems: 6,
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  summary: { type: "string" },
                  quiz: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                        answer: { type: "string", enum: ["A", "B", "C", "D"] },
                      },
                      required: ["question", "options", "answer"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "content", "summary", "quiz"],
                additionalProperties: false,
              },
            },
          },
          required: ["course_title", "learner_goal", "sections"],
          additionalProperties: false,
        },
      },
    };

    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "build_course" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) throw new Error("Rate limited. Please try again in a moment.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error("Failed to generate course");
    }
    const json = await resp.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Malformed AI response");
    const parsed = JSON.parse(args);

    // Persist
    const { data: course, error: cErr } = await supabaseAdmin
      .from("courses")
      .insert({
        role: data.role,
        experience_level: data.experienceLevel,
        goal: data.goal,
        pdf_text: data.pdfText ?? null,
        course_title: parsed.course_title,
        learner_goal: parsed.learner_goal,
      })
      .select()
      .single();
    if (cErr || !course) throw new Error(cErr?.message ?? "Failed to save course");

    for (let i = 0; i < parsed.sections.length; i++) {
      const s = parsed.sections[i];
      const { data: sec, error: sErr } = await supabaseAdmin
        .from("sections")
        .insert({
          course_id: course.id,
          title: s.title,
          content: s.content,
          summary: s.summary,
          order_index: i,
        })
        .select()
        .single();
      if (sErr || !sec) throw new Error(sErr?.message ?? "Failed to save section");
      const rows = s.quiz.map((q: any, qi: number) => ({
        section_id: sec.id,
        question: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        option_d: q.options[3],
        correct_answer: q.answer,
        order_index: qi,
      }));
      if (rows.length) {
        const { error: qErr } = await supabaseAdmin.from("quiz_questions").insert(rows);
        if (qErr) throw new Error(qErr.message);
      }
    }

    return { courseId: course.id as string };
  });

export const fetchCourse = createServerFn({ method: "GET" })
  .inputValidator((d: { courseId: string }) => d)
  .handler(async ({ data }) => {
    const { data: course, error } = await supabaseAdmin
      .from("courses")
      .select("*")
      .eq("id", data.courseId)
      .single();
    if (error || !course) throw new Error("Course not found");
    const { data: sections } = await supabaseAdmin
      .from("sections")
      .select("*")
      .eq("course_id", data.courseId)
      .order("order_index");
    const sectionIds = (sections ?? []).map((s) => s.id);
    const { data: questions } = sectionIds.length
      ? await supabaseAdmin
          .from("quiz_questions")
          .select("*")
          .in("section_id", sectionIds)
          .order("order_index")
      : { data: [] as any[] };
    return {
      id: course.id,
      course_title: course.course_title ?? "Course",
      learner_goal: course.learner_goal ?? course.goal ?? "",
      // pdf_text intentionally omitted to avoid leaking uploaded document content to clients
      sections: (sections ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        content: s.content,
        summary: s.summary ?? "",
        order_index: s.order_index,
        questions: (questions ?? [])
          .filter((q) => q.section_id === s.id)
          .map((q) => ({
            id: q.id,
            question: q.question,
            correct_answer: q.correct_answer ?? "A",
            options: [
              { key: "A", text: q.option_a ?? "" },
              { key: "B", text: q.option_b ?? "" },
              { key: "C", text: q.option_c ?? "" },
              { key: "D", text: q.option_d ?? "" },
            ],
          })),
      })),
    };
  });

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((d: { courseId: string; message: string; history: { role: string; content: string }[] }) => {
    if (!d || typeof d.courseId !== "string" || typeof d.message !== "string") throw new Error("Invalid input");
    if (!/^[0-9a-f-]{36}$/i.test(d.courseId)) throw new Error("Invalid courseId");
    const history = Array.isArray(d.history) ? d.history.slice(-10).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: clip(String(m?.content ?? ""), 2000),
    })) : [];
    return { courseId: d.courseId, message: clip(d.message, 2000), history };
  })
  .handler(async ({ data }) => {
    // Load course context
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("course_title, learner_goal")
      .eq("id", data.courseId)
      .single();
    const { data: sections } = await supabaseAdmin
      .from("sections")
      .select("title, summary")
      .eq("course_id", data.courseId)
      .order("order_index");

    const context = `Course: ${course?.course_title}\nGoal: ${course?.learner_goal}\nSections:\n${(sections ?? [])
      .map((s, i) => `${i + 1}. ${s.title} — ${s.summary}`)
      .join("\n")}`;

    const system = `You are Syncly, a friendly onboarding tutor. Answer questions about the course in a clear, concise way. If asked about quiz answers, give a hint but do not reveal the exact answer. Course context:\n${context}`;

    // Persist user message
    await supabaseAdmin
      .from("chat_messages")
      .insert({ course_id: data.courseId, role: "user", content: data.message });

    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          ...data.history.slice(-10),
          { role: "user", content: data.message },
        ],
      }),
    });
    if (!resp.ok) {
      if (resp.status === 429) throw new Error("Rate limited. Please try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("Tutor unavailable");
    }
    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content ?? "Sorry, I had trouble answering that.";

    await supabaseAdmin
      .from("chat_messages")
      .insert({ course_id: data.courseId, role: "assistant", content: text });

    return { reply: text as string };
  });

export const recordQuizAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: { questionId: string; selected: string }) => {
    if (!d || typeof d.questionId !== "string" || typeof d.selected !== "string") throw new Error("Invalid input");
    if (!/^[0-9a-f-]{36}$/i.test(d.questionId)) throw new Error("Invalid questionId");
    return { questionId: d.questionId, selected: clip(d.selected, 4) };
  })
  .handler(async ({ data }) => {
    // Server-side correctness verification — never trust the client
    const { data: q } = await supabaseAdmin
      .from("quiz_questions")
      .select("section_id, correct_answer")
      .eq("id", data.questionId)
      .single();
    if (!q) throw new Error("Question not found");
    const isCorrect = data.selected === q.correct_answer;
    await supabaseAdmin.from("quiz_attempts").insert({
      section_id: q.section_id,
      selected_answer: data.selected,
      is_correct: isCorrect,
    });
    return { ok: true, correct: isCorrect };
  });
