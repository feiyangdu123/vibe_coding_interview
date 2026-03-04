import Link from "next/link";
import { portalConfig } from "../lib/config";

export default function HomePage() {
  return (
    <main className="grid">
      <section className="card hero-card">
        <div>
          <p className="eyebrow">平台入口</p>
          <h1 className="page-title">Vibe Coding 面试平台</h1>
          <p className="muted-text">
            当前版本已经支持题目管理、候选人管理、安排面试，以及候选人题目页和面试状态页。
          </p>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">常用入口</h2>
        <div className="button-row">
          <Link href="/admin/problems" className="nav-pill">
            题目管理
          </Link>
          <Link href="/admin/candidates" className="nav-pill">
            候选人管理
          </Link>
          <Link href="/admin/interviews/new" className="nav-pill">
            安排面试
          </Link>
          <Link href="/admin/interviews" className="nav-pill">
            面试列表
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">当前环境</h2>
        <p className="muted-text">
          Control plane：<code>{portalConfig.controlPlaneOrigin}</code>
        </p>
        <p className="muted-text">
          候选人会通过 `/interview/[token]` 进入题目页，先阅读题目，再进入面试状态页和编程环境。
        </p>
      </section>
    </main>
  );
}
