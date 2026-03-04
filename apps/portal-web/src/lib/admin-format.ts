import type { ProblemDifficulty, ProblemType, SessionStatus } from "@vibe-interview/shared-types";

export function formatAdminDateTime(
  value: string | null,
  emptyLabel = "未开始",
): string {
  if (!value) {
    return emptyLabel;
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

export function toProblemTypeLabel(type: ProblemType): string {
  switch (type) {
    case "PRACTICAL":
      return "实操题";
    default:
      return type;
  }
}

export function toProblemDifficultyLabel(difficulty: ProblemDifficulty): string {
  switch (difficulty) {
    case "EASY":
      return "简单";
    case "MEDIUM":
      return "中等";
    case "HARD":
      return "困难";
    default:
      return difficulty;
  }
}

export function toSessionStatusLabel(status: SessionStatus | string): string {
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
