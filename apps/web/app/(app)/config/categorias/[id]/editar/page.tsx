import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { getCategoria } from '@/lib/data/categorias';
import { CATEGORIA_CORES } from '@/lib/schemas/categoria';
import { createClient } from '@/lib/supabase/server';
import { Palette } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { atualizarCategoria } from '../../actions';
import '../../categorias.css';
import { estadoDoFormulario } from '@/app/(app)/_shared/form-erros';
import '@/app/(app)/_shared/form-layout.css';

export const metadata = { title: 'Editar categoria' };

export default async function EditarCategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
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
  const estado = estadoDoFormulario(sp);
  const v = estado.valores;
  const campo = estado.campo;
  const erroCurto = estado.error ? estado.error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? erroCurto : undefined);
  const errorMsg = estado.error ?? null;

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
                  defaultValue={v.nome ?? categoria.nome}
                  autoComplete="off"
                  error={erroDe('nome')}
                  autoFocus={campo === 'nome'}
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Ícone (opcional)"
                  name="icone"
                  maxLength={50}
                  defaultValue={v.icone ?? categoria.icone ?? ''}
                  error={erroDe('icone')}
                  autoFocus={campo === 'icone'}
                  placeholder="Ex: wrench, hard-hat, package"
                  autoComplete="off"
                  hint="Nome do icone Lucide (ex: 'wrench', 'hard-hat'). Deixe vazio para sem icone."
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">
              <Palette
                size={12}
                aria-hidden="true"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              Cor
            </legend>
            <p className="categorias-field-hint" style={{ marginTop: 8 }}>
              Escolha uma cor para identificar visualmente a categoria
            </p>
            <div
              className="categoria-cor-radio-group"
              role="radiogroup"
              aria-label="Cor da categoria"
            >
              {CATEGORIA_CORES.map((cor) => (
                <label key={cor.value} className="categoria-cor-radio">
                  <input
                    type="radio"
                    name="cor"
                    value={cor.value}
                    defaultChecked={(v.cor ?? categoria.cor) === cor.value}
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

          <p className="form-layout__obrigatorio">* obrigatório</p>

          <div className="form-layout__actions">
            <Link href="/config/categorias" className="form-layout__cancel">
              Cancelar
            </Link>
            <Button type="submit" variant="primary">
              Salvar alterações
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
