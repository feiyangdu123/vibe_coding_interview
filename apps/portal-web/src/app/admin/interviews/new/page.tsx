import Link from "next/link";
import { AdminInterviewCreatePanel } from "../../../../components/admin-interview-create-panel";
import { ControlPlaneErrorCard } from "../../../../components/control-plane-error-card";
import {
  fetchAdminCandidates,
  fetchAdminProblems,
  getControlPlaneOrigin,
} from "../../../../lib/control-plane";

interface AdminInterviewCreatePageProps {
  searchParams?: Promise<{
    candidateId?: string;
  }>;
}

export default async function AdminInterviewCreatePage({
  searchParams,
}: AdminInterviewCreatePageProps) {
  const resolvedSearchParams = await searchParams;
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const [candidates, problems] = await Promise.all([
      fetchAdminCandidates(),
      fetchAdminProblems(),
    ]);

    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">笔试管理</p>
            <h1 className="admin-page-title">安排面试</h1>
            <p className="admin-page-description">
              选择候选人与题目，生成可直接发给候选人的专属面试链接。
            </p>
          </div>
        </header>

        {candidates.length === 0 || problems.length === 0 ? (
          <section className="card admin-card">
            <h2 className="section-title">无法安排面试</h2>
            <p className="muted-text">请先至少创建一个候选人和一个题目，再来安排面试。</p>
            <div className="button-row">
              <Link href="/admin/candidates" className="nav-pill">
                去创建候选人
              </Link>
              <Link href="/admin/problems" className="nav-pill">
                去创建题目
              </Link>
            </div>
          </section>
        ) : (
            <AdminInterviewCreatePanel
              candidates={candidates}
              problems={problems}
              initialCandidateId={resolvedSearchParams?.candidateId ?? null}
              controlPlaneOrigin={controlPlaneOrigin}
            />
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">笔试管理</p>
            <h1 className="admin-page-title">安排面试</h1>
            <p className="admin-page-description">
              选择候选人与题目，生成可直接发给候选人的专属面试链接。
            </p>
          </div>
        </header>
        <ControlPlaneErrorCard
          title="无法加载安排面试页面"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </div>
    );
  }
}
