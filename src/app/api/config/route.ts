import { createHash } from "node:crypto";
export const dynamic = "force-dynamic";
export function GET() {
  const live = !!process.env.LLM_API_KEY?.trim();
  const signature = [
    process.env.LLM_BASE_URL,
    process.env.LLM_MODEL,
    process.env.LLM_CONFIG_VERSION,
  ].join("|");
  return Response.json(
    {
      mode: live ? "live" : "mock",
      configId: createHash("sha256")
        .update(signature)
        .digest("hex")
        .slice(0, 16),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
