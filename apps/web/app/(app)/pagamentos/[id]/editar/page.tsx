import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { getPagamento } from '@/lib/data/pagamentos';
import { formatBRL } from '@/lib/schemas/pagamento';
import { notFound } from 'next/navigation';
import { estadoDoFormulario } from '../../../_shared/form-erros';
import { updatePagamento } from '../../actions';
import { PagamentoForm } from '../../pagamento-form';

export const metadata = { title: 'Editar pagamento' };

export default async function EditarPagamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
}) {
  const { id } = await params;
  // O pagamento vai junto com os lookups: em série eram duas idas ao banco.
  const [sp, pagamento, obras, fornecedores, categorias] = await Promise.all([
    searchParams,
    getPagamento(id),
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
    listCategorias(),
  ]);
  if (!pagamento) notFound();
  const estado = estadoDoFormulario(sp);

  return (
    <>
      <TopBar
        title={`Editar pagamento — ${formatBRL(pagamento.valor)}`}
        subtitle="Atualize os dados deste lançamento"
      />
      <div className="nos-page-body">
        <PagamentoForm
          mode="edit"
          initial={pagamento}
          obras={obras}
          fornecedores={fornecedores}
          categorias={categorias}
          action={updatePagamento}
          error={estado.error}
          campo={estado.campo}
          valores={estado.valores}
        />
      </div>
    </>
  );
}
