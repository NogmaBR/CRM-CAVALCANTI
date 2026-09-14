import { TopBar } from '@/components/layout/topbar';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { listPagamentos } from '@/lib/data/pagamentos';
import { estadoDoFormulario } from '../../_shared/form-erros';
import { createDocumento } from '../actions';
import { DocumentoForm } from '../documento-form';

export const metadata = { title: 'Novo Documento' };

export default async function NovoDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    campo?: string;
    v?: string;
    obra_id?: string;
    pagamento_id?: string;
  }>;
}) {
  const [params, obras, pagamentos, fornecedores] = await Promise.all([
    searchParams,
    listObras({ includeArchived: false }),
    listPagamentos({ includeArchived: false }),
    listFornecedores({ includeArchived: false }),
  ]);
  const estado = estadoDoFormulario(params);

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
          error={estado.error}
          campo={estado.campo}
          valores={estado.valores}
        />
      </div>
    </>
  );
}
