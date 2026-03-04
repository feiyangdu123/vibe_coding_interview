import { InterviewEntryPanel } from "../../../components/interview-entry-panel";
import { fetchInterview, getControlPlaneOrigin } from "../../../lib/control-plane";

interface InterviewEntryPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InterviewEntryPage({ params }: InterviewEntryPageProps) {
  const { token } = await params;
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const interview = await fetchInterview(token);

    return (
      <main className="grid">
        <section className="card hero-card">
          <div>
            <p className="eyebrow">候选人题目页</p>
            <h1 className="page-title">{interview.problem.title}</h1>
            <p className="muted-text">
              请先阅读完整题目说明。点击开始后才会初始化编程环境，并开始计时。
            </p>
          </div>
          <div className="badge-column">
            <span className="status-pill">面试时长：{interview.problem.durationMinutes} 分钟</span>
            <span className="status-pill">当前状态：{toStatusLabel(interview.status)}</span>
          </div>
        </section>

        <section className="card info-card">
          <h2 className="section-title">面试基本情况</h2>
          <dl className="detail-grid">
            <div>
              <dt>候选人</dt>
              <dd>{interview.candidate.name}</dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>{interview.candidate.email}</dd>
            </div>
            {interview.candidate.phone ? (
              <div>
                <dt>电话</dt>
                <dd>{interview.candidate.phone}</dd>
              </div>
            ) : null}
            {interview.candidate.targetRole ? (
              <div>
                <dt>应聘岗位</dt>
                <dd>{interview.candidate.targetRole}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="card info-card">
          <h2 className="section-title">题目说明</h2>
          <p className="muted-text">{interview.problem.description}</p>
          <p className="muted-text">
            开始后，系统会按照题目配置的时长倒计时；到时后页面会失效，无法继续进入编程环境。
          </p>
        </section>

        <InterviewEntryPanel interview={interview} controlPlaneOrigin={controlPlaneOrigin} />
      </main>
    );
  } catch (error) {
    return (
      <main className="single-column">
        <section className="card expired-shell">
          <p className="eyebrow">加载失败</p>
          <h1 className="page-title">无法加载面试题目</h1>
          <p className="muted-text">
            {error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          </p>
        </section>
      </main>
    );
  }
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
