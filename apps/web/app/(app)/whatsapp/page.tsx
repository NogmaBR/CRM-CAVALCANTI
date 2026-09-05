import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function WhatsAppPage() {
  return (
    <>
      <TopBar title="WhatsApp" subtitle="Fila de mensagens classificadas por IA" />
      <div className="nos-page-body">
        <ComingSoon
          title="Em construção"
          phase="Fase 6 · Integração WhatsApp"
          lead="Fornecedores mandam foto de NF ou comprovante no WhatsApp — a IA classifica, extrai valores e sugere lançamento. Você confirma em um clique."
          items={[
            { label: 'Fila em tempo real', hint: 'Supabase Realtime' },
            { label: 'Classificação por IA', hint: 'OpenAI GPT + prompt Nogma customizado' },
            { label: 'Confirmação humana', hint: 'nada é lançado sem sua aprovação' },
            { label: 'Vinculação automática', hint: 'mensagem vira pagamento + documento anexado' },
          ]}
        />
      </div>
    </>
  );
}
