"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InterviewEntryView, SessionDetailView, SessionStatus } from "@vibe-interview/shared-types";

interface InterviewEntryPanelProps {
  interview: InterviewEntryView;
  controlPlaneOrigin: string;
}

const actionableStatuses: SessionStatus[] = ["CREATED", "READY"];

export function InterviewEntryPanel({
  interview,
  controlPlaneOrigin,
}: InterviewEntryPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>(interview.status);
  const [runtimeMode, setRuntimeMode] = useState(interview.runtimeMode);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleStart(): Promise<void> {
    setErrorMessage(null);

    if (!actionableStatuses.includes(status) && status !== "RUNNING") {
      router.push(`/candidate/session/${interview.sessionId}`);
      return;
    }

    if (status === "RUNNING") {
      router.push(`/candidate/session/${interview.sessionId}`);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/sessions/${encodeURIComponent(interview.sessionId)}/start`,
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
          (payload as { message?: string } | null)?.message ?? "面试启动失败，请稍后重试。",
        );
      }

      const session = payload as SessionDetailView;
      setStatus(session.status);
      setRuntimeMode(session.runtimeMode);
      router.push(`/candidate/session/${interview.sessionId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "面试启动失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  const isDisabled = !actionableStatuses.includes(status) && status !== "RUNNING";
  const buttonLabel =
    status === "RUNNING"
      ? "进入面试状态页"
      : status === "EXPIRED"
        ? "面试已超时"
        : status === "SUBMITTED"
          ? "面试已提交"
          : status === "ARCHIVED"
            ? "面试已归档"
            : isLoading
              ? "正在启动..."
              : "我已阅读题目，开始面试";

  return (
    <section className="card action-card">
      <h2 className="section-title">开始前确认</h2>
      <ul className="info-list">
        <li>请先完整阅读题目说明，再开始面试。</li>
        <li>点击开始后才会初始化编程环境，并开始计时。</li>
        <li>启动完成后会进入面试状态页，再由你手动打开编程环境。</li>
      </ul>

      <div className="status-pill-row">
        <span className="status-pill">当前状态：{toStatusLabel(status)}</span>
        <span className="status-pill">运行模式：{runtimeMode ?? "未启动"}</span>
      </div>

      <button
        type="button"
        onClick={() => {
          void handleStart();
        }}
        disabled={isLoading || isDisabled}
        className="button-primary"
      >
        {buttonLabel}
      </button>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
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
