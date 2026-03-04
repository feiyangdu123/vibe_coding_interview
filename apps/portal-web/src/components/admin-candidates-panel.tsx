"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CandidateListItem } from "@vibe-interview/shared-types";
import { formatAdminDateTime } from "../lib/admin-format";

type CandidateDrawerMode = "create" | "view" | "edit" | null;

interface CandidateFormState {
  name: string;
  email: string;
  phone: string;
  targetRole: string;
}

interface AdminCandidatesPanelProps {
  initialCandidates: CandidateListItem[];
  controlPlaneOrigin: string;
}

const emptyFormState: CandidateFormState = {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerMode, setDrawerMode] = useState<CandidateDrawerMode>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CandidateFormState>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCandidate = selectedCandidateId
    ? candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null
    : null;
  const filteredCandidates = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) {
      return candidates;
    }

    return candidates.filter((candidate) => {
      const haystack = [
        candidate.name,
        candidate.email,
        candidate.phone ?? "",
        candidate.targetRole ?? "",
      ]
        .join("\n")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [candidates, searchQuery]);

  function openCreateDrawer(): void {
    setErrorMessage(null);
    setSelectedCandidateId(null);
    setFormState(emptyFormState);
    setDrawerMode("create");
  }

  function openViewDrawer(candidate: CandidateListItem): void {
    setErrorMessage(null);
    setSelectedCandidateId(candidate.id);
    setDrawerMode("view");
  }

  function openEditDrawer(candidate: CandidateListItem): void {
    setErrorMessage(null);
    setSelectedCandidateId(candidate.id);
    setFormState({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone ?? "",
      targetRole: candidate.targetRole ?? "",
    });
    setDrawerMode("edit");
  }

  function closeDrawer(): void {
    setDrawerMode(null);
    setSelectedCandidateId(null);
    setFormState(emptyFormState);
    setErrorMessage(null);
  }

  async function submitCandidate(): Promise<void> {
    if (drawerMode !== "create" && drawerMode !== "edit") {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const candidateId = drawerMode === "edit" ? selectedCandidateId : null;
    const requestUrl =
      drawerMode === "edit" && candidateId
        ? `${controlPlaneOrigin}/api/admin/candidates/${encodeURIComponent(candidateId)}`
        : `${controlPlaneOrigin}/api/admin/candidates`;

    try {
      const response = await fetch(requestUrl, {
        method: drawerMode === "edit" ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          phone: formState.phone || null,
          targetRole: formState.targetRole || null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "保存候选人失败。");
      }

      const nextCandidate = payload as CandidateListItem;

      if (drawerMode === "create") {
        setCandidates((current) => [nextCandidate, ...current]);
      } else if (candidateId) {
        setCandidates((current) =>
          current.map((candidate) => (candidate.id === candidateId ? nextCandidate : candidate)),
        );
      }

      closeDrawer();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存候选人失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="card admin-card">
        <div className="admin-toolbar">
          <label className="admin-search">
            <span>搜索候选人</span>
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              placeholder="按姓名、邮箱、电话或岗位搜索"
            />
          </label>

          <button
            type="button"
            className="button-primary"
            onClick={() => {
              openCreateDrawer();
            }}
          >
            新建候选人
          </button>
        </div>

        {errorMessage && drawerMode === null ? <p className="error-text">{errorMessage}</p> : null}

        <div className="table-wrap">
          <table className="data-table admin-data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>邮箱</th>
                <th>电话</th>
                <th>应聘岗位</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="admin-empty">没有匹配的候选人记录。</p>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>
                      <div className="cell-title">{candidate.name}</div>
                    </td>
                    <td>{candidate.email}</td>
                    <td>{candidate.phone ?? "未填写"}</td>
                    <td>{candidate.targetRole ?? "未填写"}</td>
                    <td>{formatAdminDateTime(candidate.createdAt)}</td>
                    <td>
                      <div className="button-row compact-row">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => {
                            openViewDrawer(candidate);
                          }}
                        >
                          查看
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => {
                            openEditDrawer(candidate);
                          }}
                        >
                          编辑
                        </button>
                        <Link
                          href={`/admin/interviews/new?candidateId=${encodeURIComponent(candidate.id)}`}
                          className="link-button"
                        >
                          发面试链接
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {drawerMode ? (
        <>
          <button
            type="button"
            className="admin-side-sheet-backdrop"
            onClick={() => {
              closeDrawer();
            }}
            aria-label="关闭候选人抽屉"
          />

          <aside className="admin-side-sheet" role="dialog" aria-modal="true">
            <div className="admin-side-sheet__header">
              <div>
                <p className="eyebrow">
                  {drawerMode === "create"
                    ? "新建候选人"
                    : drawerMode === "edit"
                      ? "编辑候选人"
                      : "候选人详情"}
                </p>
                <h2 className="section-title">
                  {drawerMode === "create"
                    ? "新增候选人"
                    : selectedCandidate?.name ?? "候选人详情"}
                </h2>
              </div>

              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  closeDrawer();
                }}
              >
                关闭
              </button>
            </div>

            {drawerMode === "view" && selectedCandidate ? (
              <>
                <div className="admin-side-sheet__body">
                  <div className="admin-kv-grid">
                    <div>
                      <span className="admin-kv-grid__label">姓名</span>
                      <strong>{selectedCandidate.name}</strong>
                    </div>
                    <div>
                      <span className="admin-kv-grid__label">邮箱</span>
                      <strong>{selectedCandidate.email}</strong>
                    </div>
                    <div>
                      <span className="admin-kv-grid__label">电话</span>
                      <strong>{selectedCandidate.phone ?? "未填写"}</strong>
                    </div>
                    <div>
                      <span className="admin-kv-grid__label">应聘岗位</span>
                      <strong>{selectedCandidate.targetRole ?? "未填写"}</strong>
                    </div>
                    <div>
                      <span className="admin-kv-grid__label">创建时间</span>
                      <strong>{formatAdminDateTime(selectedCandidate.createdAt)}</strong>
                    </div>
                    <div>
                      <span className="admin-kv-grid__label">更新时间</span>
                      <strong>{formatAdminDateTime(selectedCandidate.updatedAt)}</strong>
                    </div>
                  </div>
                </div>

                <div className="admin-side-sheet__footer">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      openEditDrawer(selectedCandidate);
                    }}
                  >
                    编辑候选人
                  </button>
                  <Link
                    href={`/admin/interviews/new?candidateId=${encodeURIComponent(selectedCandidate.id)}`}
                    className="nav-pill"
                  >
                    发面试链接
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="admin-side-sheet__body">
                  <div className="form-grid">
                    <label className="form-field">
                      <span>姓名</span>
                      <input
                        value={formState.name}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            name: event.target.value,
                          }));
                        }}
                        placeholder="例如：张三"
                      />
                    </label>

                    <label className="form-field">
                      <span>邮箱</span>
                      <input
                        value={formState.email}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            email: event.target.value,
                          }));
                        }}
                        placeholder="zhangsan@example.com"
                      />
                    </label>

                    <label className="form-field">
                      <span>电话</span>
                      <input
                        value={formState.phone}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            phone: event.target.value,
                          }));
                        }}
                        placeholder="可选"
                      />
                    </label>

                    <label className="form-field">
                      <span>应聘岗位</span>
                      <input
                        value={formState.targetRole}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            targetRole: event.target.value,
                          }));
                        }}
                        placeholder="可选"
                      />
                    </label>

                    {drawerMode === "edit" && selectedCandidate ? (
                      <>
                        <div className="form-field">
                          <span>创建时间</span>
                          <input value={formatAdminDateTime(selectedCandidate.createdAt)} readOnly />
                        </div>
                        <div className="form-field">
                          <span>更新时间</span>
                          <input value={formatAdminDateTime(selectedCandidate.updatedAt)} readOnly />
                        </div>
                      </>
                    ) : null}
                  </div>

                  {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
                </div>

                <div className="admin-side-sheet__footer">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      closeDrawer();
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => {
                      void submitCandidate();
                    }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "保存中..." : drawerMode === "create" ? "创建候选人" : "保存修改"}
                  </button>
                </div>
              </>
            )}
          </aside>
        </>
      ) : null}
    </>
  );
}
