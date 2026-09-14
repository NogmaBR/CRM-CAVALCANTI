import { TopBar } from '@/components/layout/topbar';
import { getObra } from '@/lib/data/obras';
import { notFound } from 'next/navigation';
import { estadoDoFormulario } from '../../../_shared/form-erros';
import { updateObra } from '../../actions';
import { ObraForm } from '../../obra-form';

export const metadata = { title: 'Editar obra' };

export default async function EditarObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const obra = await getObra(id);
  if (!obra) notFound();
  const estado = estadoDoFormulario(sp);

  return (
    <>
      <TopBar title={`Editar: ${obra.nome}`} subtitle="Atualize os dados desta obra" />
      <div className="nos-page-body">
        <ObraForm
          mode="edit"
          initial={obra}
          action={updateObra}
          error={estado.error}
          campo={estado.campo}
          valores={estado.valores}
        />
      </div>
    </>
  );
}
