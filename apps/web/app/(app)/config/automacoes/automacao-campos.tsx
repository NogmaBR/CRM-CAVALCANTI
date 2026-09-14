import { type CampoConfig, PREFIXO_CAMPO } from '@/lib/automations/config-campos';

/**
 * Um campo por parâmetro da automação, gerado da descrição do schema.
 *
 * Só HTML: a validação real é a do `configSchema` no servidor
 * (`salvarConfigAutomacao`). Os `min`/`max`/`step` aqui são o primeiro
 * aviso, não a trava — o navegador barra o óbvio antes de ir ao servidor.
 */
export function AutomacaoCampos({
  chave,
  campos,
  valores,
  desabilitado,
}: {
  chave: string;
  campos: CampoConfig[];
  valores: Record<string, unknown>;
  desabilitado?: boolean;
}) {
  if (campos.length === 0) {
    return <p className="automacao-campos__vazio">Esta automação não tem parâmetros.</p>;
  }

  return (
    <div className="automacao-campos">
      {campos.map((campo) => {
        const id = `${chave}__${campo.chave}`;
        const nome = `${PREFIXO_CAMPO}${campo.chave}`;
        const atual = valores[campo.chave] ?? campo.padrao;

        if (campo.tipo === 'boolean') {
          return (
            <div key={campo.chave} className="automacao-campo automacao-campo--check">
              <label className="automacao-campo__check" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  name={nome}
                  defaultChecked={atual === true}
                  disabled={desabilitado}
                />
                <span className="automacao-campo__rotulo">{campo.rotulo}</span>
              </label>
              {campo.ajuda ? <span className="automacao-campo__ajuda">{campo.ajuda}</span> : null}
            </div>
          );
        }

        return (
          <div key={campo.chave} className="automacao-campo">
            <label className="automacao-campo__rotulo" htmlFor={id}>
              {campo.rotulo}
            </label>
            {campo.tipo === 'enum' ? (
              <select
                id={id}
                name={nome}
                className="automacao-campo__input automacao-campo__select"
                defaultValue={atual == null ? '' : String(atual)}
                disabled={desabilitado}
              >
                {(campo.opcoes ?? []).map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            ) : campo.tipo === 'number' ? (
              <input
                id={id}
                type="number"
                inputMode={campo.inteiro ? 'numeric' : 'decimal'}
                name={nome}
                className="automacao-campo__input"
                defaultValue={typeof atual === 'number' ? atual : ''}
                min={campo.min}
                max={campo.max}
                step={campo.inteiro ? 1 : 'any'}
                disabled={desabilitado}
              />
            ) : (
              <input
                id={id}
                type="text"
                name={nome}
                className="automacao-campo__input"
                defaultValue={atual == null ? '' : String(atual)}
                disabled={desabilitado}
              />
            )}
            {campo.ajuda ? <span className="automacao-campo__ajuda">{campo.ajuda}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
