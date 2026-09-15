import { describe, expect, it } from 'vitest';
import type { ClassifierInput } from './classifier';
import { MockClassifier } from './mock-classifier';

/**
 * O mock é o que roda sem `ANTHROPIC_API_KEY` — inclusive na demo. As regras
 * aqui travam o contrato que `classifyAndPersist` espera dos dois tipos novos
 * e, principalmente, a regra "pagamento vence": nada com valor pode virar
 * foto de obra.
 */

const OBRAS = [
  { id: 'o-gari', nome: 'Garibaldi', apelidos: ['Gari'] },
  { id: 'o-ej', nome: 'Casa EJ', apelidos: ['EJ', 'E&J'] },
];

function input(
  over: Partial<ClassifierInput> & { grupoObraId?: string | null } = {},
): ClassifierInput {
  const { grupoObraId, ...resto } = over;
  return {
    texto: null,
    midiaStoragePath: null,
    midiaMime: null,
    telefone: '5551',
    contexto: { obrasAtivas: OBRAS, fornecedoresConhecidos: [], grupoObraId: grupoObraId ?? null },
    ...resto,
  };
}

const classificar = (i: ClassifierInput) => new MockClassifier().classify(i);

describe('MockClassifier — pagamento vence', () => {
  it('foto com valor na legenda é pagamento, com tipo de documento', async () => {
    const r = await classificar(
      input({
        texto: 'paguei 1200 de areia na Garibaldi',
        midiaMime: 'image/jpeg',
        midiaStoragePath: 'x',
      }),
    );
    expect(r.kind).toBe('pagamento_parcial');
    expect(r.extracted.valor).toBe(1200);
    expect(r.extracted.obra_id).toBe('o-gari');
    expect(r.extracted.tipo_documento).toBe('comprovante');
  });

  it('PDF cuja legenda cheira a nota, sem valor, segue o fluxo de pagamento (documento_apenas)', async () => {
    const r = await classificar(
      input({ texto: 'nota do cimento', midiaMime: 'application/pdf', midiaStoragePath: 'x' }),
    );
    expect(r.kind).toBe('documento_apenas');
    expect(r.perguntaConfirmacao).toBeTruthy();
  });
});

describe('MockClassifier — documento_obra', () => {
  it('foto sem legenda vai para fotos', async () => {
    const r = await classificar(input({ midiaMime: 'image/jpeg', midiaStoragePath: 'x' }));
    expect(r.kind).toBe('documento_obra');
    expect(r.extracted.categoria).toBe('fotos');
    expect(r.extracted.obra_id).toBeUndefined();
    expect(r.perguntaConfirmacao).toBeUndefined();
  });

  it('PDF sem pista vai para outro; com pista, para a pasta certa', async () => {
    expect(
      (await classificar(input({ midiaMime: 'application/pdf', midiaStoragePath: 'x' }))).extracted
        .categoria,
    ).toBe('outro');
    expect(
      (
        await classificar(
          input({
            texto: 'proposta revisada',
            midiaMime: 'application/pdf',
            midiaStoragePath: 'x',
          }),
        )
      ).extracted.categoria,
    ).toBe('proposta');
    expect(
      (
        await classificar(
          input({
            texto: 'cronograma atualizado',
            midiaMime: 'application/pdf',
            midiaStoragePath: 'x',
          }),
        )
      ).extracted.categoria,
    ).toBe('cronograma');
    const contrato = await classificar(
      input({ texto: 'contrato assinado', midiaMime: 'application/pdf', midiaStoragePath: 'x' }),
    );
    expect(contrato.extracted.categoria).toBe('documentacao');
    expect(contrato.extracted.tipo_documento).toBe('contrato');
  });

  it('obra por apelido na legenda; senão a do grupo', async () => {
    const porApelido = await classificar(
      input({ texto: 'foto da laje da EJ', midiaMime: 'image/jpeg', midiaStoragePath: 'x' }),
    );
    expect(porApelido.extracted.obra_id).toBe('o-ej');

    const doGrupo = await classificar(
      input({ midiaMime: 'image/jpeg', midiaStoragePath: 'x', grupoObraId: 'o-gari' }),
    );
    expect(doGrupo.extracted.obra_id).toBe('o-gari');

    // Citada vence a do grupo.
    const citada = await classificar(
      input({
        texto: 'foto da EJ',
        midiaMime: 'image/jpeg',
        midiaStoragePath: 'x',
        grupoObraId: 'o-gari',
      }),
    );
    expect(citada.extracted.obra_id).toBe('o-ej');
  });
});

describe('MockClassifier — registro_obra', () => {
  it('texto do dia a dia sem valor vira registro com resumo', async () => {
    const r = await classificar(
      input({ texto: 'hoje a equipe terminou o contrapiso da Garibaldi' }),
    );
    expect(r.kind).toBe('registro_obra');
    expect(r.extracted.obra_id).toBe('o-gari');
    expect(r.extracted.resumo).toBe('hoje a equipe terminou o contrapiso da Garibaldi');
  });

  it('saudação curta e pergunta continuam nao_identificado', async () => {
    expect((await classificar(input({ texto: 'bom dia' }))).kind).toBe('nao_identificado');
    expect((await classificar(input({ texto: 'boa tarde pessoal' }))).kind).toBe(
      'nao_identificado',
    );
    expect(
      (await classificar(input({ texto: 'alguém sabe se a areia chegou na obra?' }))).kind,
    ).toBe('nao_identificado');
  });

  it('texto com valor continua pagamento (nunca registro)', async () => {
    const r = await classificar(input({ texto: 'paguei 500 reais pro pedreiro hoje de manhã' }));
    expect(r.kind).toBe('pagamento_parcial');
  });
});
