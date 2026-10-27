"use client";
import { create } from "zustand";
import type {
  AnalysisResult,
  ParsedDoc,
  Stage,
  Granularity,
  SourceRef,
  TaskNode,
  Decision,
} from "@/types";
import { parseFile, parseText, sourceFor } from "@/lib/document";
import {
  createClient,
  getModelConfig,
  extract,
  audit,
  plan,
  retryStage,
  finishAnalysis,
  detectConflicts,
} from "@/lib/pipeline";
import { readCache, writeCache } from "@/lib/storage";
import { sampleDoc, CONFLICT_TEXT, isSample } from "@/lib/sample";
import { validateGraph } from "@/lib/graph";

interface BlueprintStore {
  doc: ParsedDoc | null;
  result: AnalysisResult | null;
  stage: Stage;
  stageMessage: string;
  error: string | null;
  selected: {
    source: SourceRef;
    kind: "requirement" | "gap" | "task" | "decision";
    nonce: number;
  } | null;
  mode: "mock" | "live";
  granularity: Granularity;
  notice: string | null;
  hydrated: boolean;
  replanning: boolean;
  dirty: boolean;
  hydrate: () => Promise<void>;
  load: (file?: File) => Promise<void>;
  run: (force?: boolean) => Promise<void>;
  answerGap: (id: string, answer: string) => void;
  replan: (granularity?: Granularity) => Promise<void>;
  select: (
    source: SourceRef,
    kind: "requirement" | "gap" | "task" | "decision",
  ) => void;
  addTask: (requirementId: string, title: string, ac: string) => void;
  removeTask: (id: string) => void;
  importResult: (result: AnalysisResult) => Promise<void>;
  addConflictDemo: () => Promise<void>;
  addDecisionDocument: (file: File) => Promise<void>;
  dismissNotice: () => void;
}
let generation = 0;
const persist = (result: AnalysisResult) => {
  void writeCache("last", result);
};

/** 单向数据流；每步执行后立即保存部分结果，错误重试不清空有效产物。 */
export const useBlueprint = create<BlueprintStore>((set, get) => ({
  doc: null,
  result: null,
  stage: "idle",
  stageMessage: "",
  error: null,
  selected: null,
  mode: "mock",
  granularity: "standard",
  notice: null,
  hydrated: false,
  replanning: false,
  dirty: false,
  async hydrate() {
    const result = await readCache("last");
    if (result && !get().doc)
      set({
        doc: result.document,
        result,
        mode: result.mode,
        granularity: result.granularity,
        stage: "done",
      });
    set({ hydrated: true });
  },
  async load(file) {
    if (
      ["parse", "extract", "audit", "plan", "validate"].includes(get().stage) ||
      get().replanning
    )
      return;
    generation++;
    const token = generation;
    set({
      stage: "parse",
      stageMessage: "在浏览器中读取文档并建立原文锚点",
      error: null,
      selected: null,
    });
    try {
      const doc = file ? await parseFile(file) : sampleDoc();
      if (token !== generation) return;
      set({ doc, result: null, stage: "idle", dirty: false });
      await get().run();
    } catch (error) {
      if (token === generation)
        set({
          stage: "error",
          error: error instanceof Error ? error.message : "文档读取失败。",
        });
    }
  },
  async run(force = false) {
    const doc = get().result?.document ?? get().doc;
    if (!doc) return;
    const token = generation;
    const start = performance.now();
    const granularity = get().granularity;
    let partial = force ? null : get().result;
    let result: AnalysisResult = partial ?? {
      version: 2,
      document: doc,
      requirements: [],
      gaps: [],
      tasks: [],
      decisions: [],
      conflicts: [],
      exclusions: [],
      mode: "mock",
      granularity,
      createdAt: new Date().toISOString(),
      durationMs: 0,
      logs: [],
      supportingDocuments: [],
    };
    const update = (stage: Stage, stageMessage: string) => {
      if (token === generation) set({ stage, stageMessage, result });
    };
    try {
      set({ error: null });
      const config = await getModelConfig();
      if (token !== generation) return;
      if (partial && partial.mode !== config.mode) {
        partial = null;
        result = {
          ...result,
          requirements: [],
          gaps: [],
          tasks: [],
          decisions: [],
          conflicts: [],
          exclusions: [],
          logs: [],
          supportingDocuments: [],
        };
      }
      set({ mode: config.mode });
      result = { ...result, mode: config.mode };
      const cacheKey = `${doc.fingerprint}:${doc.name}:${config.mode}:${config.configId}:${granularity}`;
      const cached = !force && !partial ? await readCache(cacheKey) : null;
      if (cached && cached.document.text === doc.text) {
        set({
          result: cached,
          doc,
          stage: "done",
          notice: "已复用本机缓存，无需重复调用模型。",
        });
        persist(cached);
        return;
      }
      const client = createClient(config);
      const retry = <T>(fn: () => Promise<T>) =>
        retryStage(fn, (message) => set({ stageMessage: message }));
      if (!partial?.requirements.length || force) {
        update("extract", "抽取可执行需求与已确认决策，绑定原文依据");
        const extracted = await retry(() => extract(client, doc));
        result = {
          ...result,
          ...extracted,
          gaps: [],
          tasks: [],
          decisions: extracted.decisions,
        };
      }
      if (!partial?.gaps.length || force) {
        update("audit", "逐类检查 7 类缺口，合并重复问题");
        result = {
          ...result,
          gaps: await retry(() => audit(client, doc, result.requirements)),
        };
      }
      update("plan", "根据需求和已确认答复生成任务与验收标准");
      const planned = await retry(() =>
        plan(client, doc, result.requirements, result.gaps, granularity),
      );
      result = {
        ...result,
        tasks: planned.tasks,
        exclusions: planned.exclusions,
        logs: planned.logs,
      };
      update("validate", "校验原文引用、依赖环和需求覆盖关系");
      result = finishAnalysis({
        ...result,
        durationMs: Math.round(performance.now() - start),
      });
      if (token !== generation) return;
      const saved = await writeCache(cacheKey, result);
      persist(result);
      set({
        result,
        stage: "done",
        dirty: false,
        notice: !saved
          ? "本机存储不可用，结果保留在当前页面，请及时导出。"
          : config.mode === "mock" && !isSample(doc)
            ? "当前文档使用通用占位数据，请配置模型后重新分析。"
            : null,
      });
    } catch (error) {
      if (token === generation)
        set({
          result,
          stage: "error",
          error:
            error instanceof Error ? error.message : "分析未完成，请重试。",
        });
    }
  },
  answerGap(id, answer) {
    const result = get().result;
    if (!result || !answer.trim()) return;
    const next = {
      ...result,
      gaps: result.gaps.map((g) =>
        g.id === id
          ? {
              ...g,
              resolution: {
                answer: answer.trim(),
                at: new Date().toISOString(),
              },
            }
          : g,
      ),
    };
    set({ result: next, dirty: true });
    persist(next);
  },
  async replan(granularity) {
    const { result, replanning } = get();
    if (!result || replanning) return;
    const selected = granularity ?? get().granularity;
    set({
      granularity: selected,
      replanning: true,
      error: null,
      stageMessage: "仅重新拆解，复用需求和缺口结果",
    });
    try {
      const config = await getModelConfig();
      if (config.mode !== result.mode)
        throw new Error("模型模式已变化，请先重新分析文档，再调整任务粒度。");
      const client = createClient(config);
      const planned = await retryStage(
        () =>
          plan(
            client,
            result.document,
            result.requirements,
            result.gaps,
            selected,
          ),
        (message) => set({ stageMessage: message }),
      );
      const next = finishAnalysis({
        ...result,
        tasks: planned.tasks,
        exclusions: planned.exclusions,
        granularity: selected,
        logs: planned.logs,
      });
      set({
        result: next,
        replanning: false,
        dirty: false,
        notice: "任务已重新拆解，需求抽取与缺口审查未重复执行。",
      });
      persist(next);
    } catch (error) {
      set({
        replanning: false,
        error:
          error instanceof Error ? error.message : "重新拆解失败，可重试。",
        granularity: result.granularity,
      });
    }
  },
  select(source, kind) {
    const result = get().result;
    const doc = [result?.document, ...(result?.supportingDocuments ?? [])].find(
      (d) => d?.id === source.docId,
    );
    if (
      !doc ||
      !doc.paragraphs.some(
        (p) => p.start <= source.offset.start && source.offset.start < p.end,
      )
    ) {
      set({ notice: "原文位置不可用，请检查引用文档。" });
      return;
    }
    set({ doc, selected: { source, kind, nonce: Date.now() } });
  },
  addTask(requirementId, title, ac) {
    const result = get().result;
    const req = result?.requirements.find((r) => r.id === requirementId);
    if (!result || !req) return;
    const index =
      Math.max(0, ...result.tasks.map((t) => Number(t.id.slice(2)) || 0)) + 1;
    const task: TaskNode = {
      id: `T-${String(index).padStart(2, "0")}`,
      title,
      description: req.summary,
      acceptanceCriteria: [ac],
      effort: 1,
      role: "fe",
      deps: [],
      level: 0,
      source: req.source,
      requirementIds: [req.id],
      derivedFromGap: [],
      confidence: 1,
    };
    const next = {
      ...result,
      tasks: [...result.tasks, task],
      exclusions: result.exclusions.filter((e) => e.requirementId !== req.id),
    };
    set({ result: next, notice: "已补充任务，覆盖关系已实时更新。" });
    persist(next);
  },
  removeTask(id) {
    const result = get().result;
    if (!result) return;
    const graph = validateGraph(result.tasks.filter((t) => t.id !== id));
    const next = {
      ...result,
      tasks: graph.tasks,
      logs: [...result.logs, ...graph.logs],
    };
    set({ result: next, notice: "任务已移除，可在覆盖矩阵检查并补充。" });
    persist(next);
  },
  async importResult(result) {
    generation++;
    set({
      doc: result.document,
      result,
      stage: "done",
      mode: result.mode,
      granularity: result.granularity,
      error: null,
      selected: null,
      dirty: false,
    });
    persist(result);
  },
  async addConflictDemo() {
    const result = get().result;
    if (!result) return;
    if (result.conflicts.some((c) => c.id === "C-DEMO")) {
      set({ notice: "冲突示例已加载。" });
      return;
    }
    const doc = parseText(CONFLICT_TEXT, "校园二手交易平台-V2.1.md");
    const p = doc.paragraphs[1];
    const incoming: Decision = {
      id: "D-NEW",
      topic: "信用评分体系",
      selected: "本期新增信用评分体系并用于交易准入",
      reason: "减少违约交易，提升交易信任。",
      options: [],
      constraints: ["本期实施"],
      scope: ["信用评分体系"],
      participants: [],
      status: "confirmed",
      source: [sourceFor(doc, p)],
    };
    const previous = result.decisions.find((d) => /信用/.test(d.selected));
    if (!previous) {
      set({ notice: "当前文档没有信用体系历史决策，请使用内置示例体验。" });
      return;
    }
    const next = {
      ...result,
      supportingDocuments: [...result.supportingDocuments, doc],
      conflicts: [
        ...result.conflicts,
        {
          id: "C-DEMO",
          previousId: previous.id,
          incoming,
          reason:
            "演示数据：原决策明确暂不做信用评分，补充决策要求本期新增并影响交易准入，实施范围与时间相同、方案互斥。",
        },
      ],
    };
    set({ result: next, notice: "已加载固定冲突示例；此结论未调用模型。" });
    persist(next);
  },
  async addDecisionDocument(file) {
    const result = get().result;
    if (!result) return;
    try {
      const config = await getModelConfig();
      if (config.mode === "mock") {
        set({ notice: "上传补充决策需配置真实模型；可先加载固定冲突示例。" });
        return;
      }
      set({ replanning: true });
      const doc = await parseFile(file);
      const client = createClient(config);
      const incoming = await extract(client, doc);
      const conflicts = [];
      for (const decision of incoming.decisions)
        conflicts.push(
          ...(await detectConflicts(client, doc, result.decisions, decision)),
        );
      const next = {
        ...result,
        supportingDocuments: [
          ...result.supportingDocuments.filter((d) => d.id !== doc.id),
          doc,
        ],
        conflicts: [...result.conflicts, ...conflicts],
      };
      set({
        result: next,
        replanning: false,
        notice: `已检查 ${incoming.decisions.length} 条补充决策，发现 ${conflicts.length} 项冲突。`,
      });
      persist(next);
    } catch (error) {
      set({
        replanning: false,
        error: error instanceof Error ? error.message : "补充决策分析失败。",
      });
    }
  },
  dismissNotice() {
    set({ notice: null });
  },
}));
