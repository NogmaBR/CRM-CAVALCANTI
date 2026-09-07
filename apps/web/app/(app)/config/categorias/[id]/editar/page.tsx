import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Palette } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { createClient } from '@/lib/supabase/server';
import { getCategoria } from '@/lib/data/categorias';
import { CATEGORIA_CORES } from '@/lib/schemas/categoria';
import { atualizarCategoria } from '../../actions';
import '../../categorias.css';
import '@/app/(app)/_shared/form-layout.css';

export default async function EditarCategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();

  if (profile?.papel !== 'admin') notFound();

  const { id } = await params;
  const categoria = await getCategoria(id);

  // notFound if: doesn't exist OR is archived (soft deleted)
  if (!categoria || categoria.deleted_at != null) notFound();

  const sp = await searchParams;
  const errorMsg = sp.error ?? null;

  return (
    <>
      <TopBar title={`Editar: ${categoria.nome}`} subtitle="Atualize os dados da categoria" />

      <div className="nos-page-body">
        <form action={atualizarCategoria} className="form-layout">
          <input type="hidden" name="id" value={categoria.id} />

          {errorMsg ? (
            <div className="form-layout__error" role="alert">
              {errorMsg}
            </div>
          ) : null}

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Identificação</legend>
            <div className="form-layout__grid">
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Nome"
                  name="nome"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={categoria.nome}
                  autoComplete="off"
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Icone (opcional)"
                  name="icone"
                  maxLength={50}
                  defaultValue={categoria.icone ?? ''}
                  placeholder="Ex: wrench, hard-hat, package"
                  autoComplete="off"
                  hint="Nome do icone Lucide (ex: 'wrench', 'hard-hat'). Deixe vazio para sem icone."
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">
              <Palette size={12} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Cor
            </legend>
            <p className="categorias-field-hint" style={{ marginTop: 8 }}>
              Escolha uma cor para identificar visualmente a categoria
            </p>
            <div className="categoria-cor-radio-group" role="radiogroup" aria-label="Cor da categoria">
              {CATEGORIA_CORES.map((cor) => (
                <label key={cor.value} className="categoria-cor-radio">
                  <input
                    type="radio"
                    name="cor"
                    value={cor.value}
                    defaultChecked={categoria.cor === cor.value}
                  />
                  <span
                    className="categoria-cor-radio__swatch"
                    style={{ background: cor.value }}
                    aria-hidden="true"
                  />
                  <span className="categoria-cor-radio__label">{cor.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-layout__actions">
            <Link href="/config/categorias" className="form-layout__cancel">
              Cancelar
            </Link>
            <Button type="submit" variant="primary">
              Salvar alteracoes
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
