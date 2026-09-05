import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function DocumentosPage() {
  return (
    <>
      <TopBar title="Documentos" subtitle="Notas fiscais, comprovantes e contratos" />
      <div className="nos-page-body">
        <ComingSoon
          title="Em construção"
          phase="Fase 4 · CRUD Base"
          lead="NFs, comprovantes e contratos em um acervo pesquisável com preview inline."
          items={[
            { label: 'Upload direto', hint: 'arraste imagens/PDFs no Painel' },
            { label: 'Classificação automática', hint: 'IA identifica NF vs comprovante' },
            { label: 'Vinculação a pagamento', hint: '1 doc vira 1 pagamento no clique' },
            { label: 'Busca por CNPJ / fornecedor / obra' },
          ]}
        />
      </div>
    </>
  );
}
