import { Miniatura } from './miniatura';
import type { OrigemArquivo } from './visualizador';
import './arquivos.css';

export interface ItemDaGrade {
  id: string;
  mime: string | null | undefined;
  nome: string;
  /** Linha de baixo da miniatura; por padrão o nome. */
  legenda?: string | null;
  href: string;
  origem?: OrigemArquivo;
}

/**
 * Grade de miniaturas — a pasta "Fotos" de uma obra, a faixa de últimas fotos.
 * Cada item é um link; imagem mostra a foto, o resto o ícone do tipo.
 */
export function GradeDeArquivos({
  itens,
  semLegenda = false,
  rotulo = 'Arquivos',
}: {
  itens: ItemDaGrade[];
  semLegenda?: boolean;
  rotulo?: string;
}) {
  return (
    <ul className="arq-grade" aria-label={rotulo}>
      {itens.map((item) => (
        <li key={item.id}>
          <Miniatura
            origem={item.origem ?? 'documento'}
            id={item.id}
            mime={item.mime}
            nome={item.nome}
            tamanho={132}
            href={item.href}
          />
          {semLegenda ? null : (
            <span className="arq-grade__legenda" title={item.legenda ?? item.nome}>
              {item.legenda ?? item.nome}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
