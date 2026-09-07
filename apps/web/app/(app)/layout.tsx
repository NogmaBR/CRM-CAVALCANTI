import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nos-app-shell">
      <Sidebar />
      <main id="main-content">{children}</main>
      <Toaster
        richColors
        position="top-right"
        closeButton
        theme="dark"
        toastOptions={{
          style: { fontFamily: 'inherit' },
        }}
      />
    </div>
  );
}
