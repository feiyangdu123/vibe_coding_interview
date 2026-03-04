"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  CandidateListItem,
  CreateInterviewResponse,
  ProblemListItem,
} from "@vibe-interview/shared-types";

interface AdminInterviewCreatePanelProps {
  candidates: CandidateListItem[];
  problems: ProblemListItem[];
  initialCandidateId: string | null;
  controlPlaneOrigin: string;
}

export function AdminInterviewCreatePanel({
  candidates,
  problems,
  initialCandidateId,
  controlPlaneOrigin,
}: AdminInterviewCreatePanelProps) {
  const [candidateId, setCandidateId] = useState(initialCandidateId ?? candidates[0]?.id ?? "");
  const [problemId, setProblemId] = useState(problems[0]?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdInterview, setCreatedInterview] = useState<CreateInterviewResponse | null>(null);

  async function createInterview(): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${controlPlaneOrigin}/api/admin/interviews`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          candidateId,
          problemId,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "创建面试失败。");
      }

      setCreatedInterview(payload as CreateInterviewResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建面试失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2 className="section-title">安排面试</h2>
        <div className="form-grid">
          <label className="form-field">
            <span>选择候选人</span>
            <select
              value={candidateId}
              onChange={(event) => {
                setCandidateId(event.target.value);
              }}
            >
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.email})
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>选择题目</span>
            <select
              value={problemId}
              onChange={(event) => {
                setProblemId(event.target.value);
              }}
            >
              {problems.map((problem) => (
                <option key={problem.id} value={problem.id}>
                  {problem.title} / {problem.durationMinutes} 分钟
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            onClick={() => {
              void createInterview();
            }}
            disabled={isSubmitting || !candidateId || !problemId}
            className="button-primary"
          >
            {isSubmitting ? "创建中..." : "生成候选人链接"}
          </button>
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>

      {createdInterview ? (
        <section className="card">
          <h2 className="section-title">已生成面试链接</h2>
          <label className="form-field">
            <span>候选人链接</span>
            <input readOnly value={createdInterview.interviewUrl} />
          </label>
          <div className="button-row">
            <a href={createdInterview.interviewUrl} target="_blank" rel="noreferrer" className="link-button">
              打开候选人题目页
            </a>
            <Link href="/admin/interviews" className="nav-pill">
              查看面试列表
            </Link>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                void navigator.clipboard.writeText(createdInterview.interviewUrl);
              }}
            >
              复制链接
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
