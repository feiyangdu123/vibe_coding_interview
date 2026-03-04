import Link from "next/link";

const navLinks = [
  { href: "/admin/problems", label: "题目管理" },
  { href: "/admin/candidates", label: "候选人管理" },
  { href: "/admin/interviews/new", label: "安排面试" },
  { href: "/admin/interviews", label: "面试列表" },
];

export function AdminNav() {
  return (
    <header className="card page-header">
      <div>
        <p className="eyebrow">管理后台</p>
        <h1 className="page-title">Vibe Coding 面试管理台</h1>
      </div>
      <nav className="nav-row">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} className="nav-pill">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
