import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function ConfigPage() {
  return (
    <>
      <TopBar title="Configurações" subtitle="Time, categorias, integrações" />
      <div className="nos-page-body">
        <ComingSoon
          title="Em construção"
          phase="Fase 5 · Admin"
          lead="Time, categorias contábeis, integrações (WhatsApp, OpenAI, contador), backups e auditoria."
          items={[
            { label: 'Time e papéis', hint: 'admin, gestor, financeiro, leitura' },
            { label: 'Categorias contábeis', hint: 'editar as 8 seed + adicionar novas' },
            { label: 'Integração WhatsApp', hint: 'número, webhook, HMAC secret' },
            { label: 'Auditoria', hint: 'quem fez o quê e quando' },
          ]}
        />
      </div>
    </>
  );
}
