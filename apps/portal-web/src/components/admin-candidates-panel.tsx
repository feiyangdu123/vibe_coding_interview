"use client";

import Link from "next/link";
import { useState } from "react";
import type { CandidateListItem } from "@vibe-interview/shared-types";

interface CandidateDraft {
  name: string;
  email: string;
  phone: string;
  targetRole: string;
}

interface AdminCandidatesPanelProps {
  initialCandidates: CandidateListItem[];
  controlPlaneOrigin: string;
}

const emptyDraft: CandidateDraft = {
  name: "",
  email: "",
  phone: "",
  targetRole: "",
};

export function AdminCandidatesPanel({
  initialCandidates,
  controlPlaneOrigin,
}: AdminCandidatesPanelProps) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [draft, setDraft] = useState<CandidateDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CandidateDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function createCandidate(): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${controlPlaneOrigin}/api/admin/candidates`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          phone: draft.phone || null,
          targetRole: draft.targetRole || null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "新增候选人失败。");
      }

      setCandidates((current) => [payload as CandidateListItem, ...current]);
      setDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "新增候选人失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateCandidate(candidateId: string): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/admin/candidates/${encodeURIComponent(candidateId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: editingDraft.name,
            email: editingDraft.email,
            phone: editingDraft.phone || null,
            targetRole: editingDraft.targetRole || null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "更新候选人失败。");
      }

      const nextCandidate = payload as CandidateListItem;
      setCandidates((current) =>
        current.map((candidate) => (candidate.id === candidateId ? nextCandidate : candidate)),
      );
      setEditingId(null);
      setEditingDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新候选人失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteCandidate(candidateId: string): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/admin/candidates/${encodeURIComponent(candidateId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "删除候选人失败。");
      }

      setCandidates((current) => current.filter((candidate) => candidate.id !== candidateId));
      if (editingId === candidateId) {
        setEditingId(null);
        setEditingDraft(emptyDraft);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除候选人失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(candidate: CandidateListItem): void {
    setEditingId(candidate.id);
    setEditingDraft({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone ?? "",
      targetRole: candidate.targetRole ?? "",
    });
  }

  return (
    <div className="grid">
      <section className="card">
        <h2 className="section-title">新增候选人</h2>
        <div className="form-grid">
          <label className="form-field">
            <span>姓名</span>
            <input
              value={draft.name}
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
              }}
              placeholder="例如：张三"
            />
          </label>
          <label className="form-field">
            <span>邮箱</span>
            <input
              value={draft.email}
              onChange={(event) => {
                setDraft((current) => ({ ...current, email: event.target.value }));
              }}
              placeholder="zhangsan@example.com"
            />
          </label>
          <label className="form-field">
            <span>电话</span>
            <input
              value={draft.phone}
              onChange={(event) => {
                setDraft((current) => ({ ...current, phone: event.target.value }));
              }}
              placeholder="可选"
            />
          </label>
          <label className="form-field">
            <span>应聘岗位</span>
            <input
              value={draft.targetRole}
              onChange={(event) => {
                setDraft((current) => ({ ...current, targetRole: event.target.value }));
              }}
              placeholder="可选"
            />
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            onClick={() => {
              void createCandidate();
            }}
            disabled={isSubmitting}
            className="button-primary"
          >
            {isSubmitting ? "提交中..." : "新增候选人"}
          </button>
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>

      <section className="card">
        <h2 className="section-title">候选人列表</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>候选人</th>
                <th>联系方式</th>
                <th>岗位</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <strong>{candidate.name}</strong>
                    <p className="table-subtext">{candidate.email}</p>
                  </td>
                  <td>{candidate.phone ?? "未填写"}</td>
                  <td>{candidate.targetRole ?? "未填写"}</td>
                  <td>
                    <div className="button-row compact-row">
                      <button
                        type="button"
                        onClick={() => {
                          startEditing(candidate);
                        }}
                        className="button-secondary"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteCandidate(candidate.id);
                        }}
                        className="button-danger"
                      >
                        删除
                      </button>
                      <Link
                        href={`/admin/interviews/new?candidateId=${encodeURIComponent(candidate.id)}`}
                        className="link-button"
                      >
                        安排面试
                      </Link>
                    </div>
                    {editingId === candidate.id ? (
                      <div className="edit-panel">
                        <label className="form-field">
                          <span>姓名</span>
                          <input
                            value={editingDraft.name}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                name: event.target.value,
                              }));
                            }}
                          />
                        </label>
                        <label className="form-field">
                          <span>邮箱</span>
                          <input
                            value={editingDraft.email}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                email: event.target.value,
                              }));
                            }}
                          />
                        </label>
                        <label className="form-field">
                          <span>电话</span>
                          <input
                            value={editingDraft.phone}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                phone: event.target.value,
                              }));
                            }}
                          />
                        </label>
                        <label className="form-field">
                          <span>应聘岗位</span>
                          <input
                            value={editingDraft.targetRole}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                targetRole: event.target.value,
                              }));
                            }}
                          />
                        </label>
                        <div className="button-row compact-row">
                          <button
                            type="button"
                            onClick={() => {
                              void updateCandidate(candidate.id);
                            }}
                            className="button-primary"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditingDraft(emptyDraft);
                            }}
                            className="button-secondary"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
