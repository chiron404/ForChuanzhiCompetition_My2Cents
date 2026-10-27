import { analysisSchema, type AnalysisResult } from "@/types";
import { validateAnalysis } from "./quality";
import { validateGraph } from "./graph";

const cite = (sources: AnalysisResult["tasks"][number]["source"]) =>
  sources
    .map(
      (s) =>
        `${s.docName} · ${s.locator.kind === "page" ? "第 " + s.locator.index + " 页" : "段落 " + s.locator.index} · 字符 ${s.offset.start}–${s.offset.end}`,
    )
    .join("；");
/** 完整保留出处和补充回答，JSON 导入必须经过结构、引用和图校验。 */
export function importAnalysis(value: unknown): AnalysisResult {
  const parsed = analysisSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "文件不是有效的蓝图 V2 分析结果，请选择从蓝图导出的 JSON 文件。",
    );
  const result = parsed.data;
  for (const doc of [result.document, ...result.supportingDocuments]) {
    if (
      new Set(doc.paragraphs.map((p) => p.id)).size !== doc.paragraphs.length ||
      doc.paragraphs.some(
        (p, i) =>
          p.start < 0 ||
          p.end <= p.start ||
          doc.text.slice(p.start, p.end) !== p.text ||
          (i > 0 && p.start < doc.paragraphs[i - 1].end),
      )
    ) {
      throw new Error("导入失败：段落位置与原文不一致。");
    }
  }
  const entities = [
    ...result.requirements,
    ...result.gaps,
    ...result.tasks,
    ...result.decisions,
  ];
  if (new Set(entities.map((e) => e.id)).size !== entities.length)
    throw new Error("导入数据包含重复编号。");
  if (
    validateAnalysis(result).some(
      (log) => log.includes("引用不匹配") || log.includes("不存在的需求"),
    )
  )
    throw new Error("导入失败：溯源数据与原文不一致。");
  for (const conflict of result.conflicts) {
    if (!result.decisions.some((d) => d.id === conflict.previousId))
      throw new Error("冲突引用了不存在的历史决策。");
    for (const source of conflict.incoming.source) {
      const doc = [result.document, ...result.supportingDocuments].find(
        (d) => d.id === source.docId,
      );
      if (
        !doc ||
        doc.text.slice(source.offset.start, source.offset.end) !== source.quote
      )
        throw new Error("补充文档的原文引用不一致。");
    }
  }
  const graph = validateGraph(result.tasks);
  return {
    ...result,
    tasks: graph.tasks,
    logs: [...result.logs, ...graph.logs],
  };
}
export function toMarkdown(result: AnalysisResult): string {
  return `# 蓝图 · 需求评审报告\n\n文档：${result.document.name}\n模式：${result.mode === "mock" ? "演示模式（固定数据或通用占位）" : "真实模型"}\n生成时间：${result.createdAt}\n\n## 需求\n\n${result.requirements.map((r) => `### ${r.id} ${r.title}\n${r.summary}\n\n出处：${cite(r.source)}`).join("\n\n")}\n\n## 缺口清单\n\n${result.gaps.map((g) => `### ${g.id} ${g.title} [${g.severity}]\n${g.question}\n\n原因：${g.why}\n\n补充答复：${g.resolution?.answer ?? "未回答"}\n\n出处：${cite(g.source)}`).join("\n\n")}\n\n## 任务清单\n\n${result.tasks.map((t) => `### ${t.id} ${t.title}\n${t.description}\n\n工时：${t.effort} 人日；依赖：${t.deps.join("、") || "无"}\n\n${t.acceptanceCriteria.map((ac) => "- " + ac).join("\n")}\n\n出处：${cite(t.source)}`).join("\n\n")}\n\n## 决策记录\n\n${result.decisions.map((d) => `### ${d.id} ${d.topic}\n方案：${d.selected}\n\n理由：${d.reason}\n\n出处：${cite(d.source)}`).join("\n\n")}\n\n## 校验日志\n\n${result.logs.map((l) => "- " + l).join("\n") || "无异常记录"}\n`;
}
export function downloadResult(
  result: AnalysisResult,
  format: "json" | "md",
): void {
  const text =
    format === "json" ? JSON.stringify(result, null, 2) : toMarkdown(result);
  const url = URL.createObjectURL(
    new Blob([text], {
      type:
        format === "json" ? "application/json" : "text/markdown;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `蓝图-${result.document.name.replace(/\.[^.]+$/, "")}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
