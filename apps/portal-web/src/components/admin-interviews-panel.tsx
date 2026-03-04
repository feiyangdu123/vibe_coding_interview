"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminInterviewListItem } from "@vibe-interview/shared-types";
import { formatAdminDateTime, toSessionStatusLabel } from "../lib/admin-format";

interface AdminInterviewsPanelProps {
  initialInterviews: AdminInterviewListItem[];
}

export function AdminInterviewsPanel({
  initialInterviews,
}: AdminInterviewsPanelProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  async function copyInterviewUrl(token: string): Promise<void> {
    try {
      const interviewUrl = `${window.location.origin}/interview/${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(interviewUrl);
      setCopiedToken(token);
    } catch {
      setCopiedToken(null);
    }
  }

  return (
    <section className="card admin-card">
      <div className="admin-toolbar">
        <div className="admin-toolbar__meta">
          <h2 className="section-title">面试记录</h2>
          <p className="muted-text">当前共 {initialInterviews.length} 场面试，可直接查看状态或复制候选人链接。</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table admin-data-table">
          <thead>
            <tr>
              <th>候选人</th>
              <th>题目</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>开始时间</th>
              <th>截止时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {initialInterviews.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <p className="admin-empty">暂无面试记录。</p>
                </td>
              </tr>
            ) : (
              initialInterviews.map((interview) => (
                <tr key={interview.interviewId}>
                  <td>
                    <div className="cell-title">{interview.candidate.name}</div>
                    <p className="table-subtext">{interview.candidate.email}</p>
                  </td>
                  <td>
                    <div className="cell-title">{interview.problem.title}</div>
                    <p className="table-subtext">{interview.problem.durationMinutes} 分钟</p>
                  </td>
                  <td>
                    <span className={`status-badge ${statusClassName(interview.status)}`}>
                      {toSessionStatusLabel(interview.status)}
                    </span>
                  </td>
                  <td>{formatAdminDateTime(interview.createdAt)}</td>
                  <td>{formatAdminDateTime(interview.startedAt)}</td>
                  <td>{formatAdminDateTime(interview.expiresAt)}</td>
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
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          void copyInterviewUrl(interview.token);
                        }}
                      >
                        {copiedToken === interview.token ? "已复制" : "复制面试链接"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function statusClassName(status: string): string {
  switch (status) {
    case "CREATED":
      return "is-created";
    case "READY":
      return "is-ready";
    case "RUNNING":
      return "is-running";
    case "SUBMITTED":
      return "is-submitted";
    case "EXPIRED":
      return "is-expired";
    case "ARCHIVED":
      return "is-archived";
    default:
      return "";
  }
}
