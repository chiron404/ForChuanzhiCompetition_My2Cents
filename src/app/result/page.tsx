"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Download,
  ChevronDown,
  FileText,
  ScanLine,
  Network,
  Grid2X2,
  BookOpen,
  ListChecks,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  FileUp,
  X,
  RotateCcw,
} from "lucide-react";
import { useBlueprint } from "@/store";
import { computeCoverage } from "@/lib/quality";
import { downloadResult } from "@/lib/export";
import { isSample } from "@/lib/sample";
import { DocumentViewer, SourceChip } from "@/components/document-viewer";
import { GapPanel } from "@/components/gap-panel";
import { TaskPanel } from "@/components/task-panel";
import { CoveragePanel } from "@/components/coverage-panel";
import { DecisionPanel } from "@/components/decision-panel";

function ResultContent() {
  const params = useSearchParams(),
    tab = params.get("tab") ?? "gaps";
  const result = useBlueprint((s) => s.result),
    hydrated = useBlueprint((s) => s.hydrated),
    error = useBlueprint((s) => s.error),
    stage = useBlueprint((s) => s.stage),
    run = useBlueprint((s) => s.run);
  const [exportOpen, setExportOpen] = useState(false),
    [acknowledged, setAcknowledged] = useState(false),
    [mobileView, setMobileView] = useState("insights");
  const selected = useBlueprint((s) => s.selected);
  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 767px)").matches)
      setMobileView("document");
  }, [selected]);
  if (!hydrated)
    return (
      <main className="empty-page">
        <span className="pulse-dot" />
        <p>正在读取本机工作空间…</p>
      </main>
    );
  if (!result)
    return (
      <main className="empty-page">
        <div className="empty-illustration">
          <FileText size={32} />
        </div>
        <h1>你的第一份蓝图，从这里开始</h1>
        <p>上传一份需求文档，或用示例体验完整评审。</p>
        <div>
          <Link href="/" className="button primary">
            前往工作台
            <ArrowRight size={16} />
          </Link>
          <button
            className="button secondary"
            onClick={() => void useBlueprint.getState().load()}
          >
            试试示例文档
          </button>
        </div>
      </main>
    );
  const covered = computeCoverage(
    result.requirements,
    result.tasks,
    result.gaps,
  ).filter((r) => r.covered).length;
  const blocking = result.gaps.filter(
    (g) => g.severity === "blocking" && !g.resolution,
  ).length;
  const tabs = [
    {
      key: "gaps",
      title: "缺口审查",
      icon: ScanLine,
      count: result.gaps.length,
    },
    {
      key: "tasks",
      title: "任务蓝图",
      icon: Network,
      count: result.tasks.length,
    },
    { key: "coverage", title: "覆盖矩阵", icon: Grid2X2 },
    {
      key: "decisions",
      title: "决策档案",
      icon: BookOpen,
      count: result.decisions.length,
    },
    {
      key: "requirements",
      title: "需求",
      icon: ListChecks,
      count: result.requirements.length,
    },
  ];
  return (
    <main className="result-page">
      <div className="result-heading">
        <div>
          <Link href="/" className="back-link">
            <ArrowLeft size={13} />
            工作台
          </Link>
          <h1>{result.document.name.replace(/\.[^.]+$/, "")}</h1>
          <p>
            <span className="status-dot" />
            {stage === "error" ? "分析中断，已保留完成部分" : "分析完成"}
            <span>·</span>
            {result.document.paragraphs.length} 个原文段落<span>·</span>
            {result.mode === "mock"
              ? isSample(result.document)
                ? "固定示例数据"
                : "通用占位数据"
              : "真实模型分析"}
          </p>
        </div>
        <div className="result-actions">
          <button
            className="icon-button"
            title="重新分析（真实模式会调用模型）"
            aria-label="重新分析文档"
            onClick={() => void run(true)}
            disabled={["extract", "audit", "plan", "validate"].includes(stage)}
          >
            <RotateCcw size={17} />
          </button>
          <div className="export-wrap">
            <button
              className="button secondary small"
              onClick={() => setExportOpen(!exportOpen)}
            >
              <Download size={14} />
              导出报告
              <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button
                  onClick={() => {
                    downloadResult(result, "md");
                    setExportOpen(false);
                  }}
                >
                  Markdown 报告<span>.md</span>
                </button>
                <button
                  onClick={() => {
                    downloadResult(result, "json");
                    setExportOpen(false);
                  }}
                >
                  完整分析数据<span>.json</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="text-button" onClick={() => void run()}>
            重试失败阶段
            <RotateCcw size={13} />
          </button>
        </div>
      )}
      <div className="result-stats">
        <div>
          <span className="stat-icon indigo">
            <ListChecks size={18} />
          </span>
          <span>
            <small>已识别需求</small>
            <strong>
              {result.requirements.length}
              <em>条</em>
            </strong>
          </span>
          <span className="stat-hint">逐条关联原文</span>
        </div>
        <div>
          <span className="stat-icon amber">
            <ScanLine size={18} />
          </span>
          <span>
            <small>待确认缺口</small>
            <strong>
              {result.gaps.filter((g) => !g.resolution).length}
              <em>项</em>
            </strong>
          </span>
          <span className="stat-hint">{blocking} 项阻塞</span>
        </div>
        <div>
          <span className="stat-icon green">
            <Network size={18} />
          </span>
          <span>
            <small>可执行任务</small>
            <strong>
              {result.tasks.length}
              <em>项</em>
            </strong>
          </span>
          <span className="stat-hint">含验收与依赖</span>
        </div>
        <div>
          <span className="stat-icon blue">
            <Grid2X2 size={18} />
          </span>
          <span>
            <small>需求覆盖率</small>
            <strong>
              {result.requirements.length
                ? Math.round((covered / result.requirements.length) * 100)
                : 0}
              <em>%</em>
            </strong>
          </span>
          <span className="stat-hint">
            {covered}/{result.requirements.length} 已覆盖
          </span>
        </div>
      </div>
      {blocking > 0 && (
        <div className="blocking-banner">
          <AlertTriangle size={16} />
          <span>
            <strong>{blocking} 项阻塞问题尚未确认</strong>
            ，请在开工前与团队达成共识。
            {acknowledged && " 已选择继续查看，风险仍需处理。"}
          </span>
          {!acknowledged && (
            <button onClick={() => setAcknowledged(true)}>
              知悉风险，继续查看
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
      {result.mode === "mock" && !isSample(result.document) && (
        <div className="warning-box">
          当前内容为演示占位，尚未进行真实 AI
          审查。请配置服务端模型密钥后重新分析。
        </div>
      )}
      <div className="mobile-view-toggle segmented-control">
        <button
          className={mobileView === "document" ? "selected" : ""}
          onClick={() => setMobileView("document")}
        >
          原始文档
        </button>
        <button
          className={mobileView === "insights" ? "selected" : ""}
          onClick={() => setMobileView("insights")}
        >
          分析结果
        </button>
      </div>
      <div className={`analysis-workspace mobile-${mobileView}`}>
        <DocumentViewer />
        <section className="insight-panel">
          <div className="insight-tabs">
            {tabs.map((item) => (
              <Link
                href={`/result?tab=${item.key}`}
                key={item.key}
                className={tab === item.key ? "selected" : ""}
              >
                <item.icon size={14} />
                {item.title}
                {item.count !== undefined && <span>{item.count}</span>}
              </Link>
            ))}
          </div>
          {tab === "tasks" ? (
            <TaskPanel />
          ) : tab === "coverage" ? (
            <CoveragePanel />
          ) : tab === "decisions" ? (
            <DecisionPanel />
          ) : tab === "requirements" ? (
            <div className="insight-scroll">
              <div className="panel-intro">
                <div>
                  <h2>文档中明确提出的需求</h2>
                  <p>从功能与约束出发，不把背景和口号当成需求。</p>
                </div>
              </div>
              {result.requirements.map((r) => (
                <article className="requirement-card" key={r.id}>
                  <div className="gap-card-meta">
                    <span className="entity-id">{r.id}</span>
                    <span>
                      {r.category === "functional"
                        ? "功能需求"
                        : r.category === "constraint"
                          ? "约束"
                          : "非功能需求"}
                    </span>
                    <span className="completeness">
                      完备度 {r.completeness}/3
                    </span>
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.summary}</p>
                  <div className="card-sources">
                    {r.source.map((s, i) => (
                      <SourceChip key={i} source={s} kind="requirement" />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <GapPanel />
          )}
        </section>
      </div>
    </main>
  );
}
export default function ResultPage() {
  return (
    <Suspense fallback={<main className="empty-page">读取工作空间…</main>}>
      <ResultContent />
    </Suspense>
  );
}
