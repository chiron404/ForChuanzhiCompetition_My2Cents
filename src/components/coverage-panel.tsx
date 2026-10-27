"use client";
import { useState } from "react";
import { Check, Plus, X, AlertCircle, Grid2X2, ArrowRight } from "lucide-react";
import { useBlueprint } from "@/store";
import { computeCoverage, validAC } from "@/lib/quality";
import { SourceChip } from "./document-viewer";
import type { Requirement } from "@/types";

export function CoveragePanel() {
  const result = useBlueprint((s) => s.result)!;
  const addTask = useBlueprint((s) => s.addTask);
  const rows = computeCoverage(result.requirements, result.tasks, result.gaps);
  const uncovered = rows.filter((r) => !r.covered).length;
  const [selected, setSelected] = useState<Requirement | null>(null),
    [title, setTitle] = useState(""),
    [ac, setAc] = useState(""),
    [error, setError] = useState("");
  function open(req: Requirement) {
    setSelected(req);
    setTitle(`实现${req.title}`);
    setAc(
      `[测试账号与样例数据已准备] 当执行“${req.title}”的有效操作时，系统返回需求约定的结果，页面显示结果且记录可再次查询。`,
    );
    setError("");
  }
  return (
    <div className="insight-scroll">
      <div className="panel-intro">
        <div>
          <h2>每条需求，都有着落</h2>
          <p>依据任务关联与原文区间计算，覆盖关系可核对。</p>
        </div>
        <span className={`coverage-score ${uncovered ? "incomplete" : ""}`}>
          {rows.length
            ? Math.round(((rows.length - uncovered) / rows.length) * 100)
            : 0}
          <small>%</small>
        </span>
      </div>
      <div className={uncovered ? "warning-box" : "coverage-success"}>
        {uncovered ? <AlertCircle size={18} /> : <Check size={18} />}
        <div>
          <strong>
            {uncovered
              ? `${uncovered} 条需求尚未覆盖`
              : "全部已抽取需求均有对应任务"}
          </strong>
          <p>
            {uncovered
              ? "点击红格查看原文并手动补充任务。"
              : "这不代表没有漏抽需求；请同时核对原文与需求清单。"}
          </p>
        </div>
      </div>
      <div className="matrix-legend">
        <span>
          <i className="covered" />
          有任务覆盖
        </span>
        <span>
          <i className="uncovered" />
          需求未覆盖
        </span>
        <span>
          <i />
          无关联
        </span>
      </div>
      <div className="matrix-scroll">
        <table className="coverage-matrix">
          <thead>
            <tr>
              <th>需求 / 任务</th>
              {result.tasks.map((t) => (
                <th key={t.id} title={t.title}>
                  {t.id.replace("T-", "T")}
                </th>
              ))}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {result.requirements.map((req) => {
              const row = rows.find((r) => r.requirementId === req.id)!;
              return (
                <tr key={req.id}>
                  <th>
                    <button
                      onClick={() =>
                        useBlueprint
                          .getState()
                          .select(req.source[0], "requirement")
                      }
                    >
                      <span>{req.id}</span>
                      {req.title}
                    </button>
                  </th>
                  {result.tasks.map((t) => (
                    <td key={t.id}>
                      <button
                        className={`matrix-cell ${row.taskIds.includes(t.id) ? "covered" : !row.covered ? "uncovered" : ""}`}
                        title={
                          row.taskIds.includes(t.id)
                            ? `${req.title} → ${t.title}`
                            : !row.covered
                              ? "此需求尚未覆盖，点击补任务"
                              : "此任务与该需求无关联"
                        }
                        aria-label={`${req.id} 与 ${t.id}：${row.taskIds.includes(t.id) ? "已关联" : !row.covered ? "未覆盖，补充任务" : "无关联"}`}
                        onClick={() =>
                          row.taskIds.includes(t.id)
                            ? useBlueprint
                                .getState()
                                .select(t.source[0], "task")
                            : open(req)
                        }
                      >
                        {row.taskIds.includes(t.id) ? (
                          <Check size={10} />
                        ) : !row.covered ? (
                          <Plus size={10} />
                        ) : null}
                      </button>
                    </td>
                  ))}
                  <td>
                    <button
                      className="add-task-link"
                      aria-label={`为${req.id}补充任务`}
                      onClick={() => open(req)}
                    >
                      <Plus size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="coverage-list">
        <h4>逐条核对</h4>
        {result.requirements.map((req) => {
          const row = rows.find((r) => r.requirementId === req.id)!;
          return (
            <div key={req.id} className="coverage-row">
              <span
                className={`coverage-row-icon ${row.covered ? "yes" : "no"}`}
              >
                {row.covered ? <Check size={13} /> : <AlertCircle size={13} />}
              </span>
              <div>
                <strong>
                  {req.id} · {req.title}
                </strong>
                <span>
                  {row.covered
                    ? row.taskIds.join("、")
                    : "尚无任务；请补充或记录不实现原因"}
                </span>
              </div>
              <button className="text-button" onClick={() => open(req)}>
                <Plus size={13} />
                补任务
              </button>
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="modal-scrim" onClick={() => setSelected(null)}>
          <section
            className="modal task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-task-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="关闭补充任务"
              onClick={() => setSelected(null)}
            >
              <X size={19} />
            </button>
            <span className="eyebrow">补齐需求覆盖</span>
            <h2 id="add-task-heading">为 {selected.id} 补充一项任务</h2>
            <blockquote>{selected.summary}</blockquote>
            <SourceChip source={selected.source[0]} kind="requirement" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!validAC(ac)) {
                  setError(
                    "请按格式填写：[前置条件] 当 … 时，系统 …，可观测结果",
                  );
                  return;
                }
                addTask(selected.id, title.trim(), ac.trim());
                setSelected(null);
              }}
            >
              <label>
                任务标题
                <input
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                验收标准
                <textarea
                  required
                  value={ac}
                  onChange={(e) => setAc(e.target.value)}
                  rows={4}
                />
              </label>
              {error && <p className="field-error">{error}</p>}
              <button
                className="button primary"
                type="submit"
                disabled={!title.trim()}
              >
                补充任务并更新覆盖
                <ArrowRight size={15} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
