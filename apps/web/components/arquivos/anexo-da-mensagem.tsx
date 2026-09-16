import { VisualizadorDeArquivo } from './visualizador';

/**
 * O anexo de uma mensagem do WhatsApp dentro de um cartão (pendência, lista de
 * mensagens): a foto da nota ao lado da pergunta "confirma?", o PDF aberto, o
 * áudio tocável. É o visualizador em modo compacto apontando para
 * `/api/arquivos/mensagem/<id>`.
 */
export function AnexoDaMensagem({
  mensagemId,
  mime,
  legenda,
}: {
  mensagemId: string;
  mime: string | null | undefined;
  legenda?: string | null;
}) {
  return (
    <VisualizadorDeArquivo
      origem="mensagem"
      id={mensagemId}
      mime={mime}
      nome={legenda?.trim() ? `Anexo — ${legenda.trim().slice(0, 60)}` : 'Anexo da mensagem'}
      compacto
    />
  );
}
