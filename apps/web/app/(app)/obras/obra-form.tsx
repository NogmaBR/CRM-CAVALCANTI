import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Obra } from '@/lib/data/obras';
import Link from 'next/link';
import '../_shared/form-layout.css';

type Endereco = {
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

export function ObraForm({
  mode,
  initial,
  action,
  error,
  campo,
  valores,
}: {
  mode: 'create' | 'edit';
  initial?: Obra;
  action: (formData: FormData) => Promise<void>;
  error?: string;
  /** `name` do campo que a action recusou — ganha borda de erro e foco. */
  campo?: string;
  /** O que a pessoa tinha digitado quando a action recusou (vence `initial`). */
  valores?: Record<string, string>;
}) {
  const submitLabel = mode === 'create' ? 'Criar obra' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/obras' : `/obras/${initial?.id ?? ''}`;
  const end: Endereco = (initial?.endereco as Endereco | null) ?? {};
  const apelidosCsv = Array.isArray(initial?.apelidos) ? initial.apelidos.join(', ') : '';

  const v = valores ?? {};
  // O banner diz "Nome: obrigatório"; embaixo do campo basta "obrigatório".
  const erroCurto = error ? error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? erroCurto : undefined);
  const invalido = (name: string) => (campo === name ? true : undefined);

  return (
    <form action={action} className="form-layout">
      {mode === 'edit' && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {error ? (
        <div className="form-layout__error" role="alert">
          {error}
        </div>
      ) : null}

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Identificação</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Nome"
              name="nome"
              required
              defaultValue={v.nome ?? initial?.nome ?? ''}
              placeholder="Ex: Residencial Bela Vista"
              maxLength={200}
              error={erroDe('nome')}
              autoFocus={campo === 'nome'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Cliente"
              name="cliente"
              defaultValue={v.cliente ?? initial?.cliente ?? ''}
              placeholder="Ex: Cavalcanti Construções"
              maxLength={200}
              error={erroDe('cliente')}
              autoFocus={campo === 'cliente'}
            />
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="obra-tipo">
              Tipo
            </label>
            <select
              id="obra-tipo"
              name="tipo"
              defaultValue={v.tipo ?? initial?.tipo ?? ''}
              className="form-layout__select"
              aria-invalid={invalido('tipo')}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'tipo'}
            >
              <option value="">—</option>
              <option value="nova">Nova</option>
              <option value="reforma">Reforma</option>
            </select>
            {erroDe('tipo') ? (
              <span className="form-layout__campo-erro">{erroDe('tipo')}</span>
            ) : null}
          </div>
          <div className="form-layout__field">
            <label className="form-layout__label" htmlFor="obra-status">
              Status
            </label>
            <select
              id="obra-status"
              name="status"
              defaultValue={v.status ?? initial?.status ?? 'ativa'}
              className="form-layout__select"
              aria-invalid={invalido('status')}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'status'}
            >
              <option value="ativa">Ativa</option>
              <option value="pausada">Pausada</option>
              <option value="concluida">Concluída</option>
              <option value="arquivada">Arquivada</option>
            </select>
            {erroDe('status') ? (
              <span className="form-layout__campo-erro">{erroDe('status')}</span>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Financeiro & prazos</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field">
            <Input
              label="Orçamento (R$)"
              name="orcamento"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                v.orcamento ?? (initial?.orcamento != null ? String(initial.orcamento) : '')
              }
              placeholder="0"
              error={erroDe('orcamento')}
              autoFocus={campo === 'orcamento'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Data início"
              name="data_inicio"
              type="date"
              defaultValue={v.data_inicio ?? initial?.data_inicio ?? ''}
              error={erroDe('data_inicio')}
              autoFocus={campo === 'data_inicio'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Data prevista fim"
              name="data_prevista_fim"
              type="date"
              defaultValue={v.data_prevista_fim ?? initial?.data_prevista_fim ?? ''}
              error={erroDe('data_prevista_fim')}
              autoFocus={campo === 'data_prevista_fim'}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Endereço</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field">
            <Input
              label="CEP"
              name="endereco.cep"
              defaultValue={v['endereco.cep'] ?? end.cep ?? ''}
              placeholder="00000-000"
              maxLength={9}
              error={erroDe('endereco.cep')}
              autoFocus={campo === 'endereco.cep'}
            />
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Rua"
              name="endereco.rua"
              defaultValue={v['endereco.rua'] ?? end.rua ?? ''}
              maxLength={200}
              error={erroDe('endereco.rua')}
              autoFocus={campo === 'endereco.rua'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Número"
              name="endereco.numero"
              defaultValue={v['endereco.numero'] ?? end.numero ?? ''}
              maxLength={20}
              error={erroDe('endereco.numero')}
              autoFocus={campo === 'endereco.numero'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Bairro"
              name="endereco.bairro"
              defaultValue={v['endereco.bairro'] ?? end.bairro ?? ''}
              maxLength={100}
              error={erroDe('endereco.bairro')}
              autoFocus={campo === 'endereco.bairro'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="Cidade"
              name="endereco.cidade"
              defaultValue={v['endereco.cidade'] ?? end.cidade ?? ''}
              maxLength={100}
              error={erroDe('endereco.cidade')}
              autoFocus={campo === 'endereco.cidade'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="UF"
              name="endereco.uf"
              defaultValue={v['endereco.uf'] ?? end.uf ?? ''}
              maxLength={2}
              style={{ textTransform: 'uppercase' }}
              error={erroDe('endereco.uf')}
              autoFocus={campo === 'endereco.uf'}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Extras</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Apelidos (separados por vírgula)"
              name="apelidos"
              defaultValue={v.apelidos ?? apelidosCsv}
              placeholder="Ex: Obra Alpha, RC2"
              hint="Nomes alternativos usados no WhatsApp"
              error={erroDe('apelidos')}
              autoFocus={campo === 'apelidos'}
            />
          </div>
          <div className="form-layout__field form-layout__field--full">
            <label className="form-layout__label" htmlFor="obra-obs">
              Observações
            </label>
            <textarea
              id="obra-obs"
              name="observacoes"
              defaultValue={v.observacoes ?? initial?.observacoes ?? ''}
              rows={4}
              maxLength={2000}
              className="form-layout__textarea"
              placeholder="Notas internas sobre esta obra..."
              aria-invalid={invalido('observacoes')}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'observacoes'}
            />
            {erroDe('observacoes') ? (
              <span className="form-layout__campo-erro">{erroDe('observacoes')}</span>
            ) : null}
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
