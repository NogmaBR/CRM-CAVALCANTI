import { TopBar } from '@/components/layout/topbar';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { listPagamentos } from '@/lib/data/pagamentos';
import { createDocumento } from '../actions';
import { DocumentoForm } from '../documento-form';

export default async function NovoDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; obra_id?: string; pagamento_id?: string }>;
}) {
  const [params, obras, pagamentos, fornecedores] = await Promise.all([
    searchParams,
    listObras({ includeArchived: false }),
    listPagamentos({ includeArchived: false }),
    listFornecedores({ includeArchived: false }),
  ]);

  return (
    <>
      <TopBar title="Novo Documento" subtitle="Upload de NF, comprovante ou contrato" />
      <div className="nos-page-body">
        <DocumentoForm
          mode="create"
          defaultObraId={params.obra_id}
          defaultPagamentoId={params.pagamento_id}
          obras={obras}
          pagamentos={pagamentos}
          fornecedores={fornecedores}
          action={createDocumento}
          error={params.error}
        />
      </div>
    </>
  );
}
