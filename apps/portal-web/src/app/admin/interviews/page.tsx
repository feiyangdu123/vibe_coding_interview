import Link from "next/link";
import { AdminNav } from "../../../components/admin-nav";
import { ControlPlaneErrorCard } from "../../../components/control-plane-error-card";
import { fetchAdminInterviews, getControlPlaneOrigin } from "../../../lib/control-plane";

export default async function AdminInterviewsPage() {
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const interviews = await fetchAdminInterviews();

    return (
      <main className="grid">
        <AdminNav />

        <section className="card">
          <h2 className="section-title">面试列表</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>候选人</th>
                  <th>题目</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((interview) => (
                  <tr key={interview.interviewId}>
                    <td>
                      <strong>{interview.candidate.name}</strong>
                      <p className="table-subtext">{interview.candidate.email}</p>
                    </td>
                    <td>
                      <strong>{interview.problem.title}</strong>
                      <p className="table-subtext">{interview.problem.durationMinutes} 分钟</p>
                    </td>
                    <td>{toStatusLabel(interview.status)}</td>
                    <td>
                      <p className="table-subtext">创建：{formatDateTime(interview.createdAt)}</p>
                      <p className="table-subtext">开始：{formatDateTime(interview.startedAt)}</p>
                      <p className="table-subtext">截止：{formatDateTime(interview.expiresAt)}</p>
                    </td>
                    <td>
                      <div className="button-row compact-row">
                        <Link
                          href={`/interview/${encodeURIComponent(interview.token)}`}
                          className="link-button"
                        >
                          候选人题目页
                        </Link>
                        <Link
                          href={`/candidate/session/${encodeURIComponent(interview.sessionId)}`}
                          className="link-button"
                        >
                          面试状态页
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    return (
      <main className="grid">
        <AdminNav />
        <ControlPlaneErrorCard
          title="无法加载面试列表"
          detail={error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          origin={controlPlaneOrigin}
        />
      </main>
    );
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "未开始";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toStatusLabel(status: string): string {
  switch (status) {
    case "CREATED":
      return "未开始";
    case "READY":
      return "待开始";
    case "RUNNING":
      return "进行中";
    case "SUBMITTED":
      return "已提交";
    case "EXPIRED":
      return "已超时";
    case "ARCHIVED":
      return "已归档";
    default:
      return status;
  }
}
