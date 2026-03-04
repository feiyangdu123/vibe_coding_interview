"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type NavGroupKey = "problems" | "writtenExam";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
}

interface NavGroup {
  key: NavGroupKey;
  label: string;
  shortLabel: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    key: "problems",
    label: "题目管理",
    shortLabel: "题",
    items: [
      {
        href: "/admin/problems",
        label: "实操题管理",
        shortLabel: "实",
      },
    ],
  },
  {
    key: "writtenExam",
    label: "笔试管理",
    shortLabel: "笔",
    items: [
      {
        href: "/admin/candidates",
        label: "候选人管理",
        shortLabel: "候",
      },
      {
        href: "/admin/interviews/new",
        label: "安排面试",
        shortLabel: "安",
      },
      {
        href: "/admin/interviews",
        label: "面试列表",
        shortLabel: "列",
      },
    ],
  },
];

function createDefaultExpanded(pathname: string): Record<NavGroupKey, boolean> {
  const isProblemRoute = pathname === "/" || pathname.startsWith("/admin/problems");
  const isWrittenExamRoute = pathname.startsWith("/admin/candidates") || pathname.startsWith("/admin/interviews");

  return {
    problems: isProblemRoute,
    writtenExam: isWrittenExamRoute,
  };
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/admin/problems") {
    return pathname === "/" || pathname === href;
  }

  return pathname === href;
}

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<NavGroupKey, boolean>>(
    () => createDefaultExpanded(pathname),
  );

  useEffect(() => {
    const defaults = createDefaultExpanded(pathname);
    setExpandedGroups((current) => ({
      problems: defaults.problems ? true : current.problems,
      writtenExam: defaults.writtenExam ? true : current.writtenExam,
    }));
    setIsMobileNavOpen(false);
  }, [pathname]);

  return (
    <div
      className={[
        "admin-shell",
        isCollapsed ? "is-collapsed" : "",
        isMobileNavOpen ? "is-mobile-nav-open" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="admin-shell__mobile-trigger"
        onClick={() => {
          setIsMobileNavOpen((current) => !current);
        }}
      >
        {isMobileNavOpen ? "关闭菜单" : "打开菜单"}
      </button>

      {isMobileNavOpen ? (
        <button
          type="button"
          className="admin-shell__overlay"
          aria-label="关闭侧边栏"
          onClick={() => {
            setIsMobileNavOpen(false);
          }}
        />
      ) : null}

      <aside className="admin-shell__sidebar">
        <div className="admin-shell__sidebar-inner">
          <div className="admin-shell__brand-row">
            <Link href="/" className="admin-shell__brand" aria-label="返回管理后台首页">
              <span className="admin-shell__brand-mark">VC</span>
              <span className="admin-shell__brand-text">Vibe Coding</span>
            </Link>
            <button
              type="button"
              className="admin-shell__collapse"
              onClick={() => {
                setIsCollapsed((current) => !current);
              }}
              aria-label={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            >
              {isCollapsed ? ">" : "<"}
            </button>
          </div>

          <nav className="admin-shell__nav" aria-label="管理后台菜单">
            {navGroups.map((group) => {
              const isExpanded = expandedGroups[group.key];

              return (
                <section key={group.key} className="admin-shell__group">
                  <button
                    type="button"
                    className="admin-shell__group-button"
                    onClick={() => {
                      setExpandedGroups((current) => ({
                        ...current,
                        [group.key]: !current[group.key],
                      }));
                    }}
                  >
                    <span className="admin-shell__group-short">{group.shortLabel}</span>
                    <span className="admin-shell__group-name">{group.label}</span>
                    <span className="admin-shell__group-toggle">{isExpanded ? "-" : "+"}</span>
                  </button>

                  {isExpanded ? (
                    <div className="admin-shell__items">
                      {group.items.map((item) => {
                        const active = isItemActive(pathname, item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`admin-shell__item${active ? " is-active" : ""}`}
                            aria-label={item.label}
                          >
                            <span className="admin-shell__item-short">{item.shortLabel}</span>
                            <span className="admin-shell__item-label">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="admin-shell__main">
        <div className="admin-shell__main-inner">{children}</div>
      </div>
    </div>
  );
}
