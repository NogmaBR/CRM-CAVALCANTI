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

export default async function EditarAutorizadoPage({
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
  const errorMsg = (await searchParams).error ?? null;

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
                  defaultValue={autorizado.nome}
                  autoComplete="off"
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="WhatsApp"
                  name="telefone_whats"
                  required
                  defaultValue={formatarTelefone(autorizado.telefone_whats)}
                  autoComplete="off"
                  hint="Com DDD. O DDI 55 é assumido quando não informado."
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Função na obra (opcional)"
                  name="papel_obra"
                  maxLength={80}
                  defaultValue={autorizado.papel_obra ?? ''}
                  autoComplete="off"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Acesso</legend>
            <Checkbox
              name="ativo"
              defaultChecked={autorizado.ativo ?? false}
              label="Pode lançar pagamentos"
              description="Desmarcado, as mensagens deste número passam a ser ignoradas."
            />
          </fieldset>

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
