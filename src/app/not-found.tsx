import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-page">
      <h1>这张蓝图还不存在</h1>
      <p>回到工作台，开始一次新的评审。</p>
      <Link className="button primary" href="/">
        返回工作台
      </Link>
    </main>
  );
}
