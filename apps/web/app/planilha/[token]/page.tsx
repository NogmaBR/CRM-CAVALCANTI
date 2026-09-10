import { getPlanilhaPorToken } from '@/lib/data/planilha';
import { FileCheck, Paperclip } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BotaoImprimir } from './botao-imprimir';
import './planilha.css';

/**
 * Planilha da obra — página pública, read-only, aberta por link.
 *
 * É o que o cliente final vê, e provavelmente a única tela do produto que ele
 * vai abrir. Substitui o Excel montado à mão que hoje vai por WhatsApp.
 *
 * Três coisas são deliberadas aqui:
 *
 *  - **Sem navegação.** Não há sidebar, menu nem link pro resto do CRM. A
 *    página é uma folha só; quem tem o link não tem conta.
 *  - **Sem indexação.** O layout raiz já manda `robots: noindex`, o que
 *    importa porque a URL contém a credencial.
 *  - **Impressão é primeira classe.** "Manda o PDF" é o pedido real do
 *    cliente, então o CSS de impressão é parte da feature, não enfeite.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const planilha = await getPlanilhaPorToken(token);
  // Título genérico em link inválido: o nome da obra não deve vazar por 404.
  if (!planilha) return { title: 'Planilha' };
  return { title: `Planilha · ${planilha.obra.nome}` };
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export default async function PlanilhaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const planilha = await getPlanilhaPorToken(token);

  // Token inexistente, revogado e vencido caem todos aqui, sem distinção —
  // a página não serve de oráculo pra quem estiver testando tokens.
  if (!planilha) notFound();

  const { obra, linhas, totalGeral, porCategoria, percentualOrcamento } = planilha;
  const estouro = percentualOrcamento != null && percentualOrcamento > 100;
  const alerta = percentualOrcamento != null && percentualOrcamento > 80;

  return (
    <main className="pl-page">
      <header className="pl-header">
        <div>
          <p className="pl-eyebrow">Prestação de contas</p>
          <h1 className="pl-titulo">{obra.nome}</h1>
          {obra.cliente ? <p className="pl-cliente">{obra.cliente}</p> : null}
        </div>
        <BotaoImprimir />
      </header>

      <section className="pl-kpis" aria-label="Resumo">
        <div className="pl-kpi">
          <span className="pl-kpi__rotulo">Total gasto</span>
          <strong className="pl-kpi__valor">{formatBRL(totalGeral)}</strong>
          <span className="pl-kpi__nota">
            {linhas.length} {linhas.length === 1 ? 'lançamento' : 'lançamentos'}
          </span>
        </div>

        {obra.orcamento != null ? (
          <>
            <div className="pl-kpi">
              <span className="pl-kpi__rotulo">Orçamento</span>
              <strong className="pl-kpi__valor">{formatBRL(obra.orcamento)}</strong>
              <span className="pl-kpi__nota">
                {estouro
                  ? `${formatBRL(totalGeral - obra.orcamento)} acima`
                  : `${formatBRL(obra.orcamento - totalGeral)} disponível`}
              </span>
            </div>

            <div className="pl-kpi pl-kpi--largo">
              <span className="pl-kpi__rotulo">Consumo do orçamento</span>
              <strong className="pl-kpi__valor">{percentualOrcamento}%</strong>
              {/*
                A barra é o resumo que o dono da obra lê primeiro. Passa a
                avisar em 80% — antes de estourar, que é quando ainda dá pra
                fazer alguma coisa a respeito.
              */}
              <div
                className="pl-barra"
                role="meter"
                aria-valuenow={percentualOrcamento ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Consumo do orçamento"
              >
                <div
                  className={
                    estouro
                      ? 'pl-barra__preenchida pl-barra__preenchida--estouro'
                      : alerta
                        ? 'pl-barra__preenchida pl-barra__preenchida--alerta'
                        : 'pl-barra__preenchida'
                  }
                  style={{ width: `${Math.min(100, percentualOrcamento ?? 0)}%` }}
                />
              </div>
            </div>
          </>
        ) : null}
      </section>

      {linhas.length === 0 ? (
        <p className="pl-vazio">Nenhum lançamento registrado nesta obra até o momento.</p>
      ) : (
        <div className="pl-tabela-wrap">
          <table className="pl-tabela">
            <caption className="pl-caption">
              Lançamentos da obra, do mais antigo para o mais recente
            </caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Descrição</th>
                <th scope="col">Fornecedor</th>
                <th scope="col">Categoria</th>
                <th scope="col" className="pl-num">
                  Valor
                </th>
                <th scope="col" className="pl-centro" title="Nota fiscal">
                  NF
                </th>
                <th scope="col" className="pl-centro" title="Comprovante">
                  Compr.
                </th>
                <th scope="col" className="pl-num">
                  Acumulado
                </th>
              </tr>
            </thead>

            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="pl-nowrap">{formatData(l.data)}</td>
                  <td>{l.descricao ?? '—'}</td>
                  <td>{l.fornecedor ?? '—'}</td>
                  <td>
                    <span className="pl-categoria">{l.categoria}</span>
                  </td>
                  <td className="pl-num">{formatBRL(l.valor)}</td>
                  <td className="pl-centro">
                    {l.temNotaFiscal ? (
                      <FileCheck size={14} aria-label="Nota fiscal anexada" />
                    ) : (
                      <span className="pl-ausente" aria-label="Sem nota fiscal">
                        —
                      </span>
                    )}
                  </td>
                  <td className="pl-centro">
                    {l.temComprovante ? (
                      <Paperclip size={14} aria-label="Comprovante anexado" />
                    ) : (
                      <span className="pl-ausente" aria-label="Sem comprovante">
                        —
                      </span>
                    )}
                  </td>
                  <td className="pl-num pl-acumulado">{formatBRL(l.saldoAcumulado)}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="pl-total">
                <td colSpan={4}>Total geral</td>
                <td className="pl-num">{formatBRL(totalGeral)}</td>
                <td colSpan={2} />
                <td className="pl-num">{formatBRL(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {porCategoria.length > 0 ? (
        <section className="pl-secao" aria-labelledby="pl-cat">
          <h2 id="pl-cat" className="pl-secao__titulo">
            Total por categoria
          </h2>
          <div className="pl-tabela-wrap">
            <table className="pl-tabela pl-tabela--compacta">
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col" className="pl-num">
                    Lançamentos
                  </th>
                  <th scope="col" className="pl-num">
                    Total
                  </th>
                  <th scope="col" className="pl-num">
                    % do gasto
                  </th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td>{c.categoria}</td>
                    <td className="pl-num">{c.quantidade}</td>
                    <td className="pl-num">{formatBRL(c.total)}</td>
                    <td className="pl-num">
                      {totalGeral > 0 ? `${Math.round((c.total / totalGeral) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <footer className="pl-rodape">
        <p>
          Documento somente leitura, gerado em {new Date(planilha.geradaEm).toLocaleString('pt-BR')}
          .
        </p>
        <p className="pl-rodape__marca">Cavalcanti Construções · CRM por Nogma</p>
      </footer>
    </main>
  );
}
