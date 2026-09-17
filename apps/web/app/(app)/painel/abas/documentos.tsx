import { GradeDeArquivos } from '@/components/arquivos/grade';
import { getUltimasFotosGerais } from '@/lib/data/acervo';
import { dadosDocumentos } from '@/lib/data/painel-empresario';
import Link from 'next/link';
import { Cartao, brl } from '../cartao';

/** Intensidade sequencial (uma cor, claro → escuro) pela contagem. */
function intensidade(n: number, maximo: number): string {
  if (n === 0 || maximo === 0) return 'transparent';
  const p = 0.12 + (n / maximo) * 0.55;
  return `color-mix(in srgb, var(--chart-1) ${Math.round(p * 100)}%, transparent)`;
}

export async function AbaDocumentos() {
  const [d, fotos] = await Promise.all([dadosDocumentos(), getUltimasFotosGerais(12)]);
  const pastasComAlgo = d.pastas.filter((p) =>
    d.matriz.linhas.some((l) => (l.porPasta[p.chave] ?? 0) > 0),
  );
  const obraComMais = [...d.matriz.linhas].sort((a, b) => b.total - a.total)[0];
  const semFoto = d.matriz.linhas.filter((l) => (l.porPasta.fotos ?? 0) === 0);

  return (
    <div className="painel-abas__grade">
      <Cartao
        titulo="O que tem guardado em cada pasta, por obra"
        largo
        leitura={
          <>
            São <strong>{d.totalDocumentos}</strong> arquivos no total.
            {obraComMais ? (
              <>
                {' '}
                A obra com mais documentos é <strong>{obraComMais.obra}</strong> (
                {obraComMais.total}).
              </>
            ) : null}
            {semFoto.length > 0 ? (
              <> Sem nenhuma foto: {semFoto.map((l) => l.obra).join(', ')}.</>
            ) : null}
          </>
        }
        acao={
          <Link href="/documentos" className="cartao__link">
            Abrir documentos
          </Link>
        }
      >
        <div className="cartao__tabela-rolagem">
          <table className="tabela-legivel tabela-legivel--mapa">
            <thead>
              <tr>
                <th scope="col">Obra</th>
                {pastasComAlgo.map((p) => (
                  <th key={p.chave} scope="col" className="tabela-legivel__num">
                    {p.rotulo}
                  </th>
                ))}
                <th scope="col" className="tabela-legivel__num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {d.matriz.linhas.map((l) => (
                <tr key={l.obra}>
                  <th scope="row">{l.obra}</th>
                  {pastasComAlgo.map((p) => {
                    const n = l.porPasta[p.chave] ?? 0;
                    return (
                      <td
                        key={p.chave}
                        className="tabela-legivel__num tabela-legivel__celula-mapa"
                        style={{ background: intensidade(n, d.matriz.maximo) }}
                      >
                        {n === 0 ? <span className="tabela-legivel__zero">—</span> : n}
                      </td>
                    );
                  })}
                  <td className="tabela-legivel__num">
                    <strong>{l.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao
        titulo="Últimas fotos que chegaram"
        largo
        leitura={
          fotos.length === 0
            ? 'Nenhuma foto ainda. Peça no grupo: uma foto por dia mostra o andamento.'
            : 'Clique numa foto para abrir. Cada uma diz de qual obra é.'
        }
        acao={
          <Link href="/documentos?categoria=fotos&visao=grade" className="cartao__link">
            Todas as fotos
          </Link>
        }
      >
        {fotos.length === 0 ? null : (
          <GradeDeArquivos
            rotulo="Últimas fotos"
            itens={fotos.map((f) => ({
              id: f.id,
              mime: f.mime_type,
              nome: f.nome_arquivo,
              legenda: f.obra_nome,
              href: `/documentos/${f.id}`,
            }))}
          />
        )}
      </Cartao>

      <Cartao
        titulo="Pagamentos sem nota ou comprovante"
        leitura={
          d.pagamentosSemNota.quantidade === 0 ? (
            'Todos os pagamentos têm nota ou comprovante. Está tudo comprovado.'
          ) : (
            <>
              <strong>{d.pagamentosSemNota.quantidade}</strong>{' '}
              {d.pagamentosSemNota.quantidade === 1 ? 'pagamento está' : 'pagamentos estão'} sem
              nota, somando {brl(d.pagamentosSemNota.total)}. Mande a foto da nota no grupo que o
              sistema liga ao pagamento sozinho.
            </>
          )
        }
        acao={
          <Link href="/pendentes" className="cartao__link">
            Ver a lista
          </Link>
        }
      >
        <div className="painel-numero-grande">
          {d.pagamentosSemNota.quantidade}
          <span className="painel-numero-grande__rotulo">sem nota</span>
        </div>
      </Cartao>
    </div>
  );
}
