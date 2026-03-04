"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionDetailView, SessionStatus } from "@vibe-interview/shared-types";

interface CandidateSessionViewProps {
  initialSession: SessionDetailView;
  controlPlaneOrigin: string;
}

export function CandidateSessionView({
  initialSession,
  controlPlaneOrigin,
}: CandidateSessionViewProps) {
  const [session, setSession] = useState(initialSession);
  const [remainingMs, setRemainingMs] = useState(initialSession.remainingMs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const expiringRef = useRef(false);

  useEffect(() => {
    setSession(initialSession);
    setRemainingMs(initialSession.remainingMs);
  }, [initialSession]);

  useEffect(() => {
    if (session.status !== "RUNNING") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRemainingMs((current) => Math.max(0, current - 1_000));
    }, 1_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session.status]);

  useEffect(() => {
    if (session.status !== "RUNNING") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshSession(false);
    }, 15_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session.status]);

  useEffect(() => {
    if (session.status !== "RUNNING" || remainingMs > 0 || expiringRef.current) {
      return;
    }

    expiringRef.current = true;
    void handleExpire();
  }, [remainingMs, session.status]);

  async function refreshSession(showLoading = true): Promise<void> {
    setErrorMessage(null);

    if (showLoading) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/sessions/${encodeURIComponent(session.sessionId)}`,
        {
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (payload as { message?: string } | null)?.message ?? "刷新状态失败，请稍后重试。",
        );
      }

      const nextSession = payload as SessionDetailView;
      setSession(nextSession);
      setRemainingMs(nextSession.remainingMs);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "刷新状态失败，请稍后重试。");
    } finally {
      if (showLoading) {
        setIsRefreshing(false);
      }
    }
  }

  async function handleExpire(): Promise<void> {
    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/sessions/${encodeURIComponent(session.sessionId)}/end`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "expired" }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (payload as { message?: string } | null)?.message ?? "面试超时处理失败。",
        );
      }

      const nextSession = payload as SessionDetailView;
      setSession(nextSession);
      setRemainingMs(0);
    } catch {
      setSession((current) => ({
        ...current,
        status: "EXPIRED",
        remainingMs: 0,
      }));
      setRemainingMs(0);
    } finally {
      window.close();
    }
  }

  async function handleLaunch(): Promise<void> {
    if (session.status !== "RUNNING" || remainingMs <= 0) {
      return;
    }

    setErrorMessage(null);
    setIsLaunching(true);

    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/sessions/${encodeURIComponent(session.sessionId)}/start`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (payload as { message?: string } | null)?.message ?? "编程环境启动失败，请稍后重试。",
        );
      }

      const nextSession = payload as SessionDetailView;
      setSession(nextSession);
      setRemainingMs(nextSession.remainingMs);
      window.open(`${controlPlaneOrigin}/s/${session.sessionId}/`, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "编程环境启动失败，请稍后重试。");
    } finally {
      setIsLaunching(false);
    }
  }

  if (session.status === "EXPIRED") {
    return (
      <main className="single-column">
        <section className="card expired-shell">
          <p className="eyebrow">面试已失效</p>
          <h1 className="page-title">本场面试已超时关闭</h1>
          <p className="muted-text">页面已失效，系统会尝试自动关闭此窗口。</p>
          <p className="muted-text">如果浏览器阻止自动关闭，请直接关闭当前页面。</p>
        </section>
      </main>
    );
  }

  const canLaunch = session.status === "RUNNING" && remainingMs > 0;

  return (
    <main className="grid">
      <section className="card hero-card">
        <div>
          <p className="eyebrow">面试状态页</p>
          <h1 className="page-title">{session.problem.title}</h1>
          <p className="muted-text">
            请先在本页确认剩余时间与候选人信息，再打开编程环境。
          </p>
        </div>
        <div className="countdown-block">
          <span className="countdown-label">剩余时间</span>
          <strong className="countdown-value">{formatDuration(remainingMs)}</strong>
        </div>
      </section>

      <section className="card info-card">
        <h2 className="section-title">面试基本情况</h2>
        <dl className="detail-grid">
          <div>
            <dt>当前状态</dt>
            <dd>{toStatusLabel(session.status)}</dd>
          </div>
          <div>
            <dt>面试开始时间</dt>
            <dd>{formatDateTime(session.startedAt)}</dd>
          </div>
          <div>
            <dt>截止时间</dt>
            <dd>{formatDateTime(session.expiresAt)}</dd>
          </div>
          <div>
            <dt>题目时长</dt>
            <dd>{session.problem.durationMinutes} 分钟</dd>
          </div>
        </dl>
      </section>

      <section className="card info-card">
        <h2 className="section-title">候选人信息</h2>
        <dl className="detail-grid">
          <div>
            <dt>姓名</dt>
            <dd>{session.candidate.name}</dd>
          </div>
          <div>
            <dt>邮箱</dt>
            <dd>{session.candidate.email}</dd>
          </div>
          {session.candidate.phone ? (
            <div>
              <dt>电话</dt>
              <dd>{session.candidate.phone}</dd>
            </div>
          ) : null}
          {session.candidate.targetRole ? (
            <div>
              <dt>应聘岗位</dt>
              <dd>{session.candidate.targetRole}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="card action-card">
        <h2 className="section-title">面试操作</h2>
        <div className="button-row">
          <button
            type="button"
            onClick={() => {
              void handleLaunch();
            }}
            disabled={!canLaunch || isLaunching}
            className="button-primary"
          >
            {isLaunching ? "正在打开..." : "打开编程环境"}
          </button>
          <button
            type="button"
            onClick={() => {
              void refreshSession(true);
            }}
            disabled={isRefreshing}
            className="button-secondary"
          >
            {isRefreshing ? "刷新中..." : "刷新状态"}
          </button>
        </div>
        <p className="muted-text">
          只有在“进行中”状态且剩余时间大于 0 时，才能进入编程环境。
        </p>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>
    </main>
  );
}

function formatDuration(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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

function toStatusLabel(status: SessionStatus): string {
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
