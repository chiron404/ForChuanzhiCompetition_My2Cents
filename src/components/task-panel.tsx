"use client";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Network,
  Trash2,
  ArrowRight,
  RotateCcw,
  CheckSquare2,
  Link2,
} from "lucide-react";
import { roleLabels, type TaskNode, type Granularity } from "@/types";
import { useBlueprint } from "@/store";
import { SourceChip } from "./document-viewer";

function DependencyGraph({ tasks }: { tasks: TaskNode[] }) {
  if (!tasks.length) return null;
  const levels = [...new Set(tasks.map((t) => t.level))].sort((a, b) => a - b);
  const rows = levels.map((level) => tasks.filter((t) => t.level === level));
  const height = Math.max(...rows.map((r) => r.length)) * 48 + 36;
  const width = levels.length * 170;
  const positions = new Map(
    tasks.map((task) => {
      const level = levels.indexOf(task.level),
        row = rows[level].findIndex((t) => t.id === task.id);
      return [task.id, { x: level * 170 + 10, y: row * 48 + 30 }];
    }),
  );
  return (
    <div className="dependency-graph">
      <div className="graph-heading">
        <Network size={14} />
        依赖关系图<span>按拓扑层级排列</span>
      </div>
      <div className="graph-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label="任务依赖关系分层图"
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6" fill="none" stroke="#a5b4fc" />
            </marker>
          </defs>
          {levels.map((level, i) => (
            <text
              key={level}
              x={i * 170 + 10}
              y={14}
              className="graph-level-label"
            >
              L{level} ·{" "}
              {i === 0
                ? "基础准备"
                : i === levels.length - 1
                  ? "交付验证"
                  : "功能实施"}
            </text>
          ))}
          {tasks.flatMap((t) =>
            t.deps.map((dep) => {
              const a = positions.get(dep),
                b = positions.get(t.id);
              if (!a || !b) return null;
              return (
                <path
                  className="dependency-line"
                  key={`${dep}-${t.id}`}
                  d={`M${a.x + 135},${a.y + 16} C${a.x + 154},${a.y + 16} ${b.x - 19},${b.y + 16} ${b.x - 3},${b.y + 16}`}
                  stroke="#b5bdf0"
                  strokeWidth="1.2"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              );
            }),
          )}
          {tasks.map((t) => {
            const p = positions.get(t.id)!;
            return (
              <g key={t.id}>
                <rect
                  x={p.x}
                  y={p.y}
                  width="135"
                  height="32"
                  rx="5"
                  fill="white"
                  stroke="#dce1ef"
                />
                <text
                  x={p.x + 8}
                  y={p.y + 20}
                  fill="#6366f1"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {t.id}
                </text>
                <text x={p.x + 43} y={p.y + 20} fill="#526078" fontSize="9">
                  {t.title.slice(0, 8)}
                  {t.title.length > 8 ? "…" : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
function TaskCard({ task }: { task: TaskNode }) {
  const [expanded, setExpanded] = useState(false),
    [confirm, setConfirm] = useState(false);
  const remove = useBlueprint((s) => s.removeTask);
  return (
    <article className="task-card">
      <button className="task-summary" onClick={() => setExpanded(!expanded)}>
        <span className="task-number">{task.id}</span>
        <div>
          <h3>{task.title}</h3>
          <div className="task-meta">
            <span className={`role-tag role-${task.role}`}>
              {roleLabels[task.role]}
            </span>
            <span>
              <Clock3 size={11} />
              {task.effort} 人日
            </span>
            <span>{task.acceptanceCriteria.length} 条验收标准</span>
          </div>
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {expanded && (
        <div className="task-detail">
          <p>{task.description}</p>
          <div className="task-ac">
            <strong>
              <CheckSquare2 size={13} />
              验收标准
            </strong>
            {task.acceptanceCriteria.map((ac, i) => (
              <p key={i}>
                <span>{i + 1}</span>
                {ac}
              </p>
            ))}
          </div>
          <div className="task-links">
            <span>
              前置依赖 <b>{task.deps.join("、") || "无 · 可直接开始"}</b>
            </span>
            <span>
              关联需求 <b>{task.requirementIds.join("、")}</b>
            </span>
            <span>
              模型置信度{" "}
              <b>{Math.round(task.confidence * 100)}% · 非校准概率</b>
            </span>
            {task.derivedFromGap.length > 0 && (
              <span>
                采用补充 <b>{task.derivedFromGap.join("、")}</b>
              </span>
            )}
          </div>
          <div className="card-sources">
            {task.source.map((s, i) => (
              <SourceChip key={i} source={s} kind="task" />
            ))}
          </div>
          {confirm ? (
            <div className="remove-confirm">
              <span>移除后可能出现未覆盖需求。</span>
              <button
                className="text-button danger"
                onClick={() => remove(task.id)}
              >
                确认移除
              </button>
              <button
                className="text-button subtle"
                onClick={() => setConfirm(false)}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              className="text-button subtle task-remove"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={12} />
              移除此任务
            </button>
          )}
        </div>
      )}
    </article>
  );
}
export function TaskPanel() {
  const result = useBlueprint((s) => s.result)!;
  const replan = useBlueprint((s) => s.replan),
    busy = useBlueprint((s) => s.replanning),
    granularity = useBlueprint((s) => s.granularity),
    dirty = useBlueprint((s) => s.dirty);
  const levels = [...new Set(result.tasks.map((t) => t.level))].sort(
    (a, b) => a - b,
  );
  return (
    <div className="insight-scroll">
      <div className="panel-intro">
        <div>
          <h2>从需求，到可以开工</h2>
          <p>任务有依据，交付有标准，先后有次序。</p>
        </div>
        <span className="count-pill">{result.tasks.length} 项任务</span>
      </div>
      <div className="task-controls">
        <div className="segmented-control">
          {(
            [
              ["brief", "概览"],
              ["standard", "标准"],
              ["detailed", "详细"],
            ] as [Granularity, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={granularity === key ? "selected" : ""}
              disabled={busy}
              onClick={() => {
                if (granularity !== key) void replan(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void replan()}
        >
          <RotateCcw size={13} />
          {busy ? "正在重新拆解…" : "重新拆解"}
        </button>
      </div>
      {dirty && (
        <div className="info-banner">
          已有新的缺口答复。点击“重新拆解”将确认的约定纳入任务。
        </div>
      )}
      <div className="task-totals">
        <span>
          总工时 <b>{result.tasks.reduce((s, t) => s + t.effort, 0)}</b> 人日
        </span>
        <span>
          <b>{levels.length}</b> 个依赖层级
        </span>
        <span>仅重跑拆解阶段</span>
      </div>
      <DependencyGraph tasks={result.tasks} />
      {levels.map((level) => (
        <section className="task-level" key={level}>
          <h4>
            <span>L{level}</span>
            {level === 0
              ? "基础与准备"
              : level === levels.at(-1)
                ? "依赖就绪后执行"
                : "功能实施"}
            <small>
              {result.tasks.filter((t) => t.level === level).length} 项
            </small>
          </h4>
          {result.tasks
            .filter((t) => t.level === level)
            .map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
        </section>
      ))}
      {result.exclusions.length > 0 && (
        <div className="warning-box">
          <strong>需要人工补充</strong>
          {result.exclusions.map((e) => (
            <p key={e.requirementId}>
              {e.requirementId}：{e.reason}
            </p>
          ))}
        </div>
      )}
      {result.logs.length > 0 && (
        <details className="quality-logs">
          <summary>查看校验与修正记录（{result.logs.length}）</summary>
          {result.logs.map((log, index) => (
            <p key={index}>{log}</p>
          ))}
        </details>
      )}
    </div>
  );
}
