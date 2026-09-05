import Link from 'next/link';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Obra } from '@/lib/data/obras';
import './obra-form.css';

type Endereco = { cep?: string; rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string };

export function ObraForm({
  mode,
  initial,
  action,
  error,
}: {
  mode: 'create' | 'edit';
  initial?: Obra;
  action: (formData: FormData) => Promise<void>;
  error?: string;
}) {
  const submitLabel = mode === 'create' ? 'Criar obra' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/obras' : `/obras/${initial?.id ?? ''}`;
  const end: Endereco = (initial?.endereco as Endereco | null) ?? {};
  const apelidosCsv = Array.isArray(initial?.apelidos) ? initial.apelidos.join(', ') : '';

  return (
    <form action={action} className="obra-form">
      {mode === 'edit' && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {error ? (
        <div className="obra-form__error" role="alert">
          {error}
        </div>
      ) : null}

      <fieldset className="obra-form__section">
        <legend className="obra-form__legend">Identificação</legend>
        <div className="obra-form__grid">
          <div className="obra-form__field obra-form__field--wide">
            <Input
              label="Nome"
              name="nome"
              required
              defaultValue={initial?.nome ?? ''}
              placeholder="Ex: Residencial Bela Vista"
              maxLength={200}
            />
          </div>
          <div className="obra-form__field">
            <Input
              label="Cliente"
              name="cliente"
              defaultValue={initial?.cliente ?? ''}
              placeholder="Ex: Cavalcanti Construções"
              maxLength={200}
            />
          </div>
          <div className="obra-form__field">
            <label className="obra-form__label" htmlFor="obra-tipo">Tipo</label>
            <select
              id="obra-tipo"
              name="tipo"
              defaultValue={initial?.tipo ?? ''}
              className="obra-form__select"
            >
              <option value="">—</option>
              <option value="nova">Nova</option>
              <option value="reforma">Reforma</option>
            </select>
          </div>
          <div className="obra-form__field">
            <label className="obra-form__label" htmlFor="obra-status">Status</label>
            <select
              id="obra-status"
              name="status"
              defaultValue={initial?.status ?? 'ativa'}
              className="obra-form__select"
            >
              <option value="ativa">Ativa</option>
              <option value="pausada">Pausada</option>
              <option value="concluida">Concluída</option>
              <option value="arquivada">Arquivada</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="obra-form__section">
        <legend className="obra-form__legend">Financeiro & prazos</legend>
        <div className="obra-form__grid">
          <div className="obra-form__field">
            <Input
              label="Orçamento (R$)"
              name="orcamento"
              type="number"
              min="0"
              step="0.01"
              defaultValue={initial?.orcamento != null ? String(initial.orcamento) : ''}
              placeholder="0"
            />
          </div>
          <div className="obra-form__field">
            <Input
              label="Data início"
              name="data_inicio"
              type="date"
              defaultValue={initial?.data_inicio ?? ''}
            />
          </div>
          <div className="obra-form__field">
            <Input
              label="Data prevista fim"
              name="data_prevista_fim"
              type="date"
              defaultValue={initial?.data_prevista_fim ?? ''}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="obra-form__section">
        <legend className="obra-form__legend">Endereço</legend>
        <div className="obra-form__grid">
          <div className="obra-form__field">
            <Input label="CEP" name="endereco.cep" defaultValue={end.cep ?? ''} placeholder="00000-000" maxLength={9} />
          </div>
          <div className="obra-form__field obra-form__field--wide">
            <Input label="Rua" name="endereco.rua" defaultValue={end.rua ?? ''} maxLength={200} />
          </div>
          <div className="obra-form__field">
            <Input label="Número" name="endereco.numero" defaultValue={end.numero ?? ''} maxLength={20} />
          </div>
          <div className="obra-form__field">
            <Input label="Bairro" name="endereco.bairro" defaultValue={end.bairro ?? ''} maxLength={100} />
          </div>
          <div className="obra-form__field">
            <Input label="Cidade" name="endereco.cidade" defaultValue={end.cidade ?? ''} maxLength={100} />
          </div>
          <div className="obra-form__field">
            <Input
              label="UF"
              name="endereco.uf"
              defaultValue={end.uf ?? ''}
              maxLength={2}
              style={{ textTransform: 'uppercase' }}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="obra-form__section">
        <legend className="obra-form__legend">Extras</legend>
        <div className="obra-form__grid">
          <div className="obra-form__field obra-form__field--wide">
            <Input
              label="Apelidos (separados por vírgula)"
              name="apelidos"
              defaultValue={apelidosCsv}
              placeholder="Ex: Obra Alpha, RC2"
              hint="Nomes alternativos usados no WhatsApp"
            />
          </div>
          <div className="obra-form__field obra-form__field--full">
            <label className="obra-form__label" htmlFor="obra-obs">Observações</label>
            <textarea
              id="obra-obs"
              name="observacoes"
              defaultValue={initial?.observacoes ?? ''}
              rows={4}
              maxLength={2000}
              className="obra-form__textarea"
              placeholder="Notas internas sobre esta obra..."
            />
          </div>
        </div>
      </fieldset>

      <div className="obra-form__actions">
        <Link href={cancelHref} className="obra-form__cancel">
          Cancelar
        </Link>
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
