import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function FornecedoresPage() {
  return (
    <>
      <TopBar title="Fornecedores" subtitle="Cadastro e apelidos usados no WhatsApp" />
      <div className="nos-page-body">
        <ComingSoon
          title="Em construção"
          phase="Fase 5 · CRUD Base"
          lead="Cadastro central de fornecedores da Cavalcanti — histórico de compras, apelidos usados nos comprovantes de WhatsApp e status fiscal."
          items={[
            { label: 'CNPJ + razão social + apelidos', hint: 'matching flexível na IA' },
            { label: 'Histórico de pagamentos', hint: 'total gasto e categorias mais compradas' },
            { label: 'Status de NF', hint: 'alerta se fornecedor parou de mandar' },
            { label: 'Contatos', hint: 'WhatsApp, email, endereço' },
          ]}
        />
      </div>
    </>
  );
}
