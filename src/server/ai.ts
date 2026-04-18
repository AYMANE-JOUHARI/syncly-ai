import Anthropic from "@anthropic-ai/sdk";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODEL = "claude-sonnet-4-5";

function getClient() {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: k });
}

const clip = (s: string, n: number) => s.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, n);

const SYSTEM_PROMPT = `You are a world-class onboarding course designer used by Fortune 500 companies to onboard new employees quickly and effectively.

Rules:
- Produce exactly 5 or 6 sections in a clear, logical learning progression.
- Each section must have substantial prose content (400-600 words) using rich markdown formatting.
- Use ## for major headings within a section, ### for sub-headings, **bold** for key terms, *italic* for emphasis, - for bullet lists, > for blockquotes of important insights or quotes.
- Content must be practical, actionable, and specific — not generic filler.
- Each section has a 1-2 sentence summary and exactly 4 multiple-choice questions.
- Questions test genuine comprehension and application, not rote recall.
- Each question has four options labeled A, B, C, D with exactly one correct answer.
- Tailor depth and vocabulary precisely to the stated experience level.
- If a source document is provided, ground all content firmly in it.
- course_title should be specific and professional (e.g. "Charter Broker Fundamentals: Private Aviation Essentials").
- learner_goal should be a concrete, measurable outcome statement.`;

type CourseShape = {
  course_title: string;
  learner_goal: string;
  sections: Array<{
    title: string;
    content: string;
    summary: string;
    quiz: Array<{
      question: string;
      options: string[];
      answer: string;
    }>;
  }>;
};

const buildCourseTool: Anthropic.Tool = {
  name: "build_course",
  description: "Return a fully structured onboarding course as JSON",
  input_schema: {
    type: "object",
    properties: {
      course_title: { type: "string", description: "Specific, professional course title" },
      learner_goal: { type: "string", description: "Concrete, measurable outcome statement" },
      sections: {
        type: "array",
        minItems: 5,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: {
              type: "string",
              description: "400-600 words using rich markdown: ## headings, ### sub-headings, **bold** key terms, - bullet lists, > blockquotes for important insights.",
            },
            summary: { type: "string", description: "1-2 sentence section summary" },
            quiz: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 4,
                    maxItems: 4,
                    description: "Four option strings (do not prefix with A/B/C/D)",
                  },
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
};

// ── In-memory job store (no DB table needed) ─────────────────────────
type JobStatus = "pending" | "running" | "complete" | "error";
type Job = { status: JobStatus; courseId?: string; error?: string };
const jobStore = new Map<string, Job>();

type GenInput = { role: string; experienceLevel: string; goal: string; pdfText?: string };

async function runGenerationInBackground(jobId: string, data: GenInput) {
  jobStore.set(jobId, { status: "running" });
  const client = getClient();
  try {
    const userPrompt = `Role: ${data.role}
Experience level: ${data.experienceLevel}
Learning goal: ${data.goal}${data.pdfText ? `\n\nSource document excerpt:\n"""\n${data.pdfText.slice(0, 30000)}\n"""` : ""}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [buildCourseTool],
      tool_choice: { type: "tool", name: "build_course" },
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "max_tokens") throw new Error("Course generation was cut short. Please try again with a shorter role description or smaller PDF.");
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("Malformed AI response");
    const parsed = toolUse.input as CourseShape;
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) throw new Error("AI returned an empty course. Please try again.");

    const { data: course, error: cErr } = await supabaseAdmin.from("courses").insert({
      role: data.role, experience_level: data.experienceLevel, goal: data.goal,
      pdf_text: data.pdfText ?? null, course_title: parsed.course_title, learner_goal: parsed.learner_goal,
    }).select().single();
    if (cErr || !course) throw new Error(cErr?.message ?? "Failed to save course");

    for (let i = 0; i < parsed.sections.length; i++) {
      const s = parsed.sections[i];
      const { data: sec, error: sErr } = await supabaseAdmin.from("sections").insert({
        course_id: course.id, title: s.title, content: s.content, summary: s.summary, order_index: i,
      }).select().single();
      if (sErr || !sec) throw new Error(sErr?.message ?? "Failed to save section");
      const rows = (s.quiz ?? []).map((q, qi) => ({
        section_id: sec.id, question: q.question,
        option_a: q.options[0], option_b: q.options[1], option_c: q.options[2], option_d: q.options[3],
        correct_answer: q.answer, order_index: qi,
      }));
      if (rows.length) {
        const { error: qErr } = await supabaseAdmin.from("quiz_questions").insert(rows);
        if (qErr) throw new Error(qErr.message);
      }
    }

    jobStore.set(jobId, { status: "complete", courseId: course.id });
  } catch (e: any) {
    jobStore.set(jobId, { status: "error", error: e?.message ?? "Unknown error" });
  }
}

export const startCourseGeneration = createServerFn({ method: "POST" })
  .inputValidator((d: GenInput) => {
    if (!d || typeof d.role !== "string" || typeof d.experienceLevel !== "string" || typeof d.goal !== "string")
      throw new Error("Invalid input");
    return {
      role: clip(d.role, 500),
      experienceLevel: clip(d.experienceLevel, 100),
      goal: clip(d.goal, 300),
      pdfText: typeof d.pdfText === "string" ? d.pdfText.slice(0, 30000) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const jobId = crypto.randomUUID();
    jobStore.set(jobId, { status: "pending" });
    setImmediate(() => runGenerationInBackground(jobId, data));
    return { jobId };
  });

export const getJobStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { jobId: string }) => {
    if (!d || typeof d.jobId !== "string") throw new Error("Invalid input");
    if (!/^[0-9a-f-]{36}$/i.test(d.jobId)) throw new Error("Invalid jobId");
    return d;
  })
  .handler(async ({ data }) => {
    const job = jobStore.get(data.jobId);
    if (!job) throw new Error("Job not found — the server may have restarted. Please try again.");
    return {
      status: job.status,
      courseId: job.courseId ?? null,
      error: job.error ?? null,
    };
  });

export const generateCourse = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { role: string; experienceLevel: string; goal: string; pdfText?: string }) => {
      if (!d || typeof d.role !== "string" || typeof d.experienceLevel !== "string" || typeof d.goal !== "string") {
        throw new Error("Invalid input");
      }
      return {
        role: clip(d.role, 500),
        experienceLevel: clip(d.experienceLevel, 100),
        goal: clip(d.goal, 300),
        pdfText: typeof d.pdfText === "string" ? d.pdfText.slice(0, 30000) : undefined,
      };
    }
  )
  .handler(async ({ data }) => {
    const client = getClient();

    const userPrompt = `Role: ${data.role}
Experience level: ${data.experienceLevel}
Learning goal: ${data.goal}${
      data.pdfText
        ? `\n\nSource document excerpt:\n"""\n${data.pdfText.slice(0, 30000)}\n"""`
        : ""
    }`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [buildCourseTool],
      tool_choice: { type: "tool", name: "build_course" },
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "max_tokens") throw new Error("Course generation was cut short. Please try again with a shorter role description or smaller PDF.");

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("Malformed AI response");
    const parsed = toolUse.input as CourseShape;
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) throw new Error("AI returned an empty course. Please try again.");

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

      const rows = (s.quiz ?? []).map((q, qi) => ({
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
  .inputValidator(
    (d: { courseId: string; message: string; history: { role: string; content: string }[] }) => {
      if (!d || typeof d.courseId !== "string" || typeof d.message !== "string")
        throw new Error("Invalid input");
      if (!/^[0-9a-f-]{36}$/i.test(d.courseId)) throw new Error("Invalid courseId");
      const history = Array.isArray(d.history)
        ? d.history.slice(-10).map((m) => ({
            role: m?.role === "assistant" ? "assistant" : "user",
            content: clip(String(m?.content ?? ""), 2000),
          }))
        : [];
      return { courseId: d.courseId, message: clip(d.message, 2000), history };
    }
  )
  .handler(async ({ data }) => {
    const client = getClient();

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

    const systemText = `You are Syncly, a warm and knowledgeable onboarding tutor. Answer questions about the course clearly and concisely (2-4 sentences). If asked about quiz answers, give a helpful hint but never reveal the exact answer. Be encouraging and specific.\n\nCourse context:\n${context}`;

    await supabaseAdmin
      .from("chat_messages")
      .insert({ course_id: data.courseId, role: "user", content: data.message });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
      messages: [
        ...data.history.slice(-10).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: data.message },
      ],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "Sorry, I had trouble answering that.";

    await supabaseAdmin
      .from("chat_messages")
      .insert({ course_id: data.courseId, role: "assistant", content: text });

    return { reply: text as string };
  });

export const updateSectionTitle = createServerFn({ method: "POST" })
  .inputValidator((d: { sectionId: string; title: string }) => {
    if (!d || typeof d.sectionId !== "string" || typeof d.title !== "string")
      throw new Error("Invalid input");
    if (!/^[0-9a-f-]{36}$/i.test(d.sectionId)) throw new Error("Invalid sectionId");
    return { sectionId: d.sectionId, title: clip(d.title, 200) };
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sections")
      .update({ title: data.title })
      .eq("id", data.sectionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refineCourse = createServerFn({ method: "POST" })
  .inputValidator((d: { courseId: string; instruction: string }) => {
    if (!d || typeof d.courseId !== "string" || typeof d.instruction !== "string")
      throw new Error("Invalid input");
    if (!/^[0-9a-f-]{36}$/i.test(d.courseId)) throw new Error("Invalid courseId");
    return { courseId: d.courseId, instruction: clip(d.instruction, 1000) };
  })
  .handler(async ({ data }) => {
    const client = getClient();

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("course_title, learner_goal")
      .eq("id", data.courseId)
      .single();

    const { data: sections } = await supabaseAdmin
      .from("sections")
      .select("id, title, summary, content, order_index")
      .eq("course_id", data.courseId)
      .order("order_index");

    if (!sections?.length) throw new Error("Course sections not found");

    const currentStructure = sections
      .map((s, i) =>
        `Section ${i + 1} [id: ${s.id}]\nTitle: "${s.title}"\nSummary: ${s.summary}\nContent (first 300 chars): ${(s.content ?? "").slice(0, 300)}...`
      )
      .join("\n\n");

    const prompt = `You are refining an onboarding course curriculum based on manager feedback.

Course: ${course?.course_title}
Goal: ${course?.learner_goal}

Current sections:
${currentStructure}

Manager instruction: "${data.instruction}"

Identify which sections need to change to satisfy this instruction. For EACH changed section, rewrite its title, summary, AND full content (400-600 words of rich markdown using ## headings, **bold** key terms, - bullet lists).

Return ONLY a raw JSON object (no markdown, no explanation) with this exact shape:
{"summary":"One sentence describing what changed.","sections":[{"id":"<exact-id>","title":"...","summary":"...","content":"...full markdown content..."}]}

Only include sections that actually changed. Keep all ids exactly as given.`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

    // Robustly extract JSON — strip fences, then find the first {...} block
    let jsonStr = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const jsonStart = jsonStr.indexOf("{");
    const jsonEnd = jsonStr.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);

    let parsed: { summary: string; sections: { id: string; title: string; summary: string; content?: string }[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error("Claude returned an unexpected response format. Please try again.");
    }

    if (!Array.isArray(parsed.sections)) throw new Error("Refinement response was malformed. Please try again.");

    // Write all changed sections back to Supabase (title + summary + content)
    for (const s of parsed.sections) {
      if (!/^[0-9a-f-]{36}$/i.test(s.id)) continue;
      await supabaseAdmin.from("sections").update({
        title: s.title,
        summary: s.summary,
        ...(s.content ? { content: s.content } : {}),
      }).eq("id", s.id);
    }

    return {
      summary: parsed.summary ?? "Changes applied.",
      sections: parsed.sections,
    };
  });

export const roleplayChat = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { courseId: string; message: string; history: { role: string; content: string }[] }) => {
      if (!d || typeof d.courseId !== "string" || typeof d.message !== "string")
        throw new Error("Invalid input");
      if (!/^[0-9a-f-]{36}$/i.test(d.courseId)) throw new Error("Invalid courseId");
      const history = Array.isArray(d.history)
        ? d.history.slice(-20).map((m) => ({
            role: m?.role === "assistant" ? "assistant" : "user",
            content: clip(String(m?.content ?? ""), 2000),
          }))
        : [];
      return { courseId: d.courseId, message: clip(d.message, 1000), history };
    }
  )
  .handler(async ({ data }) => {
    const client = getClient();

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("course_title, learner_goal, role")
      .eq("id", data.courseId)
      .single();
    const { data: sections } = await supabaseAdmin
      .from("sections")
      .select("title, summary")
      .eq("course_id", data.courseId)
      .order("order_index");

    const sectionList = (sections ?? [])
      .map((s, i) => `${i + 1}. ${s.title} — ${s.summary}`)
      .join("\n");

    const systemText = `You are running a professional roleplay simulation for someone learning the role of "${course?.role ?? "professional"}".

Course: ${course?.course_title}
Goal: ${course?.learner_goal}
Topics covered:
${sectionList}

Your task:
- Act as a realistic workplace character relevant to this role (client, manager, colleague, or customer — pick the most fitting)
- Create a realistic, challenging but supportive scenario that tests what the learner just studied
- Stay fully in character throughout the conversation
- If this is the first message (user says "start" or similar), introduce yourself and the scenario naturally
- Ask probing questions, react realistically to their responses, give them opportunities to demonstrate knowledge
- Keep responses concise (2-4 sentences) so the conversation flows naturally
- After 6+ exchanges, if the user says "end" or asks for feedback, step out of character and give a brief, specific coaching summary (what they did well, one area to improve)

Never break character unless explicitly asked for feedback. Never reveal you are an AI mid-roleplay.`;

    const isFirst = data.history.length === 0;
    const userMessage = isFirst
      ? `Start the roleplay scenario. Introduce yourself and the situation naturally in 2-3 sentences.`
      : data.message;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
      messages: [
        ...data.history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "Let's begin the scenario. I'm ready when you are.";

    return { reply: text as string };
  });

export const recordQuizAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: { questionId: string; selected: string }) => {
    if (!d || typeof d.questionId !== "string" || typeof d.selected !== "string")
      throw new Error("Invalid input");
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

export const generateQuizInsight = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { sectionTitle: string; score: number; wrongTopics: string[] }) => {
      if (!d || typeof d.sectionTitle !== "string" || typeof d.score !== "number")
        throw new Error("Invalid input");
      return {
        sectionTitle: clip(d.sectionTitle, 200),
        score: Math.max(0, Math.min(1, d.score)),
        wrongTopics: (d.wrongTopics ?? []).slice(0, 4).map((t) => clip(String(t), 120)),
      };
    }
  )
  .handler(async ({ data }) => {
    const client = getClient();

    const prompt = `A learner scored ${Math.round(data.score * 100)}% on the quiz for "${data.sectionTitle}". ${
      data.wrongTopics.length
        ? `They missed questions about: ${data.wrongTopics.join("; ")}.`
        : "They got everything right!"
    } Write exactly 2 sentences of specific, constructive, encouraging feedback. Do not start with "I" or repeat the percentage score.`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const insight =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    return { insight };
  });
