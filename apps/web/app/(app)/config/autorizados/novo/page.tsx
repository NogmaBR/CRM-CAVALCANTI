import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Checkbox } from '@/components/nogma/Checkbox';
import { Input } from '@/components/nogma/Input';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarAutorizado } from '../actions';
import '@/app/(app)/_shared/form-layout.css';

export default async function NovoAutorizadoPage({
  searchParams,
}: {
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

  const params = await searchParams;
  const errorMsg = params.error ?? null;

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
                  placeholder="Ex: João da Silva"
                  autoComplete="off"
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="WhatsApp"
                  name="telefone_whats"
                  required
                  placeholder="(51) 99999-8888"
                  autoComplete="off"
                  hint="Com DDD. O DDI 55 é assumido quando não informado."
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Função na obra (opcional)"
                  name="papel_obra"
                  maxLength={80}
                  placeholder="Ex: Mestre de obras"
                  autoComplete="off"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Acesso</legend>
            <Checkbox
              name="ativo"
              defaultChecked
              label="Pode lançar pagamentos agora"
              description="Desmarque para cadastrar o número sem liberar o envio ainda."
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
