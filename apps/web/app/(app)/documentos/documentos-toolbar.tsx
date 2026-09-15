'use client';

import { CATEGORIAS, CATEGORIA_LABELS } from '@/lib/status-labels';
import { Search, X } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

type Option = { value: string; label: string };

export type Agrupamento = '' | 'fornecedor' | 'obra';

const AGRUPAR_OPTIONS: Array<{ value: Agrupamento; label: string }> = [
  { value: '', label: 'Nenhum' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'obra', label: 'Obra' },
];

/**
 * Uma busca, um filtro de obra e um "Agrupar por" — numa linha só.
 *
 * Antes eram quatro controles (filtro de obra, busca ampla, abas de visão e
 * a busca interna da tabela) para chegar ao mesmo conjunto; o gestor parava
 * para pensar "qual busca?". Agora tudo é um `<Form>` GET: a busca vai por
 * Enter ou botão, os selects submetem sozinhos ao mudar. Sem JavaScript a
 * página continua funcionando — é um formulário GET comum.
 */
export function DocumentosToolbar({
  obras,
  tipo,
  obraId,
  categoria,
  agrupar,
  busca,
}: {
  obras: Option[];
  tipo: string;
  obraId: string;
  categoria: string;
  agrupar: Agrupamento;
  busca: string;
}) {
  const submeterAoMudar = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.currentTarget.form?.requestSubmit();
  };

  const hrefLimpar = (() => {
    const p = new URLSearchParams();
    if (tipo) p.set('tipo', tipo);
    if (obraId) p.set('obra_id', obraId);
    if (categoria) p.set('categoria', categoria);
    if (agrupar) p.set('agrupar', agrupar);
    const qs = p.toString();
    return qs ? `/documentos?${qs}` : '/documentos';
  })();

  return (
    <Form action="/documentos" className="docs-toolbar" aria-label="Filtrar documentos">
      {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}

      <div className="docs-toolbar__busca">
        <Search size={15} aria-hidden="true" className="docs-toolbar__busca-icone" />
        <input
          className="docs-toolbar__input"
          type="search"
          name="q"
          defaultValue={busca}
          placeholder="Buscar por arquivo, nº da NF, fornecedor ou obra"
          aria-label="Buscar documentos"
        />
        {busca ? (
          <Link href={hrefLimpar} className="docs-toolbar__limpar" aria-label="Limpar busca">
            <X size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <button type="submit" className="docs-toolbar__botao">
        Buscar
      </button>

      <label className="docs-toolbar__campo">
        <span className="docs-toolbar__rotulo">Obra</span>
        <select
          name="obra_id"
          className="docs-toolbar__select"
          defaultValue={obraId}
          onChange={submeterAoMudar}
        >
          <option value="">Todas</option>
          {obras.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="docs-toolbar__campo">
        <span className="docs-toolbar__rotulo">Pasta</span>
        <select
          name="categoria"
          className="docs-toolbar__select"
          defaultValue={categoria}
          onChange={submeterAoMudar}
        >
          <option value="">Todas</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_LABELS[c].rotulo}
            </option>
          ))}
        </select>
      </label>

      <label className="docs-toolbar__campo">
        <span className="docs-toolbar__rotulo">Agrupar por</span>
        <select
          name="agrupar"
          className="docs-toolbar__select"
          defaultValue={agrupar}
          onChange={submeterAoMudar}
        >
          {AGRUPAR_OPTIONS.map((opt) => (
            <option key={opt.value || 'nenhum'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </Form>
  );
}
