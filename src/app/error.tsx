"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="empty-page">
      <AlertTriangle size={32} />
      <h1>页面遇到了一点问题</h1>
      <p>已保存的分析仍在本机，可以重试恢复。</p>
      <button className="button primary" onClick={reset}>
        <RotateCcw size={15} />
        重新打开页面
      </button>
    </main>
  );
}
