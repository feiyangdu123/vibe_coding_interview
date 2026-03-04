import { AdminProblemsPageContent } from "../components/admin-problems-page-content";
import { AdminShell } from "../components/admin-shell";

export default function HomePage() {
  return (
    <AdminShell>
      <AdminProblemsPageContent />
    </AdminShell>
  );
}
