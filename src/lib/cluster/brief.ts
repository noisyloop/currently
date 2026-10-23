import { createServerFn } from "@tanstack/react-start";

export type AgentBrief = {
  headline: string;
  risks: string[];
  move: string;
  note: string;
};

export type BriefResult = { ok: true; brief: AgentBrief } | { ok: false; error: string };

const SYSTEM = `You are the operator on Current, an unofficial desk that places models onto AMD Instinct-class racks. You are not TensorWave and not AMD. You do not quote their contracts.

You receive a deterministic planner dump. Write a staff-engineer brief about THAT dump only. Do not invent benchmark numbers, cluster sizes, or prices that are not in the dump. If a figure is a sketch, call it a sketch.

Return JSON only, no markdown, with this shape:
{"headline": string, "risks": string[2 or 3], "move": string, "note": string}

headline: one sentence, under 18 words, specific to the placement.
risks: concrete failure modes already implied by the dump (HBM, bubble, fabric, preemption, precision).
move: the single next change an operator should try, naming the knob.
note: two or three sentences in a dry operator voice. If accelerators are marked down, say whether the placement is short.`;

function parseBrief(text: string): AgentBrief | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(trimmed.slice(start, end + 1)) as Partial<AgentBrief>;
    if (typeof json.headline !== "string" || typeof json.move !== "string" || typeof json.note !== "string") {
      return null;
    }
    const risks = Array.isArray(json.risks)
      ? json.risks.filter((risk): risk is string => typeof risk === "string").slice(0, 4)
      : [];
    return {
      headline: json.headline.slice(0, 200),
      risks: risks.map((risk) => risk.slice(0, 280)),
      move: json.move.slice(0, 320),
      note: json.note.slice(0, 900),
    };
  } catch {
    return null;
  }
}

async function complete(apiKey: string, summary: string, jsonMode: boolean): Promise<Response> {
  return fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.2,
      max_tokens: 450,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: summary },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
}

export const briefPlan = createServerFn({ method: "POST" })
  .validator((input: { summary?: unknown }) => {
    if (!input || typeof input.summary !== "string" || input.summary.trim().length < 20) {
      throw new Error("Missing plan");
    }
    return { summary: input.summary.slice(0, 6000) };
  })
  .handler(async ({ data }): Promise<BriefResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "The agent is offline in this environment. The planner still stands." };

    let res = await complete(apiKey, data.summary, true);
    if (res.status === 400) res = await complete(apiKey, data.summary, false);
    if (!res.ok) return { ok: false, error: `Agent unavailable (${res.status}). The planner still stands.` };

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    const brief = parseBrief(text);
    if (brief) return { ok: true, brief };
    if (text.trim()) {
      return {
        ok: true,
        brief: { headline: "Unstructured brief", risks: [], move: "Read the note, then re-run.", note: text.slice(0, 900) },
      };
    }
    return { ok: false, error: "The agent returned an empty brief." };
  });
