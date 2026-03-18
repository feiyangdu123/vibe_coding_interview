'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

type AuthMode = 'login' | 'register'

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword
        })
      })
      router.push('/admin')
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          organizationName,
          username: registerUsername,
          email: registerEmail || undefined,
          password: registerPassword
        })
      })
      router.push('/admin')
    } catch (err: any) {
      setError(err.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 rounded-lg border border-border bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login')
            setError('')
          }}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register')
            setError('')
          }}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          注册企业
        </button>
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-slate-700">
              用户名
            </label>
            <Input
              id="username"
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="请输入用户名"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              密码
            </label>
            <Input
              id="password"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="请输入密码"
              disabled={loading}
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="organizationName" className="block text-sm font-medium text-slate-700">
              企业名称
            </label>
            <Input
              id="organizationName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="例如：Acme Tech"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="registerUsername" className="block text-sm font-medium text-slate-700">
              管理员用户名
            </label>
            <Input
              id="registerUsername"
              type="text"
              value={registerUsername}
              onChange={(e) => setRegisterUsername(e.target.value)}
              placeholder="创建企业管理员账号"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="registerEmail" className="block text-sm font-medium text-slate-700">
              管理员邮箱
            </label>
            <Input
              id="registerEmail"
              type="email"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              placeholder="admin@company.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="registerPassword" className="block text-sm font-medium text-slate-700">
              管理员密码
            </label>
            <Input
              id="registerPassword"
              type="password"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              placeholder="至少 6 位"
              minLength={6}
              disabled={loading}
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '创建中...' : '创建企业并进入后台'}
          </Button>
        </form>
      )}
    </div>
  )
}
