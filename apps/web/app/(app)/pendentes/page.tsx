import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import {
  LIMITE_SEM_DOCUMENTO,
  type PagamentoSemDocumento,
  type PendenteItem,
  listPagamentosSemDocumento,
  listPendentes,
} from '@/lib/data/pendentes';
import { type DadosExtraidos, temDadosParaLancar } from '@/lib/schemas/dados-extraidos';
import {
  Check,
  ChevronDown,
  Clock,
  FileWarning,
  Inbox,
  Paperclip,
  PencilLine,
  TriangleAlert,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { confirmarPendencia, rejeitarPendencia } from './actions';
import './pendentes.css';

export const metadata = { title: 'Pendentes' };

function formatTelefone(raw: string): string {
  // raw armazena somente digitos, ex: "5511987654321"
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    // +55 (XX) 9XXXX-XXXX
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `+55 ${ddd} ${part1}-${part2}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8);
    return `+55 ${ddd} ${part1}-${part2}`;
  }
  return `+${digits}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function formatBRL(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** O raciocínio só ajuda quando vem do modelo real; o do mock é texto de teste. */
const mostrarRaciocinio = process.env.IA_PROVIDER === 'anthropic';

/**
 * Lacuna visível (A4): o que a IA não extraiu aparece em âmbar com ícone,
 * não em cinza itálico — é o dado que falta para poder confirmar.
 */
function ValorAusente({ children }: { children: string }) {
  return (
    <span className="pendente-extracted__value--empty">
      <TriangleAlert size={12} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Link para o formulário de pagamento já preenchido com o que a IA extraiu.
 * Só entram os campos que existem; o formulário lê os params (outro PR).
 */
function linkCompletar(item: PendenteItem, de: DadosExtraidos | null): string {
  const qs = new URLSearchParams({ msg: item.mensagem_id });
  if (de?.valor != null) qs.set('valor', String(de.valor));
  if (de?.obra_id) qs.set('obra_id', de.obra_id);
  if (de?.fornecedor_id) qs.set('fornecedor_id', de.fornecedor_id);
  if (de?.data_pagamento) qs.set('data_pagamento', de.data_pagamento);
  if (de?.descricao) qs.set('descricao', de.descricao);
  return `/pagamentos/novo?${qs.toString()}`;
}

/**
 * Limiares da cobrança (M4): 50 linhas em vermelho viravam ruído. Vermelho
 * só acima de 30 dias; âmbar entre 7 e 30; abaixo disso cor de texto comum.
 */
function classeDias(dias: number): string {
  if (dias > 30) return 'pendentes-sem-doc__dias pendentes-sem-doc__dias--critico';
  if (dias > 7) return 'pendentes-sem-doc__dias pendentes-sem-doc__dias--alerta';
  return 'pendentes-sem-doc__dias';
}

function textoDias(dias: number): string {
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

interface GrupoFornecedor {
  chave: string;
  nome: string;
  itens: PagamentoSemDocumento[];
  total: number;
  maisAntigoDias: number;
}

/**
 * Agrupa por fornecedor (M4): é assim que se cobra nota — por fornecedor,
 * não por linha. Grupos na ordem do pagamento mais antigo; dentro do grupo a
 * ordem que veio do banco (mais antigo primeiro) se mantém.
 */
function agruparPorFornecedor(itens: PagamentoSemDocumento[]): GrupoFornecedor[] {
  const mapa = new Map<string, GrupoFornecedor>();
  for (const p of itens) {
    const nome = p.fornecedor_nome ?? 'Sem fornecedor';
    const chave = p.fornecedor_nome ?? '__sem_fornecedor__';
    const grupo = mapa.get(chave) ?? { chave, nome, itens: [], total: 0, maisAntigoDias: 0 };
    grupo.itens.push(p);
    grupo.total += p.valor;
    grupo.maisAntigoDias = Math.max(grupo.maisAntigoDias, p.dias);
    mapa.set(chave, grupo);
  }
  return [...mapa.values()].sort((a, b) => b.maisAntigoDias - a.maisAntigoDias);
}

export default async function PendentesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ?? null;
  const successMsg = params.success ?? null;

  const [pendentes, semDocumento] = await Promise.all([
    listPendentes(),
    listPagamentosSemDocumento(),
  ]);

  return (
    <>
      <TopBar title="Pendentes" subtitle="Confirmações do WhatsApp e pagamentos sem documento" />

      <div className="nos-page-body">
        {errorMsg ? (
          <div className="pendentes-banner pendentes-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        {successMsg ? (
          // biome-ignore lint/a11y/useSemanticElements: banner de status (padrão do projeto)
          <div className="pendentes-banner pendentes-banner--success" role="status">
            {successMsg}
          </div>
        ) : null}

        {pendentes.length === 0 ? (
          <div className="pendentes-empty">
            <Inbox size={48} className="pendentes-empty__icon" />
            <p className="pendentes-empty__title">Nenhuma pendencia no momento</p>
            <p className="pendentes-empty__sub">
              Quando a IA classificar mensagens que precisam de revisao, elas apareceram aqui.
            </p>
          </div>
        ) : (
          <div className="pendentes-list">
            {pendentes.map((item) => {
              const de = item.dados_extraidos;
              // A4: confirmar sem valor ou sem obra gravaria pagamento incompleto
              // (o service já recusa com `dados_incompletos`; a UI não deve convidar).
              const podeConfirmar = temDadosParaLancar(de);
              const faltando = [
                de?.valor == null ? 'valor' : null,
                de?.obra_id ? null : 'obra',
              ].filter(Boolean);
              const motivoBloqueio = `Falta ${faltando.join(' e ')}. Use "Completar e confirmar" para preencher no formulário.`;
              return (
                <article key={item.confirmacao_id} className="pendente-card">
                  {/* Header */}
                  <div className="pendente-card__header">
                    <span className="pendente-card__telefone">
                      {formatTelefone(item.telefone_from)}
                    </span>
                    <span className="pendente-card__data">{formatDateTime(item.recebida_em)}</span>
                    {item.midia_mime ? (
                      <span className="pendente-card__badge">
                        <Paperclip size={11} />
                        Anexo: {item.midia_mime}
                      </span>
                    ) : null}
                  </div>

                  {/* Body */}
                  <div className="pendente-card__body">
                    {item.texto_bruto ? (
                      <div className="pendente-card__texto">{item.texto_bruto}</div>
                    ) : null}

                    {/* Dados extraidos */}
                    <div className="pendente-card__extracted">
                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Valor</span>
                        <span className="pendente-extracted__value">
                          {de?.valor != null ? (
                            formatBRL(de.valor)
                          ) : (
                            <ValorAusente>não informado</ValorAusente>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Data pagamento</span>
                        <span className="pendente-extracted__value">
                          {de?.data_pagamento ? (
                            formatDate(de.data_pagamento)
                          ) : (
                            <ValorAusente>não informada</ValorAusente>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Obra</span>
                        <span className="pendente-extracted__value">
                          {item.obra_nome ?? <ValorAusente>não identificada</ValorAusente>}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Fornecedor</span>
                        <span className="pendente-extracted__value">
                          {item.fornecedor_nome ?? <ValorAusente>não identificado</ValorAusente>}
                        </span>
                      </div>

                      {de?.tipo_documento ? (
                        <div className="pendente-extracted__field">
                          <span className="pendente-extracted__label">Tipo documento</span>
                          <span className="pendente-extracted__value">{de.tipo_documento}</span>
                        </div>
                      ) : null}

                      {de?.numero_nf ? (
                        <div className="pendente-extracted__field">
                          <span className="pendente-extracted__label">NF</span>
                          <span className="pendente-extracted__value">{de.numero_nf}</span>
                        </div>
                      ) : null}

                      {de?.descricao ? (
                        <div className="pendente-extracted__field pendente-extracted__value--wide">
                          <span className="pendente-extracted__label">Descrição</span>
                          <span className="pendente-extracted__value">{de.descricao}</span>
                        </div>
                      ) : null}

                      {/* O raciocínio cru do classificador é informação interna, como a
                          métrica de confiança que o cliente pediu para esconder. Só o do
                          modelo real ajuda o gestor; o do mock entrega o modo de teste. */}
                      {de?.raciocinio && mostrarRaciocinio ? (
                        <div className="pendente-extracted__field pendente-extracted__value--wide">
                          <span className="pendente-extracted__label">Raciocínio da IA</span>
                          <span className="pendente-extracted__value">{de.raciocinio}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pendente-card__actions">
                    <form action={rejeitarPendencia}>
                      <input type="hidden" name="confirmacao_id" value={item.confirmacao_id} />
                      <input type="hidden" name="mensagem_id" value={item.mensagem_id} />
                      <Button
                        type="submit"
                        variant="danger"
                        size="sm"
                        leadingIcon={<X size={14} />}
                      >
                        Rejeitar
                      </Button>
                    </form>

                    {podeConfirmar ? (
                      <form action={confirmarPendencia}>
                        <input type="hidden" name="confirmacao_id" value={item.confirmacao_id} />
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          leadingIcon={<Check size={14} />}
                        >
                          Confirmar
                        </Button>
                      </form>
                    ) : (
                      <>
                        {/* O `.ng-btn[disabled]` tira pointer-events; o title vai no wrapper. */}
                        <span className="pendente-card__bloqueado" title={motivoBloqueio}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled
                            aria-disabled="true"
                            title={motivoBloqueio}
                            leadingIcon={<Check size={14} />}
                          >
                            Confirmar
                          </Button>
                        </span>
                        <Link
                          href={linkCompletar(item, de)}
                          className="ng-btn ng-btn--primary ng-btn--sm"
                        >
                          <span className="ng-btn__icon" aria-hidden="true">
                            <PencilLine size={14} />
                          </span>
                          Completar e confirmar
                        </Link>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/*
          Segundo bloco: o briefing (§3) pede que item sem NF/comprovante vire
          pendência "com contagem de dias". Isso só existia como cobrança
          automática por WhatsApp (WF5 do n8n) — o gestor não tinha onde ver.
        */}
        {semDocumento.length > 0 ? (
          <section className="pendentes-sem-doc" aria-labelledby="sem-doc-titulo">
            <h2 id="sem-doc-titulo" className="pendentes-sem-doc__titulo">
              <FileWarning size={16} aria-hidden="true" />
              Pagamentos sem nota fiscal ou comprovante
              <span className="pendentes-sem-doc__contagem">
                {semDocumento.length}
                {semDocumento.length >= LIMITE_SEM_DOCUMENTO ? '+' : ''}
              </span>
            </h2>

            <div className="pendentes-sem-doc__grupos">
              {agruparPorFornecedor(semDocumento).map((grupo, indice) => (
                <details key={grupo.chave} className="pendentes-sem-doc__grupo" open={indice === 0}>
                  <summary className="pendentes-sem-doc__resumo">
                    <ChevronDown size={16} aria-hidden="true" className="pendentes-sem-doc__seta" />
                    <span className="pendentes-sem-doc__fornecedor">{grupo.nome}</span>
                    <span className="pendentes-sem-doc__qtd">
                      {grupo.itens.length === 1
                        ? '1 pagamento'
                        : `${grupo.itens.length} pagamentos`}
                    </span>
                    <span className="pendentes-sem-doc__soma">{formatBRL(grupo.total)}</span>
                    <span className={classeDias(grupo.maisAntigoDias)}>
                      <Clock size={12} aria-hidden="true" />
                      mais antigo {textoDias(grupo.maisAntigoDias)}
                    </span>
                  </summary>

                  <div className="pendentes-sem-doc__lista">
                    {grupo.itens.map((p) => (
                      <Link
                        key={p.id}
                        href={`/pagamentos/${p.id}`}
                        className="pendentes-sem-doc__item"
                      >
                        <span className="pendentes-sem-doc__valor">{formatBRL(p.valor)}</span>

                        <span className="pendentes-sem-doc__meta">
                          {[formatDate(p.data_pagamento), p.obra_nome].filter(Boolean).join(' · ')}
                          {p.descricao ? ` · ${p.descricao}` : ''}
                        </span>

                        <span className={classeDias(p.dias)}>
                          <Clock size={12} aria-hidden="true" />
                          {textoDias(p.dias)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
