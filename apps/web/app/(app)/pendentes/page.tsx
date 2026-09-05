import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function PendentesPage() {
  return (
    <>
      <TopBar title="Pendentes" subtitle="Confirmações e comprovantes aguardando" />
      <div className="nos-page-body">
        <ComingSoon
          eyebrow="PRÓXIMA FASE · CRUD BASE"
          title="Pendentes"
          lead="Central de itens que precisam da sua atenção: pagamentos sem comprovante, mensagens de WhatsApp aguardando classificação, e confirmações de fornecedores duplicados."
          items={[
            { label: 'Pagamentos sem NF', hint: ' — filtro rápido por obra e período' },
            { label: 'Mensagens não confirmadas', hint: ' — batch approve/reject' },
            { label: 'Fornecedores duplicados', hint: ' — sugestão de merge' },
            { label: 'Lembretes agendados', hint: ' — SLA por prioridade' },
          ]}
        />
      </div>
    </>
  );
}
