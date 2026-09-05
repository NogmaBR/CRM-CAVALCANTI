import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function FornecedoresPage() {
  return (
    <>
      <TopBar title="Fornecedores" subtitle="Cadastro e apelidos usados no WhatsApp" />
      <div className="nos-page-body">
        <ComingSoon
          eyebrow="PRÓXIMA FASE · CRUD BASE"
          title="Fornecedores"
          lead="Cadastro central de fornecedores da Cavalcanti, com histórico de compras, apelidos usados nos comprovantes de WhatsApp e status de conformidade fiscal."
          items={[
            { label: 'CNPJ + razão social + apelidos', hint: ' — matching flexível na IA' },
            { label: 'Histórico de pagamentos', hint: ' — total gasto, categorias mais compradas' },
            { label: 'Status de NF', hint: ' — alerta se fornecedor deixou de mandar' },
            { label: 'Contatos', hint: ' — WhatsApp, email, endereço' },
          ]}
        />
      </div>
    </>
  );
}
