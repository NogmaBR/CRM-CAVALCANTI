import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function WhatsAppPage() {
  return (
    <>
      <TopBar title="WhatsApp" subtitle="Fila de mensagens classificadas por IA" />
      <div className="nos-page-body">
        <ComingSoon
          eyebrow="FASE 6 · INTEGRAÇÃO WHATSAPP"
          title="WhatsApp"
          lead="Fornecedores mandam foto de NF ou comprovante direto pro WhatsApp — a IA classifica, extrai valores e sugere lançamento. Você confirma em um clique."
          items={[
            { label: 'Fila de mensagens recebidas', hint: ' — em tempo real via Supabase Realtime' },
            { label: 'Classificação por IA', hint: ' — OpenAI GPT + prompt Nogma customizado' },
            { label: 'Confirmação humana', hint: ' — nada é lançado sem sua aprovação' },
            { label: 'Vinculação automática', hint: ' — mensagem vira pagamento + documento anexado' },
          ]}
        />
      </div>
    </>
  );
}
