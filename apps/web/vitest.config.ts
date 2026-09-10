import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest — testes unitários das funções puras (schemas, validação, utils,
 * relatórios, classificador mock).
 *
 * Dois pontos que precisam de config explícita:
 *
 * 1. `exclude` de `e2e/**` — aqueles são specs do Playwright (`test`, `expect`
 *    e fixtures do @playwright/test). Sem esta exclusão o vitest tenta rodá-los
 *    com o runner errado e quebra em todos.
 *
 * 2. alias de `server-only` — vários módulos de `lib/` importam `server-only`
 *    como guarda do Next (falha o build se o módulo vazar pro client). Fora do
 *    bundler do Next esse import não resolve, então apontamos pra um stub vazio.
 *    O guard continua valendo em build de produção; aqui ele só não atrapalha.
 */
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx', 'app/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/supabase/**', 'lib/data/**'],
    },
  },
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
