"use client";
import { useState } from "react";
import {
  Play,
  Check,
  ArrowUpRight,
  AlertCircle,
  FlaskConical,
  Clock3,
  FileText,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  createClient,
  getModelConfig,
  extract,
  audit,
  plan,
  finishAnalysis,
} from "@/lib/pipeline";
import { sampleDoc } from "@/lib/sample";
import { evaluate, type Evaluation } from "@/lib/quality";
import type { AnalysisResult } from "@/types";
import { useBlueprint } from "@/store";

export default function EvalPage() {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [choice, setChoice] = useState<"mock" | "live">("mock");
  const mode = useBlueprint((s) => s.mode);
  async function run() {
    setBusy(true);
    setError("");
    const start = performance.now();
    try {
      const config =
        choice === "mock"
          ? { mode: "mock" as const, configId: "eval" }
          : await getModelConfig();
      if (choice === "live" && config.mode !== "live")
        throw new Error("请先在服务端配置 LLM_API_KEY，再运行真实模型评测。");
      const client = createClient(config),
        doc = sampleDoc();
      setStatus("抽取需求与决策");
      const extracted = await extract(client, doc);
      setStatus("执行七类缺口审查");
      const gaps = await audit(client, doc, extracted.requirements);
      setStatus("生成任务与依赖");
      const planned = await plan(
        client,
        doc,
        extracted.requirements,
        gaps,
        "standard",
      );
      const result: AnalysisResult = finishAnalysis({
        version: 2,
        document: doc,
        ...extracted,
        gaps,
        tasks: planned.tasks,
        exclusions: planned.exclusions,
        conflicts: [],
        mode: config.mode,
        granularity: "standard",
        createdAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - start),
        logs: planned.logs,
        supportingDocuments: [],
      });
      setEvaluation(evaluate(result));
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "评测失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="eval-page">
      <div className="page-heading">
        <span className="eyebrow">
          <span className="eyebrow-line" />
          质量可见，改进有据
        </span>
        <span className="quiet-tag">EVALUATION LAB</span>
      </div>
      <div className="eval-heading">
        <div>
          <h1>
            经得起追问的 AI，
            <br />
            也经得起检验。
          </h1>
          <p>
            用公开的金标准，检查需求审查与任务拆解的质量。
            <br />
            展示命中的结果，也保留没有做好的地方。
          </p>
        </div>
        <div className="eval-symbol">
          <FlaskConical size={58} strokeWidth={1} />
          <span>MEASURE. LEARN. IMPROVE.</span>
        </div>
      </div>
      <section className="eval-dataset">
        <div className="dataset-icon">
          <FileText size={27} />
        </div>
        <div>
          <span className="eyebrow">内置评测集 A</span>
          <h2>校园二手交易平台 V2.0</h2>
          <p>12 条人工需求 · 9 个标注缺口 · 4 项已确认决策</p>
        </div>
        <div className="eval-run">
          <select
            aria-label="选择评测模式"
            value={choice}
            onChange={(e) => setChoice(e.target.value as "mock" | "live")}
            disabled={busy}
          >
            <option value="mock">演示管线自检</option>
            <option value="live">
              真实模型评测{mode !== "live" ? "（需配置 Key）" : ""}
            </option>
          </select>
          <button
            className="button primary"
            onClick={() => void run()}
            disabled={busy}
          >
            <Play size={15} />
            {busy ? "评测中…" : evaluation ? "重新运行评测" : "运行评测"}
          </button>
        </div>
      </section>
      <div className="eval-disclosure">
        <ShieldCheck size={17} />
        <div>
          <strong>分清演示可复现与模型真实能力</strong>
          <p>
            演示管线返回预置金标准，用于验证解析、校验与界面。其分数不能证明模型效果。真实模式会实际调用模型，结果按“类别
            + 原文区间”做一对一匹配，仍需人工复核语义。
          </p>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <div className="eval-running" role="status">
          <span className="pulse-dot" />
          {status}
        </div>
      )}
      <div className="section-title eval-section-title">
        <h2>质量指标</h2>
        <span>
          {evaluation
            ? `运行于 ${new Date(evaluation.at).toLocaleString("zh-CN", { timeZone: "Asia/Hong_Kong" })}`
            : "等待首次运行"}
        </span>
      </div>
      <div className="eval-metrics">
        {(
          evaluation?.metrics ?? [
            { label: "缺口召回率", target: 7 / 9 },
            { label: "缺口精确率", target: 0.6 },
            { label: "严重度准确率", target: 0.7 },
            { label: "需求覆盖率", target: 1 },
            { label: "任务溯源率", target: 1 },
            { label: "验收标准合格率", target: 0.9 },
          ]
        ).map((metric, i) => {
          const value = "value" in metric ? Number(metric.value) : null;
          return (
            <article className="eval-metric" key={metric.label}>
              <div>
                <span>{metric.label}</span>
                {value !== null && (
                  <span
                    className={`metric-status ${value >= metric.target ? "pass" : "fail"}`}
                  >
                    {value >= metric.target ? (
                      <Check size={12} />
                    ) : (
                      <AlertCircle size={12} />
                    )}
                  </span>
                )}
              </div>
              <strong>
                {value !== null ? Math.round(value * 100) : "—"}
                {value !== null && <small>%</small>}
              </strong>
              <div className="metric-track">
                <i
                  style={{ width: value !== null ? `${value * 100}%` : "0%" }}
                />
                <span style={{ left: `${metric.target * 99}%` }} />
              </div>
              <p>
                目标 ≥ {Math.round(metric.target * 100)}%
                <span>
                  {"detail" in metric ? String(metric.detail) : "尚未评测"}
                </span>
              </p>
            </article>
          );
        })}
      </div>
      {evaluation && (
        <div className="eval-run-meta">
          <span>
            <Clock3 size={14} />
            本次管线耗时 {evaluation.durationMs / 1000} 秒
          </span>
          <span>
            {evaluation.mode === "mock"
              ? "演示模式 · 固定数据"
              : "真实模型模式 · 实际调用"}
          </span>
          <span>规则版本 2.1</span>
        </div>
      )}
      <section className="eval-failures">
        <div className="section-title">
          <h2>失败案例与待改进项</h2>
          <span>
            {evaluation
              ? `${evaluation.failures.length} 项`
              : "完整保留，不隐藏"}
          </span>
        </div>
        {!evaluation ? (
          <div className="eval-empty">
            <FlaskConical size={24} />
            <p>运行评测后，这里会列出未检出的金标准与未匹配结果。</p>
          </div>
        ) : evaluation.failures.length ? (
          <ul>
            {evaluation.failures.map((f, i) => (
              <li key={i}>
                <AlertCircle size={15} />
                {f}
              </li>
            ))}
          </ul>
        ) : (
          <div className="eval-empty success">
            <Check size={24} />
            <p>
              {evaluation.mode === "mock"
                ? "本次演示管线通过固定样例自检。请运行真实模型评测以观察实际效果。"
                : "本次按区间匹配规则没有失败案例，请继续人工核对内容并扩充评测集。"}
            </p>
          </div>
        )}
      </section>
      <details className="evaluation-method">
        <summary>
          查看评测口径与局限
          <ChevronDown size={15} />
        </summary>
        <p>
          缺口采用一对一匹配：类别相同、原文区间重叠即视为命中，不使用预测编号匹配。严重度准确率以命中的缺口为分母。需求覆盖率以已抽取的需求为分母，因此无法单独暴露漏抽需求。验收合格率使用句式和空洞词规则，不能替代人工检验业务可执行性。当前只有一份人工构造样本，不能据此推断泛化能力。
        </p>
      </details>
    </main>
  );
}
