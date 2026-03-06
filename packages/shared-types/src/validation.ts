import { z } from "zod"

// 题目验证
export const problemSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题过长"),
  description: z.string().min(1, "描述不能为空"),
  requirements: z.string().min(1, "要求不能为空"),
  duration: z.number().min(1, "时长至少1分钟").max(480, "时长不能超过8小时"),
  workDirTemplate: z.string().min(1, "工作目录不能为空"),
  scoringCriteria: z.record(z.string(), z.any()).optional()
})

export type ProblemFormData = z.infer<typeof problemSchema>

// 候选人验证
export const candidateSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(100, "姓名过长"),
  email: z.string().email("邮箱格式不正确"),
  phone: z.string().optional().refine(
    (val) => !val || /^1[3-9]\d{9}$/.test(val),
    "手机号格式不正确"
  )
})

export type CandidateFormData = z.infer<typeof candidateSchema>

// 面试验证
export const interviewSchema = z.object({
  candidateId: z.string().uuid("请选择候选人"),
  problemId: z.string().uuid("请选择题目"),
  duration: z.number().min(1, "时长至少1分钟")
})

export type InterviewFormData = z.infer<typeof interviewSchema>
