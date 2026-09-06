'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Option = { value: string; label: string };

export function PagamentosFilters({
  obras,
  fornecedores,
  categorias,
  selectedObraId,
  selectedFornecedorId,
  selectedCategoriaId,
}: {
  obras: Option[];
  fornecedores: Option[];
  categorias: Option[];
  selectedObraId: string;
  selectedFornecedorId: string;
  selectedCategoriaId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) p.set(key, value);
      else p.delete(key);
      const qs = p.toString();
      router.push(qs ? `/pagamentos?${qs}` : '/pagamentos');
    },
    [router, searchParams],
  );

  return (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      <FilterSelect
        label="Obra"
        paramKey="obra_id"
        currentValue={selectedObraId}
        options={obras}
        onChange={setParam}
      />
      <FilterSelect
        label="Categoria"
        paramKey="categoria_id"
        currentValue={selectedCategoriaId}
        options={categorias}
        onChange={setParam}
      />
      <FilterSelect
        label="Fornecedor"
        paramKey="fornecedor_id"
        currentValue={selectedFornecedorId}
        options={fornecedores}
        onChange={setParam}
      />
    </div>
  );
}

function FilterSelect({
  label,
  paramKey,
  currentValue,
  options,
  onChange,
}: {
  label: string;
  paramKey: string;
  currentValue: string;
  options: Option[];
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        htmlFor={`filter-${paramKey}`}
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </label>
      <select
        id={`filter-${paramKey}`}
        value={currentValue}
        onChange={(e) => onChange(paramKey, e.target.value)}
        className="obra-form__select"
      >
        <option value="">— todas —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
