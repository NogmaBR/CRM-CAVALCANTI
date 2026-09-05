import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function ConfigPage() {
  return (
    <>
      <TopBar title="Configurações" subtitle="Time, categorias, integrações" />
      <div className="nos-page-body">
        <ComingSoon
          eyebrow="FASE 5 · ADMIN"
          title="Configurações"
          lead="Gerenciamento do time (usuários e papéis), categorias contábeis, integrações (WhatsApp, OpenAI, contador), backups e auditoria."
          items={[
            { label: 'Time e papéis', hint: ' — admin, gestor, financeiro, leitura' },
            { label: 'Categorias contábeis', hint: ' — editar as 8 seed + adicionar novas' },
            { label: 'Integração WhatsApp', hint: ' — número, webhook, HMAC secret' },
            { label: 'Auditoria', hint: ' — quem fez o quê e quando (log completo)' },
          ]}
        />
      </div>
    </>
  );
}
