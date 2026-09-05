import { Sidebar } from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nos-app-shell">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
