import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import {
  AUDIT_ACAO_LABELS,
  AUDIT_ENTIDADES,
  AUDIT_ENTIDADE_LABELS,
  AUDIT_POR_PAGINA,
  type AuditAcao,
  type AuditEntidade,
  type AuditListItem,
  type AuditNomes,
  fraseAuditoria,
  getEntidadeUrl,
  listAuditLogPaginado,
  lookupNomesParaAuditoria,
} from '@/lib/data/auditoria';
import { FUSO_CLIENTE, hojeBR } from '@/lib/util/datas';
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import './auditoria.css';

export const metadata = { title: 'Auditoria' };

// ── helpers ────────────────────────────────────────────────────────────────

const formatadorHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_CLIENTE,
  hour: '2-digit',
  minute: '2-digit',
});

const formatadorDiaLongo = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_CLIENTE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatadorHora.format(d);
}

/**
 * Cabeçalho do grupo: "Hoje", "Ontem" ou "10/09/2026". A data civil é a de
 * Brasília (`hojeBR`), como todo o resto do sistema — um registro das 22h
 * de ontem não pode aparecer em "Hoje" só porque a Vercel roda em UTC.
 */
function rotuloDoDia(diaIso: string, hoje: string, ontem: string): string {
  if (diaIso === hoje) return 'Hoje';
  if (diaIso === ontem) return 'Ontem';
  return formatadorDiaLongo.format(new Date(`${diaIso}T12:00:00Z`));
}

function agruparPorDia(itens: AuditListItem[]): { dia: string; itens: AuditListItem[] }[] {
  const grupos: { dia: string; itens: AuditListItem[] }[] = [];
  for (const item of itens) {
    const dia = item.created_at ? hojeBR(new Date(item.created_at)) : 'sem-data';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(item);
    else grupos.push({ dia, itens: [item] });
  }
  return grupos;
}

const ACAO_VARIANT: Record<AuditAcao, BadgeVariant> = {
  insert: 'success',
  update: 'warning',
  delete: 'danger',
};

// ── filter form (pure HTML, server-friendly) ────────────────────────────────

function AuditFilters({
  entidade,
  acao,
  from,
  to,
}: {
  entidade?: string;
  acao?: string;
  from?: string;
  to?: string;
}) {
  return (
    <form action="/auditoria" method="get" className="audit-filters">
      {/* Entidade */}
      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-entidade">
          Entidade
        </label>
        <select
          id="af-entidade"
          name="entidade"
          className="audit-filters__select"
          defaultValue={entidade ?? ''}
        >
          <option value="">Todas</option>
          {AUDIT_ENTIDADES.map((e) => (
            <option key={e} value={e}>
              {AUDIT_ENTIDADE_LABELS[e]}
            </option>
          ))}
        </select>
      </div>

      {/* Acao */}
      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-acao">
          Ação
        </label>
        <select
          id="af-acao"
          name="acao"
          className="audit-filters__select"
          defaultValue={acao ?? ''}
        >
          <option value="">Todas</option>
          {(Object.entries(AUDIT_ACAO_LABELS) as [AuditAcao, string][]).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-from">
          De
        </label>
        <input
          id="af-from"
          type="date"
          name="from"
          className="audit-filters__date"
          defaultValue={from ?? ''}
        />
      </div>

      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-to">
          Até
        </label>
        <input
          id="af-to"
          type="date"
          name="to"
          className="audit-filters__date"
          defaultValue={to ?? ''}
        />
      </div>

      {/* Actions — trocar o filtro volta para a página 1 (o form não carrega `pagina`) */}
      <div className="audit-filters__actions">
        <button type="submit" className="audit-filters__submit">
          Aplicar filtros
        </button>
        <a href="/auditoria" className="audit-filters__clear">
          Limpar
        </a>
      </div>
    </form>
  );
}

// ── row card ────────────────────────────────────────────────────────────────

function AuditRow({ item, nomes }: { item: AuditListItem; nomes: AuditNomes }) {
  const acao = item.acao as AuditAcao;
  const acaoLabel = AUDIT_ACAO_LABELS[acao] ?? item.acao;
  const acaoVariant = ACAO_VARIANT[acao] ?? 'neutral';

  const entidadeUrl =
    item.entidade_id != null ? getEntidadeUrl(item.entidade, String(item.entidade_id)) : null;

  const userPapel = item.user_papel ? ` (${item.user_papel})` : '';

  return (
    <article className="audit-row">
      <div className="audit-row__main">
        <div className="audit-row__header">
          <time className="audit-row__ts" dateTime={item.created_at ?? undefined}>
            {formatHora(item.created_at)}
          </time>
          <Badge variant={acaoVariant}>{acaoLabel}</Badge>
        </div>

        <p className="audit-row__frase">
          {fraseAuditoria(item, nomes)}
          {userPapel ? <span className="audit-row__user-papel">{userPapel}</span> : null}
        </p>
      </div>

      <div className="audit-row__side">
        {entidadeUrl ? (
          <Link href={entidadeUrl} className="audit-row__link">
            Ver registro
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        ) : null}
        <Link href={`/auditoria/${item.id}`} className="audit-row__diff-btn">
          Ver diff
          <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

// ── pagination ──────────────────────────────────────────────────────────────

function hrefDaPagina(base: URLSearchParams, pagina: number): string {
  const qs = new URLSearchParams(base);
  if (pagina <= 1) qs.delete('pagina');
  else qs.set('pagina', String(pagina));
  const s = qs.toString();
  return s ? `/auditoria?${s}` : '/auditoria';
}

function Paginacao({
  pagina,
  totalPaginas,
  total,
  porPagina,
  filtros,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  porPagina: number;
  filtros: URLSearchParams;
}) {
  if (totalPaginas <= 1) return null;
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  const temAnterior = pagina > 1;
  const temProxima = pagina < totalPaginas;

  return (
    <nav className="audit-paginacao" aria-label="Paginação da auditoria">
      <span className="audit-paginacao__resumo">
        {inicio}–{fim} de {total} · página {pagina} de {totalPaginas}
      </span>
      <div className="audit-paginacao__botoes">
        {temAnterior ? (
          <Link
            href={hrefDaPagina(filtros, pagina - 1)}
            className="audit-paginacao__btn"
            rel="prev"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Anterior
          </Link>
        ) : (
          <span className="audit-paginacao__btn" aria-disabled="true">
            <ChevronLeft size={16} aria-hidden="true" />
            Anterior
          </span>
        )}
        {temProxima ? (
          <Link
            href={hrefDaPagina(filtros, pagina + 1)}
            className="audit-paginacao__btn"
            rel="next"
          >
            Próxima
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span className="audit-paginacao__btn" aria-disabled="true">
            Próxima
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    entidade?: string;
    acao?: string;
    from?: string;
    to?: string;
    user_id?: string;
    pagina?: string;
  }>;
}) {
  const params = await searchParams;

  const entidadeParam = AUDIT_ENTIDADES.includes(params.entidade as AuditEntidade)
    ? (params.entidade as AuditEntidade)
    : undefined;

  const acaoParam = (['insert', 'update', 'delete'] as AuditAcao[]).includes(
    params.acao as AuditAcao,
  )
    ? (params.acao as AuditAcao)
    : undefined;

  const paginaParam = Number.parseInt(params.pagina ?? '1', 10);
  const paginaPedida = Number.isFinite(paginaParam) && paginaParam >= 1 ? paginaParam : 1;

  const resultado = await listAuditLogPaginado(
    {
      entidade: entidadeParam,
      acao: acaoParam,
      from: params.from,
      to: params.to,
      user_id: params.user_id,
    },
    { pagina: paginaPedida, porPagina: AUDIT_POR_PAGINA },
  );
  const nomes = await lookupNomesParaAuditoria(resultado.itens);

  // Os links de página carregam os filtros ativos, e só eles.
  const filtros = new URLSearchParams();
  if (entidadeParam) filtros.set('entidade', entidadeParam);
  if (acaoParam) filtros.set('acao', acaoParam);
  if (params.from) filtros.set('from', params.from);
  if (params.to) filtros.set('to', params.to);
  if (params.user_id) filtros.set('user_id', params.user_id);

  const hoje = hojeBR();
  const ontem = hojeBR(new Date(Date.now() - 86_400_000));
  const grupos = agruparPorDia(resultado.itens);

  return (
    <>
      <TopBar title="Auditoria" subtitle="Histórico de alterações no sistema" />
      <div className="nos-page-body">
        <AuditFilters
          entidade={params.entidade}
          acao={params.acao}
          from={params.from}
          to={params.to}
        />

        {resultado.itens.length === 0 ? (
          <div className="audit-empty">
            <ShieldCheck size={36} className="audit-empty__icon" aria-hidden="true" />
            <p className="audit-empty__text">
              {paginaPedida > 1 ? 'Esta página não tem registros' : 'Nenhum registro no filtro'}
            </p>
            {paginaPedida > 1 ? (
              <Link href={hrefDaPagina(filtros, 1)} className="audit-empty__link">
                Voltar à primeira página
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="audit-feed">
              {grupos.map((grupo) => (
                <section
                  key={grupo.dia}
                  className="audit-dia"
                  aria-labelledby={`audit-dia-${grupo.dia}`}
                >
                  <h2 id={`audit-dia-${grupo.dia}`} className="audit-dia__titulo">
                    {rotuloDoDia(grupo.dia, hoje, ontem)}
                    <span className="audit-dia__contagem">{grupo.itens.length}</span>
                  </h2>
                  <ul className="audit-dia__lista">
                    {grupo.itens.map((item) => (
                      <li key={item.id}>
                        <AuditRow item={item} nomes={nomes} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <Paginacao
              pagina={resultado.pagina}
              totalPaginas={resultado.totalPaginas}
              total={resultado.total}
              porPagina={resultado.porPagina}
              filtros={filtros}
            />
          </>
        )}
      </div>
    </>
  );
}
