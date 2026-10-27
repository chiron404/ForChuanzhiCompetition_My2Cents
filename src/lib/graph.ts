import type { TaskNode } from "@/types";

/** 删除未知、自环和闭环边，再用 Kahn 算法计算拓扑层级。输入不被修改。 */
export function validateGraph(input: TaskNode[]): {
  tasks: TaskNode[];
  logs: string[];
} {
  const logs: string[] = [];
  const tasks = input.map((t) => ({
    ...t,
    deps: [...new Set(t.deps)],
    level: 0,
  }));
  const ids = new Set(tasks.map((t) => t.id));
  const accepted = new Map<string, string[]>();
  const reaches = (
    from: string,
    target: string,
    seen = new Set<string>(),
  ): boolean => {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (accepted.get(from) ?? []).some((next) =>
      reaches(next, target, seen),
    );
  };
  for (const task of tasks) {
    const deps: string[] = [];
    accepted.set(task.id, deps);
    for (const dep of task.deps) {
      if (!ids.has(dep)) logs.push(`${task.id}：已过滤不存在的依赖 ${dep}`);
      else if (dep === task.id) logs.push(`${task.id}：已删除自依赖`);
      else if (reaches(dep, task.id))
        logs.push(`${task.id} → ${dep}：检测到环，已断开该边`);
      else deps.push(dep);
    }
    task.deps = deps;
  }
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indegrees = new Map(tasks.map((t) => [t.id, t.deps.length]));
  const queue = tasks.filter((t) => !t.deps.length);
  for (let i = 0; i < queue.length; i++) {
    const task = queue[i];
    for (const child of tasks.filter((t) => t.deps.includes(task.id))) {
      child.level = Math.max(child.level, task.level + 1);
      indegrees.set(child.id, indegrees.get(child.id)! - 1);
      if (indegrees.get(child.id) === 0) queue.push(byId.get(child.id)!);
    }
  }
  return { tasks, logs };
}
