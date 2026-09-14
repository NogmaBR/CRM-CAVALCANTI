import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { getFornecedor } from '@/lib/data/fornecedores';
import { notFound } from 'next/navigation';
import { estadoDoFormulario } from '../../../_shared/form-erros';
import { updateFornecedor } from '../../actions';
import { FornecedorForm } from '../../fornecedor-form';

export const metadata = { title: 'Editar fornecedor' };

export default async function EditarFornecedorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
}) {
  const [{ id }, sp, categorias] = await Promise.all([params, searchParams, listCategorias()]);
  const fornecedor = await getFornecedor(id);
  if (!fornecedor) notFound();
  const estado = estadoDoFormulario(sp);

  return (
    <>
      <TopBar title={`Editar: ${fornecedor.nome}`} subtitle="Atualize os dados deste fornecedor" />
      <div className="nos-page-body">
        <FornecedorForm
          mode="edit"
          initial={fornecedor}
          categorias={categorias}
          action={updateFornecedor}
          error={estado.error}
          campo={estado.campo}
          valores={estado.valores}
        />
      </div>
    </>
  );
}
