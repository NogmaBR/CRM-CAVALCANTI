import { rotuloDoMime, tipoVisual, urlDoArquivo } from '@/lib/arquivos/tipo-visual';
import Link from 'next/link';
import type { OrigemArquivo } from './visualizador';
import { IconeDoMime } from './visualizador';
import './arquivos.css';

/**
 * A miniatura de um arquivo em lista ou grade. Imagem mostra a foto reduzida
 * (`?miniatura=1`, gerada na primeira vez); o resto mostra o ícone do tipo com
 * o rótulo. `href` embrulha tudo num link (para a página do documento, ou para
 * abrir o arquivo em nova aba). `tamanho` é o lado do quadrado, em px.
 */
export function Miniatura({
  origem,
  id,
  mime,
  nome,
  tamanho = 72,
  href,
  novaAba = false,
}: {
  origem: OrigemArquivo;
  id: string;
  mime: string | null | undefined;
  nome: string;
  tamanho?: number;
  href?: string;
  novaAba?: boolean;
}) {
  const tipo = tipoVisual(mime);
  const estilo = { width: tamanho, height: tamanho } as const;

  const conteudo =
    tipo === 'imagem' ? (
      <img
        src={urlDoArquivo(origem, id, 'miniatura')}
        alt={nome}
        loading="lazy"
        decoding="async"
        width={tamanho}
        height={tamanho}
      />
    ) : (
      <span className="arq-miniatura__icone" data-tipo={tipo}>
        <IconeDoMime mime={mime} size={Math.max(18, Math.round(tamanho / 3))} />
        <span className="arq-miniatura__rotulo">{rotuloDoMime(mime)}</span>
      </span>
    );

  if (!href) {
    return (
      <span className="arq-miniatura" style={estilo} title={nome}>
        {conteudo}
      </span>
    );
  }
  if (novaAba) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="arq-miniatura"
        style={estilo}
        title={nome}
      >
        {conteudo}
      </a>
    );
  }
  return (
    <Link href={href} className="arq-miniatura" style={estilo} title={nome}>
      {conteudo}
    </Link>
  );
}
