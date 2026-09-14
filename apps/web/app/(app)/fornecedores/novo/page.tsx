import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { estadoDoFormulario } from '../../_shared/form-erros';
import { createFornecedor } from '../actions';
import { FornecedorForm } from '../fornecedor-form';

export const metadata = { title: 'Novo Fornecedor' };

export default async function NovoFornecedorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
}) {
  const [params, categorias] = await Promise.all([searchParams, listCategorias()]);
  const estado = estadoDoFormulario(params);
  return (
    <>
      <TopBar title="Novo Fornecedor" subtitle="Cadastro de fornecedor" />
      <div className="nos-page-body">
        <FornecedorForm
          mode="create"
          categorias={categorias}
          action={createFornecedor}
          error={estado.error}
          campo={estado.campo}
          valores={estado.valores}
        />
      </div>
    </>
  );
}
