import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nos-app-shell">
      <Sidebar />
      <main>{children}</main>
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}
