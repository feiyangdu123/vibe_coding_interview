"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CandidateListItem,
  CreateInterviewResponse,
  ProblemListItem,
} from "@vibe-interview/shared-types";
import {
  toProblemDifficultyLabel,
  toProblemTypeLabel,
} from "../lib/admin-format";

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

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === candidateId) ?? null,
    [candidateId, candidates],
  );
  const selectedProblem = useMemo(
    () => problems.find((problem) => problem.id === problemId) ?? null,
    [problemId, problems],
  );

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

  async function copyInterviewUrl(): Promise<void> {
    if (!createdInterview) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdInterview.interviewUrl);
    } catch {
      // Ignore clipboard failures so the page remains usable.
    }
  }

  return (
    <div className="grid">
      {selectedCandidate ? (
        <section className="card admin-card">
          <div className="admin-inline-summary">
            <div>
              <p className="eyebrow">已选候选人</p>
              <h2 className="section-title">{selectedCandidate.name}</h2>
              <p className="muted-text">{selectedCandidate.email}</p>
            </div>
            <div className="admin-summary-tags">
              <span className="tag">{selectedCandidate.phone ?? "未填写电话"}</span>
              <span className="tag">{selectedCandidate.targetRole ?? "未填写岗位"}</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card admin-card">
        <div className="admin-toolbar">
          <div className="admin-toolbar__meta">
            <h2 className="section-title">生成面试链接</h2>
            <p className="muted-text">先选择候选人与题目，再生成候选人专属链接。</p>
          </div>
        </div>

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

        {selectedProblem ? (
          <div className="admin-kv-grid">
            <div>
              <span className="admin-kv-grid__label">题目类型</span>
              <strong>{toProblemTypeLabel(selectedProblem.type)}</strong>
            </div>
            <div>
              <span className="admin-kv-grid__label">难度</span>
              <strong>{toProblemDifficultyLabel(selectedProblem.difficulty)}</strong>
            </div>
            <div>
              <span className="admin-kv-grid__label">面试时长</span>
              <strong>{selectedProblem.durationMinutes} 分钟</strong>
            </div>
            <div>
              <span className="admin-kv-grid__label">模板目录</span>
              <strong>{selectedProblem.templatePath ?? "未设置"}</strong>
            </div>
          </div>
        ) : null}

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
        <section className="card admin-card">
          <div className="admin-toolbar">
            <div className="admin-toolbar__meta">
              <h2 className="section-title">已生成面试链接</h2>
              <p className="muted-text">可以直接复制链接发给候选人，或先打开页面检查内容。</p>
            </div>
          </div>

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
                void copyInterviewUrl();
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
