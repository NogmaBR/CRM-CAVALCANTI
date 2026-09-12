import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { PAPEL_DESCRIPTIONS, PAPEL_LABELS, getUsuario } from '@/lib/data/usuarios';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { alterarPapelUsuario } from '../../actions';
import '../../usuarios.css';
import '../../../../_shared/form-layout.css';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type PapelVariant = 'warning' | 'success' | 'info' | 'neutral';
function papelVariant(papel: string): PapelVariant {
  if (papel === 'admin') return 'warning';
  if (papel === 'gestor') return 'success';
  if (papel === 'financeiro') return 'info';
  return 'neutral';
}

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  convite_pendente: 'Convite pendente',
  arquivado: 'Arquivado',
};

export default async function EditarPapelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const currentUser = userData.user;
  if (!currentUser) notFound();

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', currentUser.id)
    .single();

  if (callerProfile?.papel !== 'admin') notFound();

  const { id } = await params;
  const usuario = await getUsuario(id);

  if (!usuario) notFound();

  // Self-edit guard: redirect with error
  if (usuario.user_id === currentUser.id) {
    redirect(
      `/config/usuarios?error=${encodeURIComponent('Nao e possivel editar seu proprio papel')}`,
    );
  }

  const sp = await searchParams;
  const errorMsg = sp.error ?? null;

  const papeis = Object.entries(PAPEL_LABELS) as Array<[keyof typeof PAPEL_LABELS, string]>;

  return (
    <>
      <TopBar title={`Editar papel: ${usuario.nome}`} subtitle={usuario.email} />

      <div className="nos-page-body">
        <div style={{ maxWidth: 560 }}>
          {/* Current user info */}
          <div className="usuario-info-card" style={{ marginBottom: 24 }}>
            <div className="usuario-info-item">
              <span className="usuario-info-label">Papel atual</span>
              <span className="usuario-info-value">
                <span className={`usuarios-badge usuarios-badge--${papelVariant(usuario.papel)}`}>
                  {PAPEL_LABELS[usuario.papel]}
                </span>
              </span>
            </div>
            <div className="usuario-info-item">
              <span className="usuario-info-label">Status</span>
              <span className="usuario-info-value">
                {STATUS_LABELS[usuario.status] ?? usuario.status}
              </span>
            </div>
            <div className="usuario-info-item">
              <span className="usuario-info-label">Criado em</span>
              <span className="usuario-info-value">{formatDateTime(usuario.created_at)}</span>
            </div>
            <div className="usuario-info-item">
              <span className="usuario-info-label">Último acesso</span>
              <span className="usuario-info-value">{formatDateTime(usuario.last_sign_in_at)}</span>
            </div>
          </div>

          {/* Edit form */}
          <form action={alterarPapelUsuario} className="form-layout">
            {errorMsg ? (
              <div className="form-layout__error" role="alert">
                {errorMsg}
              </div>
            ) : null}

            <input type="hidden" name="user_id" value={usuario.user_id} />

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="form-layout__label" htmlFor="papel-select">
                  Novo papel
                </label>
                <select
                  id="papel-select"
                  name="papel"
                  className="form-layout__select"
                  defaultValue={usuario.papel}
                  required
                >
                  {papeis.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {papeis.map(([value, label]) => (
                    <div key={value} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{label}:</strong>{' '}
                      {PAPEL_DESCRIPTIONS[value]}
                    </div>
                  ))}
                </div>
              </div>
            </fieldset>

            <div className="form-layout__actions">
              <Link href="/config/usuarios" className="form-layout__cancel">
                Cancelar
              </Link>
              <Button type="submit" variant="primary">
                Salvar
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
