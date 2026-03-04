"use client";

import { useMemo, useState } from "react";
import {
  problemDifficulties,
  type ProblemDifficulty,
  type ProblemListItem,
} from "@vibe-interview/shared-types";
import {
  formatAdminDateTime,
  toProblemDifficultyLabel,
  toProblemTypeLabel,
} from "../lib/admin-format";

type ProblemDrawerMode = "create" | "preview" | "edit" | null;

interface ProblemFormState {
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  durationMinutes: string;
  templatePath: string;
}

interface AdminProblemsPanelProps {
  initialProblems: ProblemListItem[];
  controlPlaneOrigin: string;
}

const emptyFormState: ProblemFormState = {
  title: "",
  description: "",
  difficulty: "MEDIUM",
  durationMinutes: "60",
  templatePath: "",
};

export function AdminProblemsPanel({
  initialProblems,
  controlPlaneOrigin,
}: AdminProblemsPanelProps) {
  const [problems, setProblems] = useState(initialProblems);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerMode, setDrawerMode] = useState<ProblemDrawerMode>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProblemFormState>(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedProblem = selectedProblemId
    ? problems.find((problem) => problem.id === selectedProblemId) ?? null
    : null;
  const filteredProblems = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) {
      return problems;
    }

    return problems.filter((problem) => {
      const haystack = `${problem.title}\n${problem.description}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [problems, searchQuery]);

  function openCreateDrawer(): void {
    setErrorMessage(null);
    setSelectedProblemId(null);
    setFormState(emptyFormState);
    setDrawerMode("create");
  }

  function openPreviewDrawer(problem: ProblemListItem): void {
    setErrorMessage(null);
    setSelectedProblemId(problem.id);
    setDrawerMode("preview");
  }

  function openEditDrawer(problem: ProblemListItem): void {
    setErrorMessage(null);
    setSelectedProblemId(problem.id);
    setFormState({
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      durationMinutes: String(problem.durationMinutes),
      templatePath: problem.templatePath ?? "",
    });
    setDrawerMode("edit");
  }

  function closeDrawer(): void {
    setDrawerMode(null);
    setSelectedProblemId(null);
    setFormState(emptyFormState);
    setErrorMessage(null);
  }

  async function submitProblem(): Promise<void> {
    if (drawerMode !== "create" && drawerMode !== "edit") {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const problemId = drawerMode === "edit" ? selectedProblemId : null;
    const requestUrl =
      drawerMode === "edit" && problemId
        ? `${controlPlaneOrigin}/api/admin/problems/${encodeURIComponent(problemId)}`
        : `${controlPlaneOrigin}/api/admin/problems`;

    try {
      const response = await fetch(requestUrl, {
        method: drawerMode === "edit" ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: formState.title,
          description: formState.description,
          difficulty: formState.difficulty,
          durationMinutes: Number.parseInt(formState.durationMinutes, 10),
          templatePath: formState.templatePath || null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message ?? "保存题目失败。");
      }

      const nextProblem = payload as ProblemListItem;

      if (drawerMode === "create") {
        setProblems((current) => [nextProblem, ...current]);
      } else if (problemId) {
        setProblems((current) =>
          current.map((problem) => (problem.id === problemId ? nextProblem : problem)),
        );
      }

      closeDrawer();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存题目失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="card admin-card">
        <div className="admin-toolbar">
          <label className="admin-search">
            <span>搜索题目</span>
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              placeholder="按标题或内容搜索"
            />
          </label>

          <button
            type="button"
            className="button-primary"
            onClick={() => {
              openCreateDrawer();
            }}
          >
            新建题目
          </button>
        </div>

        {errorMessage && drawerMode === null ? <p className="error-text">{errorMessage}</p> : null}

        <div className="table-wrap">
          <table className="data-table admin-data-table">
            <thead>
              <tr>
                <th>题目标题</th>
                <th>内容</th>
                <th>题目类型</th>
                <th>难度</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredProblems.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="admin-empty">没有匹配的题目记录。</p>
                  </td>
                </tr>
              ) : (
                filteredProblems.map((problem) => (
                  <tr key={problem.id}>
                    <td>
                      <div className="cell-title">{problem.title}</div>
                    </td>
                    <td>
                      <p className="cell-clamp">{problem.description}</p>
                    </td>
                    <td>
                      <span className="tag">{toProblemTypeLabel(problem.type)}</span>
                    </td>
                    <td>{toProblemDifficultyLabel(problem.difficulty)}</td>
                    <td>{formatAdminDateTime(problem.createdAt)}</td>
                    <td>
                      <div className="button-row compact-row">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => {
                            openPreviewDrawer(problem);
                          }}
                        >
                          预览
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => {
                            openEditDrawer(problem);
                          }}
                        >
                          编辑
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

      {drawerMode ? (
        <>
          <button
            type="button"
            className="admin-side-sheet-backdrop"
            onClick={() => {
              closeDrawer();
            }}
            aria-label="关闭题目抽屉"
          />

          <aside className="admin-side-sheet" role="dialog" aria-modal="true">
            <div className="admin-side-sheet__header">
              <div>
                <p className="eyebrow">
                  {drawerMode === "create"
                    ? "新建题目"
                    : drawerMode === "edit"
                      ? "编辑题目"
                      : "预览题目"}
                </p>
                <h2 className="section-title">
                  {drawerMode === "create"
                    ? "新建实操题"
                    : selectedProblem?.title ?? "题目详情"}
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

            {drawerMode === "preview" && selectedProblem ? (
              <>
                <div className="admin-side-sheet__body">
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
                    <div>
                      <span className="admin-kv-grid__label">创建时间</span>
                      <strong>{formatAdminDateTime(selectedProblem.createdAt)}</strong>
                    </div>
                    <div>
                      <span className="admin-kv-grid__label">更新时间</span>
                      <strong>{formatAdminDateTime(selectedProblem.updatedAt)}</strong>
                    </div>
                  </div>

                  <section className="admin-section-block">
                    <h3 className="admin-section-block__title">题目说明</h3>
                    <p className="admin-content-text">{selectedProblem.description}</p>
                  </section>
                </div>

                <div className="admin-side-sheet__footer">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      openEditDrawer(selectedProblem);
                    }}
                  >
                    编辑题目
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="admin-side-sheet__body">
                  <div className="form-grid">
                    <label className="form-field field-span-2">
                      <span>题目标题</span>
                      <input
                        value={formState.title}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            title: event.target.value,
                          }));
                        }}
                        placeholder="例如：实现一个并发队列"
                      />
                    </label>

                    <label className="form-field">
                      <span>题目类型</span>
                      <input value="实操题" readOnly />
                    </label>

                    <label className="form-field">
                      <span>难度</span>
                      <select
                        value={formState.difficulty}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            difficulty: event.target.value as ProblemDifficulty,
                          }));
                        }}
                      >
                        {problemDifficulties.map((difficulty) => (
                          <option key={difficulty} value={difficulty}>
                            {toProblemDifficultyLabel(difficulty)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <span>面试时长（分钟）</span>
                      <input
                        type="number"
                        min="1"
                        value={formState.durationMinutes}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            durationMinutes: event.target.value,
                          }));
                        }}
                      />
                    </label>

                    <label className="form-field">
                      <span>模板目录路径</span>
                      <input
                        value={formState.templatePath}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            templatePath: event.target.value,
                          }));
                        }}
                        placeholder="/path/to/problem-template"
                      />
                    </label>

                    {drawerMode === "edit" && selectedProblem ? (
                      <>
                        <div className="form-field">
                          <span>创建时间</span>
                          <input value={formatAdminDateTime(selectedProblem.createdAt)} readOnly />
                        </div>
                        <div className="form-field">
                          <span>更新时间</span>
                          <input value={formatAdminDateTime(selectedProblem.updatedAt)} readOnly />
                        </div>
                      </>
                    ) : null}

                    <label className="form-field field-span-2">
                      <span>题目内容</span>
                      <textarea
                        value={formState.description}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            description: event.target.value,
                          }));
                        }}
                        rows={10}
                        placeholder="描述题目目标、输入输出和验收要求"
                      />
                    </label>
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
                      void submitProblem();
                    }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "保存中..." : drawerMode === "create" ? "创建题目" : "保存修改"}
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
