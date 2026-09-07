import { Link, Text } from '@react-email/components';
import { EmailLayout } from './base-layout';

export type PapelUsuario = 'admin' | 'gestor' | 'financeiro' | 'leitura';

export interface BoasVindasProps {
  nome_gestor: string;
  papel: PapelUsuario;
  painel_url: string;
}

export function buildSubject(
  _props: Pick<BoasVindasProps, 'nome_gestor'>,
): string {
  return 'Bem-vindo ao Gestor de Obras Nogma';
}

export function buildText(props: BoasVindasProps): string {
  const { nome_gestor, papel, painel_url } = props;
  const lines = [
    `Bem-vindo, ${nome_gestor}!`,
    '',
    `Sua conta no Gestor de Obras Nogma foi criada com o papel ${papel}.`,
    '',
    'Próximos passos:',
    '• Configure suas obras em /obras',
    '• Cadastre seus fornecedores em /fornecedores',
    '• Explore os relatórios em /relatorios',
    '',
    `Acessar o painel: ${painel_url}/painel`,
  ];

  if (papel === 'leitura') {
    lines.push(
      '',
      'Você tem acesso apenas para visualização. Contate um administrador para permissões de edição.',
    );
  }

  return lines.join('\n');
}

const PASSOS = [
  { texto: 'Configure suas obras em', local: '/obras' },
  { texto: 'Cadastre seus fornecedores em', local: '/fornecedores' },
  { texto: 'Explore os relatórios em', local: '/relatorios' },
] as const;

export function BoasVindasEmail(props: BoasVindasProps) {
  const { nome_gestor, papel, painel_url } = props;
  const ctaHref = `${painel_url}/painel`;

  return (
    <EmailLayout preview={`Bem-vindo ao Gestor de Obras Nogma, ${nome_gestor}!`}>
      <Text
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: '#0C4651',
          margin: '0 0 16px',
          lineHeight: '1.2',
        }}
      >
        Bem-vindo, {nome_gestor}!
      </Text>

      <Text
        style={{ fontSize: 14, color: '#232626', margin: '0 0 20px', lineHeight: '1.6' }}
      >
        Sua conta no <strong>Gestor de Obras Nogma</strong> foi criada com o papel{' '}
        <strong>{papel}</strong>.
      </Text>

      {/* Próximos passos */}
      <Text
        style={{ fontSize: 13, color: '#565B5B', fontWeight: 600, margin: '0 0 8px' }}
      >
        Próximos passos
      </Text>
      <ul
        style={{
          margin: '0 0 24px',
          paddingLeft: 20,
          color: '#232626',
          fontSize: 14,
          lineHeight: '1.8',
        }}
      >
        {PASSOS.map((passo) => (
          <li key={passo.local} style={{ marginBottom: 4 }}>
            {passo.texto}{' '}
            <span
              style={{
                color: '#0C4651',
                fontWeight: 600,
                fontFamily: "'Courier New', Courier, monospace",
              }}
            >
              {passo.local}
            </span>
          </li>
        ))}
      </ul>

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
          Acessar o painel →
        </Link>
      </div>

      {/* Aviso papel leitura */}
      {papel === 'leitura' && (
        <div
          style={{
            backgroundColor: '#FBF1DC',
            border: '1px solid #E8A317',
            borderRadius: 8,
            padding: '12px 16px',
            marginTop: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: '#232626',
              margin: 0,
              lineHeight: '1.5',
            }}
          >
            Você tem acesso apenas para visualização. Contate um administrador
            para permissões de edição.
          </Text>
        </div>
      )}
    </EmailLayout>
  );
}
