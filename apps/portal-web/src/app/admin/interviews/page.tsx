import { AdminInterviewsPanel } from "../../../components/admin-interviews-panel";
import { ControlPlaneErrorCard } from "../../../components/control-plane-error-card";
import { fetchAdminInterviews, getControlPlaneOrigin } from "../../../lib/control-plane";

export default async function AdminInterviewsPage() {
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const interviews = await fetchAdminInterviews();

    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">笔试管理</p>
            <h1 className="admin-page-title">面试列表</h1>
            <p className="admin-page-description">
              查看所有面试安排、当前状态，并快速进入候选人页面或状态页。
            </p>
          </div>
        </header>

        <AdminInterviewsPanel initialInterviews={interviews} />
      </div>
    );
  } catch (error) {
    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">笔试管理</p>
            <h1 className="admin-page-title">面试列表</h1>
            <p className="admin-page-description">
              查看所有面试安排、当前状态，并快速进入候选人页面或状态页。
            </p>
          </div>
        </header>
        <ControlPlaneErrorCard
          title="无法加载面试列表"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </div>
    );
  }
}
