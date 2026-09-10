// Stub vazio pro alias de `server-only` no vitest (ver vitest.config.ts).
// Em produção o módulo real do Next continua ativo — este arquivo só existe
// pra que os testes unitários consigam importar módulos de `lib/` que usam
// a guarda `import 'server-only'`.
export {};
