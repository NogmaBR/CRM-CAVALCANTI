import { Button } from '@/components/nogma/Button';
import { ALLOWED_MIMES } from '@/lib/schemas/documento';
import { Paperclip } from 'lucide-react';
import './formulario-comprovante.css';

/**
 * PM3 — anexar o comprovante ou a nota sem sair da tela do pagamento.
 * Server component com `<form action>`: escolhe o arquivo, diz se é nota ou
 * comprovante, envia. Obra, fornecedor e pasta vêm do pagamento na action.
 *
 * `compacto`: quando o pagamento já tem documento, o formulário vira uma
 * linha discreta ("Anexar outro") em vez do bloco em destaque.
 */
export function FormularioDeComprovante({
  pagamentoId,
  action,
  compacto = false,
}: {
  pagamentoId: string;
  action: (formData: FormData) => Promise<void>;
  compacto?: boolean;
}) {
  return (
    <form
      id="comprovante"
      action={action}
      className={`form-comprovante${compacto ? ' form-comprovante--compacto' : ''}`}
      encType="multipart/form-data"
    >
      <input type="hidden" name="pagamento_id" value={pagamentoId} />
      <label className="form-comprovante__arquivo">
        <span className="form-comprovante__rotulo">
          <Paperclip size={15} aria-hidden="true" />
          {compacto ? 'Anexar outro arquivo' : 'Escolher o arquivo do comprovante ou da nota'}
        </span>
        <input type="file" name="file" required accept={ALLOWED_MIMES.join(',')} />
        <span className="form-comprovante__dica">PDF, JPEG, PNG ou WebP · máx 10 MB</span>
      </label>
      <label className="form-comprovante__tipo">
        <span className="form-comprovante__rotulo">O que é</span>
        <select name="tipo" defaultValue="comprovante">
          <option value="comprovante">Comprovante (Pix, TED, recibo)</option>
          <option value="nota_fiscal">Nota fiscal</option>
        </select>
      </label>
      <label className="form-comprovante__nf">
        <span className="form-comprovante__rotulo">Nº da NF (se tiver)</span>
        <input
          type="text"
          name="numero_nf"
          inputMode="numeric"
          placeholder="ex.: 1234"
          maxLength={50}
        />
      </label>
      <div className="form-comprovante__acao">
        <Button type="submit" variant={compacto ? 'secondary' : 'primary'}>
          Anexar
        </Button>
      </div>
    </form>
  );
}
