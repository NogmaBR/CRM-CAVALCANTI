import Link from 'next/link';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Categoria } from '@/lib/data/categorias';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Pagamento } from '@/lib/data/pagamentos';
import '../_shared/form-layout.css';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PagamentoForm({
  mode,
  initial,
  defaultObraId,
  obras,
  fornecedores,
  categorias,
  action,
  error,
}: {
  mode: 'create' | 'edit';
  initial?: Pagamento;
  defaultObraId?: string;
  obras: Obra[];
  fornecedores: Fornecedor[];
  categorias: Categoria[];
  action: (formData: FormData) => Promise<void>;
  error?: string;
}) {
  const submitLabel = mode === 'create' ? 'Registrar pagamento' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/pagamentos' : `/pagamentos/${initial?.id ?? ''}`;

  const valorDefault = initial?.valor != null ? String(initial.valor) : '';
  const dataDefault = initial?.data_pagamento ?? todayISO();
  const origemDefault = initial?.origem ?? 'manual';
  const statusDefault = initial?.status_pagto ?? 'confirmado';
  const obraDefault = initial?.obra_id ?? defaultObraId ?? '';

  // Filtro: obras ativas + a obra atual do initial (mesmo se arquivada)
  const obrasVisiveis = obras.filter(
    (o) => o.deleted_at == null || (initial != null && o.id === initial.obra_id),
  );
  const fornecedoresVisiveis = fornecedores.filter(
    (f) => f.deleted_at == null || (initial != null && f.id === initial.fornecedor_id),
  );

  return (
    <form action={action} className="form-layout">
      {mode === 'edit' && initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="origem" value={origemDefault} />

      {error ? (
        <div className="form-layout__error" role="alert">
          {error}
        </div>
      ) : null}

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Referências</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <label className="form-layout__label" htmlFor="pag-obra">
              Obra <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>
            <select
              id="pag-obra"
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
            <label className="form-layout__label" htmlFor="pag-fornecedor">Fornecedor</label>
            <select
              id="pag-fornecedor"
              name="fornecedor_id"
              defaultValue={initial?.fornecedor_id ?? ''}
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
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="pag-categoria">Categoria</label>
            <select
              id="pag-categoria"
              name="categoria_id"
              defaultValue={initial?.categoria_id ?? ''}
              className="form-layout__select"
            >
              <option value="">— sem categoria —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Valores & data</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field">
            <Input
              label="Valor (R$)"
              name="valor"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={valorDefault}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Data do pagamento"
              name="data_pagamento"
              type="date"
              required
              defaultValue={dataDefault}
            />
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="pag-status">Status</label>
            <select
              id="pag-status"
              name="status_pagto"
              defaultValue={statusDefault}
              className="form-layout__select"
            >
              <option value="confirmado">Confirmado</option>
              <option value="aguardando">Aguardando</option>
              <option value="erro">Erro</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Notas</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Descrição"
              name="descricao"
              defaultValue={initial?.descricao ?? ''}
              placeholder="Ex: NF 4592 - Cimento portland CP-II"
              maxLength={500}
            />
          </div>
          <div className="form-layout__field form-layout__field--full">
            <label className="form-layout__label" htmlFor="pag-obs">Observações</label>
            <textarea
              id="pag-obs"
              name="observacoes"
              defaultValue={initial?.observacoes ?? ''}
              rows={4}
              maxLength={2000}
              className="form-layout__textarea"
              placeholder="Notas internas sobre este pagamento..."
            />
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
