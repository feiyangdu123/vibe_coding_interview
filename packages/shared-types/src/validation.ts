import { z } from "zod"

const scheduledDateTimeSchema = z.string().min(1, "请选择预约开始时间").refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "预约开始时间格式不正确"
)

// 题目验证
export const problemSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题过长"),
  description: z.string().min(1, "描述不能为空"),
  requirements: z.string().min(1, "要求不能为空"),
  duration: z.number().min(1, "时长至少1分钟").max(480, "时长不能超过8小时"),
  workDirTemplate: z.string().min(1, "工作目录不能为空"),
  scoringCriteria: z.record(z.string(), z.any()).optional(),
  visibility: z.enum(['PRIVATE', 'ORG_SHARED']).optional(),
  problemType: z.enum(['ALGORITHM_MODELING', 'FEATURE_DEV', 'DEBUG_FIX', 'DATA_PROCESSING', 'AGENT_DEV', 'ITERATION_REFACTOR', 'PRODUCT_DESIGN']).optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  positions: z.array(z.string()).optional(),
  scoringRubric: z.string().optional()
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

export const registerSchema = z.object({
  organizationName: z.string().min(2, "企业名称至少 2 个字符").max(100, "企业名称过长"),
  username: z.string().min(3, "用户名至少 3 个字符").max(50, "用户名过长"),
  email: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  password: z.string().min(6, "密码至少 6 位")
})

export type RegisterFormData = z.infer<typeof registerSchema>

export const organizationUserSchema = z.object({
  username: z.string().min(3, "用户名至少 3 个字符").max(50, "用户名过长"),
  email: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  password: z.string().min(6, "密码至少 6 位"),
  role: z.enum(['PLATFORM_ADMIN', 'ORG_ADMIN', 'INTERVIEWER'])
})

export type OrganizationUserFormData = z.infer<typeof organizationUserSchema>

export const organizationApiKeyConfigCreateSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  baseUrl: z.string().url("Base URL 格式不正确").max(500, "Base URL 过长"),
  apiKey: z.string().min(1, "API Key 不能为空").max(5000, "API Key 过长"),
  modelId: z.string().min(1, "模型 ID 不能为空").max(200, "模型 ID 过长")
})

export type OrganizationApiKeyConfigCreateFormData = z.infer<typeof organizationApiKeyConfigCreateSchema>

export const organizationApiKeyConfigUpdateSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  baseUrl: z.string().url("Base URL 格式不正确").max(500, "Base URL 过长"),
  apiKey: z.string().max(5000, "API Key 过长").optional(),
  modelId: z.string().min(1, "模型 ID 不能为空").max(200, "模型 ID 过长").optional()
})

export type OrganizationApiKeyConfigUpdateFormData = z.infer<typeof organizationApiKeyConfigUpdateSchema>

// 面试验证
export const interviewSchema = z.object({
  candidateId: z.string().uuid("请选择候选人"),
  problemId: z.string().uuid("请选择题目"),
  duration: z.number().min(1, "时长至少1分钟")
})

export type InterviewFormData = z.infer<typeof interviewSchema>

// 面试创建验证（支持内联创建候选人）
export const interviewCreateSchema = z.object({
  positionName: z.string().optional(),
  interviewerId: z.string().uuid().optional(),
  problemId: z.string().uuid("请选择题目"),
  scheduledStartAt: scheduledDateTimeSchema,
  duration: z.number().min(1, "时长至少1分钟"),
  candidateMode: z.enum(['existing', 'new', 'bulk']),
  candidateIds: z.array(z.string().uuid()).default([]),
  newCandidate: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().optional()
  }).optional()
}).superRefine((data, ctx) => {
  if (data.candidateMode === 'existing') {
    if (data.candidateIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请至少选择一位候选人",
        path: ['candidateIds']
      })
    }
  } else if (data.candidateMode === 'new') {
    if (!data.newCandidate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请填写候选人信息",
        path: ['newCandidate']
      })
    } else {
      if (!data.newCandidate.name || data.newCandidate.name.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "姓名不能为空",
          path: ['newCandidate', 'name']
        })
      }
      if (!data.newCandidate.email || data.newCandidate.email.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "邮箱不能为空",
          path: ['newCandidate', 'email']
        })
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.newCandidate.email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "邮箱格式不正确",
          path: ['newCandidate', 'email']
        })
      }
    }
  }
})

export type InterviewCreateFormData = z.input<typeof interviewCreateSchema>

// 批量创建面试验证
export const batchCreateInterviewSchema = z.object({
  positionName: z.string().optional(),
  interviewerId: z.string().uuid().optional(),
  problemId: z.string().min(1, "请选择题目"),
  scheduledStartAt: scheduledDateTimeSchema,
  duration: z.number().int().positive("时长必须为正整数"),
  candidates: z.array(z.object({
    name: z.string().min(1, "姓名不能为空"),
    email: z.string().email("邮箱格式不正确"),
    phone: z.string().optional()
  })).min(1, "至少需要一位候选人").max(100, "最多支持100位候选人")
})

export type BatchCreateInterviewFormData = z.infer<typeof batchCreateInterviewSchema>
