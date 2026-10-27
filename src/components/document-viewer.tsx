"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Search, LocateFixed, X, Link2 } from "lucide-react";
import { useBlueprint } from "@/store";
import type { SourceRef } from "@/types";

export function SourceChip({
  source,
  kind = "gap",
}: {
  source: SourceRef;
  kind?: "gap" | "task" | "requirement" | "decision";
}) {
  const select = useBlueprint((s) => s.select);
  return (
    <button
      className={`source-chip ${kind}`}
      onClick={() => select(source, kind)}
      title={source.quote}
    >
      <Link2 size={12} />
      {source.docName.length > 20
        ? source.docName.slice(0, 18) + "…"
        : source.docName}
      <span>·</span>
      {source.locator.kind === "page"
        ? `第 ${source.locator.index} 页`
        : `段落 ${source.locator.index}`}
      <span>↗</span>
    </button>
  );
}
export function DocumentViewer() {
  const doc = useBlueprint((s) => s.doc),
    selected = useBlueprint((s) => s.selected),
    result = useBlueprint((s) => s.result);
  const [search, setSearch] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    [visited, setVisited] = useState<{ source: SourceRef; kind: string }[]>([]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setVisited([]);
  }, [doc?.id]);
  useEffect(() => {
    if (!selected) return;
    setVisited((prev) => [
      ...prev.filter(
        (v) =>
          !(
            v.source.offset.start === selected.source.offset.start &&
            v.kind === selected.kind
          ),
      ),
      selected,
    ]);
    const p = doc?.paragraphs.find(
      (p) =>
        p.start <= selected.source.offset.start &&
        selected.source.offset.start < p.end,
    );
    if (p)
      root.current
        ?.querySelector(`[data-paragraph="${p.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected, doc]);
  if (!doc) return null;
  const matches = doc.paragraphs.filter(
    (p) => search && p.text.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="document-panel">
      <div className="panel-toolbar">
        <span>
          <FileText size={15} />
          原始文档
        </span>
        <div>
          <span className="doc-type">{doc.type.toUpperCase()}</span>
          <button
            className="icon-button"
            aria-label="搜索原文"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={15} />
          </button>
        </div>
      </div>
      {showSearch && (
        <div className="document-search">
          <Search size={14} />
          <input
            aria-label="搜索原文内容"
            value={search}
            placeholder="搜索原文…"
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>{search ? `${matches.length} 处` : ""}</span>
          <button
            className="icon-button"
            aria-label="关闭搜索"
            onClick={() => {
              setSearch("");
              setShowSearch(false);
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {result && result.supportingDocuments.length > 0 && (
        <div className="document-picker">
          <select
            aria-label="切换原文文档"
            value={doc.id}
            onChange={(e) => {
              const chosen = [
                result.document,
                ...result.supportingDocuments,
              ].find((d) => d.id === e.target.value);
              if (chosen)
                useBlueprint.setState({ doc: chosen, selected: null });
            }}
          >
            {[result.document, ...result.supportingDocuments].map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="document-content" ref={root}>
        <div className="document-paper">
          <div className="paper-topline">
            <span>原文 / SOURCE DOCUMENT</span>
            <span>
              {doc.pages} {doc.type === "pdf" ? "页" : "份文档"}
            </span>
          </div>
          {doc.paragraphs.map((p, i) => {
            const refs = visited.filter(
              (v) =>
                v.source.offset.start < p.end && v.source.offset.end > p.start,
            );
            const active =
              selected &&
              selected.source.offset.start < p.end &&
              selected.source.offset.end > p.start;
            const kinds = [...new Set(refs.map((r) => r.kind))];
            const boundaries = new Set([p.start, p.end]);
            refs.forEach((r) => {
              boundaries.add(Math.max(p.start, r.source.offset.start));
              boundaries.add(Math.min(p.end, r.source.offset.end));
            });
            if (search) {
              let pos = p.text.toLowerCase().indexOf(search.toLowerCase());
              while (pos >= 0) {
                boundaries.add(p.start + pos);
                boundaries.add(p.start + pos + search.length);
                pos = p.text
                  .toLowerCase()
                  .indexOf(search.toLowerCase(), pos + search.length);
              }
            }
            const sorted = [...boundaries].sort((a, b) => a - b);
            return (
              <div
                key={`${p.id}-${active ? selected?.nonce : ""}`}
                data-paragraph={p.id}
                className={`document-paragraph ${p.heading ? "document-h" + p.heading : ""} ${active ? "source-active" : ""} ${kinds.map((k) => "marked-" + k).join(" ")}`}
              >
                <span className="paragraph-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  {sorted.slice(0, -1).map((start, index) => {
                    const end = sorted[index + 1];
                    const text = doc.text.slice(start, end);
                    const colours = refs
                      .filter(
                        (r) =>
                          r.source.offset.start < end &&
                          r.source.offset.end > start,
                      )
                      .map((r) => r.kind);
                    const searchHit =
                      !!search && text.toLowerCase() === search.toLowerCase();
                    return colours.length || searchHit ? (
                      <mark
                        key={start}
                        className={`${colours.map((c) => "highlight-" + c).join(" ")} ${searchHit ? "highlight-search" : ""}`}
                        style={
                          colours.length > 1
                            ? {
                                boxShadow: `inset 0 -3px ${colours.includes("task") ? "#22c55e" : "#6366f1"}, inset 0 3px ${colours.includes("gap") ? "#fb7185" : "#fbbf24"}`,
                              }
                            : {}
                        }
                      >
                        {text}
                      </mark>
                    ) : (
                      <span key={start}>{text}</span>
                    );
                  })}
                </div>
                {active && (
                  <LocateFixed size={12} className="paragraph-locator" />
                )}
              </div>
            );
          })}
          <div className="paper-end">— 文档结束 —</div>
        </div>
      </div>
      <div className="document-legend">
        <span>
          <i className="legend-blue" />
          需求
        </span>
        <span>
          <i className="legend-red" />
          缺口
        </span>
        <span>
          <i className="legend-green" />
          任务
        </span>
        <span>
          <LocateFixed size={12} />
          点击出处定位原文
        </span>
      </div>
    </section>
  );
}
