import { AdminCandidatesPanel } from "../../../components/admin-candidates-panel";
import { ControlPlaneErrorCard } from "../../../components/control-plane-error-card";
import { fetchAdminCandidates, getControlPlaneOrigin } from "../../../lib/control-plane";

export default async function AdminCandidatesPage() {
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const candidates = await fetchAdminCandidates();

    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">笔试管理</p>
            <h1 className="admin-page-title">候选人管理</h1>
            <p className="admin-page-description">
              维护候选人信息，并从候选人维度快速发起面试链接。
            </p>
          </div>
        </header>
        <AdminCandidatesPanel
          initialCandidates={candidates}
          controlPlaneOrigin={controlPlaneOrigin}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">笔试管理</p>
            <h1 className="admin-page-title">候选人管理</h1>
            <p className="admin-page-description">
              维护候选人信息，并从候选人维度快速发起面试链接。
            </p>
          </div>
        </header>
        <ControlPlaneErrorCard
          title="无法加载候选人管理"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </div>
    );
  }
}
