import { Link, Text } from '@react-email/components';
import { EmailLayout } from './base-layout';

export interface PendenciaNovaProps {
  nome_gestor: string;
  texto_bruto: string | null;
  midia_mime: string | null;
  valor_estimado: number | null;
  obra_hint: string | null;
  /** Confidence score 0–1 */
  confidence: number;
  painel_url: string;
  pendencia_count: number;
}

export function buildSubject(
  props: Pick<PendenciaNovaProps, 'pendencia_count'>,
): string {
  return `Mensagem WhatsApp aguardando classificação — ${props.pendencia_count} pendente(s)`;
}

export function buildText(props: PendenciaNovaProps): string {
  const pct = (props.confidence * 100).toFixed(0);
  const valor =
    props.valor_estimado !== null
      ? Number(props.valor_estimado).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      : '—';
  const cta = `${props.painel_url}/pendentes`;

  return [
    `Olá ${props.nome_gestor},`,
    '',
    `A IA classificou uma mensagem do WhatsApp com baixa confiança (${pct}%) e precisa de revisão sua.`,
    '',
    '--- Mensagem original ---',
    props.texto_bruto ? `"${props.texto_bruto}"` : '(sem texto)',
    props.midia_mime ? `Anexo: ${mimeLabel(props.midia_mime)}` : null,
    '',
    '--- Estimativa da IA ---',
    `Valor: ${valor}`,
    `Obra provável: ${props.obra_hint ?? '—'}`,
    '',
    `Revisar pendências: ${cta}`,
    '',
    `Total pendente agora: ${props.pendencia_count}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/** Returns a human-readable label for a MIME type */
function mimeLabel(mime: string): string {
  if (mime.startsWith('image/')) return 'Imagem';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('video/')) return 'Vídeo';
  if (mime.startsWith('audio/')) return 'Áudio';
  return mime;
}

export function PendenciaNovaEmail(props: PendenciaNovaProps) {
  const {
    nome_gestor,
    texto_bruto,
    midia_mime,
    valor_estimado,
    obra_hint,
    confidence,
    painel_url,
    pendencia_count,
  } = props;

  const pct = (confidence * 100).toFixed(0);
  const valorFormatado =
    valor_estimado !== null
      ? Number(valor_estimado).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      : '—';
  const ctaHref = `${painel_url}/pendentes`;

  return (
    <EmailLayout
      preview={`Mensagem WhatsApp aguardando classificação (${pct}% confiança)`}
    >
      <Text style={{ fontSize: 15, color: '#041F25', margin: '0 0 8px' }}>
        Olá {nome_gestor},
      </Text>
      <Text
        style={{ fontSize: 14, color: '#232626', margin: '0 0 20px', lineHeight: '1.5' }}
      >
        A IA classificou uma mensagem do WhatsApp com baixa confiança ({pct}%) e
        precisa de revisão sua.
      </Text>

      {/* Content card */}
      <div
        style={{
          backgroundColor: '#F7F8F8',
          border: '1px solid #E1E4E4',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        {/* Original text */}
        <Text
          style={{ fontSize: 12, color: '#565B5B', margin: '0 0 4px', fontWeight: 600 }}
        >
          Texto original
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: '#041F25',
            fontStyle: texto_bruto ? 'italic' : 'normal',
            margin: '0 0 12px',
            lineHeight: '1.5',
          }}
        >
          {texto_bruto ? `"${texto_bruto}"` : '(sem texto)'}
        </Text>

        {/* Attachment badge */}
        {midia_mime !== null && (
          <div style={{ marginBottom: 12 }}>
            <Text
              style={{ fontSize: 12, color: '#565B5B', margin: '0 0 4px', fontWeight: 600 }}
            >
              Anexo
            </Text>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: '#E1EEF0',
                color: '#0C4651',
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              {mimeLabel(midia_mime)}
            </span>
          </div>
        )}

        {/* AI estimates */}
        <Text
          style={{ fontSize: 12, color: '#565B5B', margin: '12px 0 4px', fontWeight: 600 }}
        >
          Estimativa da IA
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ fontSize: 12, color: '#565B5B', paddingBottom: 4, width: '40%' }}>
                Valor
              </td>
              <td style={{ fontSize: 14, color: '#041F25', paddingBottom: 4 }}>
                {valorFormatado}
              </td>
            </tr>
            <tr>
              <td style={{ fontSize: 12, color: '#565B5B' }}>Obra provável</td>
              <td style={{ fontSize: 14, color: '#041F25' }}>{obra_hint ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* CTA */}
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
          Revisar pendências →
        </Link>
      </div>

      <Text style={{ fontSize: 14, color: '#041F25', marginTop: 16 }}>
        Total pendente agora: {pendencia_count}
      </Text>
    </EmailLayout>
  );
}
