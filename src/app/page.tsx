"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Upload,
  FileText,
  ScanLine,
  Network,
  Link2,
  ShieldCheck,
  Check,
  Braces,
  FileUp,
  Sparkles,
  ChevronRight,
  Clock3,
  X,
  FolderOpen,
} from "lucide-react";
import { useBlueprint } from "@/store";
import { importAnalysis } from "@/lib/export";

export default function Home() {
  const input = useRef<HTMLInputElement>(null),
    jsonInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [drag, setDrag] = useState(false),
    [localError, setLocalError] = useState<string | null>(null);
  const load = useBlueprint((s) => s.load),
    stage = useBlueprint((s) => s.stage),
    error = useBlueprint((s) => s.error),
    result = useBlueprint((s) => s.result);
  const busy = ["parse", "extract", "audit", "plan", "validate"].includes(
    stage,
  );
  async function analyze(file?: File) {
    setLocalError(null);
    const previous = useBlueprint.getState().result;
    await load(file);
    const current = useBlueprint.getState().result;
    if (current && current !== previous) router.push("/result?tab=gaps");
  }
  async function onImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024)
        throw new Error("导入文件不能超过 30 MB。");
      const value: unknown = JSON.parse(await file.text());
      await useBlueprint.getState().importResult(importAnalysis(value));
      router.push("/result");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "结果导入失败。");
    }
  }
  return (
    <main className="home-page">
      <div className="page-heading">
        <span className="eyebrow">
          <span className="eyebrow-line" />
          AI 驱动的需求工作空间
        </span>
        <span className="quiet-tag">从需求，到行动</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            好项目，
            <br />从<span>问清楚</span>开始
            <span className="heading-period">。</span>
          </h1>
          <p>
            把一份需求文档，变成一份有据可循的行动蓝图。
            <br />
            发现模糊与遗漏，澄清关键问题，让团队从容开工。
          </p>
          <div className="hero-points">
            <span>
              <Check size={14} />
              七类缺口审查
            </span>
            <span>
              <Check size={14} />
              原文一键溯源
            </span>
            <span>
              <Check size={14} />
              可执行任务拆解
            </span>
          </div>
        </div>
        <div
          className="blueprint-visual"
          aria-label="从文档经审查生成任务蓝图的示意图"
        >
          <div className="blueprint-grid" />
          <span className="drawing-label">BLUEPRINT / WORKFLOW 01</span>
          <div className="visual-ruler ruler-top" />
          <div className="visual-ruler ruler-left" />
          <div className="mini-document">
            <div className="mini-doc-header">
              <FileText size={15} />
              <span>产品需求文档.md</span>
              <span>···</span>
            </div>
            <div className="mini-text-line long" />
            <div className="mini-text-line" />
            <div className="mini-highlight">
              卖家可上传商品图片<span>?</span>
            </div>
            <div className="mini-text-line long" />
            <div className="mini-text-line short" />
            <div className="mini-doc-footer">
              <span className="status-dot" />
              正在发现更多可能
            </div>
          </div>
          <div className="visual-connector">
            <i />
            <ArrowRight size={15} />
            <i />
          </div>
          <div className="mini-review">
            <div>
              <span className="mini-icon">
                <ScanLine size={16} />
              </span>
              <strong>先审查，再开工</strong>
            </div>
            <span className="mini-review-label">把隐含问题变成明确约定</span>
            <div className="mini-task">
              <Check size={13} />
              <span>明确图片上传边界</span>
              <span className="mini-task-role">产品</span>
            </div>
            <div className="mini-task">
              <Network size={13} />
              <span>生成任务与验收标准</span>
              <span className="mini-task-role">开发</span>
            </div>
          </div>
          <span className="drawing-dimension">每一步，都能回到原文 ↗</span>
          <span className="drawing-cross cross-one">+</span>
          <span className="drawing-cross cross-two">+</span>
        </div>
      </section>
      {(localError || error) && (
        <div className="error-banner" role="alert">
          <span>{localError || error}</span>
          <button
            className="text-button"
            onClick={() => input.current?.click()}
          >
            重新选择文件
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      <section className="start-section">
        <div className="section-title">
          <h2>开始绘制你的蓝图</h2>
          <button
            className="text-button subtle"
            onClick={() => jsonInput.current?.click()}
            disabled={busy}
          >
            <FolderOpen size={15} />
            导入分析结果
          </button>
        </div>
        <div className="start-grid">
          <button
            className={`upload-zone ${drag ? "dragging" : ""}`}
            disabled={busy}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const file = e.dataTransfer.files[0];
              if (file) void analyze(file);
            }}
            onClick={() => input.current?.click()}
          >
            <span className="upload-icon">
              <Upload size={25} strokeWidth={1.6} />
              <span className="upload-plus">+</span>
            </span>
            <strong>
              {busy ? "正在绘制你的蓝图…" : "拖入需求文档，或点击上传"}
            </strong>
            <span className="upload-subtitle">
              让 AI 帮你找到那些“想当然”的地方
            </span>
            <span className="file-formats">
              <span>
                <FileText size={12} />
                PDF
              </span>
              <span>
                <FileText size={12} />
                DOCX
              </span>
              <span>
                <Braces size={12} />
                Markdown
              </span>
              <i />
              单文件最大 20 MB
            </span>
          </button>
          <div className="sample-card">
            <div className="sample-card-top">
              <span className="eyebrow">没有文档？先试一份</span>
              <span className="sample-badge">内置示例</span>
            </div>
            <span className="sample-file-icon">
              <FileText size={25} />
              <span>MD</span>
            </span>
            <h3>校园二手交易平台</h3>
            <p>
              一份并不完美的 PRD，
              <br />
              一次看得见价值的需求评审。
            </p>
            <button
              className="button primary sample-button"
              disabled={busy}
              onClick={() => void analyze()}
            >
              {busy ? "分析中…" : "试试示例文档"}
              <ArrowRight size={17} />
            </button>
            <div className="sample-meta">
              <Clock3 size={12} />
              无需配置 API Key · 本地即可体验
            </div>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt"
          className="sr-only"
          aria-label="上传需求文档"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void analyze(file);
            e.target.value = "";
          }}
        />
        <input
          ref={jsonInput}
          type="file"
          accept=".json"
          className="sr-only"
          aria-label="导入 JSON 分析结果"
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="upload-privacy">
          <ShieldCheck size={13} />
          原始文件留在你的浏览器；真实模型模式仅发送必要文本片段。
        </p>
      </section>
      {result && (
        <Link className="recent-result" href="/result">
          <span className="recent-icon">
            <FileText size={19} />
          </span>
          <div>
            <strong>继续上次的分析</strong>
            <span>
              {result.document.name} · {result.requirements.length} 条需求 ·{" "}
              {result.tasks.length} 项任务
            </span>
          </div>
          <ArrowUpRight size={18} />
        </Link>
      )}
      <section className="workflow-section">
        <div className="section-title">
          <h2>不止读懂文档，更让它落地</h2>
          <span>一条完整的需求闭环</span>
        </div>
        <div className="workflow-grid">
          {[
            {
              icon: ScanLine,
              n: "01",
              title: "把问题问在前面",
              description:
                "七类缺口逐一审查，把开发中的意外，变成开工前的共识。",
            },
            {
              icon: Network,
              n: "02",
              title: "把需求变成行动",
              description:
                "生成带验收标准、工时与依赖的任务，知道做什么，也知道怎样算做完。",
            },
            {
              icon: Link2,
              n: "03",
              title: "让每一步有据可循",
              description:
                "任务回溯原文，矩阵检查遗漏，决策留下理由。结论随时可以核对。",
            },
          ].map((step, i) => (
            <div className="workflow-step" key={step.n}>
              <div className="workflow-step-top">
                <step.icon size={19} />
                <span>{step.n}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {i < 2 && <ChevronRight className="workflow-arrow" size={15} />}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
