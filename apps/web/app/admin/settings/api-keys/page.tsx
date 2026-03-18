'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface SessionUser {
  id: string
  username: string
  email?: string
  role: 'ORG_ADMIN' | 'INTERVIEWER'
  organizationId: string
  organizationName?: string
}

interface OrganizationApiKeyConfig {
  id: string
  name: string
  baseUrl: string
  apiKeyMasked: string
  isSelected: boolean
  createdAt: string
  lastUsedAt?: string | null
}

const emptyForm = {
  name: '',
  baseUrl: '',
  apiKey: ''
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '未使用'
  }

  return new Date(value).toLocaleString()
}

export default function OrganizationApiKeysSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [configs, setConfigs] = useState<OrganizationApiKeyConfig[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<OrganizationApiKeyConfig | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingConfig, setDeletingConfig] = useState<OrganizationApiKeyConfig | null>(null)
  const [form, setForm] = useState(emptyForm)

  const loadData = async () => {
    try {
      const me = await apiFetch('/api/auth/me')
      setUser(me.user)

      if (me.user?.role === 'ORG_ADMIN') {
        const response = await apiFetch('/api/admin/settings/api-keys')
        setConfigs(response.data || [])
      }
    } catch (error) {
      console.error(error)
      toast.error('加载 API Key 配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreateDialog = () => {
    setEditingConfig(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (config: OrganizationApiKeyConfig) => {
    setEditingConfig(config)
    setForm({
      name: config.name,
      baseUrl: config.baseUrl,
      apiKey: ''
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.name.trim()) {
      toast.error('名称不能为空')
      return
    }

    if (!form.baseUrl.trim()) {
      toast.error('Base URL 不能为空')
      return
    }

    if (!editingConfig && !form.apiKey.trim()) {
      toast.error('API Key 不能为空')
      return
    }

    setSubmitting(true)

    try {
      await apiFetch(
        editingConfig
          ? `/api/admin/settings/api-keys/${editingConfig.id}`
          : '/api/admin/settings/api-keys',
        {
          method: editingConfig ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            baseUrl: form.baseUrl.trim(),
            ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {})
          })
        }
      )

      toast.success(editingConfig ? '配置更新成功' : '配置创建成功')
      setDialogOpen(false)
      setEditingConfig(null)
      setForm(emptyForm)
      await loadData()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || '保存配置失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelect = async (configId: string) => {
    setSwitchingId(configId)

    try {
      await apiFetch(`/api/admin/settings/api-keys/${configId}/select`, {
        method: 'POST'
      })

      toast.success('已切换当前配置')
      await loadData()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || '切换配置失败')
    } finally {
      setSwitchingId(null)
    }
  }

  const handleDelete = (config: OrganizationApiKeyConfig) => {
    setDeletingConfig(config)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingConfig) {
      return
    }

    setSubmitting(true)

    try {
      await apiFetch(`/api/admin/settings/api-keys/${deletingConfig.id}`, {
        method: 'DELETE'
      })

      toast.success('配置删除成功')
      setDeletingConfig(null)
      setDeleteDialogOpen(false)
      await loadData()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || '删除配置失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return <div className="text-gray-500">未获取到当前用户信息</div>
  }

  if (user.role !== 'ORG_ADMIN') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Key 配置</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">只有企业管理员可以管理 API Key 配置。</p>
        </CardContent>
      </Card>
    )
  }

  const currentConfig = configs.find((config) => config.isSelected) || null

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">当前使用配置</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">配置名称</div>
              <div className="font-medium">{currentConfig?.name || '暂无'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Base URL</div>
              <div className="font-medium break-all">{currentConfig?.baseUrl || '-'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>支持在企业下维护多套 API 配置，但同一时刻只会有一个“当前使用”配置。</p>
            <p>当前仅做配置管理和切换，暂未真正透传到 OpenCode Runtime。</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">API Key 配置列表</CardTitle>
            <p className="mt-2 text-sm text-gray-500">
              已配置 {configs.length} 套连接信息。API Key 在列表中仅展示脱敏值。
            </p>
          </div>
          <Button onClick={openCreateDialog}>新增配置</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>上次使用时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    暂无 API Key 配置，点击“新增配置”创建第一套企业级连接信息。
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell className="max-w-[240px] break-all">{config.baseUrl}</TableCell>
                    <TableCell className="font-mono text-xs">{config.apiKeyMasked}</TableCell>
                    <TableCell>{formatDateTime(config.createdAt)}</TableCell>
                    <TableCell>{formatDateTime(config.lastUsedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={config.isSelected ? 'success' : 'secondary'}>
                        {config.isSelected ? '当前使用' : '可切换'}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {!config.isSelected && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={switchingId === config.id}
                          onClick={() => handleSelect(config.id)}
                        >
                          {switchingId === config.id ? '切换中...' : '设为当前'}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(config)}>
                        编辑
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(config)}>
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingConfig ? '编辑 API Key 配置' : '新增 API Key 配置'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="mb-2 block text-sm font-medium">名称</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：OpenAI Production"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Base URL</label>
                <Input
                  value={form.baseUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={editingConfig ? '留空则保持当前 API Key 不变' : '输入 API Key'}
                  required={!editingConfig}
                />
                {editingConfig && (
                  <p className="mt-2 text-sm text-gray-500">
                    当前存量值会继续保留，只有填写新值时才会覆盖。
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '保存中...' : editingConfig ? '保存修改' : '创建配置'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="删除 API Key 配置"
        description={
          deletingConfig
            ? `确认删除“${deletingConfig.name}”吗？如果它是当前配置，系统会自动切换到另一套可用配置。`
            : '确认删除这条配置吗？'
        }
        onConfirm={confirmDelete}
        confirmText={submitting ? '删除中...' : '确认删除'}
        cancelText="取消"
        variant="destructive"
      />
    </div>
  )
}
