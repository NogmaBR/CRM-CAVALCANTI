import { estadoDoFormulario } from '@/app/(app)/_shared/form-erros';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Checkbox } from '@/components/nogma/Checkbox';
import { Input } from '@/components/nogma/Input';
import { formatarTelefone } from '@/lib/schemas/autorizado';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { atualizarAutorizado } from '../../actions';
import '@/app/(app)/_shared/form-layout.css';

export const metadata = { title: 'Editar autorizado' };

export default async function EditarAutorizadoPage({
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
  const params2 = await searchParams;
  const estado = estadoDoFormulario(params2);
  const v = estado.valores;
  const campo = estado.campo;
  const erroCurto = estado.error ? estado.error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? erroCurto : undefined);
  const errorMsg = estado.error ?? null;
  const temValores = Object.keys(v).length > 0;

  const { data: autorizado } = await supabase
    .from('autorizados')
    .select('id, nome, telefone_whats, papel_obra, ativo')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!autorizado) notFound();

  return (
    <>
      <TopBar title="Editar autorizado" subtitle={autorizado.nome} />

      <div className="nos-page-body">
        <form action={atualizarAutorizado} className="form-layout">
          <input type="hidden" name="id" value={autorizado.id} />

          {errorMsg ? (
            <div className="form-layout__error" role="alert">
              {errorMsg}
            </div>
          ) : null}

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Quem é</legend>
            <div className="form-layout__grid">
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Nome"
                  name="nome"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={v.nome ?? autorizado.nome}
                  autoComplete="off"
                  error={erroDe('nome')}
                  autoFocus={campo === 'nome'}
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="WhatsApp"
                  name="telefone_whats"
                  required
                  defaultValue={v.telefone_whats ?? formatarTelefone(autorizado.telefone_whats)}
                  error={erroDe('telefone_whats')}
                  autoFocus={campo === 'telefone_whats'}
                  autoComplete="off"
                  hint="Com DDD. O DDI 55 é assumido quando não informado."
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Função na obra (opcional)"
                  name="papel_obra"
                  maxLength={80}
                  defaultValue={v.papel_obra ?? autorizado.papel_obra ?? ''}
                  error={erroDe('papel_obra')}
                  autoFocus={campo === 'papel_obra'}
                  autoComplete="off"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Acesso</legend>
            <Checkbox
              name="ativo"
              defaultChecked={temValores ? v.ativo != null : (autorizado.ativo ?? false)}
              label="Pode lançar pagamentos"
              description="Desmarcado, as mensagens deste número passam a ser ignoradas."
            />
          </fieldset>

          <p className="form-layout__obrigatorio">* obrigatório</p>

          <div className="form-layout__actions">
            <Link href="/config/autorizados" className="form-layout__cancel">
              Cancelar
            </Link>
            <Button type="submit" variant="primary">
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
