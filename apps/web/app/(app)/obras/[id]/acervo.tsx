import { EmptyState } from '@/components/nogma/EmptyState';
import type { PastaDaObra, RegistroComAutor } from '@/lib/data/acervo';
import { CATEGORIA_LABELS, DOC_ORIGEM_LABEL } from '@/lib/status-labels';
import { FolderOpen, NotebookPen } from 'lucide-react';
import Link from 'next/link';
import './acervo.css';

/**
 * As "pastas" da obra: a mesma estrutura que o cliente usa no OneDrive
 * (Documentação, NFs/Pagamentos, Projeto, Fotos…), só as que têm arquivo.
 * Cada cartão abre /documentos já filtrado.
 */
export function PastasDaObra({ obraId, pastas }: { obraId: string; pastas: PastaDaObra[] }) {
  if (pastas.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen size={22} aria-hidden="true" />}
        title="Nenhum arquivo ainda"
        compact
      >
        O que chegar pelo grupo do WhatsApp ou pelo importador do OneDrive aparece aqui, por pasta.
      </EmptyState>
    );
  }
  return (
    <ul className="acervo-pastas" aria-label="Pastas da obra">
      {pastas.map((p) => {
        const meta = CATEGORIA_LABELS[p.categoria];
        return (
          <li key={p.categoria}>
            <Link
              href={`/documentos?obra_id=${obraId}&categoria=${p.categoria}`}
              className="acervo-pasta"
            >
              <span className="acervo-pasta__icone" aria-hidden="true">
                {meta.icone}
              </span>
              <span className="acervo-pasta__nome">{meta.rotulo}</span>
              <span className="acervo-pasta__qtd">
                {p.quantidade} {p.quantidade === 1 ? 'arquivo' : 'arquivos'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/**
 * O diário: áudio ou texto do dia a dia que a equipe mandou no grupo e não é
 * pagamento ("hoje a laje ficou pronta"). Resumo em destaque, texto inteiro
 * embaixo, autor e origem.
 */
export function DiarioDaObra({ registros }: { registros: RegistroComAutor[] }) {
  if (registros.length === 0) {
    return (
      <EmptyState icon={<NotebookPen size={22} aria-hidden="true" />} title="Diário vazio" compact>
        Áudio ou texto sobre o andamento da obra, mandado no grupo, vira uma anotação aqui.
      </EmptyState>
    );
  }
  return (
    <ol className="acervo-diario" aria-label="Diário da obra">
      {registros.map((r) => (
        <li key={r.id} className="acervo-registro">
          <div className="acervo-registro__topo">
            <time dateTime={r.data_registro}>{formatDate(r.data_registro)}</time>
            <span className="acervo-registro__meta">
              {r.autor_nome ?? 'Equipe'} · {DOC_ORIGEM_LABEL[r.origem]}
              {r.midia_mime?.startsWith('audio/') ? ' · áudio' : ''}
            </span>
          </div>
          {r.resumo ? <p className="acervo-registro__resumo">{r.resumo}</p> : null}
          <p className={r.resumo ? 'acervo-registro__texto' : 'acervo-registro__resumo'}>
            {r.texto}
          </p>
        </li>
      ))}
    </ol>
  );
}
