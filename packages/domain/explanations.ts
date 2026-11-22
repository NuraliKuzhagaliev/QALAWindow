import { z } from "zod";
import type { PlanResult } from "./index";

export const ExplanationPatchSchema = z.object({
  requestId: z.string(),
  provider: z.string(),
  model: z.string(),
  trace: z.object({ stage: z.literal("generate"), summary: z.string() }),
  stops: z
    .array(
      z.object({ id: z.string(), reason: z.string(), activity: z.string() }),
    )
    .min(1)
    .max(3),
});

export function applyExplanation(
  result: PlanResult,
  patch: z.infer<typeof ExplanationPatchSchema>,
): PlanResult {
  if (!result.plan || result.requestId !== patch.requestId)
    throw new Error("Explanation does not match this plan");

  const byId = new Map(patch.stops.map((stop) => [stop.id, stop]));
  if (
    byId.size !== patch.stops.length ||
    byId.size !== result.plan.stops.length
  )
    throw new Error("Explanation stop count changed");

  return {
    ...result,
    plan: {
      ...result.plan,
      stops: result.plan.stops.map((stop) => {
        const text = byId.get(stop.poi.id);
        if (!text) throw new Error("Explanation contains different stops");
        return { ...stop, reason: text.reason, activity: text.activity };
      }),
    },
    mode: "live_ai",
    provider: patch.provider,
    model: patch.model,
    trace: [...result.trace, patch.trace],
  };
}
