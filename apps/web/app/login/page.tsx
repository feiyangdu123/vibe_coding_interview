'use client'

import { Badge } from '@/components/ui/badge'
import { LoginForm } from '@/components/auth/login-form'
import { Building2, FileCode2, ShieldCheck, Users2 } from 'lucide-react'

const features = [
  {
    icon: FileCode2,
    title: '题库与模板',
    description: '按岗位、语言、难度沉淀企业题库，支持从平台模板一键复制。'
  },
  {
    icon: Users2,
    title: '批量面试执行',
    description: '统一管理候选人、创建批量面试草稿，并导出 Excel 汇总结果。'
  },
  {
    icon: ShieldCheck,
    title: '评估与复核',
    description: '结合 AI 评估历史、聊天记录与人工结论，形成标准复核闭环。'
  }
]

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1240px] items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <section className="hidden rounded-[20px] border border-border bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex lg:flex-col">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-950">Vibe Interview Console</div>
                  <div className="text-sm text-slate-500">企业级编程面试控制台</div>
                </div>
              </div>

              <div className="space-y-3">
                <Badge variant="outline">Enterprise Access</Badge>
                <h1 className="max-w-xl text-[30px] font-semibold leading-[1.2] tracking-[-0.03em] text-slate-950">
                  为技术招聘团队提供稳定、专业、可审计的面试运营后台
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-500">
                  采用云控制台风格的管理界面，覆盖题库管理、面试执行、AI 评估、人工复核与运行观测。
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4">
              {features.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.title}
                    className="rounded-xl border border-border bg-slate-50/80 px-5 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">{item.description}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-[20px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
            <div className="space-y-2 border-b border-border pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-950">登录控制台</div>
                  <div className="text-sm text-slate-500">企业管理员与面试官统一入口</div>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <LoginForm />
            </div>

            <div className="mt-6 border-t border-border pt-5 text-sm text-slate-500">
              <div>
                演示账号：<span className="font-mono text-slate-700">admin / admin123</span>
              </div>
              <div className="mt-1">也可以直接注册一家新企业并自动进入后台。</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
