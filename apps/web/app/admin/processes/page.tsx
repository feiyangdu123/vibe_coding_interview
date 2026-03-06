'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

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
      const res = await fetch('http://localhost:3001/api/admin/processes')
      const data = await res.json()
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
      const res = await fetch(`http://localhost:3001/api/admin/processes/${stoppingProcessId}/stop`, {
        method: 'POST'
      })

      if (res.ok) {
        toast.success('进程已停止')
        loadProcesses()
      } else {
        toast.error('停止失败')
      }
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
      const res = await fetch(`http://localhost:3001/api/admin/processes/${interviewId}/health-check`, {
        method: 'POST'
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.healthy ? '健康检查通过' : '健康检查失败')
        loadProcesses()
      } else {
        toast.error('健康检查失败')
      }
    } catch (err) {
      console.error(err)
      toast.error('健康检查失败')
    }
  }

  const showDetails = (process: ProcessStatus) => {
    setSelectedProcess(process)
    setDetailsOpen(true)
  }

  const getHealthBadge = (healthStatus: string, status: string) => {
    if (status === 'crashed') {
      return <span className="text-2xl" title="崩溃">💥</span>
    }

    switch (healthStatus) {
      case 'healthy':
        return <span className="text-2xl" title="健康">🟢</span>
      case 'unhealthy':
        return <span className="text-2xl" title="不健康">🔴</span>
      default:
        return <span className="text-2xl" title="未知">⚪</span>
    }
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

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">进程管理</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">自动刷新 (10秒)</span>
          </label>
          <Button onClick={loadProcesses} variant="outline">
            刷新
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4">面试ID</th>
              <th className="text-left p-4">候选人</th>
              <th className="text-left p-4">题目</th>
              <th className="text-left p-4">端口</th>
              <th className="text-left p-4">进程ID</th>
              <th className="text-left p-4">健康状态</th>
              <th className="text-left p-4">开始时间</th>
              <th className="text-left p-4">剩余时间</th>
              <th className="text-left p-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {processes.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500">
                  暂无运行中的进程
                </td>
              </tr>
            ) : (
              processes.map(process => (
                <tr key={process.interviewId} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-mono text-xs">
                    {process.interviewId.substring(0, 8)}...
                  </td>
                  <td className="p-4">{process.candidateName}</td>
                  <td className="p-4">{process.problemTitle}</td>
                  <td className="p-4">{process.port || '-'}</td>
                  <td className="p-4">{process.processId || '-'}</td>
                  <td className="p-4">
                    {getHealthBadge(process.healthStatus, process.status)}
                  </td>
                  <td className="p-4 text-sm">
                    {process.startTime
                      ? new Date(process.startTime).toLocaleString('zh-CN')
                      : '-'}
                  </td>
                  <td className="p-4 text-sm">
                    {getRemainingTime(process.endTime)}
                  </td>
                  <td className="p-4 space-x-2">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
