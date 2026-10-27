import { describe, expect, it } from "vitest";
import {
  parseText,
  sourceFor,
  validSource,
  chunkDocument,
} from "@/lib/document";
import {
  sampleDoc,
  sampleGaps,
  sampleRequirements,
  sampleDecisions,
  mockTasks,
} from "@/lib/sample";
import { validateGraph } from "@/lib/graph";
import { computeCoverage, evaluate } from "@/lib/quality";
import { importAnalysis, toMarkdown } from "@/lib/export";
import {
  createClient,
  extract,
  audit,
  plan,
  finishAnalysis,
  retryStage,
} from "@/lib/pipeline";
import { analysisSchema, type AnalysisResult } from "@/types";

function fixture(): AnalysisResult {
  const document = sampleDoc(),
    requirements = sampleRequirements(document),
    gaps = sampleGaps(document);
  return {
    version: 2,
    document,
    requirements,
    gaps,
    tasks: validateGraph(mockTasks(requirements, gaps, "standard")).tasks,
    decisions: sampleDecisions(document),
    conflicts: [],
    exclusions: [],
    mode: "mock",
    granularity: "standard",
    createdAt: "2026-10-19T00:00:00.000Z",
    durationMs: 1,
    logs: [],
    supportingDocuments: [],
  };
}
describe("文档锚点", () => {
  it("保留 CRLF、重复文本、标题和 Unicode 的精确偏移", () => {
    const text = "# 标题\r\n\r\n  图片😀最多九张\r\n\r\n图片😀最多九张";
    const doc = parseText(text, "测试.md");
    expect(doc.paragraphs).toHaveLength(3);
    for (const p of doc.paragraphs) {
      expect(text.slice(p.start, p.end)).toBe(p.text);
      expect(validSource(sourceFor(doc, p), doc)).toBe(true);
    }
    expect(doc.paragraphs[0].heading).toBe(1);
    expect(doc.paragraphs[1].start).not.toBe(doc.paragraphs[2].start);
  });
  it("拒绝空文档与伪造来源", () => {
    expect(() => parseText(" \n ", "空.md")).toThrow();
    const doc = sampleDoc(),
      source = sourceFor(doc, doc.paragraphs[0]);
    expect(validSource({ ...source, quote: "伪造文字" }, doc)).toBe(false);
  });
  it("超长段落分片且块不超过 4000 字，锚点仍正确", () => {
    const doc = parseText(
      "开头\n\n" + "a".repeat(9100) + "\n\n结束",
      "长文.md",
    );
    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks)
      expect(c.reduce((s, p) => s + p.text.length, 0)).toBeLessThanOrEqual(
        4000,
      );
    for (const p of doc.paragraphs)
      expect(validSource(sourceFor(doc, p), doc)).toBe(true);
  });
});
describe("确定性质量校验", () => {
  it("移除自环、未知依赖与三节点环，并产生正确分层", () => {
    const base = fixture().tasks.slice(0, 3);
    const result = validateGraph([
      { ...base[0], id: "T-01", deps: ["T-03", "T-01", "T-99"] },
      { ...base[1], id: "T-02", deps: ["T-01"] },
      { ...base[2], id: "T-03", deps: ["T-02"] },
    ]);
    expect(result.logs).toHaveLength(3);
    expect(result.tasks.map((t) => t.level)).toEqual([1, 2, 0]);
    for (const task of result.tasks)
      for (const dep of task.deps)
        expect(result.tasks.find((t) => t.id === dep)!.level).toBeLessThan(
          task.level,
        );
    expect(base[0].deps).toEqual([]);
  });
  it("缺口派生不能误算为覆盖全部需求", () => {
    const result = fixture(),
      req = result.requirements;
    const task = {
      ...result.tasks[0],
      requirementIds: req.map((r) => r.id),
      derivedFromGap: ["G-01"],
      source: req[3].source,
    };
    const coverage = computeCoverage(req, [task], result.gaps);
    expect(
      coverage.filter((c) => c.covered).map((c) => c.requirementId),
    ).toEqual(["R-04"]);
  });
  it("删除唯一任务会立即暴露红格，补充后重新覆盖", () => {
    const result = fixture();
    const tasks = mockTasks(result.requirements, result.gaps, "detailed");
    const remaining = tasks.filter((t) => !t.requirementIds.includes("R-04"));
    expect(
      computeCoverage(result.requirements, remaining).find(
        (c) => c.requirementId === "R-04",
      )?.covered,
    ).toBe(false);
    expect(
      computeCoverage(result.requirements, [
        ...remaining,
        tasks.find((t) => t.requirementIds.includes("R-04"))!,
      ]).every((c) => c.covered),
    ).toBe(true);
  });
  it("三档任务数量递增且覆盖全部需求", () => {
    const result = fixture();
    const counts = ["brief", "standard", "detailed"].map((g) => {
      const tasks = mockTasks(
        result.requirements,
        result.gaps,
        g as AnalysisResult["granularity"],
      );
      expect(
        computeCoverage(result.requirements, tasks).every((c) => c.covered),
      ).toBe(true);
      return tasks.length;
    });
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    expect(counts[1]).toBeGreaterThanOrEqual(13);
    expect(counts[2]).toBe(36);
  });
});
describe("演示管线和可恢复交付", () => {
  it("无 Key 跑通全部阶段，9 个缺口、4 项决策，且有真实出处", async () => {
    const client = createClient({ mode: "mock", configId: "test" }),
      doc = sampleDoc();
    const extracted = await extract(client, doc);
    const gaps = await audit(client, doc, extracted.requirements);
    const planned = await plan(
      client,
      doc,
      extracted.requirements,
      gaps,
      "standard",
    );
    const result = finishAnalysis({
      ...fixture(),
      ...extracted,
      gaps,
      tasks: planned.tasks,
    });
    expect(analysisSchema.safeParse(result).success).toBe(true);
    expect(result.requirements).toHaveLength(12);
    expect(result.gaps).toHaveLength(9);
    expect(result.decisions).toHaveLength(4);
    expect(evaluate(result).failures).toEqual([]);
    expect(result.logs).toEqual([]);
    for (const item of [
      ...result.requirements,
      ...result.tasks,
      ...result.gaps,
      ...result.decisions,
    ])
      for (const source of item.source)
        expect(validSource(source, doc)).toBe(true);
  });
  it("JSON 可幂等导入，篡改原文引用被拒绝，Markdown 保留出处", () => {
    const result = fixture();
    expect(importAnalysis(JSON.parse(JSON.stringify(result)))).toEqual(result);
    const broken = structuredClone(result);
    broken.tasks[0].source[0].quote = "不存在的原文";
    expect(() => importAnalysis(broken)).toThrow();
    const md = toMarkdown(result);
    expect(md).toContain("## 缺口清单");
    expect(md).toContain("## 任务清单");
    expect(md).toContain("## 决策记录");
    expect(md).toContain("字符 ");
  });
  it("评测用原文区间匹配，显示漏检而非依赖固定编号", () => {
    const result = fixture();
    result.gaps = result.gaps.slice(1).map((g, i) => ({ ...g, id: `P-${i}` }));
    const evaluation = evaluate(result);
    expect(evaluation.metrics[0].value).toBe(8 / 9);
    expect(evaluation.failures[0]).toContain("G-01 未检出");
  });
  it("回答缺口后重新拆解会采用补充说明", async () => {
    const result = fixture();
    result.gaps[1].resolution = {
      answer: "最多 5 张，每张不超过 2 MB。",
      at: result.createdAt,
    };
    const client = createClient({ mode: "mock", configId: "test" });
    const planned = await plan(
      client,
      result.document,
      result.requirements,
      result.gaps,
      "standard",
    );
    const related = planned.tasks.find((t) =>
      t.requirementIds.includes("R-02"),
    )!;
    expect(related.description).toContain("最多 5 张");
    expect(related.derivedFromGap).toContain("G-02");
  });
  it("阶段失败仅重试一次，仍失败向上报告", async () => {
    let calls = 0;
    await expect(
      retryStage(
        async () => {
          calls++;
          throw new Error("网络不可用");
        },
        () => {},
      ),
    ).rejects.toThrow("网络不可用");
    expect(calls).toBe(2);
  });
  it("其他文档的演示内容明确为占位，不伪造审查结论", async () => {
    const doc = parseText("客户要求实现登录。", "客户.md");
    const data = await extract(
      createClient({ mode: "mock", configId: "test" }),
      doc,
    );
    expect(data.requirements[0].title).toContain("占位");
    expect(data.decisions).toEqual([]);
  });
  it("长文档 PLAN 分批后编号仍唯一，依赖指向同批已有任务", async () => {
    const result = fixture();
    let calls = 0;
    const client = {
      config: { mode: "live" as const, configId: "test" },
      async run(
        stage: string,
        doc: typeof result.document,
        context?: Record<string, unknown>,
        paragraphs?: typeof doc.paragraphs,
      ) {
        calls++;
        expect(stage).toBe("plan");
        expect(
          paragraphs!.reduce((sum, p) => sum + p.text.length, 0),
        ).toBeLessThanOrEqual(4000);
        const reqs = context!.requirements as typeof result.requirements;
        const tasks = mockTasks(reqs, [], "standard");
        return { tasks, exclusions: [] };
      },
    };
    const planned = await plan(
      client,
      result.document,
      result.requirements,
      result.gaps,
      "standard",
    );
    expect(calls).toBe(2);
    expect(new Set(planned.tasks.map((t) => t.id)).size).toBe(
      planned.tasks.length,
    );
    for (const t of planned.tasks)
      expect(t.deps.every((d) => planned.tasks.some((p) => p.id === d))).toBe(
        true,
      );
    expect(
      computeCoverage(result.requirements, planned.tasks).every(
        (c) => c.covered,
      ),
    ).toBe(true);
  });
});
