import { z } from "zod";

export const gapCategories = [
  "exception_flow",
  "boundary",
  "nonfunctional",
  "acceptance",
  "ambiguity",
  "conflict",
  "dependency",
] as const;
export const categoryLabels: Record<GapCategory, string> = {
  exception_flow: "异常流程缺失",
  boundary: "边界条件缺失",
  nonfunctional: "非功能需求缺失",
  acceptance: "验收标准缺失",
  ambiguity: "表述歧义",
  conflict: "文档矛盾",
  dependency: "外部依赖未确认",
};
export type GapCategory = (typeof gapCategories)[number];
export const sourceSchema = z.object({
  docId: z.string(),
  docName: z.string(),
  locator: z.object({
    kind: z.enum(["page", "paragraph"]),
    index: z.number().int().min(1),
  }),
  quote: z.string().min(1).max(200),
  offset: z.object({
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  }),
});
export type SourceRef = z.infer<typeof sourceSchema>;
export const paragraphSchema = z.object({
  id: z.string(),
  text: z.string(),
  start: z.number(),
  end: z.number(),
  page: z.number().optional(),
  heading: z.number().optional(),
});
export const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["md", "pdf", "docx"]),
  text: z.string(),
  paragraphs: z.array(paragraphSchema),
  pages: z.number(),
  fingerprint: z.string(),
});
export type ParsedDoc = z.infer<typeof documentSchema>;
export type Paragraph = z.infer<typeof paragraphSchema>;
export const requirementSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string(),
  category: z.enum(["functional", "nonfunctional", "constraint"]),
  actors: z.array(z.string()),
  source: z.array(sourceSchema).min(1),
  completeness: z.number().int().min(0).max(3),
});
export const gapSchema = z.object({
  id: z.string(),
  category: z.enum(gapCategories),
  severity: z.enum(["blocking", "major", "minor"]),
  title: z.string().min(1),
  question: z.string(),
  why: z.string(),
  suggestions: z.array(z.string()).min(2).max(3),
  source: z.array(sourceSchema).min(1),
  resolution: z.object({ answer: z.string(), at: z.string() }).nullable(),
});
export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()).min(1),
  effort: z.number().min(0.5).max(5),
  role: z.enum(["fe", "be", "qa", "design", "pm"]),
  deps: z.array(z.string()),
  level: z.number().int().min(0),
  source: z.array(sourceSchema).min(1),
  requirementIds: z.array(z.string()).min(1),
  derivedFromGap: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export const decisionSchema = z.object({
  id: z.string(),
  topic: z.string(),
  options: z.array(
    z.object({ name: z.string(), pros: z.string(), cons: z.string() }),
  ),
  selected: z.string(),
  reason: z.string(),
  constraints: z.array(z.string()),
  scope: z.array(z.string()),
  participants: z.array(z.string()),
  status: z.enum(["confirmed", "proposed", "rejected"]),
  source: z.array(sourceSchema).min(1),
});
export const conflictSchema = z.object({
  id: z.string(),
  previousId: z.string(),
  incoming: decisionSchema,
  reason: z.string().min(1),
});
export const analysisSchema = z.object({
  version: z.literal(2),
  document: documentSchema,
  requirements: z.array(requirementSchema),
  gaps: z.array(gapSchema),
  tasks: z.array(taskSchema),
  decisions: z.array(decisionSchema),
  conflicts: z.array(conflictSchema),
  exclusions: z.array(
    z.object({ requirementId: z.string(), reason: z.string().min(1) }),
  ),
  mode: z.enum(["mock", "live"]),
  granularity: z.enum(["brief", "standard", "detailed"]),
  createdAt: z.string(),
  durationMs: z.number(),
  logs: z.array(z.string()),
  supportingDocuments: z.array(documentSchema).default([]),
});
export type Requirement = z.infer<typeof requirementSchema>;
export type Gap = z.infer<typeof gapSchema>;
export type TaskNode = z.infer<typeof taskSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type DecisionConflict = z.infer<typeof conflictSchema>;
export type AnalysisResult = z.infer<typeof analysisSchema>;
export type Granularity = AnalysisResult["granularity"];
export type Stage =
  | "idle"
  | "parse"
  | "extract"
  | "audit"
  | "plan"
  | "validate"
  | "done"
  | "error";
export const roleLabels: Record<TaskNode["role"], string> = {
  fe: "前端",
  be: "后端",
  qa: "测试",
  design: "设计",
  pm: "产品",
};
export const severityLabels = {
  blocking: "阻塞",
  major: "重要",
  minor: "建议",
};
