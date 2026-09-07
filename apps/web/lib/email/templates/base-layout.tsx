import type { ReactNode } from 'react';
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';

export interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

const FONT_STACK =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif";

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#F7F8F8',
          fontFamily: FONT_STACK,
          margin: 0,
          padding: 24,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 32,
            margin: '0 auto',
            border: '1px solid #E1E4E4',
          }}
        >
          {/* Header */}
          <div
            style={{
              borderBottom: '2px solid #0C4651',
              paddingBottom: 12,
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: '#0C4651',
                letterSpacing: '0.04em',
                lineHeight: '1.2',
              }}
            >
              NOGMA{' '}
              <span style={{ color: '#A3CC00' }}>·</span>
              {' '}Gestor de Obras
            </Text>
          </div>

          {/* Slot */}
          {children}

          {/* Divider + Footer */}
          <Hr style={{ borderColor: '#E1E4E4', margin: '32px 0 16px' }} />
          <Text
            style={{
              fontSize: 11,
              color: '#565B5B',
              margin: '0 0 4px',
              lineHeight: '1.5',
            }}
          >
            Nogma Corp · Gestor de Obras para Cavalcanti Construções
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: '#565B5B',
              margin: 0,
              lineHeight: '1.5',
            }}
          >
            Você recebeu este email porque tem acesso ao painel. Ajuste em /config.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
