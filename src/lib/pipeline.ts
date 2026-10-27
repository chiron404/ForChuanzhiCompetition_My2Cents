import { z } from "zod";
import {
  requirementSchema,
  gapSchema,
  taskSchema,
  decisionSchema,
  conflictSchema,
  type ParsedDoc,
  type AnalysisResult,
  type Granularity,
  type Requirement,
  type Gap,
  type Decision,
  type SourceRef,
} from "@/types";
import { chunkDocument, sourceFor, validSource } from "./document";
import {
  isSample,
  sampleRequirements,
  sampleGaps,
  sampleDecisions,
  mockTasks,
} from "./sample";
import { validateGraph } from "./graph";
import { computeCoverage, validateAnalysis } from "./quality";

export type AIStage = "extract" | "audit" | "plan" | "conflicts";
export interface ModelConfig {
  mode: "mock" | "live";
  configId: string;
}
export interface LLMClient {
  config: ModelConfig;
  run(
    stage: AIStage,
    doc: ParsedDoc,
    context?: Record<string, unknown>,
    paragraphs?: ParsedDoc["paragraphs"],
  ): Promise<unknown>;
}
const extractSchema = z.object({
  requirements: z.array(requirementSchema),
  decisions: z.array(decisionSchema),
});
const auditSchema = z.object({ gaps: z.array(gapSchema) });
const planSchema = z.object({
  tasks: z.array(taskSchema),
  exclusions: z.array(
    z.object({ requirementId: z.string(), reason: z.string().min(1) }),
  ),
});

export async function getModelConfig(): Promise<ModelConfig> {
  const response = await fetch("/api/config");
  if (!response.ok)
    throw new Error("无法读取模型配置，请确认本地服务正在运行。");
  return z
    .object({ mode: z.enum(["mock", "live"]), configId: z.string() })
    .parse(await response.json());
}

/** 模型接口可替换；演示从不向服务器发送文档。真实调用仅发送带编号的文本片段。 */
export function createClient(config: ModelConfig): LLMClient {
  return {
    config,
    async run(stage, doc, context = {}, paragraphs = doc.paragraphs) {
      if (config.mode === "mock") return mockStage(stage, doc, context);
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          document: { id: doc.id, name: doc.name },
          paragraphs,
          context,
        }),
        signal: AbortSignal.timeout(55000),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          z.object({ error: z.string() }).safeParse(payload).data?.error ??
            "模型暂时不可用，请重试。",
        );
      return payload;
    },
  };
}

function mockStage(
  stage: AIStage,
  doc: ParsedDoc,
  context: Record<string, unknown>,
): unknown {
  const sample = isSample(doc);
  if (stage === "extract") {
    if (sample)
      return {
        requirements: sampleRequirements(doc),
        decisions: sampleDecisions(doc),
      };
    // 其他文档只提供明确标注的结构占位，不伪造真实审查结果。
    const p = doc.paragraphs.find((p) => !p.heading) ?? doc.paragraphs[0];
    return {
      requirements: [
        {
          id: "R-01",
          title: "演示占位需求（待真实模型分析）",
          summary: "此条目仅用于验证界面和溯源，不能作为文档审查结论。",
          category: "functional",
          actors: [],
          source: [sourceFor(doc, p)],
          completeness: 0,
        },
      ],
      decisions: [],
    };
  }
  if (stage === "audit") {
    if (sample) return { gaps: sampleGaps(doc) };
    return {
      gaps: [
        {
          id: "G-01",
          category: "acceptance",
          severity: "minor",
          title: "演示占位：请使用真实模型完成审查",
          question: "请配置服务端 API Key 后重新分析，本条不代表原文存在缺陷。",
          why: "当前没有调用模型，此处仅展示内联作答与任务拆解交互。",
          suggestions: [
            "已知悉：当前为通用占位数据。",
            "先使用内置示例查看完整功能。",
          ],
          source: [sourceFor(doc, doc.paragraphs[0])],
          resolution: null,
        },
      ],
    };
  }
  if (stage === "plan")
    return {
      tasks: mockTasks(
        z.array(requirementSchema).parse(context.requirements),
        z.array(gapSchema).parse(context.gaps),
        z.enum(["brief", "standard", "detailed"]).parse(context.granularity),
      ),
      exclusions: [],
    };
  return { conflicts: [] };
}

/** 每阶段只重试一次；失败保留已完成结果，由调用方展示可恢复状态。 */
export async function retryStage<T>(
  fn: () => Promise<T>,
  onRetry: (message: string) => void,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    onRetry(
      `本阶段首次失败，正在重试：${error instanceof Error ? error.message : "未知错误"}`,
    );
    return fn();
  }
}

function renumber<T extends { id: string; source: SourceRef[] }>(
  entities: T[],
  prefix: string,
): T[] {
  const unique = new Map<string, T>();
  for (const item of entities) {
    const key = `${item.source[0]?.offset.start}:${"category" in item ? item.category : ""}:${"title" in item ? String(item.title).replace(/\s/g, "") : ""}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].map((r, i) => ({
    ...r,
    id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
  }));
}

export async function extract(
  client: LLMClient,
  doc: ParsedDoc,
): Promise<{ requirements: Requirement[]; decisions: Decision[] }> {
  if (client.config.mode === "mock")
    return extractSchema.parse(await client.run("extract", doc));
  const results = [];
  for (const paragraphs of chunkDocument(doc))
    results.push(
      extractSchema.parse(await client.run("extract", doc, {}, paragraphs)),
    );
  return {
    requirements: renumber(
      results.flatMap((r) => r.requirements),
      "R",
    ),
    decisions: renumber(
      results.flatMap((r) => r.decisions),
      "D",
    ),
  };
}
export async function audit(
  client: LLMClient,
  doc: ParsedDoc,
  requirements: Requirement[],
): Promise<Gap[]> {
  if (client.config.mode === "mock")
    return auditSchema.parse(await client.run("audit", doc)).gaps;
  const gaps: Gap[] = [];
  // 全局约束摘要随块传递，使跨章节矛盾可被发现；模型仍只能引用提供的段落。
  const summary = requirements.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
  }));
  for (const paragraphs of chunkDocument(doc))
    gaps.push(
      ...auditSchema.parse(
        await client.run("audit", doc, { requirements: summary }, paragraphs),
      ).gaps,
    );
  const deduped: Gap[] = [];
  for (const gap of gaps)
    if (
      !deduped.some(
        (g) =>
          g.title === gap.title ||
          (g.source[0].offset.start === gap.source[0].offset.start &&
            g.question === gap.question),
      )
    )
      deduped.push(gap);
  return renumber(deduped, "G");
}
export async function plan(
  client: LLMClient,
  doc: ParsedDoc,
  requirements: Requirement[],
  gaps: Gap[],
  granularity: Granularity,
) {
  const batches: Requirement[][] = [];
  let batch: Requirement[] = [],
    size = 0;
  for (const requirement of requirements) {
    const length = requirement.source.reduce(
      (sum, s) => sum + s.quote.length,
      0,
    );
    if (batch.length && (batch.length >= 8 || size + length > 4000)) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(requirement);
    size += length;
  }
  if (batch.length) batches.push(batch);
  const raw: z.infer<typeof planSchema> = { tasks: [], exclusions: [] };
  if (client.config.mode === "mock")
    Object.assign(
      raw,
      planSchema.parse(
        await client.run("plan", doc, { requirements, gaps, granularity }),
      ),
    );
  else
    for (const group of batches) {
      // PLAN 只发送有界原文摘录，保留完整文档中的字符偏移。
      const paragraphs = group
        .flatMap((r) => r.source)
        .map((source, index) => {
          if (!validSource(source, doc))
            throw new Error("需求引用与原文不一致，无法拆解。");
          const p = doc.paragraphs.find(
            (p) =>
              p.start <= source.offset.start && source.offset.start < p.end,
          )!;
          return {
            ...p,
            id: `${p.id}-ref-${index}`,
            text: source.quote,
            start: source.offset.start,
            end: source.offset.end,
          };
        });
      const related = gaps.filter((g) =>
        g.source.some((s) =>
          group.some((r) =>
            r.source.some(
              (rs) =>
                s.docId === rs.docId &&
                s.offset.start < rs.offset.end &&
                rs.offset.start < s.offset.end,
            ),
          ),
        ),
      );
      const output = planSchema.parse(
        await client.run(
          "plan",
          doc,
          { requirements: group, gaps: related, granularity },
          paragraphs,
        ),
      );
      const mapping = new Map(
        output.tasks.map((t, index) => [
          t.id,
          `T-${String(raw.tasks.length + index + 1).padStart(2, "0")}`,
        ]),
      );
      if (mapping.size !== output.tasks.length)
        throw new Error("模型生成了重复任务编号，请重试拆解。");
      raw.tasks.push(
        ...output.tasks.map((t) => ({
          ...t,
          id: mapping.get(t.id)!,
          deps: t.deps.map((d) => mapping.get(d) ?? `invalid:${d}`),
        })),
      );
      raw.exclusions.push(...output.exclusions);
    }
  const graph = validateGraph(raw.tasks);
  const ids = new Set(requirements.map((r) => r.id));
  if (graph.tasks.some((t) => t.requirementIds.some((id) => !ids.has(id))))
    throw new Error("模型生成了不存在的需求编号，请重试拆解。");
  if (new Set(graph.tasks.map((t) => t.id)).size !== graph.tasks.length)
    throw new Error("模型生成了重复任务编号，请重试拆解。");
  return { ...raw, tasks: graph.tasks, logs: graph.logs };
}

export function finishAnalysis(result: AnalysisResult): AnalysisResult {
  const quality = validateAnalysis(result);
  const missing = computeCoverage(
    result.requirements,
    result.tasks,
    result.gaps,
  ).filter((c) => !c.covered);
  const exclusions = [...result.exclusions];
  for (const row of missing)
    if (!exclusions.some((e) => e.requirementId === row.requirementId))
      exclusions.push({
        requirementId: row.requirementId,
        reason: "模型没有生成带有效依据的对应任务，请人工补充。",
      });
  return {
    ...result,
    exclusions,
    logs: [...new Set([...result.logs, ...quality])],
  };
}

/** 检索只召回相关决策，真实模式的冲突结论必须由模型给出双方引用与理由。 */
export async function detectConflicts(
  client: LLMClient,
  doc: ParsedDoc,
  history: Decision[],
  incoming: Decision,
): Promise<AnalysisResult["conflicts"]> {
  const tokens = [
    ...new Set([
      ...incoming.scope,
      ...(incoming.topic.match(/[\u4e00-\u9fa5]{2,}/g) ?? []),
    ]),
  ];
  const candidates = history
    .filter(
      (d) =>
        tokens.some(
          (t) =>
            d.topic.includes(t) ||
            d.scope.some((s) => s.includes(t) || t.includes(s)),
        ) ||
        (/信用/.test(incoming.selected) && /信用/.test(d.selected)),
    )
    .slice(0, 5);
  if (!candidates.length) return [];
  const data = await client.run("conflicts", doc, { candidates, incoming });
  return z
    .object({ conflicts: z.array(conflictSchema) })
    .parse(data)
    .conflicts.filter((c) => candidates.some((d) => d.id === c.previousId))
    .map((c) => ({ ...c, incoming }));
}
