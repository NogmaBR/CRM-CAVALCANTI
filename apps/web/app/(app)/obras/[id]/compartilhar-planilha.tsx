'use client';

import { Button } from '@/components/nogma/Button';
import type { LinkCompartilhado } from '@/lib/data/compartilhamentos';
import { Ban, Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { useState } from 'react';
import { gerarLinkPlanilha, revogarLinkPlanilha } from '../actions';

/**
 * Gestão dos links read-only da planilha da obra.
 *
 * Client component por um motivo só: copiar pra área de transferência. O
 * protótipo aprovado tinha o botão "Copiar Link" mas ele não fazia nada — é
 * exatamente o passo que o gestor executa toda semana, então aqui ele
 * funciona de verdade, com confirmação visual.
 */

interface Props {
  obraId: string;
  links: LinkCompartilhado[];
  urls: Record<string, string>;
  podeGerenciar: boolean;
}

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—';
}

function Situacao({ link }: { link: LinkCompartilhado }) {
  if (link.revogado_em) {
    return <span className="cp-tag cp-tag--off">Revogado</span>;
  }
  if (link.expirado) {
    return <span className="cp-tag cp-tag--off">Expirado</span>;
  }
  return <span className="cp-tag cp-tag--on">Ativo</span>;
}

export function CompartilharPlanilha({ obraId, links, urls, podeGerenciar }: Props) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(token: string) {
    const url = urls[token];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(token);
      window.setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Clipboard bloqueado (http, permissão negada): o input abaixo continua
      // selecionável, então o gestor copia à mão em vez de ficar sem saída.
      window.prompt('Copie o link da planilha:', url);
    }
  }

  const ativos = links.filter((l) => !l.revogado_em && !l.expirado);

  return (
    <div className="cp-bloco">
      <p className="cp-intro">
        Link somente leitura com os lançamentos desta obra, para enviar ao cliente. Quem tiver o
        link vê a planilha sem precisar de conta — trate como senha.
      </p>

      {links.length === 0 ? (
        <p className="cp-vazio">Nenhum link gerado ainda.</p>
      ) : (
        <ul className="cp-lista">
          {links.map((link) => {
            const url = urls[link.token] ?? '';
            const utilizavel = !link.revogado_em && !link.expirado;
            return (
              <li key={link.id} className="cp-item">
                <div className="cp-item__topo">
                  <Link2 size={14} aria-hidden="true" />
                  <span className="cp-item__desc">{link.descricao || 'Link sem descrição'}</span>
                  <Situacao link={link} />
                </div>

                {utilizavel ? (
                  <div className="cp-url-row">
                    <input
                      className="cp-url"
                      value={url}
                      readOnly
                      aria-label="Endereço da planilha"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="cp-acao"
                      onClick={() => copiar(link.token)}
                      aria-label="Copiar link"
                    >
                      {copiado === link.token ? (
                        <>
                          <Check size={13} aria-hidden="true" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={13} aria-hidden="true" />
                          Copiar
                        </>
                      )}
                    </button>
                    <a
                      className="cp-acao"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir planilha em nova aba"
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      Abrir
                    </a>
                  </div>
                ) : null}

                <div className="cp-meta">
                  <span>Criado em {formatDateTime(link.created_at)}</span>
                  <span>
                    {link.acessos === 0
                      ? 'Nunca aberto'
                      : `${link.acessos} ${link.acessos === 1 ? 'abertura' : 'aberturas'} · última em ${formatDateTime(link.ultimo_acesso_em)}`}
                  </span>
                  {link.revogado_em ? (
                    <span>Revogado em {formatDateTime(link.revogado_em)}</span>
                  ) : null}
                </div>

                {podeGerenciar && utilizavel ? (
                  <form action={revogarLinkPlanilha} className="cp-revogar">
                    <input type="hidden" name="obra_id" value={obraId} />
                    <input type="hidden" name="link_id" value={link.id} />
                    <button type="submit" className="cp-acao cp-acao--perigo">
                      <Ban size={13} aria-hidden="true" />
                      Revogar
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {podeGerenciar ? (
        <form action={gerarLinkPlanilha} className="cp-form">
          <input type="hidden" name="obra_id" value={obraId} />
          <input
            className="cp-input"
            name="descricao"
            maxLength={80}
            placeholder="Para quem é este link? Ex: Fernando, engenheiro"
            aria-label="Descrição do link"
          />
          <Button type="submit" variant="primary" size="sm">
            Gerar link
          </Button>
        </form>
      ) : null}

      {ativos.length > 1 ? (
        <p className="cp-aviso">
          Há {ativos.length} links ativos para esta obra. Revogue os que não estiverem mais em uso.
        </p>
      ) : null}
    </div>
  );
}
