'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { toast } from 'sonner'
import type { EvaluationCriteriaConfigResponse, EvaluationDimension } from '@vibe/shared-types'
import { apiFetch } from '@/lib/api'

const PROBLEM_TYPE_LABELS: Record<string, string> = {
  ALGORITHM_MODELING: '算法与建模',
  FEATURE_DEV: '功能开发',
  DEBUG_FIX: '调试修复',
  DATA_PROCESSING: '数据处理与分析',
  AGENT_DEV: '智能体开发',
  ITERATION_REFACTOR: '迭代重构',
  PRODUCT_DESIGN: '产品设计',
}

export default function EvaluationConfigsPage() {
  const [configs, setConfigs] = useState<EvaluationCriteriaConfigResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<EvaluationCriteriaConfigResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    displayName: '',
    description: '',
    promptTemplate: '',
    dimensions: [{ name: '', maxScore: 5, description: '' }] as EvaluationDimension[]
  })

  const loadConfigs = async () => {
    try {
      const data = await apiFetch('/api/platform/evaluation-configs')
      setConfigs(data)
    } catch (err) {
      console.error(err)
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const handleEdit = (config: EvaluationCriteriaConfigResponse) => {
    setEditingConfig(config)
    setForm({
      displayName: config.displayName,
      description: config.description || '',
      promptTemplate: config.promptTemplate || '',
      dimensions: config.dimensions.length > 0 ? config.dimensions : [{ name: '', maxScore: 5, description: '' }]
    })
    setDialogOpen(true)
  }

  const handleAddDimension = () => {
    setForm({
      ...form,
      dimensions: [...form.dimensions, { name: '', maxScore: 5, description: '' }]
    })
  }

  const handleRemoveDimension = (index: number) => {
    setForm({
      ...form,
      dimensions: form.dimensions.filter((_, i) => i !== index)
    })
  }

  const handleDimensionChange = (index: number, field: keyof EvaluationDimension, value: string | number) => {
    const dims = [...form.dimensions]
    dims[index] = { ...dims[index], [field]: value }
    setForm({ ...form, dimensions: dims })
  }

  const handleSubmit = async () => {
    if (!editingConfig) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/platform/evaluation-configs/${editingConfig.problemType}`, {
        method: 'PUT',
        body: JSON.stringify({
          displayName: form.displayName,
          description: form.description || undefined,
          dimensions: form.dimensions.filter(d => d.name.trim()),
          promptTemplate: form.promptTemplate || undefined
        })
      })
      toast.success('配置已更新')
      setDialogOpen(false)
      loadConfigs()
    } catch (err) {
      console.error(err)
      toast.error('更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">加载中...</div>
    </div>
  )

  return (
    <div className="console-page">
      <PageHeader
        meta="Evaluation Configs"
        title="评估配置"
        description="按题目类型配置 AI 评估维度和 prompt 模板。"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configs.map(config => (
          <Card key={config.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{config.displayName}</CardTitle>
                <Badge variant="outline">{PROBLEM_TYPE_LABELS[config.problemType] || config.problemType}</Badge>
              </div>
              {config.description && (
                <p className="text-sm text-muted-foreground">{config.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <div className="text-sm font-medium">评估维度</div>
                {config.dimensions.map((dim, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="shrink-0">{dim.maxScore}分</Badge>
                    <span className="font-medium">{dim.name}</span>
                    {dim.description && <span className="text-muted-foreground truncate">- {dim.description}</span>}
                  </div>
                ))}
              </div>
              {config.promptTemplate && (
                <div className="text-xs text-muted-foreground truncate mb-3">
                  Prompt: {config.promptTemplate.substring(0, 60)}...
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => handleEdit(config)} className="w-full">
                编辑配置
              </Button>
            </CardContent>
          </Card>
        ))}

        {configs.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            暂无评估配置，请先运行数据库种子脚本。
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑评估配置 - {editingConfig?.displayName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">显示名称</label>
                <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">描述</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">评估维度</label>
                <Button variant="outline" size="sm" onClick={handleAddDimension}>添加维度</Button>
              </div>
              <div className="space-y-3">
                {form.dimensions.map((dim, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="维度名称"
                          value={dim.name}
                          onChange={(e) => handleDimensionChange(i, 'name', e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="满分"
                          value={dim.maxScore}
                          onChange={(e) => handleDimensionChange(i, 'maxScore', parseInt(e.target.value) || 0)}
                        />
                        <Input
                          placeholder="描述"
                          value={dim.description}
                          onChange={(e) => handleDimensionChange(i, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                    {form.dimensions.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveDimension(i)}>
                        删除
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">AI 评估 Prompt 模板（可选）</label>
              <Textarea
                value={form.promptTemplate}
                onChange={(e) => setForm({ ...form, promptTemplate: e.target.value })}
                rows={5}
                placeholder="自定义 AI 评估时使用的 prompt 模板..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
