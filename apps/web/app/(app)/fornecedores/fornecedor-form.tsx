import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Categoria } from '@/lib/data/categorias';
import type { Fornecedor } from '@/lib/data/fornecedores';
import { formatDocumento } from '@/lib/schemas/fornecedor';
import Link from 'next/link';
import '../_shared/form-layout.css';

export function FornecedorForm({
  mode,
  initial,
  categorias,
  action,
  error,
  campo,
  valores,
}: {
  mode: 'create' | 'edit';
  initial?: Fornecedor;
  categorias: Categoria[];
  action: (formData: FormData) => Promise<void>;
  error?: string;
  /** `name` do campo que a action recusou — ganha borda de erro e foco. */
  campo?: string;
  /** O que a pessoa tinha digitado quando a action recusou (vence `initial`). */
  valores?: Record<string, string>;
}) {
  const submitLabel = mode === 'create' ? 'Criar fornecedor' : 'Salvar alterações';
  const cancelHref = mode === 'create' ? '/fornecedores' : `/fornecedores/${initial?.id ?? ''}`;
  const documentoDefault =
    mode === 'edit'
      ? formatDocumento(initial?.documento, initial?.documento_tipo).replace(/^—$/, '')
      : '';
  const ativoDefault = mode === 'create' ? true : (initial?.ativo ?? true);

  const v = valores ?? {};
  // Checkbox desmarcado não viaja no FormData: se veio algum valor, `ativo`
  // ausente significa "desmarcado".
  const temValores = Object.keys(v).length > 0;
  const ativoChecked = temValores ? v.ativo != null : ativoDefault;
  const erroCurto = error ? error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? erroCurto : undefined);

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
              placeholder="Ex: Home Center Sul"
              maxLength={200}
              error={erroDe('nome')}
              autoFocus={campo === 'nome'}
            />
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Razão social"
              name="razao_social"
              defaultValue={v.razao_social ?? initial?.razao_social ?? ''}
              placeholder="Ex: Home Center Sul Materiais LTDA"
              maxLength={200}
              error={erroDe('razao_social')}
              autoFocus={campo === 'razao_social'}
            />
          </div>
          <div className="form-layout__field form-layout__field--wide">
            <Input
              label="Documento (CNPJ ou CPF)"
              name="documento"
              defaultValue={v.documento ?? documentoDefault}
              placeholder="00.000.000/0000-00 ou 000.000.000-00"
              hint="Aceita com ou sem máscara — validado por dígito verificador"
              maxLength={20}
              error={erroDe('documento')}
              autoFocus={campo === 'documento'}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-layout__section">
        <legend className="form-layout__legend">Categorização & status</legend>
        <div className="form-layout__grid">
          <div className="form-layout__field form-layout__field--wide">
            <label className="form-layout__label" htmlFor="forn-categoria">
              Categoria
            </label>
            <select
              id="forn-categoria"
              name="categoria_id"
              defaultValue={v.categoria_id ?? initial?.categoria_id ?? ''}
              className="form-layout__select"
              aria-invalid={campo === 'categoria_id' ? true : undefined}
              // biome-ignore lint/a11y/noAutofocus: foco no campo que a action recusou (T-QA-6)
              autoFocus={campo === 'categoria_id'}
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
                defaultChecked={ativoChecked}
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
              defaultValue={v.telefone ?? initial?.telefone ?? ''}
              placeholder="(00) 00000-0000"
              maxLength={30}
              error={erroDe('telefone')}
              autoFocus={campo === 'telefone'}
            />
          </div>
          <div className="form-layout__field">
            <Input
              label="E-mail"
              name="email"
              type="email"
              defaultValue={v.email ?? initial?.email ?? ''}
              placeholder="contato@empresa.com"
              maxLength={200}
              error={erroDe('email')}
              autoFocus={campo === 'email'}
            />
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
