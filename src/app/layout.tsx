import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = {
  title: "蓝图 Blueprint · AI 需求评审与任务拆解",
  description: "从一份需求文档，到可以开工的任务蓝图。每个结论，都有据可循。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
