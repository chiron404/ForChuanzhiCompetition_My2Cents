"use client";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ArrowRight,
  SlidersHorizontal,
  EyeOff,
  Undo2,
} from "lucide-react";
import {
  categoryLabels,
  severityLabels,
  gapCategories,
  type Gap,
  type GapCategory,
} from "@/types";
import { useBlueprint } from "@/store";
import { SourceChip } from "./document-viewer";

function GapCard({ gap }: { gap: Gap }) {
  const [answer, setAnswer] = useState(""),
    [editing, setEditing] = useState(false),
    [expanded, setExpanded] = useState(false);
  const submit = useBlueprint((s) => s.answerGap);
  if (gap.resolution && !expanded)
    return (
      <article className="gap-card resolved">
        <button className="resolved-summary" onClick={() => setExpanded(true)}>
          <span className="resolved-check">
            <Check size={15} />
          </span>
          <span>
            <b>{gap.title}</b>
            <small>已补充 · {gap.resolution.answer}</small>
          </span>
          <ChevronDown size={16} />
        </button>
      </article>
    );
  return (
    <article
      className={`gap-card severity-${gap.severity} ${gap.resolution ? "resolved" : ""}`}
    >
      <div className="gap-card-meta">
        <span className={`severity-tag ${gap.severity}`}>
          {gap.resolution ? (
            <Check size={11} />
          ) : (
            <span className="status-dot" />
          )}
          {gap.resolution ? "已补充" : severityLabels[gap.severity]}
        </span>
        <span>{categoryLabels[gap.category]}</span>
        <span className="entity-id">{gap.id}</span>
      </div>
      <h3>{gap.title}</h3>
      <p className="gap-question">{gap.question}</p>
      <div className="why-box">
        <span>为什么需要确认</span>
        <p>{gap.why}</p>
      </div>
      <div className="suggestion-section">
        <div className="suggestion-label">
          参考答案<span>点击采纳，或填写你的约定</span>
        </div>
        {gap.suggestions.map((suggestion, i) => (
          <button
            key={i}
            className="suggestion-button"
            onClick={() => {
              submit(gap.id, suggestion);
              setEditing(false);
              setExpanded(false);
            }}
          >
            <span>{String.fromCharCode(65 + i)}</span>
            <span>{suggestion}</span>
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
      {gap.resolution && (
        <div className="answered-box">
          <Check size={13} />
          当前约定：{gap.resolution.answer}
        </div>
      )}
      {editing ? (
        <form
          className="answer-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (answer.trim()) {
              submit(gap.id, answer);
              setEditing(false);
              setExpanded(false);
            }
          }}
        >
          <textarea
            aria-label={`回答${gap.id}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="写下团队确认的规则、边界或处理方式…"
            required
            maxLength={3000}
          />
          <div>
            <button
              type="button"
              className="text-button subtle"
              onClick={() => setEditing(false)}
            >
              取消
            </button>
            <button
              className="button primary small"
              type="submit"
              disabled={!answer.trim()}
            >
              确认补充
              <Check size={14} />
            </button>
          </div>
        </form>
      ) : (
        <button
          className="write-answer"
          onClick={() => {
            setAnswer(gap.resolution?.answer ?? "");
            setEditing(true);
          }}
        >
          <MessageSquare size={14} />
          {gap.resolution ? "修改约定" : "填写我的答案"}
        </button>
      )}
      <div className="card-sources">
        {gap.source.map((s, i) => (
          <SourceChip key={i} source={s} />
        ))}
      </div>
    </article>
  );
}
export function GapPanel() {
  const result = useBlueprint((s) => s.result)!;
  const [category, setCategory] = useState<GapCategory | "all">("all"),
    [ignored, setIgnored] = useState<GapCategory[]>([]),
    [minor, setMinor] = useState(false),
    [resolved, setResolved] = useState(false);
  const filtered = result.gaps.filter(
    (g) =>
      (category === "all" || g.category === category) &&
      !ignored.includes(g.category),
  );
  const unanswered = filtered.filter((g) => !g.resolution);
  return (
    <div className="insight-scroll">
      <div className="panel-intro">
        <div>
          <h2>把问题，问在开工前</h2>
          <p>先确认关键约定，再生成可靠的任务蓝图。</p>
        </div>
        <span className="count-pill">
          {result.gaps.filter((g) => !g.resolution).length} 待确认
        </span>
      </div>
      <div className="filter-toolbar">
        <div className="select-wrap">
          <SlidersHorizontal size={13} />
          <select
            aria-label="筛选缺口类别"
            value={category}
            onChange={(e) => setCategory(e.target.value as GapCategory | "all")}
          >
            <option value="all">全部缺口类别</option>
            {gapCategories.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </div>
        {category !== "all" && (
          <button
            className="text-button subtle"
            onClick={() => setIgnored([...ignored, category])}
          >
            <EyeOff size={13} />
            忽略此类
          </button>
        )}
        <span>
          已补充 {result.gaps.filter((g) => g.resolution).length} /{" "}
          {result.gaps.length}
        </span>
      </div>
      {ignored.length > 0 && (
        <button
          className="ignored-note text-button"
          onClick={() => setIgnored([])}
        >
          <Undo2 size={13} />
          已隐藏 {ignored.length} 类问题，点击恢复（不会视为已解决）
        </button>
      )}
      {(["blocking", "major"] as const).map((severity) => {
        const gaps = unanswered.filter((g) => g.severity === severity);
        return (
          gaps.length > 0 && (
            <section key={severity} className="gap-group">
              <h4>
                <span className={`group-dot ${severity}`} />
                {severity === "blocking" ? "需要优先确认" : "建议开工前确认"}
                <span>{gaps.length}</span>
              </h4>
              {gaps.map((g) => (
                <GapCard key={g.id} gap={g} />
              ))}
            </section>
          )
        );
      })}
      {unanswered.some((g) => g.severity === "minor") && (
        <section className="gap-group">
          <button className="collapse-heading" onClick={() => setMinor(!minor)}>
            {minor ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            可以稍后补充
            <span>
              {unanswered.filter((g) => g.severity === "minor").length}
            </span>
          </button>
          {minor &&
            unanswered
              .filter((g) => g.severity === "minor")
              .map((g) => <GapCard key={g.id} gap={g} />)}
        </section>
      )}
      {filtered.some((g) => g.resolution) && (
        <section className="gap-group resolved-group">
          <button
            className="collapse-heading"
            onClick={() => setResolved(!resolved)}
          >
            {resolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Check size={14} />
            已确认的约定
            <span>{filtered.filter((g) => g.resolution).length}</span>
          </button>
          {resolved &&
            filtered
              .filter((g) => g.resolution)
              .map((g) => <GapCard key={g.id} gap={g} />)}
        </section>
      )}
      {unanswered.length === 0 && (
        <div className="panel-success">
          <Check size={25} />
          <h3>当前筛选下的问题已确认</h3>
          <p>可以前往任务蓝图，基于补充说明重新拆解。</p>
        </div>
      )}
    </div>
  );
}
