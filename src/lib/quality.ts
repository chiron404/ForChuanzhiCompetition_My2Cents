import type {
  AnalysisResult,
  Gap,
  Requirement,
  SourceRef,
  TaskNode,
} from "@/types";
import { validSource } from "./document";
import {
  GOLD_GAPS,
  sampleGaps,
  sampleRequirements,
  sampleDecisions,
} from "./sample";

export const overlaps = (a: SourceRef, b: SourceRef) =>
  a.docId === b.docId &&
  a.offset.start < b.offset.end &&
  b.offset.start < a.offset.end;

/** 同时校验显式需求关联和原文依据；一个缺口来源不能替所有需求提供覆盖。 */
export function computeCoverage(
  requirements: Requirement[],
  tasks: TaskNode[],
  gaps: Gap[] = [],
) {
  return requirements.map((r) => {
    const taskIds = tasks
      .filter(
        (t) =>
          t.requirementIds.includes(r.id) &&
          (t.source.some((s) => r.source.some((rs) => overlaps(s, rs))) ||
            gaps.some(
              (g) =>
                t.derivedFromGap.includes(g.id) &&
                !!g.resolution &&
                g.source.some((s) => r.source.some((rs) => overlaps(s, rs))),
            )),
      )
      .map((t) => t.id);
    return { requirementId: r.id, taskIds, covered: taskIds.length > 0 };
  });
}

export function validAC(value: string): boolean {
  return (
    /^\[.+?\]\s*当\s*.+?时[，,]\s*系统\s*.+[，,].+/.test(value) &&
    !/(体验流畅|界面友好|处理合理|正常运行|合理即可)/.test(value)
  );
}

/** 逐条校验真实出处，返回可被用户检查的失败记录。 */
export function validateAnalysis(result: AnalysisResult): string[] {
  const logs: string[] = [];
  const reqIds = new Set(result.requirements.map((r) => r.id));
  for (const entity of [
    ...result.requirements,
    ...result.gaps,
    ...result.tasks,
    ...result.decisions,
  ]) {
    if (entity.source.some((s) => !validSource(s, result.document)))
      logs.push(`${entity.id}：原文引用不匹配`);
  }
  for (const task of result.tasks) {
    if (task.requirementIds.some((id) => !reqIds.has(id)))
      logs.push(`${task.id}：引用了不存在的需求`);
    if (!task.acceptanceCriteria.every(validAC))
      logs.push(`${task.id}：验收标准需人工确认`);
  }
  for (const row of computeCoverage(
    result.requirements,
    result.tasks,
    result.gaps,
  ))
    if (!row.covered) logs.push(`${row.requirementId}：尚无任务覆盖`);
  return logs;
}

export interface Evaluation {
  at: string;
  mode: AnalysisResult["mode"];
  durationMs: number;
  metrics: { label: string; value: number; target: number; detail: string }[];
  failures: string[];
}
/** 基于类别与原文区间进行一对一匹配，公开匹配规则；不伪装成语义评审。 */
export function evaluate(result: AnalysisResult): Evaluation {
  const gold = sampleGaps(result.document);
  const used = new Set<string>();
  let hits = 0,
    severity = 0;
  const failures: string[] = [];
  gold.forEach((g, i) => {
    const found = result.gaps.find(
      (p) =>
        !used.has(p.id) &&
        p.category === g.category &&
        p.source.some((s) => overlaps(s, g.source[0])),
    );
    if (found) {
      used.add(found.id);
      hits++;
      if (found.severity === g.severity) severity++;
      else
        failures.push(
          `${g.id}：严重度应为 ${g.severity}，实际 ${found.severity}`,
        );
    } else failures.push(`${g.id} 未检出：${GOLD_GAPS[i].title}`);
  });
  result.gaps
    .filter((g) => !used.has(g.id))
    .forEach((g) => failures.push(`${g.id} 未匹配金标准：${g.title}`));
  const covered = computeCoverage(
    result.requirements,
    result.tasks,
    result.gaps,
  ).filter((r) => r.covered).length;
  const traced = result.tasks.filter((t) =>
    t.source.every((s) => validSource(s, result.document)),
  ).length;
  const acs = result.tasks.flatMap((t) => t.acceptanceCriteria),
    valid = acs.filter(validAC).length;
  const goldRequirements = sampleRequirements(result.document),
    goldDecisions = sampleDecisions(result.document);
  const reqHits = goldRequirements.filter((g) =>
    result.requirements.some((r) =>
      r.source.some((s) => g.source.some((gs) => overlaps(s, gs))),
    ),
  ).length;
  const decisionHits = goldDecisions.filter((g) =>
    result.decisions.some(
      (d) =>
        d.status === "confirmed" &&
        d.source.some((s) => g.source.some((gs) => overlaps(s, gs))),
    ),
  ).length;
  goldRequirements
    .filter(
      (g) =>
        !result.requirements.some((r) =>
          r.source.some((s) => g.source.some((gs) => overlaps(s, gs))),
        ),
    )
    .forEach((g) => failures.push(`${g.id} 需求未抽取：${g.title}`));
  goldDecisions
    .filter(
      (g) =>
        !result.decisions.some((d) =>
          d.source.some((s) => g.source.some((gs) => overlaps(s, gs))),
        ),
    )
    .forEach((g) => failures.push(`${g.id} 决策未抽取：${g.topic}`));
  const divide = (a: number, b: number) => (b ? a / b : 0);
  return {
    at: new Date().toISOString(),
    mode: result.mode,
    durationMs: result.durationMs,
    failures,
    metrics: [
      {
        label: "缺口召回率",
        value: hits / 9,
        target: 7 / 9,
        detail: `${hits} / 9 个金标准缺口`,
      },
      {
        label: "缺口精确率",
        value: divide(hits, result.gaps.length),
        target: 0.6,
        detail: "一对一：类别 + 原文区间",
      },
      {
        label: "严重度准确率",
        value: divide(severity, hits),
        target: 0.7,
        detail: `${severity} / ${hits} 个命中缺口`,
      },
      {
        label: "需求覆盖率",
        value: divide(covered, result.requirements.length),
        target: 1,
        detail: `${covered} / ${result.requirements.length} 条已抽取需求`,
      },
      {
        label: "任务溯源率",
        value: divide(traced, result.tasks.length),
        target: 1,
        detail: `${traced} / ${result.tasks.length} 条任务引用有效`,
      },
      {
        label: "验收标准合格率",
        value: divide(valid, acs.length),
        target: 0.9,
        detail: "格式与空洞措辞规则检查",
      },
      {
        label: "需求抽取召回率",
        value: reqHits / 12,
        target: 0.8,
        detail: `${reqHits} / 12 条人工需求`,
      },
      {
        label: "决策抽取 F1",
        value: divide(2 * decisionHits, 4 + result.decisions.length),
        target: 0.75,
        detail: "原文匹配的精确率与召回率调和均值",
      },
    ],
  };
}
