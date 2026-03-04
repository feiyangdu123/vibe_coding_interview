"use client";

import { useState } from "react";
import type { ProblemListItem } from "@vibe-interview/shared-types";

interface ProblemDraft {
  title: string;
  description: string;
  durationMinutes: string;
  templatePath: string;
}

interface AdminProblemsPanelProps {
  initialProblems: ProblemListItem[];
  controlPlaneOrigin: string;
}

const emptyDraft: ProblemDraft = {
  title: "",
  description: "",
  durationMinutes: "60",
  templatePath: "",
};

export function AdminProblemsPanel({
  initialProblems,
  controlPlaneOrigin,
}: AdminProblemsPanelProps) {
  const [problems, setProblems] = useState(initialProblems);
  const [draft, setDraft] = useState<ProblemDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<ProblemDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function createProblem(): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${controlPlaneOrigin}/api/admin/problems`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          durationMinutes: Number.parseInt(draft.durationMinutes, 10),
          templatePath: draft.templatePath || null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "新增题目失败。");
      }

      setProblems((current) => [payload as ProblemListItem, ...current]);
      setDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "新增题目失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateProblem(problemId: string): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/admin/problems/${encodeURIComponent(problemId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            title: editingDraft.title,
            description: editingDraft.description,
            durationMinutes: Number.parseInt(editingDraft.durationMinutes, 10),
            templatePath: editingDraft.templatePath || null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "更新题目失败。");
      }

      const nextProblem = payload as ProblemListItem;
      setProblems((current) =>
        current.map((problem) => (problem.id === problemId ? nextProblem : problem)),
      );
      setEditingId(null);
      setEditingDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新题目失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteProblem(problemId: string): Promise<void> {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${controlPlaneOrigin}/api/admin/problems/${encodeURIComponent(problemId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "删除题目失败。");
      }

      setProblems((current) => current.filter((problem) => problem.id !== problemId));
      if (editingId === problemId) {
        setEditingId(null);
        setEditingDraft(emptyDraft);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除题目失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(problem: ProblemListItem): void {
    setEditingId(problem.id);
    setEditingDraft({
      title: problem.title,
      description: problem.description,
      durationMinutes: String(problem.durationMinutes),
      templatePath: problem.templatePath ?? "",
    });
  }

  return (
    <div className="grid">
      <section className="card">
        <h2 className="section-title">新增题目</h2>
        <div className="form-grid">
          <label className="form-field">
            <span>题目标题</span>
            <input
              value={draft.title}
              onChange={(event) => {
                setDraft((current) => ({ ...current, title: event.target.value }));
              }}
              placeholder="例如：实现一个限流器"
            />
          </label>
          <label className="form-field">
            <span>面试时长（分钟）</span>
            <input
              type="number"
              min="1"
              value={draft.durationMinutes}
              onChange={(event) => {
                setDraft((current) => ({ ...current, durationMinutes: event.target.value }));
              }}
            />
          </label>
          <label className="form-field field-span-2">
            <span>模板目录路径</span>
            <input
              value={draft.templatePath}
              onChange={(event) => {
                setDraft((current) => ({ ...current, templatePath: event.target.value }));
              }}
              placeholder="/path/to/problem-template"
            />
          </label>
          <label className="form-field field-span-2">
            <span>题目说明</span>
            <textarea
              value={draft.description}
              onChange={(event) => {
                setDraft((current) => ({ ...current, description: event.target.value }));
              }}
              rows={6}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            onClick={() => {
              void createProblem();
            }}
            disabled={isSubmitting}
            className="button-primary"
          >
            {isSubmitting ? "提交中..." : "新增题目"}
          </button>
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>

      <section className="card">
        <h2 className="section-title">题目列表</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>时长</th>
                <th>模板路径</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr key={problem.id}>
                  <td>
                    <strong>{problem.title}</strong>
                    <p className="table-subtext">{problem.description}</p>
                  </td>
                  <td>{problem.durationMinutes} 分钟</td>
                  <td>{problem.templatePath ?? "未设置"}</td>
                  <td>
                    <div className="button-row compact-row">
                      <button
                        type="button"
                        onClick={() => {
                          startEditing(problem);
                        }}
                        className="button-secondary"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteProblem(problem.id);
                        }}
                        className="button-danger"
                      >
                        删除
                      </button>
                    </div>
                    {editingId === problem.id ? (
                      <div className="edit-panel">
                        <label className="form-field">
                          <span>题目标题</span>
                          <input
                            value={editingDraft.title}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                title: event.target.value,
                              }));
                            }}
                          />
                        </label>
                        <label className="form-field">
                          <span>面试时长</span>
                          <input
                            type="number"
                            min="1"
                            value={editingDraft.durationMinutes}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                durationMinutes: event.target.value,
                              }));
                            }}
                          />
                        </label>
                        <label className="form-field">
                          <span>模板路径</span>
                          <input
                            value={editingDraft.templatePath}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                templatePath: event.target.value,
                              }));
                            }}
                          />
                        </label>
                        <label className="form-field">
                          <span>题目说明</span>
                          <textarea
                            value={editingDraft.description}
                            onChange={(event) => {
                              setEditingDraft((current) => ({
                                ...current,
                                description: event.target.value,
                              }));
                            }}
                            rows={4}
                          />
                        </label>
                        <div className="button-row compact-row">
                          <button
                            type="button"
                            onClick={() => {
                              void updateProblem(problem.id);
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
