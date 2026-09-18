import { hojeBR } from '@/lib/util/datas';
import { z } from 'zod/v4';
import { normalizarNome, resolverPorNome } from '../resolver-nomes';
import { carregarObras } from './crm';
import { escolherObra } from './obras';
import { type Client, ferramenta } from './registro';

/**
 * Ferramentas de AÇÃO — que nunca agem.
 *
 * O modelo pede `propor_criar_obra({ nome: 'Sítio do Pedro' })`; a ferramenta
 * valida (nome livre, obra resolvida, valor positivo), aplica os defaults e
 * devolve uma **proposta**. Quem grava é `aplicarAcao` em
 * `lib/services/acoes-whatsapp.ts`, e só depois que a pessoa responde SIM à
 * pergunta montada por `perguntaDaAcao` — a mesma regra do pagamento.
 *
 * Por que a proposta é um tipo fechado (`PropostaSchema`): ela vai para o
 * JSONB de `confirmacoes_pendentes.acao` e é relida horas depois, no SIM.
 * O schema é o contrato entre o momento de propor e o momento de executar;
 * se não passar por ele na releitura, a ação não roda.
 */

const Valor = z
  .number()
  .positive('precisa ser maior que zero')
  .max(1_000_000_000)
  .describe('Valor em reais, número (ex.: 850000 para "850 mil")');

const Data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'use AAAA-MM-DD')
  .describe('Data AAAA-MM-DD; se a pessoa não disse, omita (vira hoje)');

const NomeObra = z.string().trim().min(2).max(80).describe('Nome ou apelido da obra');

export const PropostaSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('criar_obra'),
    dados: z.object({
      nome: z.string().trim().min(2).max(200),
      cliente: z.string().trim().min(1).max(200).nullable(),
      tipo_obra: z.enum(['nova', 'reforma']).nullable(),
      endereco: z.string().trim().min(1).max(300).nullable(),
      valor_contrato: Valor.nullable(),
      data_inicio: Data.nullable(),
    }),
  }),
  z.object({
    tipo: z.literal('cadastrar_fornecedor'),
    dados: z.object({
      nome: z.string().trim().min(2).max(200),
      documento: z
        .string()
        .regex(/^\d{11}$|^\d{14}$/u)
        .nullable(),
      telefone: z
        .string()
        .regex(/^\d{10,13}$/u)
        .nullable(),
    }),
  }),
  z.object({
    tipo: z.literal('definir_contrato'),
    dados: z.object({
      obra_id: z.string().uuid(),
      obra_nome: z.string(),
      valor: Valor,
      valor_anterior: z.number().nullable(),
    }),
  }),
  z.object({
    tipo: z.literal('registrar_recebimento'),
    dados: z.object({
      obra_id: z.string().uuid(),
      obra_nome: z.string(),
      valor: Valor,
      data: Data,
      descricao: z.string().trim().min(1).max(200).nullable(),
    }),
  }),
  z.object({
    tipo: z.literal('arquivar_obra'),
    dados: z.object({
      obra_id: z.string().uuid(),
      obra_nome: z.string(),
    }),
  }),
  // PM1: medição do cronograma físico ("laje 100%"). `etapa_id` nulo = a
  // etapa não existe ainda e será criada no SIM com esse nome.
  z.object({
    tipo: z.literal('registrar_medicao'),
    dados: z.object({
      obra_id: z.string().uuid(),
      obra_nome: z.string(),
      etapa_id: z.string().uuid().nullable(),
      etapa_nome: z.string().trim().min(2).max(120),
      percentual: z.number().min(0).max(100),
      percentual_anterior: z.number().min(0).max(100).nullable(),
    }),
  }),
]);

export type Proposta = z.infer<typeof PropostaSchema>;
export type TipoDeAcao = Proposta['tipo'];

/** Relê uma proposta vinda do JSONB. `null` se não passar no schema. */
export function lerProposta(v: unknown): Proposta | null {
  const r = PropostaSchema.safeParse(v);
  return r.success ? r.data : null;
}

/** Marca o resultado de uma ferramenta de ação para o laço do assistente. */
export interface ResultadoDeProposta {
  ok: true;
  proposta: Proposta;
  /** Aviso a repassar (ex.: fornecedor parecido já existe). */
  aviso?: string;
}

export function ehResultadoDeProposta(v: unknown): v is ResultadoDeProposta {
  return (
    !!v &&
    typeof v === 'object' &&
    (v as { ok?: unknown }).ok === true &&
    lerProposta((v as { proposta?: unknown }).proposta) !== null
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function soDigitos(s: string | null | undefined): string | null {
  const d = String(s ?? '').replace(/\D/gu, '');
  return d ? d : null;
}

async function resolverObra(supabase: Client, termo: string) {
  const obras = await carregarObras(supabase);
  const escolha = escolherObra(termo, obras);
  if (escolha.tipo === 'uma') {
    const obra = obras.find((o) => o.id === escolha.obra.id);
    if (obra) return { ok: true as const, obra };
  }
  if (escolha.tipo === 'ambigua') {
    return {
      ok: false as const,
      erro: `mais de uma obra casa com "${termo}"; pergunte qual`,
      candidatas: escolha.candidatas.map((o) => o.nome),
    };
  }
  return {
    ok: false as const,
    erro: `nenhuma obra casa com "${termo}"; liste as obras e pergunte`,
  };
}

// ---------------------------------------------------------------------------
// As ferramentas
// ---------------------------------------------------------------------------

export const proporCriarObra = ferramenta({
  nome: 'propor_criar_obra',
  descricao:
    'Prepara a criação de uma obra nova. Use quando a pessoa pedir "cria a obra X", "cadastra uma obra chamada X", "abre a obra do cliente Y". Só propõe: a obra é criada depois que a pessoa responder SIM. Não invente cliente, endereço ou valor — só passe o que foi dito.',
  schema: z.object({
    nome: z.string().trim().min(2).max(200).describe('Nome da obra como a pessoa disse'),
    cliente: z.string().trim().max(200).optional().describe('Cliente, se foi dito'),
    tipo_obra: z.enum(['nova', 'reforma']).optional(),
    endereco: z.string().trim().max(300).optional(),
    valor_contrato: Valor.optional(),
    data_inicio: Data.optional(),
  }),
  executar: async (supabase, args): Promise<ResultadoDeProposta | { ok: false; erro: string }> => {
    const obras = await carregarObras(supabase, { incluirArquivadas: true });
    const alvo = normalizarNome(args.nome);
    const igual = obras.find((o) => normalizarNome(o.nome) === alvo);
    if (igual) {
      return {
        ok: false,
        erro: `já existe uma obra chamada "${igual.nome}"${igual.status === 'arquivada' ? ' (arquivada)' : ''}; diga isso e pergunte se quer outro nome`,
      };
    }
    return {
      ok: true,
      proposta: {
        tipo: 'criar_obra',
        dados: {
          nome: args.nome,
          cliente: args.cliente?.trim() || null,
          tipo_obra: args.tipo_obra ?? null,
          endereco: args.endereco?.trim() || null,
          valor_contrato: args.valor_contrato ?? null,
          data_inicio: args.data_inicio ?? null,
        },
      },
    };
  },
});

export const proporCadastrarFornecedor = ferramenta({
  nome: 'propor_cadastrar_fornecedor',
  descricao:
    'Prepara o cadastro de um fornecedor. Use para "cadastra o fornecedor X", "anota o CNPJ do X", "o telefone do X é …". Só propõe: grava depois do SIM. Se já existir um parecido, o resultado avisa.',
  schema: z.object({
    nome: z.string().trim().min(2).max(200),
    documento: z.string().trim().max(30).optional().describe('CNPJ ou CPF, como foi dito'),
    telefone: z.string().trim().max(30).optional().describe('Telefone com DDD'),
  }),
  executar: async (supabase, args): Promise<ResultadoDeProposta | { ok: false; erro: string }> => {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('id, nome')
      .is('deleted_at', null)
      .limit(1000);
    if (error) throw new Error(`fornecedores: ${error.message}`);
    const lista = data ?? [];
    const alvo = normalizarNome(args.nome);
    const igual = lista.find((f) => normalizarNome(f.nome) === alvo);
    if (igual) {
      return { ok: false, erro: `o fornecedor "${igual.nome}" já está cadastrado; diga isso` };
    }
    const documento = soDigitos(args.documento);
    if (documento && documento.length !== 11 && documento.length !== 14) {
      return {
        ok: false,
        erro: 'documento precisa ter 11 (CPF) ou 14 (CNPJ) dígitos; peça de novo',
      };
    }
    const telefone = soDigitos(args.telefone);
    if (telefone && (telefone.length < 10 || telefone.length > 13)) {
      return { ok: false, erro: 'telefone precisa ter DDD + número; peça de novo' };
    }
    const parecido = resolverPorNome(args.nome, lista);
    return {
      ok: true,
      proposta: {
        tipo: 'cadastrar_fornecedor',
        dados: { nome: args.nome, documento, telefone },
      },
      ...(parecido ? { aviso: `existe um fornecedor parecido: "${parecido.nome}"` } : {}),
    };
  },
});

export const proporDefinirContrato = ferramenta({
  nome: 'propor_definir_contrato',
  descricao:
    'Prepara a gravação do valor do contrato de uma obra (quanto o cliente paga pelo todo). Use para "o contrato da X é 850 mil", "a obra X vale 1,2 milhão", "anota que o contrato da X ficou em …". Só propõe: grava depois do SIM.',
  schema: z.object({ obra: NomeObra, valor: Valor }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    return {
      ok: true,
      proposta: {
        tipo: 'definir_contrato',
        dados: {
          obra_id: r.obra.id,
          obra_nome: r.obra.nome,
          valor: args.valor,
          valor_anterior: r.obra.valor_contrato,
        },
      },
    } satisfies ResultadoDeProposta;
  },
});

export const proporRegistrarRecebimento = ferramenta({
  nome: 'propor_registrar_recebimento',
  descricao:
    'Prepara o registro de uma parcela que o CLIENTE DA OBRA pagou (dinheiro que ENTROU). Use para "recebi 50 mil da X", "o cliente da X pagou a segunda parcela de 30 mil", "entrou 20 mil da X". NÃO é para pagamento a fornecedor (isso é lançamento, não use ferramenta). Só propõe: grava depois do SIM.',
  schema: z.object({
    obra: NomeObra,
    valor: Valor,
    data: Data.optional(),
    descricao: z.string().trim().max(200).optional().describe('ex.: "2ª parcela"'),
  }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    return {
      ok: true,
      proposta: {
        tipo: 'registrar_recebimento',
        dados: {
          obra_id: r.obra.id,
          obra_nome: r.obra.nome,
          valor: args.valor,
          data: args.data ?? hojeBR(),
          descricao: args.descricao?.trim() || null,
        },
      },
    } satisfies ResultadoDeProposta;
  },
});

export const proporArquivarObra = ferramenta({
  nome: 'propor_arquivar_obra',
  descricao:
    'Prepara o arquivamento de uma obra (encerrada ou cancelada). Use para "arquiva a obra X", "encerra a X", "a X acabou, pode fechar". Só propõe: arquiva depois do SIM.',
  schema: z.object({ obra: NomeObra }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    return {
      ok: true,
      proposta: {
        tipo: 'arquivar_obra',
        dados: { obra_id: r.obra.id, obra_nome: r.obra.nome },
      },
    } satisfies ResultadoDeProposta;
  },
});

export const proporRegistrarMedicao = ferramenta({
  nome: 'propor_registrar_medicao',
  descricao:
    'Prepara a MEDIÇÃO de uma etapa do cronograma físico da obra: quantos % daquela etapa estão feitos. Use para "laje 100%", "a alvenaria da casa ej tá em 60%", "fundação terminou", "pintura pela metade". Se a etapa não existir na obra, ela é criada no SIM. Só propõe: grava depois do SIM. NÃO é pagamento nem valor em reais.',
  schema: z.object({
    obra: NomeObra,
    etapa: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .describe('Nome da etapa como a pessoa disse (ex.: "laje", "alvenaria")'),
    percentual: z
      .number()
      .min(0)
      .max(100)
      .describe('0–100. "terminou"/"pronta" = 100; "pela metade" = 50; "começou" = 10'),
  }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    const { data, error } = await supabase
      .from('etapas_obra')
      .select('id, nome, percentual_concluido')
      .eq('obra_id', r.obra.id)
      .is('deleted_at', null)
      .limit(200);
    if (error) throw new Error(`etapas: ${error.message}`);
    const etapas = (data ?? []).map((e) => ({
      id: e.id,
      nome: e.nome,
      percentual: Number(e.percentual_concluido),
    }));
    const alvo = normalizarNome(args.etapa);
    const exata = etapas.find((e) => normalizarNome(e.nome) === alvo);
    const parecida = exata ?? resolverPorNome(args.etapa, etapas);
    return {
      ok: true,
      proposta: {
        tipo: 'registrar_medicao',
        dados: {
          obra_id: r.obra.id,
          obra_nome: r.obra.nome,
          etapa_id: parecida?.id ?? null,
          etapa_nome: parecida?.nome ?? args.etapa,
          percentual: Math.round(args.percentual),
          percentual_anterior: parecida?.percentual ?? null,
        },
      },
      ...(parecida
        ? {}
        : {
            aviso: `a etapa "${args.etapa}" não existe nesta obra; será criada com essa medição`,
          }),
    } satisfies ResultadoDeProposta;
  },
});

export const FERRAMENTAS_DE_ACAO = [
  proporCriarObra,
  proporCadastrarFornecedor,
  proporDefinirContrato,
  proporRegistrarRecebimento,
  proporArquivarObra,
  proporRegistrarMedicao,
] as const;
