import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Copy } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Badge } from '@/components/nogma/Badge';
import { createClient } from '@/lib/supabase/server';
import { detectDuplicateFornecedores } from '@/lib/services/detect-duplicates';
import { MergeButtons } from './merge-buttons';

function ScoreBadge({ score, motivo }: { score: number; motivo: string }) {
  const pct = Math.round(score * 100);
  const variant = pct >= 99 ? 'success' : 'warning';
  return (
    <Badge variant={variant}>
      {pct}%
    </Badge>
  );
}

function MotivoBadge({ motivo }: { motivo: 'documento_igual' | 'nome_similar' }) {
  return (
    <Badge variant="neutral">
      {motivo === 'documento_igual' ? 'Documento idêntico' : 'Nomes muito similares'}
    </Badge>
  );
}

export default async function DuplicatasPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  // Check auth and role
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();

  if (!profile || !['admin', 'gestor'].includes(profile.papel)) {
    notFound();
  }

  const [sp, candidatos] = await Promise.all([searchParams, detectDuplicateFornecedores()]);

  const successMsg = sp.success ?? null;
  const errorMsg = sp.error ?? null;

  return (
    <>
      <TopBar
        title="Duplicatas de fornecedores"
        subtitle="IA detectou possíveis fornecedores duplicados baseado em nome e documento"
      />

      <div className="nos-page-body">
        {successMsg ? (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--brand, #a3e635) 12%, transparent)',
              color: 'var(--brand, #a3e635)',
              fontSize: 13,
              border: '1px solid color-mix(in srgb, var(--brand, #a3e635) 30%, transparent)',
            }}
          >
            {successMsg}
          </div>
        ) : null}

        {errorMsg ? (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--danger, #ef4444) 12%, transparent)',
              color: 'var(--danger, #ef4444)',
              fontSize: 13,
              border: '1px solid color-mix(in srgb, var(--danger, #ef4444) 30%, transparent)',
            }}
          >
            {errorMsg}
          </div>
        ) : null}

        {candidatos.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '60px 24px',
              color: 'var(--text-secondary)',
            }}
          >
            <CheckCircle2 size={40} aria-hidden="true" style={{ opacity: 0.5 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Nenhuma duplicata detectada</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candidatos.map((candidato) => (
              <article
                key={`${candidato.a.id}-${candidato.b.id}`}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '18px 20px',
                  background: 'var(--surface-1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {/* Header row: score + motivo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <ScoreBadge score={candidato.score} motivo={candidato.motivo} />
                  <MotivoBadge motivo={candidato.motivo} />
                  <Copy
                    size={13}
                    aria-hidden="true"
                    style={{ marginLeft: 4, opacity: 0.4, flexShrink: 0 }}
                  />
                </div>

                {/* Pair display */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Fornecedor A */}
                  <div
                    style={{
                      flex: '1 1 180px',
                      padding: '10px 14px',
                      background: 'var(--surface-2)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-secondary)',
                        marginBottom: 4,
                      }}
                    >
                      A
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Link
                        href={`/fornecedores/${candidato.a.id}`}
                        style={{ color: 'inherit', textDecoration: 'underline' }}
                      >
                        {candidato.a.nome}
                      </Link>
                    </div>
                    {candidato.a.documento ? (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {candidato.a.documento}
                      </div>
                    ) : null}
                  </div>

                  <ArrowRight size={16} aria-hidden="true" style={{ opacity: 0.4, flexShrink: 0 }} />

                  {/* Fornecedor B */}
                  <div
                    style={{
                      flex: '1 1 180px',
                      padding: '10px 14px',
                      background: 'var(--surface-2)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-secondary)',
                        marginBottom: 4,
                      }}
                    >
                      B
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Link
                        href={`/fornecedores/${candidato.b.id}`}
                        style={{ color: 'inherit', textDecoration: 'underline' }}
                      >
                        {candidato.b.nome}
                      </Link>
                    </div>
                    {candidato.b.documento ? (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {candidato.b.documento}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Merge actions */}
                <MergeButtons
                  keepAId={candidato.a.id}
                  dropAId={candidato.b.id}
                  keepBId={candidato.b.id}
                  dropBId={candidato.a.id}
                  pagamentosA={0}
                  documentosA={0}
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
