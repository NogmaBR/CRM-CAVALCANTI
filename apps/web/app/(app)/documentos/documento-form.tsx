import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Documento } from '@/lib/data/documentos';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Pagamento } from '@/lib/data/pagamentos';
import { ALLOWED_MIMES, ANEXO_TIPO_LABELS } from '@/lib/schemas/documento';
import { Paperclip } from 'lucide-react';
import Link from 'next/link';
import '../_shared/form-layout.css';

export function DocumentoForm({
  mode,
  initial,
  defaultObraId,
  defaultPagamentoId,
  obras,
  pagamentos,
  fornecedores,
  action,
  error,
  campo,
  valores,
}: {
  mode: 'create' | 'edit';
  initial?: Documento;
  defaultObraId?: string;
  defaultPagamentoId?: string;
  obras: Obra[];
  pagamentos: Pagamento[];
  fornecedores: Fornecedor[];
  action: (formData: FormData) => Promise<void>;
  error?: string;
  /** `name` do campo que a action recusou — ganha borda de erro e foco. */
  campo?: string;
  /** O que a pessoa tinha digitado quando a action recusou (vence `initial`). */
  valores?: Record<string, string>;
}) {
  const submitLabel = mode === 'create' ? 'Enviar documento' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/documentos' : `/documentos/${initial?.id ?? ''}`;

  const v = valores ?? {};
  const obraDefault = v.obra_id ?? initial?.obra_id ?? defaultObraId ?? '';
  const pagamentoDefault = v.pagamento_id ?? initial?.pagamento_id ?? defaultPagamentoId ?? '';
  const fornecedorDefault = v.fornecedor_id ?? initial?.fornecedor_id ?? '';
  const tipoDefault = v.tipo ?? initial?.tipo ?? 'nota_fiscal';
  const erroCurto = error ? error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? erroCurto : undefined);
  const invalido = (name: string) => (campo === name ? true : undefined);

  const obrasVisiveis = obras.filter(
    (o) => o.deleted_at == null || (initial != null && o.id === initial.obra_id),
  );
  const pagamentosVisiveis = pagamentos.filter(
    (p) => p.deleted_at == null || (initial != null && p.id === initial.pagamento_id),
  );
  const fornecedoresVisiveis = fornecedores.filter(
    (f) => f.deleted_at == null || (initial != null && f.id === initial.fornecedor_id),
  );

  const acceptMimes = ALLOWED_MIMES.join(',');

  return (
    <form action={action} className="form-layout" encType="multipart/form-data">
      {mode === 'edit' && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {error ? (
        <div className="form-layout__error" role="alert">
          {error}
        </div>
      ) : null}

      {mode === 'create' ? (
        <fieldset className="form-layout__section">
          <legend className="form-layout__legend">Arquivo</legend>
          <div className="form-layout__grid">
            <div className="form-layout__field form-layout__field--full">
              <label className="form-layout__label form-layout__label--required" htmlFor="doc-file">
                Selecione o arquivo
              </label>
              <input
                id="doc-file"
                type="file"
                name="file"
                required
                accept={acceptMimes}
                aria-invalid={invalido('file')}
                // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
                autoFocus={campo === 'file'}
                style={{
                  padding: 10,
                  border: `1px dashed ${campo === 'file' ? 'var(--danger)' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  background: 'var(--surface-2, transparent)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                PDF, JPEG, PNG ou WebP · máx 10 MB
              </p>
            </div>
          </div>
        </fieldset>
      ) : (
        <fieldset className="form-layout__section">
          <legend className="form-layout__legend">Arquivo</legend>
          <div className="form-layout__grid">
            <div className="form-layout__field form-layout__field--full">
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                <Paperclip
                  size={14}
                  aria-hidden="true"
                  style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }}
                />
                <strong>{initial?.nome_arquivo}</strong>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Para trocar o arquivo, arquive este documento e crie um novo.
              </p>
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Classificação</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field">
            <label className="form-layout__label form-layout__label--required" htmlFor="doc-tipo">
              Tipo
            </label>
            <select
              id="doc-tipo"
              name="tipo"
              required
              defaultValue={tipoDefault}
              className="form-layout__select"
              aria-invalid={invalido('tipo')}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'tipo'}
            >
              {(Object.keys(ANEXO_TIPO_LABELS) as Array<keyof typeof ANEXO_TIPO_LABELS>).map(
                (k) => (
                  <option key={k} value={k}>
                    {ANEXO_TIPO_LABELS[k]}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="form-layout__field">
            <Input
              label="Número da NF"
              name="numero_nf"
              defaultValue={v.numero_nf ?? initial?.numero_nf ?? ''}
              placeholder="Ex: 4592"
              maxLength={50}
              error={erroDe('numero_nf')}
              autoFocus={campo === 'numero_nf'}
            />
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Chave de acesso NF"
              name="chave_acesso_nf"
              defaultValue={v.chave_acesso_nf ?? initial?.chave_acesso_nf ?? ''}
              placeholder="44 dígitos"
              maxLength={50}
              hint="Chave completa impressa no DANFE (opcional, evita duplicatas)"
              error={erroDe('chave_acesso_nf')}
              autoFocus={campo === 'chave_acesso_nf'}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Referências</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <label className="form-layout__label form-layout__label--required" htmlFor="doc-obra">
              Obra
            </label>
            <select
              id="doc-obra"
              name="obra_id"
              required
              defaultValue={obraDefault}
              className="form-layout__select"
              aria-invalid={invalido('obra_id')}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'obra_id'}
            >
              <option value="" disabled>
                — selecione uma obra —
              </option>
              {obrasVisiveis.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                  {o.deleted_at != null ? ' (arquivada)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="doc-pagamento">
              Pagamento
            </label>
            <select
              id="doc-pagamento"
              name="pagamento_id"
              defaultValue={pagamentoDefault}
              className="form-layout__select"
              aria-invalid={invalido('pagamento_id')}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'pagamento_id'}
            >
              <option value="">— sem pagamento —</option>
              {pagamentosVisiveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data_pagamento} ·{' '}
                  {Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  {p.deleted_at != null ? ' (arquivado)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="doc-fornecedor">
              Fornecedor
            </label>
            <select
              id="doc-fornecedor"
              name="fornecedor_id"
              defaultValue={fornecedorDefault}
              className="form-layout__select"
              aria-invalid={invalido('fornecedor_id')}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'fornecedor_id'}
            >
              <option value="">— sem fornecedor —</option>
              {fornecedoresVisiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                  {f.deleted_at != null ? ' (arquivado)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <p className="form-layout__obrigatorio">* obrigatório</p>

      <div className="form-layout__actions">
        <Link href={cancelHref} className="form-layout__cancel">
          Cancelar
        </Link>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
