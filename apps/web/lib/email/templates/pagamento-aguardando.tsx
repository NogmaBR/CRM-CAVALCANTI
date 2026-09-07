import { Link, Text } from '@react-email/components';
import { EmailLayout } from './base-layout';

export interface PagamentoAguardandoProps {
  nome_gestor: string;
  obra_nome: string;
  fornecedor_nome: string | null;
  valor: number;
  /** ISO date string — formatado como dd/mm/yyyy no template */
  data_pagamento: string;
  descricao: string | null;
  painel_url: string;
  pagamento_id: string;
}

export function buildSubject(props: Pick<PagamentoAguardandoProps, 'obra_nome'>): string {
  return `Novo pagamento aguardando aprovação — ${props.obra_nome}`;
}

export function buildText(props: PagamentoAguardandoProps): string {
  const valor = Number(props.valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const data = formatDate(props.data_pagamento);
  const cta = `${props.painel_url}/pagamentos/${props.pagamento_id}`;

  return [
    `Olá ${props.nome_gestor},`,
    '',
    'Um novo pagamento foi lançado no sistema e está aguardando sua aprovação:',
    '',
    `Obra: ${props.obra_nome}`,
    `Fornecedor: ${props.fornecedor_nome ?? '—'}`,
    `Valor: ${valor}`,
    `Data: ${data}`,
    props.descricao ? `Descrição: ${props.descricao}` : null,
    '',
    `Revisar no painel: ${cta}`,
    '',
    `ID do pagamento: ${props.pagamento_id}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function PagamentoAguardandoEmail(props: PagamentoAguardandoProps) {
  const {
    nome_gestor,
    obra_nome,
    fornecedor_nome,
    valor,
    data_pagamento,
    descricao,
    painel_url,
    pagamento_id,
  } = props;

  const valorFormatado = Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const dataFormatada = formatDate(data_pagamento);
  const ctaHref = `${painel_url}/pagamentos/${pagamento_id}`;

  return (
    <EmailLayout preview={`Pagamento aguardando aprovação — ${obra_nome}`}>
      <Text style={{ fontSize: 15, color: '#041F25', margin: '0 0 8px' }}>
        Olá {nome_gestor},
      </Text>
      <Text style={{ fontSize: 14, color: '#232626', margin: '0 0 20px', lineHeight: '1.5' }}>
        Um novo pagamento foi lançado no sistema e está aguardando sua aprovação:
      </Text>

      {/* Detail card */}
      <div
        style={{
          backgroundColor: '#FAFFE0',
          border: '1px solid #E0FF66',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ fontSize: 12, color: '#565B5B', paddingBottom: 6, width: '36%' }}>
                Obra
              </td>
              <td style={{ fontSize: 14, color: '#041F25', fontWeight: 700, paddingBottom: 6 }}>
                {obra_nome}
              </td>
            </tr>
            <tr>
              <td style={{ fontSize: 12, color: '#565B5B', paddingBottom: 6 }}>
                Fornecedor
              </td>
              <td style={{ fontSize: 14, color: '#041F25', paddingBottom: 6 }}>
                {fornecedor_nome ?? '—'}
              </td>
            </tr>
            <tr>
              <td style={{ fontSize: 12, color: '#565B5B', paddingBottom: 6 }}>
                Valor
              </td>
              <td
                style={{
                  fontSize: 20,
                  color: '#041F25',
                  fontWeight: 700,
                  paddingBottom: 6,
                }}
              >
                {valorFormatado}
              </td>
            </tr>
            <tr>
              <td style={{ fontSize: 12, color: '#565B5B', paddingBottom: 6 }}>
                Data
              </td>
              <td style={{ fontSize: 14, color: '#041F25', paddingBottom: 6 }}>
                {dataFormatada}
              </td>
            </tr>
            {descricao !== null && (
              <tr>
                <td style={{ fontSize: 12, color: '#565B5B' }}>
                  Descrição
                </td>
                <td style={{ fontSize: 14, color: '#041F25' }}>
                  {descricao}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CTA button */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Link
          href={ctaHref}
          style={{
            display: 'inline-block',
            backgroundColor: '#CCFF00',
            color: '#041F25',
            padding: '12px 24px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Revisar no painel →
        </Link>
      </div>

      <Text style={{ fontSize: 12, color: '#565B5B', marginTop: 24 }}>
        ID do pagamento: {pagamento_id}
      </Text>
    </EmailLayout>
  );
}
