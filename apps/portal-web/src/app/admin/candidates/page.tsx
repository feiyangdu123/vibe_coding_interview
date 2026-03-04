import { AdminCandidatesPanel } from "../../../components/admin-candidates-panel";
import { AdminNav } from "../../../components/admin-nav";
import { ControlPlaneErrorCard } from "../../../components/control-plane-error-card";
import { fetchAdminCandidates, getControlPlaneOrigin } from "../../../lib/control-plane";

export default async function AdminCandidatesPage() {
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const candidates = await fetchAdminCandidates();

    return (
      <main className="grid">
        <AdminNav />
        <AdminCandidatesPanel
          initialCandidates={candidates}
          controlPlaneOrigin={controlPlaneOrigin}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="grid">
        <AdminNav />
        <ControlPlaneErrorCard
          title="无法加载候选人管理"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </main>
    );
  }
}
