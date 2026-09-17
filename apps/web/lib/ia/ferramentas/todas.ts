import { FERRAMENTAS_DE_ACAO } from './acoes';
import { FERRAMENTAS_CRM } from './crm';
import { FERRAMENTAS_DE_OBRA } from './obras';

/**
 * A allowlist completa do agente. Ferramenta que não está aqui não existe
 * para o modelo.
 *
 * Leitura: gasto (`obras.ts`) + CRM inteiro (`crm.ts`). Proposta de ação
 * (`acoes.ts`): nunca gravam — devolvem uma proposta que vira pendência e só
 * é executada no "SIM" (`lib/services/acoes-whatsapp.ts`).
 *
 * Arquivo próprio para não haver import circular: `crm.ts` reaproveita as
 * funções puras de `obras.ts`.
 */
export const FERRAMENTAS_DO_AGENTE = [
  ...FERRAMENTAS_DE_OBRA,
  ...FERRAMENTAS_CRM,
  ...FERRAMENTAS_DE_ACAO,
] as const;
