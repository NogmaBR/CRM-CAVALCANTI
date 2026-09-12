import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { PAPEL_LABELS, type UsuarioItem, listUsuarios } from '@/lib/data/usuarios';
import { createClient } from '@/lib/supabase/server';
import { Archive, Mail, Pencil, RotateCcw, RotateCw, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { arquivarUsuario, reenviarConvite, restaurarUsuario } from './actions';
import './usuarios.css';

type StatusFilter = 'ativos' | 'pendentes' | 'arquivados';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ativos', label: 'Ativos' },
  { value: 'pendentes', label: 'Convites pendentes' },
  { value: 'arquivados', label: 'Arquivados' },
];

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

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return (parts[0].charAt(0) ?? '?').toUpperCase();
  return ((parts[0].charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase();
}

type PapelVariant = 'warning' | 'success' | 'info' | 'neutral';
function papelVariant(papel: UsuarioItem['papel']): PapelVariant {
  if (papel === 'admin') return 'warning';
  if (papel === 'gestor') return 'success';
  if (papel === 'financeiro') return 'info';
  return 'neutral';
}

type StatusVariant = 'success' | 'warning' | 'neutral';
function statusVariant(status: UsuarioItem['status']): StatusVariant {
  if (status === 'ativo') return 'success';
  if (status === 'convite_pendente') return 'warning';
  return 'neutral';
}

const STATUS_LABELS: Record<UsuarioItem['status'], string> = {
  ativo: 'Ativo',
  convite_pendente: 'Convite pendente',
  arquivado: 'Arquivado',
};

function UsuarioRow({
  u,
  currentUserId,
}: {
  u: UsuarioItem;
  currentUserId: string;
}) {
  const isSelf = u.user_id === currentUserId;
  return (
    <tr>
      <td>
        <div className="usuarios-user-cell">
          <span className="usuario-avatar" aria-hidden="true">
            {getInitials(u.nome)}
          </span>
          <span className="usuarios-user-name">{u.nome}</span>
        </div>
      </td>
      <td>
        <span className="usuarios-email">{u.email}</span>
      </td>
      <td>
        <span className={`usuarios-badge usuarios-badge--${papelVariant(u.papel)}`}>
          {PAPEL_LABELS[u.papel]}
        </span>
      </td>
      <td>
        <span className={`usuarios-badge usuarios-badge--${statusVariant(u.status)}`}>
          {STATUS_LABELS[u.status]}
        </span>
      </td>
      <td>{formatDateTime(u.last_sign_in_at)}</td>
      <td>
        <div className="usuarios-actions">
          {u.status === 'ativo' && (
            <>
              {!isSelf && (
                <Link href={`/config/usuarios/${u.user_id}/editar`} className="usuarios-action-btn">
                  <Pencil size={12} aria-hidden="true" />
                  Editar papel
                </Link>
              )}
              {!isSelf && (
                <form action={arquivarUsuario} style={{ display: 'contents' }}>
                  <input type="hidden" name="user_id" value={u.user_id} />
                  <button type="submit" className="usuarios-action-btn usuarios-action-btn--danger">
                    <Archive size={12} aria-hidden="true" />
                    Arquivar
                  </button>
                </form>
              )}
              {isSelf && (
                <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>(você)</span>
              )}
            </>
          )}
          {u.status === 'convite_pendente' && (
            <>
              <form action={reenviarConvite} style={{ display: 'contents' }}>
                <input type="hidden" name="user_id" value={u.user_id} />
                <button type="submit" className="usuarios-action-btn">
                  <RotateCw size={12} aria-hidden="true" />
                  Reenviar convite
                </button>
              </form>
              <form action={arquivarUsuario} style={{ display: 'contents' }}>
                <input type="hidden" name="user_id" value={u.user_id} />
                <button type="submit" className="usuarios-action-btn usuarios-action-btn--danger">
                  <Archive size={12} aria-hidden="true" />
                  Cancelar
                </button>
              </form>
            </>
          )}
          {u.status === 'arquivado' && (
            <form action={restaurarUsuario} style={{ display: 'contents' }}>
              <input type="hidden" name="user_id" value={u.user_id} />
              <button type="submit" className="usuarios-action-btn">
                <RotateCcw size={12} aria-hidden="true" />
                Restaurar
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; success?: string; error?: string }>;
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
  const rawStatus = (params.status ?? 'ativos') as StatusFilter;
  const statusFilter = FILTER_OPTIONS.some((o) => o.value === rawStatus) ? rawStatus : 'ativos';
  const successMsg = params.success ?? null;
  const errorMsg = params.error ?? null;

  // Fetch all once (including archived) and filter client-side
  const allUsuarios = await listUsuarios(true);

  const filtered = allUsuarios.filter((u) => {
    if (statusFilter === 'ativos') return u.status === 'ativo';
    if (statusFilter === 'pendentes') return u.status === 'convite_pendente';
    if (statusFilter === 'arquivados') return u.status === 'arquivado';
    return true;
  });

  return (
    <>
      <TopBar
        title="Usuários"
        subtitle="Gerencie a equipe que acessa o painel"
        actions={
          <Link href="/config/usuarios/convidar" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<UserPlus size={16} />}>
              Convidar
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        {successMsg ? (
          // biome-ignore lint/a11y/useSemanticElements: banner de status (padrão do projeto)
          <div className="usuarios-banner usuarios-banner--success" role="status">
            {successMsg}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="usuarios-banner usuarios-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        <nav className="usuarios-filter-tabs" aria-label="Filtrar por status">
          {FILTER_OPTIONS.map((opt) => {
            const href = `/config/usuarios?status=${opt.value}`;
            const active = opt.value === statusFilter;
            return (
              <Link
                key={opt.value}
                href={href}
                className={active ? 'usuarios-filter-tab is-active' : 'usuarios-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        {filtered.length === 0 ? (
          <div className="usuarios-empty">
            <Users size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              {statusFilter === 'ativos'
                ? 'Nenhum usuario ativo no momento.'
                : statusFilter === 'pendentes'
                  ? 'Nenhum convite pendente.'
                  : 'Nenhum usuario arquivado.'}
            </p>
          </div>
        ) : (
          <div className="usuarios-table-wrap">
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Email</th>
                  <th>Papel</th>
                  <th>Status</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UsuarioRow key={u.user_id} u={u} currentUserId={user.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
