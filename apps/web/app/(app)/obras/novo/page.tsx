import { TopBar } from '@/components/layout/topbar';
import { estadoDoFormulario } from '../../_shared/form-erros';
import { createObra } from '../actions';
import { ObraForm } from '../obra-form';

export const metadata = { title: 'Nova Obra' };

export default async function NovaObraPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
}) {
  const estado = estadoDoFormulario(await searchParams);
  return (
    <>
      <TopBar title="Nova Obra" subtitle="Cadastro de nova obra" />
      <div className="nos-page-body">
        <ObraForm
          mode="create"
          action={createObra}
          error={estado.error}
          campo={estado.campo}
          valores={estado.valores}
        />
      </div>
    </>
  );
}
