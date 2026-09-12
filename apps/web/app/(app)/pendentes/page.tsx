import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import {
  LIMITE_SEM_DOCUMENTO,
  listPagamentosSemDocumento,
  listPendentes,
} from '@/lib/data/pendentes';
import { Check, Clock, FileWarning, Inbox, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { confirmarPendencia, rejeitarPendencia } from './actions';
import './pendentes.css';

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
                            <span className="pendente-extracted__value--empty">não informado</span>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Data pagamento</span>
                        <span className="pendente-extracted__value">
                          {de?.data_pagamento ? (
                            formatDate(de.data_pagamento)
                          ) : (
                            <span className="pendente-extracted__value--empty">não informada</span>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Obra</span>
                        <span className="pendente-extracted__value">
                          {item.obra_nome ?? (
                            <span className="pendente-extracted__value--empty">
                              não identificada
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Fornecedor</span>
                        <span className="pendente-extracted__value">
                          {item.fornecedor_nome ?? (
                            <span className="pendente-extracted__value--empty">
                              não identificado
                            </span>
                          )}
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
                      {de?.raciocinio && !de.raciocinio.startsWith('MockClassifier') ? (
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

            <div className="pendentes-sem-doc__lista">
              {semDocumento.map((p) => (
                <Link key={p.id} href={`/pagamentos/${p.id}`} className="pendentes-sem-doc__item">
                  <span className="pendentes-sem-doc__valor">{formatBRL(p.valor)}</span>

                  <span className="pendentes-sem-doc__meta">
                    {[p.fornecedor_nome, p.obra_nome].filter(Boolean).join(' · ') ||
                      p.descricao ||
                      'Sem descrição'}
                  </span>

                  {/*
                    Limiares validados com o cliente no protótipo: acima de 3
                    dias vira âmbar, acima de 7 vira vermelho. São os prazos
                    que ele já usa pra cobrar o fornecedor.
                  */}
                  <span
                    className={
                      p.dias > 7
                        ? 'pendentes-sem-doc__dias pendentes-sem-doc__dias--critico'
                        : p.dias > 3
                          ? 'pendentes-sem-doc__dias pendentes-sem-doc__dias--alerta'
                          : 'pendentes-sem-doc__dias'
                    }
                  >
                    <Clock size={12} aria-hidden="true" />
                    {p.dias === 1 ? 'há 1 dia' : `há ${p.dias} dias`}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
