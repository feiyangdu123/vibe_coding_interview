import { CandidateSessionView } from "../../../../components/candidate-session-view";
import { fetchSession, getControlPlaneOrigin } from "../../../../lib/control-plane";

interface CandidateSessionPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export default async function CandidateSessionPage({ params }: CandidateSessionPageProps) {
  const { sessionId } = await params;
  const controlPlaneOrigin = getControlPlaneOrigin();

  try {
    const session = await fetchSession(sessionId);

    return (
      <CandidateSessionView
        initialSession={session}
        controlPlaneOrigin={controlPlaneOrigin}
      />
    );
  } catch (error) {
    return (
      <main className="single-column">
        <section className="card expired-shell">
          <p className="eyebrow">加载失败</p>
          <h1 className="page-title">无法加载面试状态</h1>
          <p className="muted-text">
            {error instanceof Error ? error.message : "连接 control-plane 时发生未知错误。"}
          </p>
        </section>
      </main>
    );
  }
}
