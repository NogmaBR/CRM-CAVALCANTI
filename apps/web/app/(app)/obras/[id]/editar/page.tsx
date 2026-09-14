import { TopBar } from '@/components/layout/topbar';
import { getObra } from '@/lib/data/obras';
import { notFound } from 'next/navigation';
import { updateObra } from '../../actions';
import { ObraForm } from '../../obra-form';

export const metadata = { title: 'Editar obra' };

export default async function EditarObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const obra = await getObra(id);
  if (!obra) notFound();

  return (
    <>
      <TopBar title={`Editar: ${obra.nome}`} subtitle="Atualize os dados desta obra" />
      <div className="nos-page-body">
        <ObraForm mode="edit" initial={obra} action={updateObra} error={sp.error} />
      </div>
    </>
  );
}
