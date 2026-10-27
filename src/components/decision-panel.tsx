"use client";
import { useRef, useState } from "react";
import {
  BookOpen,
  AlertTriangle,
  Check,
  Upload,
  FlaskConical,
  ChevronDown,
} from "lucide-react";
import { useBlueprint } from "@/store";
import { SourceChip } from "./document-viewer";
export function DecisionPanel() {
  const result = useBlueprint((s) => s.result)!;
  const addDemo = useBlueprint((s) => s.addConflictDemo),
    upload = useBlueprint((s) => s.addDecisionDocument),
    busy = useBlueprint((s) => s.replanning);
  const input = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filtered = result.decisions.filter((d) =>
    `${d.topic} ${d.selected} ${d.reason} ${d.scope.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="insight-scroll">
      <div className="panel-intro">
        <div>
          <h2>记下决定，也记下为什么</h2>
          <p>只收录已确认的决策，不把建议当成定论。</p>
        </div>
        <span className="count-pill">{result.decisions.length} 项决策</span>
      </div>
      <div className="decision-controls">
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={13} />
          检查补充决策
        </button>
        <button
          className="text-button subtle"
          disabled={busy}
          onClick={() => void addDemo()}
        >
          <FlaskConical size={14} />
          加载冲突示例
        </button>
        <input
          type="file"
          accept=".md,.docx,.pdf,.txt"
          className="sr-only"
          ref={input}
          aria-label="上传补充决策文档"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
      <input
        className="decision-search"
        aria-label="检索决策档案"
        placeholder="搜索决策、理由或影响范围…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {result.conflicts.map((conflict) => {
        const previous = result.decisions.find(
          (d) => d.id === conflict.previousId,
        );
        return (
          <section className="conflict-card" key={conflict.id}>
            <h3>
              <AlertTriangle size={17} />
              发现决策冲突
            </h3>
            <p>{conflict.reason}</p>
            <div className="conflict-pair">
              <div>
                <span>历史决定 · {previous?.id}</span>
                <strong>{previous?.selected}</strong>
                <p>理由：{previous?.reason}</p>
                {previous?.source.map((s, i) => (
                  <SourceChip key={i} source={s} kind="decision" />
                ))}
              </div>
              <div>
                <span>补充决定 · {conflict.incoming.id}</span>
                <strong>{conflict.incoming.selected}</strong>
                <p>理由：{conflict.incoming.reason}</p>
                <div className="card-sources">
                  {conflict.incoming.source.map((source, index) => (
                    <SourceChip key={index} source={source} kind="decision" />
                  ))}
                </div>
                <blockquote>{conflict.incoming.source[0]?.quote}</blockquote>
              </div>
            </div>
            <p className="conflict-footnote">
              冲突预警不会自动覆盖历史决定，请由团队确认生效范围。
            </p>
          </section>
        );
      })}
      {result.decisions.length === 0 ? (
        <div className="empty-inline">
          <BookOpen size={28} />
          <h3>尚未识别到已确认决策</h3>
          <p>使用真实模型分析，或加载内置示例体验。</p>
        </div>
      ) : (
        <div className="decision-list">
          {filtered.map((d, i) => (
            <article className="decision-card" key={d.id}>
              <div className="decision-timeline-dot" />
              <div className="decision-meta">
                <span className="entity-id">{d.id}</span>
                <span className="decision-confirmed">
                  <Check size={11} />
                  {d.status === "confirmed"
                    ? "已确认"
                    : d.status === "proposed"
                      ? "提议"
                      : "已否决"}
                </span>
              </div>
              <h3>{d.topic}</h3>
              <strong className="decision-chosen">{d.selected}</strong>
              <div className="decision-reason">
                <span>选择的理由</span>
                <p>{d.reason || "文档未说明理由，待团队补充。"}</p>
              </div>
              <div className="decision-scope">
                {d.scope.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <div className="card-sources">
                {d.source.map((s, j) => (
                  <SourceChip key={j} source={s} kind="decision" />
                ))}
              </div>
              {(d.options.length > 0 || d.constraints.length > 0) && (
                <>
                  <button
                    className="text-button subtle"
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  >
                    查看约束与备选方案
                    <ChevronDown size={12} />
                  </button>
                  {expanded === d.id && (
                    <div className="decision-extra">
                      <p>约束：{d.constraints.join("；") || "未说明"}</p>
                      <p>参与人：{d.participants.join("、") || "文档未记录"}</p>
                      {d.options.length ? (
                        d.options.map((o, j) => (
                          <p key={j}>
                            {o.name}：优点 {o.pros || "未说明"}；缺点{" "}
                            {o.cons || "未说明"}
                          </p>
                        ))
                      ) : (
                        <p>文档未记录其他候选方案，系统不补造。</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="empty-inline">
              <p>没有匹配的决策，请更换关键词。</p>
            </div>
          )}
        </div>
      )}
      <div className="method-note">
        <BookOpen size={15} />
        <p>
          冲突检查采用“相关范围召回 →
          模型判定互斥”的两阶段流程。演示模式使用明确标注的固定冲突样例。
        </p>
      </div>
    </div>
  );
}
