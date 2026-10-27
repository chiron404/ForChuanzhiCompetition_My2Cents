"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  LayoutDashboard,
  ScanLine,
  Network,
  Grid2X2,
  BookOpen,
  ChartNoAxesCombined,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  ShieldCheck,
  CircleHelp,
  X,
  CheckCheck,
  ArrowRight,
  FileText,
} from "lucide-react";
import { useBlueprint } from "@/store";
import { getModelConfig } from "@/lib/pipeline";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-icon">
        <svg width="25" height="25" viewBox="0 0 28 28" fill="none">
          <path
            d="M5 5h13v13H5zM10 10h13v13H10z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M5 11h5M17 5v5M23 17h-5M11 23v-5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      </span>
      <span>
        蓝图 <span className="brand-english">Blueprint</span>
      </span>
    </span>
  );
}
function Navigation() {
  const path = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "gaps";
  const [open, setOpen] = useState(false);
  const result = useBlueprint((s) => s.result);
  const links = [
    { href: "/", icon: LayoutDashboard, label: "工作台", active: path === "/" },
    {
      href: "/result?tab=gaps",
      icon: ScanLine,
      label: "需求评审",
      active: path === "/result" && (tab === "gaps" || tab === "requirements"),
      badge: result?.gaps.filter((g) => !g.resolution).length,
    },
    {
      href: "/result?tab=tasks",
      icon: Network,
      label: "任务蓝图",
      active: path === "/result" && tab === "tasks",
    },
    {
      href: "/result?tab=coverage",
      icon: Grid2X2,
      label: "覆盖矩阵",
      active: path === "/result" && tab === "coverage",
    },
    {
      href: "/result?tab=decisions",
      icon: BookOpen,
      label: "决策档案",
      active: path === "/result" && tab === "decisions",
    },
  ];
  return (
    <>
      <button
        className="mobile-menu icon-button"
        aria-label="打开导航"
        onClick={() => setOpen(!open)}
      >
        <PanelLeftOpen size={21} />
      </button>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href="/" aria-label="蓝图工作台" className="brand-link">
          <Brand />
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">B</span>
          <span>
            个人工作空间<small>本机存储 · 无需注册</small>
          </span>
        </div>
        <div className="nav-label">工作空间</div>
        <nav>
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`nav-item ${item.active ? "active" : ""}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {!!item.badge && <b className="nav-badge">{item.badge}</b>}
              {item.active && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-label tools-label">验证与评估</div>
        <Link
          href="/eval"
          onClick={() => setOpen(false)}
          className={`nav-item ${path === "/eval" ? "active" : ""}`}
        >
          <ChartNoAxesCombined size={18} />
          <span>评测台</span>
          <span className="beta-label">LAB</span>
        </Link>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-star">✳</span>
            <strong>让每一个结论，有据可循。</strong>
            <p>
              AI 负责发现与生成，
              <br />
              你始终掌握最终决定权。
            </p>
          </div>
          <div className="sidebar-footer">
            <span>
              <span className="status-dot" />
              本地工作空间
            </span>
            <span>V2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
function Header() {
  const path = usePathname();
  const mode = useBlueprint((s) => s.mode);
  const [help, setHelp] = useState(false);
  return (
    <>
      <header className="app-header">
        <div className="breadcrumb">
          工作空间<span>/</span>
          <strong>
            {path === "/eval"
              ? "质量评测"
              : path === "/result"
                ? "文档分析"
                : "概览"}
          </strong>
        </div>
        <div className="header-right">
          <span className="privacy">
            <ShieldCheck size={14} />
            文件在浏览器内解析
          </span>
          <span className={`mode-tag ${mode}`}>
            <span className="status-dot" />
            {mode === "mock" ? "演示模式" : "真实模型"}
          </span>
          <button
            className="icon-button help-button"
            aria-label="使用说明"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={18} />
          </button>
          <span className="profile-avatar">BP</span>
        </div>
      </header>
      {help && (
        <div className="modal-scrim" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="关闭说明"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">快速上手</span>
            <h2 id="help-title">从需求文档，到任务蓝图</h2>
            <ol className="help-steps">
              <li>上传 PDF、DOCX、Markdown，或点击示例文档。</li>
              <li>逐条回答阻塞缺口，点击出处核对原文。</li>
              <li>重新拆解任务，检查覆盖矩阵并补齐遗漏。</li>
              <li>查看决策记录，导出完整报告。</li>
            </ol>
            <p className="muted">
              演示模式：内置示例使用固定数据，其他文档仅提供通用占位。配置服务端
              LLM_API_KEY 后启用真实分析；文本片段会经服务端发送至模型服务。
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              开始使用
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
function Progress() {
  const stage = useBlueprint((s) => s.stage);
  const message = useBlueprint((s) => s.stageMessage);
  const replanning = useBlueprint((s) => s.replanning);
  const steps = [
    ["parse", "解析文档"],
    ["extract", "抽取需求"],
    ["audit", "审查缺口"],
    ["plan", "拆解任务"],
    ["validate", "一致性校验"],
  ];
  const index = steps.findIndex((s) => s[0] === stage);
  if (index < 0 && !replanning) return null;
  return (
    <section className="progress-banner" aria-live="polite">
      <div className="progress-title">
        <span className="pulse-dot" />
        {replanning ? "仅重新拆解" : message}
        <small>{replanning ? "复用需求与缺口结果" : `${index + 1} / 5`}</small>
      </div>
      {!replanning && (
        <div className="progress-steps">
          {steps.map(([key, label], i) => (
            <span
              key={key}
              className={i < index ? "complete" : i === index ? "current" : ""}
            >
              <b>{i < index ? <CheckCheck size={12} /> : i + 1}</b>
              {label}
              {i < 4 && <i />}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useBlueprint((s) => s.hydrate);
  const notice = useBlueprint((s) => s.notice);
  const dismiss = useBlueprint((s) => s.dismissNotice);
  useEffect(() => {
    void hydrate();
    void getModelConfig()
      .then((config) => useBlueprint.setState({ mode: config.mode }))
      .catch(() => {});
  }, [hydrate]);
  return (
    <div className="app-shell">
      <Suspense>
        <Navigation />
      </Suspense>
      <div className="main-shell">
        <Header />
        <Progress />
        {children}
        <footer className="page-footer">
          <span>
            蓝图 Blueprint <span>·</span> 把需求想清楚，让项目走更远。
          </span>
          <span>AI 生成结果需人工确认</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={dismiss}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
