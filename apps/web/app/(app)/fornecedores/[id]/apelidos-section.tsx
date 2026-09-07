'use client';

import { Tag, X, Sparkles } from 'lucide-react';
import type { FornecedorApelido } from '@/lib/data/fornecedores';
import { adicionarApelido, removerApelido } from './apelido-actions';

export function ApelidosSection({
  fornecedorId,
  apelidos,
}: {
  fornecedorId: string;
  apelidos: FornecedorApelido[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* List */}
      {apelidos.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Sem apelidos ainda. Adicione formas alternativas de referenciar este fornecedor (usado
          pela IA).
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {apelidos.map((a) => (
            <li
              key={a.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px 5px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 20,
                fontSize: 13,
              }}
            >
              <Tag size={11} aria-hidden="true" style={{ opacity: 0.5, flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{a.apelido}</span>
              {a.criado_por_ia ? (
                <span
                  title="Criado pela IA"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--brand, #a3e635) 15%, transparent)',
                    color: 'var(--brand, #a3e635)',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  <Sparkles size={9} aria-hidden="true" />
                  IA
                </span>
              ) : null}
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.vezes_visto}×
              </span>
              <form action={removerApelido} style={{ display: 'contents' }}>
                <input type="hidden" name="fornecedor_id" value={fornecedorId} />
                <input type="hidden" name="apelido_id" value={a.id} />
                <button
                  type="submit"
                  aria-label={`Remover apelido ${a.apelido}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    borderRadius: 4,
                    color: 'var(--text-secondary)',
                    lineHeight: 1,
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* Add form */}
      <form
        action={adicionarApelido}
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <input type="hidden" name="fornecedor_id" value={fornecedorId} />
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <label
            htmlFor="apelido-input"
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 5,
            }}
          >
            Novo apelido
          </label>
          <input
            id="apelido-input"
            name="apelido"
            type="text"
            placeholder="Ex: 'Casa Tintas', 'CDT'"
            autoComplete="off"
            minLength={2}
            maxLength={100}
            required
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: 13,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: 'var(--brand, #a3e635)',
            color: '#000',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Adicionar
        </button>
      </form>
    </div>
  );
}
