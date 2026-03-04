import { AdminNav } from "../../../components/admin-nav";
import { AdminProblemsPanel } from "../../../components/admin-problems-panel";
import { ControlPlaneErrorCard } from "../../../components/control-plane-error-card";
import { fetchAdminProblems, getControlPlaneOrigin } from "../../../lib/control-plane";

export default async function AdminProblemsPage() {
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const problems = await fetchAdminProblems();

    return (
      <main className="grid">
        <AdminNav />
        <AdminProblemsPanel
          initialProblems={problems}
          controlPlaneOrigin={controlPlaneOrigin}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="grid">
        <AdminNav />
        <ControlPlaneErrorCard
          title="无法加载题目管理"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </main>
    );
  }
}
