interface ControlPlaneErrorCardProps {
  title: string;
  detail: string;
  origin: string;
}

export function ControlPlaneErrorCard({
  title,
  detail,
  origin,
}: ControlPlaneErrorCardProps) {
  return (
    <section className="card expired-shell">
      <p className="eyebrow">Control Plane 不可用</p>
      <h2 className="section-title">{title}</h2>
      <p className="muted-text">{detail}</p>
      <p className="muted-text">
        当前目标地址：<code>{origin}</code>
      </p>
      <p className="muted-text">
        请确认后端已启动：<code>pnpm dev:control-plane</code>
      </p>
    </section>
  );
}
