'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { toast } from 'sonner'
import {
  interviewCreateSchema,
  type InterviewCreateFormData,
  type InterviewDraft,
  type InterviewQuotaSummary
} from '@vibe/shared-types'
import { apiFetch } from '@/lib/api'
import { copyToClipboard } from '@/lib/clipboard'
import { BulkCandidateImport } from '@/components/interview/bulk-candidate-import'

interface User {
  id: string
  username: string
  email?: string
}

interface Candidate {
  id: string
  name: string
  email: string
  phone?: string
  interviewCount?: number
}

interface Problem {
  id: string
  title: string
  description: string
  duration: number
  difficulty?: string
  problemType?: string
  visibility?: string
}

function toDateTimeInputValue(value?: string | Date | null) {
  if (!value) return ''

  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function toApiDateTimeValue(value: string) {
  return new Date(value).toISOString()
}

export default function CreateInterviewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [interviewLink, setInterviewLink] = useState('')
  const [bulkCandidates, setBulkCandidates] = useState<Array<{ name: string; email: string; phone?: string }>>([])
  const [batchResultDialogOpen, setBatchResultDialogOpen] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)
  const [quotaSummary, setQuotaSummary] = useState<InterviewQuotaSummary | null>(null)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [hideInterviewedCandidates, setHideInterviewedCandidates] = useState(false)

  const form = useForm<InterviewCreateFormData>({
    resolver: zodResolver(interviewCreateSchema),
    mode: 'onChange',
    defaultValues: {
      positionName: '',
      interviewerId: '',
      problemId: '',
      scheduledStartAt: toDateTimeInputValue(new Date()),
      duration: 60,
      candidateMode: 'existing',
      candidateIds: [],
      newCandidate: {
        name: '',
        email: '',
        phone: ''
      }
    }
  })

  const candidateMode = form.watch('candidateMode')
  const problemId = form.watch('problemId')
  const scheduledStartAt = form.watch('scheduledStartAt')
  const selectedCandidateIds = form.watch('candidateIds') ?? []
  const filteredCandidates = candidates.filter(candidate => {
    if (hideInterviewedCandidates && (candidate.interviewCount || 0) > 0) {
      return false
    }

    if (!candidateSearch.trim()) {
      return true
    }

    const keyword = candidateSearch.trim().toLowerCase()
    return (
      candidate.name.toLowerCase().includes(keyword) ||
      candidate.email.toLowerCase().includes(keyword)
    )
  })
  const requestedQuotaCount =
    candidateMode === 'bulk'
      ? bulkCandidates.length
      : candidateMode === 'existing'
        ? selectedCandidateIds.length
        : 1
  const quotaInsufficient =
    quotaSummary !== null &&
    requestedQuotaCount > 0 &&
    quotaSummary.availableCount < requestedQuotaCount

  const loadQuotaSummary = async () => {
    try {
      const quota = await apiFetch('/api/admin/interview-quota')
      setQuotaSummary(quota)
    } catch (error) {
      console.error('Load interview quota failed:', error)
      setQuotaSummary(null)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersRes, candidatesRes, problemsRes] = await Promise.all([
          apiFetch('/api/admin/users?limit=1000'),
          apiFetch('/api/admin/candidates?limit=1000'),
          apiFetch('/api/admin/problems?limit=1000')
        ])

        setUsers(usersRes.data || usersRes)
        setCandidates(candidatesRes.data || candidatesRes)
        setProblems(problemsRes.data || problemsRes)
        await loadQuotaSummary()

        // Set default interviewer to current user if available
        if (usersRes.data && usersRes.data.length > 0) {
          form.setValue('interviewerId', usersRes.data[0].id)
        }

        // Load draft
        try {
          const draft = await apiFetch('/api/admin/interview-drafts/current')
          if (draft) {
            form.reset({
              positionName: draft.positionName || '',
              interviewerId: draft.interviewerId || (usersRes.data && usersRes.data.length > 0 ? usersRes.data[0].id : ''),
              problemId: draft.problemId || '',
              scheduledStartAt: toDateTimeInputValue(draft.scheduledStartAt),
              duration: draft.duration || 60,
              candidateMode: draft.candidateMode || 'existing',
              candidateIds: draft.candidateIds || (draft.candidateId ? [draft.candidateId] : []),
              newCandidate: {
                name: draft.newCandidateName || '',
                email: draft.newCandidateEmail || '',
                phone: draft.newCandidatePhone || ''
              }
            })
            toast.info('已恢复草稿')
          }
        } catch (err) {
          console.error('Load draft failed:', err)
        }

        setLoading(false)
      } catch (err) {
        console.error(err)
        toast.error('加载数据失败')
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (problemId) {
      const problem = problems.find(p => p.id === problemId)
      if (problem) {
        setSelectedProblem(problem)
        form.setValue('duration', problem.duration)
      }
    } else {
      setSelectedProblem(null)
    }
  }, [problemId, problems])

  const handleSaveDraft = async () => {
    const values = form.getValues()
    try {
      await apiFetch('/api/admin/interview-drafts', {
        method: 'POST',
        body: JSON.stringify({
          positionName: values.positionName,
          interviewerId: values.interviewerId,
          problemId: values.problemId,
          scheduledStartAt: values.scheduledStartAt ? toApiDateTimeValue(values.scheduledStartAt) : undefined,
          duration: values.duration,
          candidateMode: values.candidateMode,
          candidateIds: values.candidateIds ?? [],
          newCandidateName: values.newCandidate?.name,
          newCandidateEmail: values.newCandidate?.email,
          newCandidatePhone: values.newCandidate?.phone
        })
      })
      toast.success('草稿已保存')
    } catch (err) {
      toast.error('保存草稿失败')
    }
  }

  const onSubmit = async (data: InterviewCreateFormData) => {
    console.log('Form submitted with data:', data)
    setSubmitting(true)

    try {
      const payloadBase = {
        positionName: data.positionName,
        interviewerId: data.interviewerId,
        problemId: data.problemId,
        scheduledStartAt: toApiDateTimeValue(data.scheduledStartAt),
        duration: data.duration
      }

      if (data.candidateMode === 'bulk') {
        const result = await apiFetch('/api/admin/interviews/batch', {
          method: 'POST',
          body: JSON.stringify({
            ...payloadBase,
            candidates: bulkCandidates
          })
        })

        setBatchResult(result)
        setBatchResultDialogOpen(true)
        await loadQuotaSummary()

        // 清除草稿
        try {
          await apiFetch('/api/admin/interview-drafts/current', { method: 'DELETE' })
        } catch {}
      } else if (data.candidateMode === 'existing') {
        const existingCandidateIds = data.candidateIds ?? []
        const selectedCandidates = existingCandidateIds
          .map(candidateId => candidates.find(candidate => candidate.id === candidateId))
          .filter((candidate): candidate is Candidate => Boolean(candidate))

        if (selectedCandidates.length !== existingCandidateIds.length) {
          throw new Error('部分候选人不存在，请刷新页面后重试')
        }

        if (selectedCandidates.length > 1) {
          const result = await apiFetch('/api/admin/interviews/batch', {
            method: 'POST',
            body: JSON.stringify({
              ...payloadBase,
              candidates: selectedCandidates.map(candidate => ({
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone
              }))
            })
          })

          setBatchResult(result)
          setBatchResultDialogOpen(true)
          await loadQuotaSummary()

          try {
            await apiFetch('/api/admin/interview-drafts/current', { method: 'DELETE' })
          } catch {}
        } else {
          const interview = await apiFetch('/api/admin/interviews', {
            method: 'POST',
            body: JSON.stringify({
              ...payloadBase,
              candidateId: selectedCandidates[0].id
            })
          })

          try {
            await apiFetch('/api/admin/interview-drafts/current', { method: 'DELETE' })
          } catch {}

          const link = `${window.location.origin}/interview/${interview.token}`
          setInterviewLink(link)
          copyToClipboard(link)
          setSuccessDialogOpen(true)
          await loadQuotaSummary()
        }
      } else {
        const interview = await apiFetch('/api/admin/interviews', {
          method: 'POST',
          body: JSON.stringify({
            ...payloadBase,
            newCandidate: data.newCandidate
          })
        })

        // 清除草稿
        try {
          await apiFetch('/api/admin/interview-drafts/current', { method: 'DELETE' })
        } catch {}

        const link = `${window.location.origin}/interview/${interview.token}`
        setInterviewLink(link)
        copyToClipboard(link)
        setSuccessDialogOpen(true)
        await loadQuotaSummary()
      }
    } catch (err) {
      console.error('Interview creation error:', err)
      toast.error(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateAnother = () => {
    setSuccessDialogOpen(false)
    form.reset({
      positionName: '',
      interviewerId: users.length > 0 ? users[0].id : '',
      problemId: '',
      scheduledStartAt: toDateTimeInputValue(new Date()),
      duration: 60,
      candidateMode: 'existing',
      candidateIds: [],
      newCandidate: {
        name: '',
        email: '',
        phone: ''
      }
    })
    setSelectedProblem(null)
    setBulkCandidates([])
    setCandidateSearch('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="console-page max-w-5xl">
      <PageHeader
        meta="Interview Creation"
        title="创建面试"
        description="配置岗位、题目、时长和候选人来源，支持草稿恢复、模板复制与批量导入。"
        actions={
          <Button variant="outline" onClick={() => router.push('/admin/interviews')}>
            返回列表
          </Button>
        }
      />

      <Card className="mb-6 border-blue-100 bg-blue-50/70">
        <CardContent className="flex flex-col gap-3 pt-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-medium text-blue-700">面试配额</div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-blue-900">
              <Badge variant="outline">剩余可创建 {quotaSummary?.availableCount ?? '--'} 场</Badge>
              <Badge variant="secondary">预占中 {quotaSummary?.reservedCount ?? '--'} 场</Badge>
              <Badge variant="secondary">已消耗 {quotaSummary?.consumedCount ?? '--'} 场</Badge>
              <Badge variant="secondary">总额 {quotaSummary?.totalGranted ?? '--'} 场</Badge>
            </div>
            <div className="mt-2 text-sm text-blue-900/80">
              本次将预占 {requestedQuotaCount} 场；面试正常结束后实扣，取消、未到场和系统错误会释放预占。
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin/interview-quota')}>
            查看场次流水
          </Button>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.log('Validation errors:', errors)
          const errorMessages = Object.entries(errors).map(([key, error]) => {
            if (key === 'newCandidate' && typeof error === 'object') {
              return Object.entries(error).map(([field, fieldError]: [string, any]) =>
                `${field}: ${fieldError?.message || '验证失败'}`
              ).join(', ')
            }
            return `${key}: ${(error as any)?.message || '验证失败'}`
          }).join('; ')
          toast.error(`表单验证失败: ${errorMessages}`)
        })} className="space-y-6">
          {/* Section 1: 职位信息 */}
          <Card>
            <CardHeader>
              <CardTitle>职位信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="positionName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>职位名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：高级前端工程师" {...field} />
                    </FormControl>
                    <FormDescription>可选，用于标识面试职位</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interviewerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>面试官</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择面试官" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username} {user.email && `(${user.email})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduledStartAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>预约开始时间</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>
                      候选人可在预约前 15 分钟开始，最晚在预约后 30 分钟内入场。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 2: 题目选择 */}
          <Card>
            <CardHeader>
              <CardTitle>题目选择</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="problemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>面试题目</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择题目" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {problems.map(problem => (
                          <SelectItem key={problem.id} value={problem.id}>
                            <span className="text-muted-foreground text-xs mr-1">
                              {problem.visibility === 'ORG_SHARED' ? '[共享]' : '[私有]'}
                            </span>
                            {problem.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedProblem && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">{selectedProblem.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedProblem.description.length > 200
                        ? `${selectedProblem.description.substring(0, 200)}...`
                        : selectedProblem.description}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">时长: {selectedProblem.duration}分钟</Badge>
                      {selectedProblem.difficulty && (
                        <Badge variant="secondary">{selectedProblem.difficulty}</Badge>
                      )}
                      {selectedProblem.problemType && (
                        <Badge variant="secondary">{selectedProblem.problemType}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <p className="text-sm text-muted-foreground">
                没有合适的题目？去
                <a href="/admin/problems" className="text-primary underline underline-offset-4 hover:text-primary/80 mx-1">
                  题目管理
                </a>
                浏览平台模板并复制到企业题库。
              </p>
            </CardContent>
          </Card>

          {/* Section 3: 面试时长 */}
          <Card>
            <CardHeader>
              <CardTitle>面试时长</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>时长（分钟）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>面试时长会从题目自动填充，可手动调整</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 4: 候选人信息 */}
          <Card>
            <CardHeader>
              <CardTitle>候选人信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="candidateMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>候选人选择方式</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="existing" />
                          <Label htmlFor="existing">选择已有候选人</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="new" />
                          <Label htmlFor="new">创建新候选人</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="bulk" id="bulk" />
                          <Label htmlFor="bulk">批量导入</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {candidateMode === 'existing' ? (
                <FormField
                  control={form.control}
                  name="candidateIds"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <FormLabel>选择候选人</FormLabel>
                          <FormDescription>可一次选择多位候选人批量创建面试</FormDescription>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={hideInterviewedCandidates}
                            onChange={event => {
                              const checked = event.target.checked
                              setHideInterviewedCandidates(checked)
                              if (checked) {
                                const nextSelectedIds = (field.value || []).filter((candidateId: string) => {
                                  const candidate = candidates.find(item => item.id === candidateId)
                                  return candidate ? (candidate.interviewCount || 0) === 0 : false
                                })
                                field.onChange(nextSelectedIds)
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          隐藏已创建过面试的候选人
                        </label>
                      </div>
                      <FormControl>
                        <div className="space-y-3">
                          <Input
                            value={candidateSearch}
                            onChange={event => setCandidateSearch(event.target.value)}
                            placeholder="搜索候选人姓名或邮箱"
                          />
                          <div className="rounded-lg border border-border">
                            <div className="border-b border-border px-3 py-2 text-sm text-muted-foreground">
                              已选择 {field.value?.length || 0} 位候选人
                            </div>
                            <div className="max-h-72 overflow-y-auto p-2">
                              {filteredCandidates.length === 0 ? (
                                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                  {hideInterviewedCandidates
                                    ? '当前没有可展示的候选人，请关闭筛选或调整搜索条件'
                                    : '未找到匹配的候选人'}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {filteredCandidates.map(candidate => {
                                    const checked = (field.value || []).includes(candidate.id)
                                    return (
                                      <label
                                        key={candidate.id}
                                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
                                          checked
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:bg-muted/40'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            const currentValue = field.value || []
                                            field.onChange(
                                              checked
                                                ? currentValue.filter((candidateId: string) => candidateId !== candidate.id)
                                                : [...currentValue, candidate.id]
                                            )
                                          }}
                                          className="mt-1 h-4 w-4 rounded border-slate-300"
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium text-slate-900">{candidate.name}</div>
                                          <div className="text-sm text-muted-foreground">{candidate.email}</div>
                                        </div>
                                        {(candidate.interviewCount || 0) > 0 && (
                                          <Badge variant="secondary">
                                            已有 {candidate.interviewCount} 场面试
                                          </Badge>
                                        )}
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : candidateMode === 'new' ? (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="newCandidate.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓名</FormLabel>
                        <FormControl>
                          <Input placeholder="候选人姓名" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="newCandidate.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="candidate@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="newCandidate.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>电话</FormLabel>
                        <FormControl>
                          <Input placeholder="联系电话（可选）" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : candidateMode === 'bulk' ? (
                <div className="space-y-4">
                  <BulkCandidateImport onImport={setBulkCandidates} />
                  {bulkCandidates.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <p className="text-sm font-medium mb-2">已导入 {bulkCandidates.length} 位候选人：</p>
                      <ul className="text-sm space-y-1">
                        {bulkCandidates.slice(0, 5).map((c, i) => (
                          <li key={i}>{c.name} - {c.email}</li>
                        ))}
                        {bulkCandidates.length > 5 && (
                          <li className="text-gray-500">...还有 {bulkCandidates.length - 5} 位</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {scheduledStartAt && (
            <Card className="border-dashed">
              <CardContent className="pt-4 text-sm text-slate-600">
                预约开始：{new Date(toApiDateTimeValue(scheduledStartAt)).toLocaleString('zh-CN')}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleSaveDraft}>
              保存草稿
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                submitting ||
                quotaInsufficient ||
                (candidateMode === 'bulk' && bulkCandidates.length === 0) ||
                (candidateMode === 'existing' && selectedCandidateIds.length === 0)
              }
            >
              {submitting
                ? '创建中...'
                : candidateMode === 'bulk'
                  ? `批量创建 (${bulkCandidates.length}位)`
                  : candidateMode === 'existing' && selectedCandidateIds.length > 1
                    ? `批量创建 (${selectedCandidateIds.length}位)`
                    : '创建面试'}
            </Button>
          </div>
          {quotaInsufficient && (
            <div className="text-sm text-red-600">
              当前仅剩 {quotaSummary?.availableCount ?? 0} 场可创建，无法满足本次 {requestedQuotaCount} 场的预占需求。
            </div>
          )}
        </form>
      </Form>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>面试创建成功</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>面试链接</Label>
              <Input value={interviewLink} readOnly className="mt-2" />
            </div>
            <p className="text-sm text-muted-foreground">链接已复制到剪贴板</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCreateAnother}>
              创建另一场面试
            </Button>
            <Button onClick={() => router.push('/admin/interviews')}>
              查看面试列表
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Result Dialog */}
      <Dialog open={batchResultDialogOpen} onOpenChange={setBatchResultDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量创建结果</DialogTitle>
          </DialogHeader>
          {batchResult && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default">成功: {batchResult.success}</Badge>
                {batchResult.failed > 0 && (
                  <Badge variant="destructive">失败: {batchResult.failed}</Badge>
                )}
              </div>

              {batchResult.results.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">成功创建的面试链接：</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {batchResult.results.map((r: any, i: number) => (
                      <div key={i} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">{r.candidate.name} - {r.candidate.email}</div>
                        <Input value={r.interview.link} readOnly className="mt-1 text-xs" />
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => {
                      const links = batchResult.results.map((r: any) => r.interview.link).join('\n')
                      copyToClipboard(links)
                      toast.success('已复制所有链接')
                    }}
                  >
                    复制全部链接
                  </Button>
                </div>
              )}

              {batchResult.errors.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2 text-red-600">创建失败：</h3>
                  <div className="space-y-2">
                    {batchResult.errors.map((e: any, i: number) => (
                      <div key={i} className="p-2 bg-red-50 rounded text-sm">
                        <div className="font-medium">{e.candidate.name} - {e.candidate.email}</div>
                        <div className="text-red-600">{e.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => router.push('/admin/interviews')}>
              查看面试列表
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
