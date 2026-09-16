import { rotuloDoMime, tipoVisual, urlDoArquivo } from '@/lib/arquivos/tipo-visual';
import { formatBytes } from '@/lib/schemas/documento';
import { Download, ExternalLink, File, FileSpreadsheet, FileText, Film, Music } from 'lucide-react';
import type { ReactNode } from 'react';
import { ImagemComLightbox } from './lightbox';
import './arquivos.css';

export type OrigemArquivo = 'documento' | 'mensagem' | 'registro';

/**
 * O visualizador único do CRM. Escolhe pelo MIME: foto abre grande ao clicar,
 * PDF abre na própria página, vídeo e áudio tocam, o resto (planilha, Word,
 * DWG) mostra ícone, nome, tamanho e o botão de baixar. Tudo passa pela rota
 * `/api/arquivos`, que só entrega o que a RLS do usuário deixa ver.
 *
 * `textoExtraido` (quando há) aparece dobrado embaixo: é o que a IA leu do
 * arquivo — útil para conferir uma nota escaneada sem abrir o PDF.
 */
export function VisualizadorDeArquivo({
  origem,
  id,
  mime,
  nome,
  tamanho,
  textoExtraido,
}: {
  origem: OrigemArquivo;
  id: string;
  mime: string | null | undefined;
  nome: string;
  tamanho?: number | null;
  textoExtraido?: string | null;
}) {
  const tipo = tipoVisual(mime);
  const abrir = urlDoArquivo(origem, id);
  const baixar = urlDoArquivo(origem, id, 'baixar');

  return (
    <figure className="arq-visualizador" data-tipo={tipo}>
      {tipo === 'imagem' ? (
        <ImagemComLightbox src={abrir} alt={nome} className="arq-visualizador__imagem" />
      ) : null}

      {tipo === 'pdf' ? (
        <iframe
          className="arq-visualizador__pdf"
          src={`${abrir}#toolbar=1&view=FitH`}
          title={nome}
        />
      ) : null}

      {tipo === 'video' ? (
        // biome-ignore lint/a11y/useMediaCaption: vídeo de canteiro mandado pelo WhatsApp; não há legenda a oferecer
        <video
          className="arq-visualizador__video"
          controls
          preload="metadata"
          playsInline
          src={abrir}
        >
          Seu navegador não toca este vídeo. <a href={baixar}>Baixar</a>.
        </video>
      ) : null}

      {tipo === 'audio' ? (
        // biome-ignore lint/a11y/useMediaCaption: a transcrição fica no registro, ao lado do player
        <audio className="arq-visualizador__audio" controls preload="none" src={abrir}>
          Seu navegador não toca este áudio. <a href={baixar}>Baixar</a>.
        </audio>
      ) : null}

      {tipo === 'outro' ? (
        <div className="arq-visualizador__outro">
          <span className="arq-visualizador__icone" aria-hidden="true">
            <IconeDoMime mime={mime} size={36} />
          </span>
          <div>
            <p className="arq-visualizador__nome">{nome}</p>
            <p className="arq-visualizador__meta">
              {rotuloDoMime(mime)}
              {tamanho != null ? ` · ${formatBytes(tamanho)}` : ''} · sem pré-visualização no
              navegador
            </p>
          </div>
        </div>
      ) : null}

      <figcaption className="arq-visualizador__acoes">
        <a href={abrir} target="_blank" rel="noreferrer noopener" className="arq-acao">
          <ExternalLink size={14} aria-hidden="true" />
          Abrir em nova aba
        </a>
        <a href={baixar} className="arq-acao">
          <Download size={14} aria-hidden="true" />
          Baixar{tamanho != null ? ` (${formatBytes(tamanho)})` : ''}
        </a>
      </figcaption>

      {textoExtraido?.trim() ? (
        <details className="arq-texto">
          <summary>Texto lido do arquivo</summary>
          <pre>
            {textoExtraido.length > 4000 ? `${textoExtraido.slice(0, 4000)}…` : textoExtraido}
          </pre>
        </details>
      ) : null}
    </figure>
  );
}

/** Ícone por tipo, para miniaturas e para o cartão "sem pré-visualização". */
export function IconeDoMime({
  mime,
  size = 20,
}: { mime: string | null | undefined; size?: number }): ReactNode {
  const tipo = tipoVisual(mime);
  const rotulo = rotuloDoMime(mime);
  if (tipo === 'pdf') return <FileText size={size} />;
  if (tipo === 'video') return <Film size={size} />;
  if (tipo === 'audio') return <Music size={size} />;
  if (rotulo === 'Planilha') return <FileSpreadsheet size={size} />;
  if (rotulo === 'Word' || rotulo === 'Texto') return <FileText size={size} />;
  return <File size={size} />;
}
