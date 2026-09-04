# CRM Nogma — Gestor de Obras

Sistema de gestão financeira de obras para construtoras, com bot WhatsApp classificado por IA.

- **Cliente inicial:** Cavalcanti Construções
- **Fabricante:** Nogma (nogmacorp.com.br)
- **Spec:** [docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md](docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md)
- **Plano #1 (fundações):** [docs/superpowers/plans/2026-09-03-plano-1-fundacoes-v2.md](docs/superpowers/plans/2026-09-03-plano-1-fundacoes-v2.md)
- **Design System (source of truth):** [Nogma Design System/readme.md](Nogma%20Design%20System/readme.md)

## Requisitos

- Node ≥ 20 (usando v22.18)
- pnpm ≥ 9 (usando v11.7)
- Supabase CLI: `npm i -g supabase`
- Docker Desktop (Fase 10+)

## Setup local

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# preencha as chaves Supabase seguindo docs/operacao/setup-supabase.md
pnpm dev
```

Aplicação em `http://localhost:3000`.

## Estrutura

```
apps/web/            # Next.js 15 (frontend + API routes) — deploy Vercel
packages/db/         # Tipos Postgres gerados
infra/docker/        # docker-compose para VPS (Fase 10+)
supabase/            # Migrations e seed
docs/                # Specs, plans, operação
Nogma Design System/ # Design system oficial (read-only, source of truth)
```

## Operação em produção

Ver `docs/operacao/`:

- `setup-supabase.md` — provisionamento Supabase
- `setup-vercel.md` — provisionamento Vercel
- `runbook.md` — troubleshooting e restart de serviços
- `backup-restore.md` — backup e recuperação

## Contato

Nogma · operacao@nogmacorp.com.br · WhatsApp +55 51 9285-6911
