import Link from 'next/link';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Categoria } from '@/lib/data/categorias';
import type { Fornecedor } from '@/lib/data/fornecedores';
import { formatDocumento } from '@/lib/schemas/fornecedor';
import '../_shared/form-layout.css';

export function FornecedorForm({
  mode,
  initial,
  categorias,
  action,
  error,
}: {
  mode: 'create' | 'edit';
  initial?: Fornecedor;
  categorias: Categoria[];
  action: (formData: FormData) => Promise<void>;
  error?: string;
}) {
  const submitLabel = mode === 'create' ? 'Criar fornecedor' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/fornecedores' : `/fornecedores/${initial?.id ?? ''}`;
  const documentoDefault = mode === 'edit'
    ? formatDocumento(initial?.documento, initial?.documento_tipo).replace(/^—$/, '')
    : '';
  const ativoDefault = mode === 'create' ? true : initial?.ativo ?? true;

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
              defaultValue={initial?.nome ?? ''}
              placeholder="Ex: Home Center Sul"
              maxLength={200}
            />
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Razão social"
              name="razao_social"
              defaultValue={initial?.razao_social ?? ''}
              placeholder="Ex: Home Center Sul Materiais LTDA"
              maxLength={200}
            />
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Documento (CNPJ ou CPF)"
              name="documento"
              defaultValue={documentoDefault}
              placeholder="00.000.000/0000-00 ou 000.000.000-00"
              hint="Aceita com ou sem máscara — validado por dígito verificador"
              maxLength={20}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Categorização & status</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <label className="form-layout__label" htmlFor="forn-categoria">Categoria</label>
            <select
              id="forn-categoria"
              name="categoria_id"
              defaultValue={initial?.categoria_id ?? ''}
              className="form-layout__select"
            >
              <option value="">— sem categoria —</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={ativoDefault}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
              />
              Fornecedor ativo
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Contato</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field">
            <Input
              label="Telefone"
              name="telefone"
              type="tel"
              defaultValue={initial?.telefone ?? ''}
              placeholder="(00) 00000-0000"
              maxLength={30}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="E-mail"
              name="email"
              type="email"
              defaultValue={initial?.email ?? ''}
              placeholder="contato@empresa.com"
              maxLength={200}
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
