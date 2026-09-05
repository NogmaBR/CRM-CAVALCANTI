import '@/styles/globals.css';

export const metadata = {
  title: 'Gestor de Obras · Nogma',
  description: 'CRM de gestão financeira de obras com bot WhatsApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="black">
      <body>{children}</body>
    </html>
  );
}
