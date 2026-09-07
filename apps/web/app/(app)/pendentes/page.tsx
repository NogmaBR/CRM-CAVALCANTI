import { Inbox, Check, X, Paperclip } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { listPendentes } from '@/lib/data/pendentes';
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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const fillClass =
    pct < 50
      ? 'pendente-confidence__fill pendente-confidence__fill--low'
      : pct < 75
        ? 'pendente-confidence__fill pendente-confidence__fill--mid'
        : 'pendente-confidence__fill pendente-confidence__fill--high';

  return (
    <div className="pendente-card__confidence">
      <span className="pendente-confidence__label">Confianca IA: {pct}%</span>
      <div className="pendente-confidence__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={fillClass} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PendentesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ?? null;
  const successMsg = params.success ?? null;

  const pendentes = await listPendentes();

  return (
    <>
      <TopBar
        title="Pendentes"
        subtitle="Mensagens de WhatsApp aguardando sua confirmacao"
      />

      <div className="nos-page-body">
        {errorMsg ? (
          <div className="pendentes-banner pendentes-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        {successMsg ? (
          <div className="pendentes-banner pendentes-banner--success" role="status">
            {successMsg}
          </div>
        ) : null}

        {pendentes.length === 0 ? (
          <div className="pendentes-empty">
            <Inbox size={48} className="pendentes-empty__icon" />
            <p className="pendentes-empty__title">Nenhuma pendencia no momento</p>
            <p className="pendentes-empty__sub">
              Quando a IA classificar mensagens com baixa confianca, elas apareceram aqui.
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
                    <span className="pendente-card__data">
                      {formatDateTime(item.recebida_em)}
                    </span>
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
                          {de?.valor != null ? formatBRL(de.valor) : (
                            <span className="pendente-extracted__value--empty">nao informado</span>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Data pagamento</span>
                        <span className="pendente-extracted__value">
                          {de?.data_pagamento ? formatDate(de.data_pagamento) : (
                            <span className="pendente-extracted__value--empty">nao informada</span>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Obra</span>
                        <span className="pendente-extracted__value">
                          {item.obra_nome ?? (
                            <span className="pendente-extracted__value--empty">nao identificada</span>
                          )}
                        </span>
                      </div>

                      <div className="pendente-extracted__field">
                        <span className="pendente-extracted__label">Fornecedor</span>
                        <span className="pendente-extracted__value">
                          {item.fornecedor_nome ?? (
                            <span className="pendente-extracted__value--empty">nao identificado</span>
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
                          <span className="pendente-extracted__label">Descricao</span>
                          <span className="pendente-extracted__value">{de.descricao}</span>
                        </div>
                      ) : null}

                      {de?.raciocinio ? (
                        <div className="pendente-extracted__field pendente-extracted__value--wide">
                          <span className="pendente-extracted__label">Raciocinio da IA</span>
                          <span className="pendente-extracted__value">{de.raciocinio}</span>
                        </div>
                      ) : null}
                    </div>

                    {item.confianca_ia != null ? (
                      <ConfidenceBar value={item.confianca_ia} />
                    ) : null}
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
      </div>
    </>
  );
}
