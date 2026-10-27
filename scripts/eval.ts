import { sampleDoc } from "../src/lib/sample";
import {
  createClient,
  extract,
  audit,
  plan,
  finishAnalysis,
} from "../src/lib/pipeline";
import { evaluate } from "../src/lib/quality";

async function main() {
  const client = createClient({ mode: "mock", configId: "script" }),
    doc = sampleDoc();
  const start = performance.now();
  const extracted = await extract(client, doc);
  const gaps = await audit(client, doc, extracted.requirements);
  const planned = await plan(
    client,
    doc,
    extracted.requirements,
    gaps,
    "standard",
  );
  const result = finishAnalysis({
    version: 2,
    document: doc,
    ...extracted,
    gaps,
    tasks: planned.tasks,
    exclusions: planned.exclusions,
    conflicts: [],
    mode: "mock",
    granularity: "standard",
    createdAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - start),
    logs: planned.logs,
    supportingDocuments: [],
  });
  const report = evaluate(result);
  console.log("蓝图 · 演示管线自检（固定数据，不代表真实模型能力）");
  console.table(
    report.metrics.map((m) => ({
      指标: m.label,
      实际: `${Math.round(m.value * 100)}%`,
      目标: `${Math.round(m.target * 100)}%`,
      通过: m.value >= m.target,
    })),
  );
  console.log(
    JSON.stringify(
      {
        timestamp: report.at,
        mode: report.mode,
        durationMs: report.durationMs,
        failures: report.failures,
      },
      null,
      2,
    ),
  );
  if (report.failures.length || report.metrics.some((m) => m.value < m.target))
    process.exitCode = 1;
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
