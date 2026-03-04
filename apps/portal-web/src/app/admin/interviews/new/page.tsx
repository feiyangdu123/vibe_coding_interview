import Link from "next/link";
import { AdminInterviewCreatePanel } from "../../../../components/admin-interview-create-panel";
import { AdminNav } from "../../../../components/admin-nav";
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
      <main className="grid">
        <AdminNav />

        {candidates.length === 0 || problems.length === 0 ? (
          <section className="card">
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
      </main>
    );
  } catch (error) {
    return (
      <main className="grid">
        <AdminNav />
        <ControlPlaneErrorCard
          title="无法加载安排面试页面"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </main>
    );
  }
}
