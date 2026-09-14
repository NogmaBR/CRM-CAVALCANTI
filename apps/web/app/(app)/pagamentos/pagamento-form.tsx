import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Categoria } from '@/lib/data/categorias';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Pagamento } from '@/lib/data/pagamentos';
import { PAGAMENTO_STATUS_LABEL } from '@/lib/status-labels';
import { formatarValorBR } from '@/lib/util/moeda';
import Link from 'next/link';
import '../_shared/form-layout.css';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Formulário de pagamento (criar e editar).
 *
 * `valores` é o que a pessoa digitou na tentativa anterior (ou o que veio
 * pré-preenchido de /pendentes) e vence `initial`; `campo` é o input que o
 * servidor apontou como errado — ele recebe a borda vermelha, a mensagem
 * curta e o foco. Ver `_shared/form-erros.ts`.
 */
export function PagamentoForm({
  mode,
  initial,
  defaultObraId,
  obras,
  fornecedores,
  categorias,
  action,
  error,
  campo,
  valores = {},
}: {
  mode: 'create' | 'edit';
  initial?: Pagamento;
  defaultObraId?: string;
  obras: Obra[];
  fornecedores: Fornecedor[];
  categorias: Categoria[];
  action: (formData: FormData) => Promise<void>;
  error?: string;
  campo?: string;
  valores?: Record<string, string>;
}) {
  const submitLabel = mode === 'create' ? 'Registrar pagamento' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/pagamentos' : `/pagamentos/${initial?.id ?? ''}`;

  // O banner mostra "Rótulo: mensagem"; junto ao campo basta a mensagem.
  const mensagemCurta = error ? error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? mensagemCurta : undefined);

  const valorDefault =
    valores.valor ?? (initial?.valor != null ? formatarValorBR(initial.valor) : '');
  const dataDefault = valores.data_pagamento ?? initial?.data_pagamento ?? todayISO();
  const origemDefault = valores.origem ?? initial?.origem ?? 'manual';
  const statusDefault = valores.status_pagto ?? initial?.status_pagto ?? 'confirmado';
  const obraDefault = valores.obra_id ?? initial?.obra_id ?? defaultObraId ?? '';
  const fornecedorDefault = valores.fornecedor_id ?? initial?.fornecedor_id ?? '';
  const categoriaDefault = valores.categoria_id ?? initial?.categoria_id ?? '';
  const descricaoDefault = valores.descricao ?? initial?.descricao ?? '';
  const observacoesDefault = valores.observacoes ?? initial?.observacoes ?? '';

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
              aria-invalid={campo === 'obra_id' || undefined}
              aria-describedby={campo === 'obra_id' ? 'pag-obra-erro' : undefined}
              // biome-ignore lint/a11y/noAutofocus: foco vai para o campo que o servidor recusou
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
            {erroDe('obra_id') ? (
              <span id="pag-obra-erro" className="form-layout__campo-erro">
                {erroDe('obra_id')}
              </span>
            ) : null}
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="pag-fornecedor">
              Fornecedor
            </label>
            <select
              id="pag-fornecedor"
              name="fornecedor_id"
              defaultValue={fornecedorDefault}
              className="form-layout__select"
              aria-invalid={campo === 'fornecedor_id' || undefined}
              // biome-ignore lint/a11y/noAutofocus: foco vai para o campo que o servidor recusou
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
            {erroDe('fornecedor_id') ? (
              <span className="form-layout__campo-erro">{erroDe('fornecedor_id')}</span>
            ) : null}
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="pag-categoria">
              Categoria
            </label>
            <select
              id="pag-categoria"
              name="categoria_id"
              defaultValue={categoriaDefault}
              className="form-layout__select"
              aria-invalid={campo === 'categoria_id' || undefined}
              // biome-ignore lint/a11y/noAutofocus: foco vai para o campo que o servidor recusou
              autoFocus={campo === 'categoria_id'}
            >
              <option value="">— sem categoria —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {erroDe('categoria_id') ? (
              <span className="form-layout__campo-erro">{erroDe('categoria_id')}</span>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Valores & data</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field">
            {/*
              Texto livre, não `type="number"`: no Android o campo numérico
              recusa "1.250,00" e a vírgula depende do teclado (design review,
              M5). `parseValorBR` lê o que vier no servidor.
            */}
            <Input
              label="Valor (R$)"
              name="valor"
              type="text"
              inputMode="decimal"
              required
              defaultValue={valorDefault}
              placeholder="1.250,00"
              hint="Use vírgula para centavos"
              error={erroDe('valor')}
              autoComplete="off"
              autoFocus={campo === 'valor'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Data do pagamento"
              name="data_pagamento"
              type="date"
              required
              defaultValue={dataDefault}
              error={erroDe('data_pagamento')}
              autoFocus={campo === 'data_pagamento'}
            />
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="pag-status">
              Status
            </label>
            {/* Mesmo vocabulário dos filtros e badges (`status-labels.ts`, QA ISSUE-003). */}
            <select
              id="pag-status"
              name="status_pagto"
              defaultValue={statusDefault}
              className="form-layout__select"
              aria-invalid={campo === 'status_pagto' || undefined}
              // biome-ignore lint/a11y/noAutofocus: foco vai para o campo que o servidor recusou
              autoFocus={campo === 'status_pagto'}
            >
              {Object.entries(PAGAMENTO_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {erroDe('status_pagto') ? (
              <span className="form-layout__campo-erro">{erroDe('status_pagto')}</span>
            ) : null}
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
              defaultValue={descricaoDefault}
              placeholder="Ex: NF 4592 - Cimento portland CP-II"
              maxLength={500}
              error={erroDe('descricao')}
              autoFocus={campo === 'descricao'}
            />
          </div>
          <div className="form-layout__field form-layout__field--full">
            <label className="form-layout__label" htmlFor="pag-obs">
              Observações
            </label>
            <textarea
              id="pag-obs"
              name="observacoes"
              defaultValue={observacoesDefault}
              rows={4}
              maxLength={2000}
              className="form-layout__textarea"
              placeholder="Notas internas sobre este pagamento..."
              aria-invalid={campo === 'observacoes' || undefined}
              // biome-ignore lint/a11y/noAutofocus: foco vai para o campo que o servidor recusou
              autoFocus={campo === 'observacoes'}
            />
            {erroDe('observacoes') ? (
              <span className="form-layout__campo-erro">{erroDe('observacoes')}</span>
            ) : null}
          </div>
        </div>
      </fieldset>

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
