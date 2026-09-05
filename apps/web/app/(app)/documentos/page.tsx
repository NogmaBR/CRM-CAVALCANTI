import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function DocumentosPage() {
  return (
    <>
      <TopBar title="Documentos" subtitle="Notas fiscais, comprovantes e contratos" />
      <div className="nos-page-body">
        <ComingSoon
          eyebrow="PRÓXIMA FASE · CRUD BASE"
          title="Documentos"
          lead="Todos os documentos anexados a pagamentos e obras — NFs, comprovantes de transferência, contratos — em um único acervo pesquisável, com preview inline."
          items={[
            { label: 'Upload direto', hint: ' — arraste imagens/PDFs no Painel' },
            { label: 'Classificação automática', hint: ' — IA identifica NF vs comprovante' },
            { label: 'Vinculação a pagamento', hint: ' — 1 doc pode virar 1 pagamento no clique' },
            { label: 'Busca por CNPJ / fornecedor / obra', hint: '' },
          ]}
        />
      </div>
    </>
  );
}
