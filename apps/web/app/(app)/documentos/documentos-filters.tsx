'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Option = { value: string; label: string };

export function DocumentosFilters({
  obras,
  selectedObraId,
}: {
  obras: Option[];
  selectedObraId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) p.set(key, value);
      else p.delete(key);
      const qs = p.toString();
      router.push(qs ? `/documentos?${qs}` : '/documentos');
    },
    [router, searchParams],
  );

  return (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 320px)',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label
          htmlFor="filter-obra"
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Obra
        </label>
        <select
          id="filter-obra"
          value={selectedObraId}
          onChange={(e) => setParam('obra_id', e.target.value)}
          className="form-layout__select"
        >
          <option value="">— todas —</option>
          {obras.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
