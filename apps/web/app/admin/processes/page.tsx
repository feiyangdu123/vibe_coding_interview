'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface ProcessStatus {
  interviewId: string
  candidateName: string
  problemTitle: string
  port: number | null
  processId: number | null
  status: string
  healthStatus: string
  startTime: string | null
  endTime: string | null
  lastHealthCheck: string | null
  inMemory: boolean
  inDatabase: boolean
  workDir: string | null
  processError: string | null
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedProcess, setSelectedProcess] = useState<ProcessStatus | null>(null)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [stoppingProcessId, setStoppingProcessId] = useState<string | null>(null)

  const loadProcesses = async () => {
    try {
      const data = await apiFetch('/api/admin/processes')
      if (data.processes) {
        setProcesses(data.processes)
      } else {
        setProcesses([])
        if (data.error || data.message) {
          toast.error(data.error || data.message)
        }
      }
      setLoading(false)
    } catch (err) {
      console.error(err)
      setProcesses([])
      setLoading(false)
      toast.error('加载进程状态失败')
    }
  }

  useEffect(() => {
    loadProcesses()

    if (autoRefresh) {
      const interval = setInterval(loadProcesses, 10000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const handleStop = (interviewId: string) => {
    setStoppingProcessId(interviewId)
    setStopDialogOpen(true)
  }

  const confirmStop = async () => {
    if (!stoppingProcessId) return

    try {
      await apiFetch(`/api/admin/processes/${stoppingProcessId}/stop`, {
        method: 'POST'
      })
      toast.success('进程已停止')
      loadProcesses()
    } catch (err) {
      console.error(err)
      toast.error('停止失败')
    } finally {
      setStoppingProcessId(null)
      setStopDialogOpen(false)
    }
  }

  const handleHealthCheck = async (interviewId: string) => {
    try {
      const data = await apiFetch(`/api/admin/processes/${interviewId}/health-check`, {
        method: 'POST'
      })
      toast.success(data.healthy ? '健康检查通过' : '健康检查失败')
      loadProcesses()
    } catch (err) {
      console.error(err)
      toast.error('健康检查失败')
    }
  }

  const showDetails = (process: ProcessStatus) => {
    setSelectedProcess(process)
    setDetailsOpen(true)
  }

  const getRuntimeStatus = (healthStatus: string, status: string) => {
    if (status === 'crashed') {
      return <Badge variant="error">异常崩溃</Badge>
    }

    if (healthStatus === 'healthy') {
      return <Badge variant="success">运行正常</Badge>
    }

    if (healthStatus === 'unhealthy') {
      return <Badge variant="error">健康异常</Badge>
    }

    return <Badge variant="warning">状态未知</Badge>
  }

  const getRemainingTime = (endTime: string | null) => {
    if (!endTime) return '-'

    const now = new Date()
    const end = new Date(endTime)
    const diff = end.getTime() - now.getTime()

    if (diff <= 0) return '已过期'

    const minutes = Math.floor(diff / 60000)
    return `${minutes} 分钟`
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">加载中...</div>
    </div>
  )

  return (
    <div className="console-page">
      <PageHeader
        meta="Runtime Operations"
        title="进程管理"
        description="监控面试 Runtime 的运行状态、健康检查结果与剩余时长，必要时可人工停止。"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>自动刷新</span>
            </label>
            <Button onClick={loadProcesses} variant="outline">
              刷新
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              当前每 10 秒自动轮询一次运行状态，可在异常场景下进入详情查看工作目录与错误信息。
            </div>
            <Badge variant="outline">{processes.length} 个实例</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>面试标识</TableHead>
                <TableHead>候选人</TableHead>
                <TableHead>题目</TableHead>
                <TableHead>运行状态</TableHead>
                <TableHead>端口 / 进程</TableHead>
                <TableHead>开始时间</TableHead>
                <TableHead>剩余时间</TableHead>
                <TableHead>数据一致性</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    暂无运行中的进程
                  </TableCell>
                </TableRow>
              ) : (
                processes.map((process) => (
                  <TableRow key={process.interviewId}>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {process.interviewId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{process.candidateName}</TableCell>
                    <TableCell>{process.problemTitle}</TableCell>
                    <TableCell>{getRuntimeStatus(process.healthStatus, process.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-700">Port {process.port || '-'}</div>
                      <div className="text-xs text-slate-500">PID {process.processId || '-'}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {process.startTime
                        ? new Date(process.startTime).toLocaleString('zh-CN')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{getRemainingTime(process.endTime)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={process.inMemory ? 'success' : 'warning'}>
                          {process.inMemory ? '内存已登记' : '内存缺失'}
                        </Badge>
                        <Badge variant={process.inDatabase ? 'info' : 'warning'}>
                          {process.inDatabase ? '数据库已登记' : '数据库缺失'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleHealthCheck(process.interviewId)}
                        >
                          检查
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => showDetails(process)}
                        >
                          详情
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleStop(process.interviewId)}
                        >
                          停止
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>进程详情</DialogTitle>
          </DialogHeader>
          {selectedProcess && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">面试ID:</span>
                <div className="font-mono text-xs mt-1">{selectedProcess.interviewId}</div>
              </div>
              <div>
                <span className="font-semibold">候选人:</span> {selectedProcess.candidateName}
              </div>
              <div>
                <span className="font-semibold">题目:</span> {selectedProcess.problemTitle}
              </div>
              <div>
                <span className="font-semibold">端口:</span> {selectedProcess.port || '-'}
              </div>
              <div>
                <span className="font-semibold">进程ID:</span> {selectedProcess.processId || '-'}
              </div>
              <div>
                <span className="font-semibold">工作目录:</span>
                <div className="font-mono text-xs mt-1 break-all">
                  {selectedProcess.workDir || '-'}
                </div>
              </div>
              <div>
                <span className="font-semibold">健康状态:</span> {selectedProcess.healthStatus}
              </div>
              <div>
                <span className="font-semibold">最后检查:</span>{' '}
                {selectedProcess.lastHealthCheck
                  ? new Date(selectedProcess.lastHealthCheck).toLocaleString('zh-CN')
                  : '-'}
              </div>
              <div>
                <span className="font-semibold">内存中:</span> {selectedProcess.inMemory ? '是' : '否'}
              </div>
              <div>
                <span className="font-semibold">数据库中:</span> {selectedProcess.inDatabase ? '是' : '否'}
              </div>
              {selectedProcess.processError && (
                <div>
                  <span className="font-semibold text-red-600">错误信息:</span>
                  <div className="text-red-600 mt-1">{selectedProcess.processError}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stop Confirmation Dialog */}
      <AlertDialog
        open={stopDialogOpen}
        onOpenChange={setStopDialogOpen}
        title="确认停止进程"
        description="确定要停止这个 OpenCode 进程吗？面试将被标记为已完成。此操作无法撤销。"
        onConfirm={confirmStop}
        confirmText="停止"
        variant="destructive"
      />
    </div>
  )
}
