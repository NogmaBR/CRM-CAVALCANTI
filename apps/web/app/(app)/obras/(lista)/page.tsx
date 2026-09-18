import { FiltroDeSituacao } from '@/components/completude/filtro-situacao';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import {
  type FiltroDeSituacao as Situacao,
  lerFiltroDeSituacao,
  passaNoFiltro,
} from '@/lib/completude/regras';
import { completudeDasObras } from '@/lib/data/completude';
import { type Obra, listObras } from '@/lib/data/obras';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ObrasTable } from '../obras-table';

export const metadata = { title: 'Obras' };

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'ativa', label: 'Ativas' },
  { value: 'pausada', label: 'Pausadas' },
  { value: 'concluida', label: 'Concluídas' },
  { value: 'arquivada', label: 'Arquivadas' },
];

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; success?: string; error?: string; situacao?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status ?? '') as '' | 'ativa' | 'pausada' | 'concluida' | 'arquivada';
  const situacao = lerFiltroDeSituacao(params.situacao);
  const successMessage = params.success ? decodeURIComponent(params.success) : undefined;
  const errorMessage = params.error ? decodeURIComponent(params.error) : undefined;

  const todas: Obra[] = await listObras({
    status: status === '' ? undefined : status,
    includeArchived: status === 'arquivada',
  });

  // O semáforo de cada obra (duas consultas para todas de uma vez) e o
  // filtro de situação em memória.
  const completudeMap = await completudeDasObras(todas);
  const completude = Object.fromEntries(completudeMap);
  const contagem: Record<Situacao, number> = {
    '': todas.length,
    pendente: 0,
    critico: 0,
    completo: 0,
  };
  for (const o of todas) {
    const c = completudeMap.get(o.id);
    if (!c) continue;
    if (c.nivel === 'completo') contagem.completo += 1;
    else contagem.pendente += 1;
    if (c.nivel === 'critico') contagem.critico += 1;
  }
  const obras = todas.filter((o) =>
    passaNoFiltro(completudeMap.get(o.id) ?? { nivel: 'completo' }, situacao),
  );
  const hrefDeStatus = (st: string, sit: Situacao) => {
    const p = new URLSearchParams();
    if (st) p.set('status', st);
    if (sit) p.set('situacao', sit);
    const qs = p.toString();
    return qs ? `/obras?${qs}` : '/obras';
  };

  return (
    <>
      <TopBar
        title="Obras"
        subtitle="Cadastro, orçamento e acompanhamento"
        actions={
          <Link href="/obras/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Nova Obra
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        <nav className="obras-filter-tabs" aria-label="Filtrar por status">
          {STATUS_OPTIONS.map((opt) => {
            const href = hrefDeStatus(opt.value, situacao);
            const active = opt.value === status;
            return (
              <Link
                key={opt.value || 'todas'}
                href={href}
                className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        <FiltroDeSituacao
          atual={situacao}
          buildHref={(v) => hrefDeStatus(status, v)}
          contagem={contagem}
        />

        <div style={{ marginTop: 24 }}>
          <ObrasTable
            obras={obras}
            successMessage={successMessage}
            errorMessage={errorMessage}
            completude={completude}
          />
        </div>
      </div>
    </>
  );
}
