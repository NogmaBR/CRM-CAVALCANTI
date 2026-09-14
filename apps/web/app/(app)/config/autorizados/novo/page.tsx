import { estadoDoFormulario } from '@/app/(app)/_shared/form-erros';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Checkbox } from '@/components/nogma/Checkbox';
import { Input } from '@/components/nogma/Input';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarAutorizado } from '../actions';
import '@/app/(app)/_shared/form-layout.css';

export const metadata = { title: 'Autorizar número' };

export default async function NovoAutorizadoPage({
  searchParams,
}: {
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

  const params = await searchParams;
  const estado = estadoDoFormulario(params);
  const v = estado.valores;
  const campo = estado.campo;
  const erroCurto = estado.error ? estado.error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? erroCurto : undefined);
  const errorMsg = estado.error ?? null;
  // Checkbox desmarcado não viaja no FormData: se veio algum valor, `ativo` ausente = desmarcado.
  const ativoChecked = Object.keys(v).length > 0 ? v.ativo != null : true;

  return (
    <>
      <TopBar
        title="Autorizar número"
        subtitle="Só números desta lista podem lançar pagamentos pelo WhatsApp"
      />

      <div className="nos-page-body">
        <form action={criarAutorizado} className="form-layout">
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
                  defaultValue={v.nome ?? ''}
                  placeholder="Ex: João da Silva"
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
                  defaultValue={v.telefone_whats ?? ''}
                  placeholder="(51) 99999-8888"
                  autoComplete="off"
                  hint="Com DDD. O DDI 55 é assumido quando não informado."
                  error={erroDe('telefone_whats')}
                  autoFocus={campo === 'telefone_whats'}
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Função na obra (opcional)"
                  name="papel_obra"
                  maxLength={80}
                  defaultValue={v.papel_obra ?? ''}
                  placeholder="Ex: Mestre de obras"
                  autoComplete="off"
                  error={erroDe('papel_obra')}
                  autoFocus={campo === 'papel_obra'}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Acesso</legend>
            <Checkbox
              name="ativo"
              defaultChecked={ativoChecked}
              label="Pode lançar pagamentos agora"
              description="Desmarque para cadastrar o número sem liberar o envio ainda."
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
