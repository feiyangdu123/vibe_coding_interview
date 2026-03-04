import { AdminProblemsPanel } from "./admin-problems-panel";
import { ControlPlaneErrorCard } from "./control-plane-error-card";
import { fetchAdminProblems, getControlPlaneOrigin } from "../lib/control-plane";

export async function AdminProblemsPageContent() {
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const problems = await fetchAdminProblems();

    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">题目管理</p>
            <h1 className="admin-page-title">实操题管理</h1>
            <p className="admin-page-description">
              管理实操作答题目，支持搜索、新建、预览和编辑。
            </p>
          </div>
        </header>

        <AdminProblemsPanel
          initialProblems={problems}
          controlPlaneOrigin={controlPlaneOrigin}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="admin-page">
        <header className="card admin-page-header">
          <div>
            <p className="eyebrow">题目管理</p>
            <h1 className="admin-page-title">实操题管理</h1>
            <p className="admin-page-description">
              管理实操作答题目，支持搜索、新建、预览和编辑。
            </p>
          </div>
        </header>

        <ControlPlaneErrorCard
          title="无法加载题目管理"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </div>
    );
  }
}
