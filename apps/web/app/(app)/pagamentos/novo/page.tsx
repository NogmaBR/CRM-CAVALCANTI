import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { createPagamento } from '../actions';
import { PagamentoForm } from '../pagamento-form';

export default async function NovoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; obra_id?: string }>;
}) {
  const [params, obras, fornecedores, categorias] = await Promise.all([
    searchParams,
    listObras({ includeArchived: false }),
    listFornecedores({ includeArchived: false }),
    listCategorias(),
  ]);

  return (
    <>
      <TopBar title="Novo Pagamento" subtitle="Registrar pagamento manual" />
      <div className="nos-page-body">
        <PagamentoForm
          mode="create"
          defaultObraId={params.obra_id}
          obras={obras}
          fornecedores={fornecedores}
          categorias={categorias}
          action={createPagamento}
          error={params.error}
        />
      </div>
    </>
  );
}
