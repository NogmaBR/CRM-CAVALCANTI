import Link from 'next/link';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Pagamento } from '@/lib/data/pagamentos';
import type { Documento } from '@/lib/data/documentos';
import { ANEXO_TIPO_LABELS, ALLOWED_MIMES } from '@/lib/schemas/documento';

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
}) {
  const submitLabel = mode === 'create' ? 'Enviar documento' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/documentos' : `/documentos/${initial?.id ?? ''}`;

  const obraDefault = initial?.obra_id ?? defaultObraId ?? '';
  const pagamentoDefault = initial?.pagamento_id ?? defaultPagamentoId ?? '';
  const fornecedorDefault = initial?.fornecedor_id ?? '';
  const tipoDefault = initial?.tipo ?? 'nota_fiscal';

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
    <form action={action} className="form-layout__form" encType="multipart/form-data">
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
              <label className="form-layout__label" htmlFor="doc-file">
                Selecione o arquivo <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <input
                id="doc-file"
                type="file"
                name="file"
                required
                accept={acceptMimes}
                style={{
                  padding: 10,
                  border: '1px dashed var(--border-subtle)',
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
                📎 <strong>{initial?.nome_arquivo}</strong>
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
            <label className="form-layout__label" htmlFor="doc-tipo">
              Tipo <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>
            <select
              id="doc-tipo"
              name="tipo"
              required
              defaultValue={tipoDefault}
              className="form-layout__select"
            >
              {(Object.keys(ANEXO_TIPO_LABELS) as Array<keyof typeof ANEXO_TIPO_LABELS>).map((k) => (
                <option key={k} value={k}>
                  {ANEXO_TIPO_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-layout__field">
            <Input
              label="Número da NF"
              name="numero_nf"
              defaultValue={initial?.numero_nf ?? ''}
              placeholder="Ex: 4592"
              maxLength={50}
            />
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Chave de acesso NF"
              name="chave_acesso_nf"
              defaultValue={initial?.chave_acesso_nf ?? ''}
              placeholder="44 dígitos"
              maxLength={50}
              hint="Chave completa impressa no DANFE (opcional, evita duplicatas)"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Referências</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <label className="form-layout__label" htmlFor="doc-obra">
              Obra <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>
            <select
              id="doc-obra"
              name="obra_id"
              required
              defaultValue={obraDefault}
              className="form-layout__select"
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
            <label className="form-layout__label" htmlFor="doc-pagamento">Pagamento</label>
            <select
              id="doc-pagamento"
              name="pagamento_id"
              defaultValue={pagamentoDefault}
              className="form-layout__select"
            >
              <option value="">— sem pagamento —</option>
              {pagamentosVisiveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data_pagamento} · {Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  {p.deleted_at != null ? ' (arquivado)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="doc-fornecedor">Fornecedor</label>
            <select
              id="doc-fornecedor"
              name="fornecedor_id"
              defaultValue={fornecedorDefault}
              className="form-layout__select"
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

      <div className="form-layout__actions">
        <Link href={cancelHref} className="form-layout__cancel">
          Cancelar
        </Link>
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
