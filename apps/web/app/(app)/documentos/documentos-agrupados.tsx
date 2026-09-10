import type { Database } from '@nogma/db';
import { FileSignature, FileText, Paperclip, Receipt } from 'lucide-react';
import Link from 'next/link';

type Documento = Database['public']['Tables']['documentos']['Row'];
type Tipo = Database['public']['Enums']['anexo_tipo'];

/**
 * Documentos agrupados por fornecedor ou por obra.
 *
 * Responde a pergunta que o gestor faz de verdade — "onde está a NF do
 * Votorantim de janeiro?" — que a tabela plana ordenada por data não responde.
 * Vem do protótipo aprovado pelo cliente, onde o agrupamento alternável era um
 * dos controles mais usados.
 *
 * Usa `<details>`/`<summary>` nativos em vez de estado em client component:
 * o accordion funciona sem JavaScript, o navegador cuida da acessibilidade de
 * teclado e a página segue sendo inteiramente renderizada no servidor.
 */

export interface DocumentoEnriquecido extends Documento {
  obra_nome: string | null;
  fornecedor_nome: string | null;
}

const ICONE: Record<Tipo, typeof FileText> = {
  nota_fiscal: Receipt,
  comprovante: Paperclip,
  contrato: FileSignature,
  outro: FileText,
};

const TIPO_LABEL: Record<Tipo, string> = {
  nota_fiscal: 'NF',
  comprovante: 'Comprovante',
  contrato: 'Contrato',
  outro: 'Outro',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function contagem(docs: DocumentoEnriquecido[]): string {
  const nfs = docs.filter((d) => d.tipo === 'nota_fiscal').length;
  const comprovantes = docs.filter((d) => d.tipo === 'comprovante').length;
  const partes: string[] = [];
  if (nfs > 0) partes.push(`${nfs} ${nfs === 1 ? 'NF' : 'NFs'}`);
  if (comprovantes > 0) {
    partes.push(`${comprovantes} ${comprovantes === 1 ? 'comprovante' : 'comprovantes'}`);
  }
  const outros = docs.length - nfs - comprovantes;
  if (outros > 0) partes.push(`${outros} ${outros === 1 ? 'outro' : 'outros'}`);
  return partes.join(' · ');
}

export function DocumentosAgrupados({
  documentos,
  por,
}: {
  documentos: DocumentoEnriquecido[];
  por: 'fornecedor' | 'obra';
}) {
  const SEM_GRUPO = por === 'fornecedor' ? 'Sem fornecedor' : 'Sem obra';

  const grupos = new Map<string, DocumentoEnriquecido[]>();
  for (const d of documentos) {
    const chave = (por === 'fornecedor' ? d.fornecedor_nome : d.obra_nome) ?? SEM_GRUPO;
    const atual = grupos.get(chave);
    if (atual) atual.push(d);
    else grupos.set(chave, [d]);
  }

  // Maior grupo primeiro: é onde está a maior chance do que se procura, e
  // deixa "Sem fornecedor" no fim, que é onde ele deve ficar.
  const ordenados = [...grupos.entries()].sort((a, b) => {
    if (a[0] === SEM_GRUPO) return 1;
    if (b[0] === SEM_GRUPO) return -1;
    return b[1].length - a[1].length;
  });

  if (documentos.length === 0) {
    return (
      <div className="docs-grupo-vazio">
        <p style={{ margin: 0, fontWeight: 500 }}>Nenhum documento encontrado</p>
        <p style={{ margin: '4px 0 0', fontSize: 12 }}>
          Tente ajustar a busca ou os filtros de tipo e obra.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="docs-grupo-resumo">
        {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'} em{' '}
        {ordenados.length} {ordenados.length === 1 ? 'grupo' : 'grupos'}
      </p>

      <div className="docs-grupos">
        {ordenados.map(([nome, docs], indice) => (
          <details key={nome} className="docs-grupo" open={indice === 0}>
            <summary className="docs-grupo__cabecalho">
              <span className="docs-grupo__nome">{nome}</span>
              <span className="docs-grupo__contagem">{contagem(docs)}</span>
            </summary>

            <ul className="docs-grupo__lista">
              {docs.map((d) => {
                const Icone = ICONE[d.tipo];
                const secundario = por === 'fornecedor' ? d.obra_nome : d.fornecedor_nome;
                return (
                  <li key={d.id}>
                    <Link href={`/documentos/${d.id}`} className="docs-grupo__item">
                      <Icone size={14} aria-hidden="true" className="docs-grupo__icone" />

                      <span className="docs-grupo__arquivo">{d.nome_arquivo}</span>

                      <span className="docs-grupo__tag">{TIPO_LABEL[d.tipo]}</span>

                      {d.numero_nf ? (
                        <span className="docs-grupo__nf">nº {d.numero_nf}</span>
                      ) : null}

                      <span className="docs-grupo__secundario">{secundario ?? '—'}</span>

                      <span className="docs-grupo__data">{formatDate(d.created_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}
