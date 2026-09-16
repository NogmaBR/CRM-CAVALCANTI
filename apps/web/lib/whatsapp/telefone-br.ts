/**
 * O nono dígito que o WhatsApp esconde.
 *
 * Celular brasileiro tem 9 dígitos desde 2016, mas o WhatsApp ainda
 * identifica muitos números pelo formato antigo, sem o 9: o JID de
 * "(73) 99848-9747" chega como `557398489747@s.whatsapp.net` — 12 dígitos,
 * não 13. Quem cadastra digita o número como está no celular, com o 9.
 * Comparar dígito a dígito reprova todo mundo, e o CRM ignora a mensagem
 * em silêncio (foi o primeiro contato real, 2026-09-16: 10 eventos
 * `ignorada_nao_autorizada` com os dois números cadastrados).
 *
 * A regra: para número do Brasil (55 + DDD + 8 ou 9 dígitos), as duas formas
 * identificam a mesma pessoa. A busca em `autorizados` usa as duas.
 */

/** Só dígitos. `5573998489747@s.whatsapp.net` → `5573998489747`. */
export function digitosDoTelefone(v: string): string {
  return v.replace(/\D+/gu, '');
}

/**
 * Todas as formas pelas quais este telefone pode aparecer: a própria e,
 * para celular brasileiro, a variante com/sem o nono dígito. Nunca vazio.
 */
export function variantesTelefoneBR(telefone: string): string[] {
  let d = digitosDoTelefone(telefone);
  // DDD + número, como brasileiro digita: assume 55 (mesma regra do cadastro).
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  const formas = new Set<string>();
  if (d) formas.add(d);
  if (d.startsWith('55')) {
    const resto = d.slice(2);
    // 55 + DDD(2) + 9 + 8 dígitos = 13 → tira o 9
    if (resto.length === 11 && resto[2] === '9')
      formas.add(`55${resto.slice(0, 2)}${resto.slice(3)}`);
    // 55 + DDD(2) + 8 dígitos = 12 → põe o 9 (só celular: primeiro dígito 6–9)
    if (resto.length === 10 && /[6-9]/u.test(resto[2] ?? ''))
      formas.add(`55${resto.slice(0, 2)}9${resto.slice(2)}`);
  }
  return [...formas];
}

/** As duas formas identificam a mesma pessoa? */
export function mesmoTelefoneBR(a: string, b: string): boolean {
  const va = variantesTelefoneBR(a);
  return variantesTelefoneBR(b).some((x) => va.includes(x));
}
