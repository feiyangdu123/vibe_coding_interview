import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  ClipboardList,
  Crown,
  FileCode2,
  KeyRound,
  LayoutDashboard,
  ServerCog,
  Settings2,
  ShieldCheck,
  Users,
  Wallet
} from 'lucide-react'

export interface AdminNavItem {
  href: string
  label: string
  description?: string
  icon: LucideIcon
  roles?: string[]
  children?: AdminNavItem[]
}

const adminNavigation: AdminNavItem[] = [
  {
    href: '/admin',
    label: '运营总览',
    description: '平台关键入口与状态概览',
    icon: LayoutDashboard
  },
  {
    href: '/admin/problems',
    label: '题目管理',
    description: '企业题库与平台模板',
    icon: FileCode2,
    roles: ['ORG_ADMIN', 'INTERVIEWER']
  },
  {
    href: '/admin/candidates',
    label: '候选人',
    description: '候选人档案与联系方式',
    icon: Users,
    roles: ['ORG_ADMIN', 'INTERVIEWER']
  },
  {
    href: '/admin/interviews',
    label: '面试管理',
    description: '面试执行、评估与结果复核',
    icon: ClipboardList,
    roles: ['ORG_ADMIN', 'INTERVIEWER']
  },
  {
    href: '/admin/interview-quota',
    label: '面试配额',
    description: '查看剩余场次与消费流水',
    icon: Wallet,
    roles: ['ORG_ADMIN']
  },
  {
    href: '/admin/processes',
    label: '运行进程',
    description: 'Runtime 进程与健康状态',
    icon: ServerCog,
    roles: ['ORG_ADMIN']
  },
  {
    href: '/admin/settings',
    label: '企业设置',
    description: '组织成员与 API 配置',
    icon: Building2,
    roles: ['ORG_ADMIN'],
    children: [
      {
        href: '/admin/settings/members',
        label: '成员管理',
        description: '维护管理员与面试官账号',
        icon: Users,
        roles: ['ORG_ADMIN']
      },
      {
        href: '/admin/settings/api-keys',
        label: 'API 配置',
        description: '管理组织级 API 凭证',
        icon: KeyRound,
        roles: ['ORG_ADMIN']
      }
    ]
  },
  {
    href: '/admin/platform',
    label: '平台管理',
    description: '平台模板与评估配置',
    icon: Crown,
    roles: ['PLATFORM_ADMIN'],
    children: [
      {
        href: '/admin/platform/templates',
        label: '模板管理',
        description: '管理平台题目模板库',
        icon: FileCode2,
        roles: ['PLATFORM_ADMIN']
      },
      {
        href: '/admin/platform/evaluation-configs',
        label: '评估配置',
        description: '按题目类型配置评估维度',
        icon: Settings2,
        roles: ['PLATFORM_ADMIN']
      }
    ]
  }
]

function hasAccess(item: AdminNavItem, role?: string | null) {
  if (!item.roles || item.roles.length === 0) {
    return true
  }

  return !!role && item.roles.includes(role)
}

export function getAdminNavigation(role?: string | null) {
  return adminNavigation
    .filter((item) => hasAccess(item, role))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => hasAccess(child, role))
    }))
}

export function isAdminNavItemActive(item: AdminNavItem, pathname: string): boolean {
  const selfActive =
    item.href === '/admin'
      ? pathname === '/admin'
      : pathname === item.href || pathname.startsWith(`${item.href}/`)

  if (selfActive) {
    return true
  }

  return item.children?.some((child) => isAdminNavItemActive(child, pathname)) ?? false
}

export function findActiveAdminTrail(items: AdminNavItem[], pathname: string): AdminNavItem[] {
  for (const item of items) {
    if (item.href === '/admin' ? pathname === '/admin' : pathname === item.href) {
      return [item]
    }

    if (item.children) {
      const childTrail = findActiveAdminTrail(item.children, pathname)
      if (childTrail.length > 0) {
        return [item, ...childTrail]
      }
    }

    if (item.href !== '/admin' && pathname.startsWith(`${item.href}/`)) {
      return [item]
    }
  }

  return [
    {
      href: pathname,
      label: '控制台',
      icon: ShieldCheck
    }
  ]
}
