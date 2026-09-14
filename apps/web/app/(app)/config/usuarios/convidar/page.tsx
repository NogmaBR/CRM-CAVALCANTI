import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { PAPEL_DESCRIPTIONS, PAPEL_LABELS } from '@/lib/data/usuarios';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { convidarUsuario } from '../actions';
import '../usuarios.css';
import { estadoDoFormulario } from '../../../_shared/form-erros';
import '../../../_shared/form-layout.css';

export const metadata = { title: 'Convidar novo usuário' };

export default async function ConvidarUsuarioPage({
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

  const papeis = Object.entries(PAPEL_LABELS) as Array<[keyof typeof PAPEL_LABELS, string]>;

  return (
    <>
      <TopBar
        title="Convidar novo usuário"
        subtitle="Envia email de convite com link para definir senha"
      />

      <div className="nos-page-body">
        <form action={convidarUsuario} className="form-layout">
          {errorMsg ? (
            <div className="form-layout__error" role="alert">
              {errorMsg}
            </div>
          ) : null}

          <fieldset
            className="form-layout__section"
            style={{ border: 'none', padding: 0, margin: 0 }}
          >
            <div className="form-layout__grid">
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  required
                  defaultValue={v.email ?? ''}
                  autoComplete="off"
                  placeholder="colaborador@empresa.com.br"
                  error={erroDe('email')}
                  autoFocus={campo === 'email'}
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Nome completo"
                  name="nome"
                  type="text"
                  required
                  minLength={2}
                  defaultValue={v.nome ?? ''}
                  placeholder="Nome do colaborador"
                  autoComplete="off"
                  error={erroDe('nome')}
                  autoFocus={campo === 'nome'}
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <label
                  className="form-layout__label form-layout__label--required"
                  htmlFor="papel-select"
                >
                  Papel
                </label>
                <select
                  id="papel-select"
                  name="papel"
                  className="form-layout__select"
                  defaultValue={v.papel ?? 'leitura'}
                  required
                  aria-invalid={campo === 'papel' ? true : undefined}
                  // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
                  autoFocus={campo === 'papel'}
                >
                  {papeis.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {/* Descriptions for each role shown below the select */}
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {papeis.map(([value, label]) => (
                    <div key={value} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{label}:</strong>{' '}
                      {PAPEL_DESCRIPTIONS[value]}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </fieldset>

          <p className="form-layout__obrigatorio">* obrigatório</p>

          <div className="form-layout__actions">
            <Link href="/config/usuarios" className="form-layout__cancel">
              Cancelar
            </Link>
            <Button type="submit" variant="primary">
              Enviar convite
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
