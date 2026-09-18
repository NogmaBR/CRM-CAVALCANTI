import { z } from 'zod';
import type { Automacao } from './tipos';

/**
 * Do schema Zod de uma automação para campos de formulário — e de volta.
 *
 * O painel mostrava `{"limite_por_rodada":25,...}` num textarea: o gestor
 * precisava saber JSON para mudar um prazo. Aqui o `configSchema` de cada
 * regra vira uma descrição **serializável** (`CampoConfig[]`) que o server
 * component entrega ao HTML, e o `FormData` que volta é remontado no objeto
 * que `validarConfig` já sabe validar. A validação continua sendo a do
 * schema `.strict()` — este módulo não decide o que é válido, só traduz.
 *
 * Um schema Zod não atravessa a fronteira servidor → cliente (tem funções
 * dentro), por isso a descrição é dados puros: chave, tipo, limites, padrão,
 * rótulo e ajuda.
 */

export type TipoCampo = 'number' | 'boolean' | 'enum' | 'string';

export interface CampoConfig {
  chave: string;
  tipo: TipoCampo;
  /** Rótulo humano; cai para a chave "humanizada" quando não há mapeamento. */
  rotulo: string;
  /** Texto pequeno abaixo do campo: padrão e limites. */
  ajuda: string;
  padrao: unknown;
  min?: number;
  max?: number;
  /** `true` quando o schema exige inteiro (`z.number().int()`). */
  inteiro?: boolean;
  /** Só para `enum`. */
  opcoes?: string[];
}

/**
 * Rótulos das chaves conhecidas. Chave nova sem entrada aqui não quebra
 * nada: aparece como "Chave nova" (underscores viram espaço, inicial
 * maiúscula) até alguém dar um nome melhor.
 */
export const ROTULOS_CONFIG: Record<string, string> = {
  dias_sem_documento: 'Dias sem nota',
  limite_por_rodada: 'Máximo de cobranças por rodada',
  dias_entre_cobrancas: 'Dias entre cobranças do mesmo pagamento',
  limiar_percentual: 'Alerta a partir de (% do orçamento)',
  telefones: 'Telefones que recebem o resumo (separados por vírgula)',
  enviar_quando_tudo_ok: 'Enviar mesmo quando não há pendência',
};

/** Prefixo dos inputs no formulário, para não colidir com `chave`/`config`. */
export const PREFIXO_CAMPO = 'campo__';

export function rotuloDaChave(chave: string): string {
  const conhecido = ROTULOS_CONFIG[chave];
  if (conhecido) return conhecido;
  const texto = chave.replace(/_+/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Tira `.optional()`, `.default()`, `.nullable()` e afins até chegar ao tipo base. */
function desembrulhar(schema: z.ZodTypeAny): z.ZodTypeAny {
  let atual = schema;
  for (let i = 0; i < 8; i++) {
    if (
      atual instanceof z.ZodOptional ||
      atual instanceof z.ZodNullable ||
      atual instanceof z.ZodDefault
    ) {
      atual = atual._def.innerType as z.ZodTypeAny;
      continue;
    }
    if (atual instanceof z.ZodEffects) {
      atual = atual._def.schema as z.ZodTypeAny;
      continue;
    }
    break;
  }
  return atual;
}

function limitesDoNumero(schema: z.ZodNumber): Pick<CampoConfig, 'min' | 'max' | 'inteiro'> {
  const out: Pick<CampoConfig, 'min' | 'max' | 'inteiro'> = {};
  for (const check of schema._def.checks) {
    if (check.kind === 'min') out.min = check.inclusive ? check.value : check.value + 1;
    else if (check.kind === 'max') out.max = check.inclusive ? check.value : check.value - 1;
    else if (check.kind === 'int') out.inteiro = true;
  }
  return out;
}

function formatarPadrao(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'boolean') return valor ? 'ligado' : 'desligado';
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR');
  // Texto vazio é um padrão válido ("telefones" nasce vazio): a ajuda diz isso.
  if (typeof valor === 'string') return valor === '' ? '(vazio)' : valor;
  return String(valor);
}

function montarAjuda(campo: Omit<CampoConfig, 'ajuda'>): string {
  const partes: string[] = [];
  const padrao = formatarPadrao(campo.padrao);
  if (padrao) partes.push(`Padrão: ${padrao}`);
  if (campo.tipo === 'number') {
    if (campo.min != null && campo.max != null) partes.push(`entre ${campo.min} e ${campo.max}`);
    else if (campo.min != null) partes.push(`mínimo ${campo.min}`);
    else if (campo.max != null) partes.push(`máximo ${campo.max}`);
  }
  return partes.join(' · ');
}

/**
 * Descreve os campos de uma automação a partir do `configSchema`.
 *
 * A ordem é a do schema, que é a ordem em que quem escreveu a regra pensou
 * nos parâmetros — normalmente do mais importante para o menos.
 */
export function descreverCampos(
  automacao: Pick<Automacao, 'configSchema' | 'configPadrao'>,
): CampoConfig[] {
  const padrao = automacao.configPadrao ?? {};
  const shape = automacao.configSchema.shape;
  return Object.keys(shape).map((chave) => {
    const base = desembrulhar(shape[chave] as z.ZodTypeAny);
    const comum = { chave, rotulo: rotuloDaChave(chave), padrao: padrao[chave] };

    let campo: Omit<CampoConfig, 'ajuda'>;
    if (base instanceof z.ZodNumber) {
      campo = { ...comum, tipo: 'number', ...limitesDoNumero(base) };
    } else if (base instanceof z.ZodBoolean) {
      campo = { ...comum, tipo: 'boolean' };
    } else if (base instanceof z.ZodEnum) {
      campo = { ...comum, tipo: 'enum', opcoes: [...(base.options as string[])] };
    } else {
      campo = { ...comum, tipo: 'string' };
    }
    return { ...campo, ajuda: montarAjuda(campo) };
  });
}

/** O mínimo de `FormData` que este módulo usa — assim o teste não precisa do DOM. */
export interface LeitorDeCampos {
  get(nome: string): FormDataEntryValue | null;
}

/**
 * Remonta o objeto de configuração a partir dos inputs do formulário.
 *
 * Só as chaves descritas entram no objeto — o resto do `FormData` (`chave`,
 * botões) é ignorado. Campo numérico vazio **não** entra: `validarConfig`
 * completa com o padrão, que é o que quem apagou o campo esperava. Texto que
 * não é número vira `NaN` de propósito, para o schema recusar com o nome do
 * campo em vez de gravar lixo em silêncio.
 */
export function montarConfigDosCampos(
  form: LeitorDeCampos,
  campos: CampoConfig[],
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const campo of campos) {
    const bruto = form.get(`${PREFIXO_CAMPO}${campo.chave}`);
    if (campo.tipo === 'boolean') {
      // Checkbox desmarcado não vai no FormData: ausência é `false`.
      config[campo.chave] = bruto === 'on' || bruto === 'true';
      continue;
    }
    if (bruto === null) continue;
    const texto = String(bruto).trim();
    if (texto === '') continue;
    if (campo.tipo === 'number') {
      // Aceita vírgula decimal: "12,5" é como se digita em pt-BR.
      config[campo.chave] = Number(texto.replace(',', '.'));
      continue;
    }
    config[campo.chave] = texto;
  }
  return config;
}
