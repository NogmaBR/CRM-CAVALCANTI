/**
 * Supabase em memória para testes de serviço.
 *
 * Cobre o subconjunto do query builder que os serviços usam:
 * `from().select().eq().is().not().in().order().limit()` com terminais
 * `maybeSingle()`, `single()` e `await` direto; `insert()`, `update()` e
 * `delete()` com os mesmos filtros e `.select()` opcional. Joins embutidos
 * (`obras ( id, nome )`) não são resolvidos — o teste que precisar deles põe
 * o objeto já na linha.
 *
 * Índices únicos são declarados por tabela (`unicos`) e um INSERT que os
 * viola devolve erro `23505`, como o Postgres — é assim que se testa a
 * idempotência em camadas sem banco.
 */

export type Linha = Record<string, unknown>;

interface Filtro {
  tipo: 'eq' | 'neq' | 'is' | 'not_is' | 'in' | 'gte' | 'lte' | 'gt' | 'lt';
  coluna: string;
  valor: unknown;
}

interface Opcoes {
  unicos?: Record<string, string[][]>;
}

let seq = 0;
function novoId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

function passa(linha: Linha, f: Filtro): boolean {
  const v = linha[f.coluna];
  switch (f.tipo) {
    case 'eq':
      return v === f.valor;
    case 'neq':
      return v !== f.valor;
    case 'is':
      return f.valor === null ? v == null : v === f.valor;
    case 'not_is':
      return f.valor === null ? v != null : v !== f.valor;
    case 'in':
      return (f.valor as unknown[]).includes(v);
    case 'gte':
      return (v as number | string) >= (f.valor as number | string);
    case 'lte':
      return (v as number | string) <= (f.valor as number | string);
    case 'gt':
      return (v as number | string) > (f.valor as number | string);
    case 'lt':
      return (v as number | string) < (f.valor as number | string);
    default:
      return true;
  }
}

class Consulta implements PromiseLike<{ data: unknown; error: unknown }> {
  private filtros: Filtro[] = [];
  private ordem: { coluna: string; asc: boolean } | null = null;
  private teto: number | null = null;
  private operacao: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private carga: Linha | Linha[] | null = null;
  private devolveLinhas = true;

  constructor(
    private readonly db: FakeSupabase,
    private readonly tabela: string,
  ) {}

  select(_cols?: string) {
    if (this.operacao === 'select') this.devolveLinhas = true;
    else this.devolveLinhas = true;
    return this;
  }
  insert(carga: Linha | Linha[]) {
    this.operacao = 'insert';
    this.carga = carga;
    this.devolveLinhas = false;
    return this;
  }
  update(carga: Linha) {
    this.operacao = 'update';
    this.carga = carga;
    this.devolveLinhas = false;
    return this;
  }
  delete() {
    this.operacao = 'delete';
    this.devolveLinhas = false;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filtros.push({ tipo: 'eq', coluna: c, valor: v });
    return this;
  }
  neq(c: string, v: unknown) {
    this.filtros.push({ tipo: 'neq', coluna: c, valor: v });
    return this;
  }
  is(c: string, v: unknown) {
    this.filtros.push({ tipo: 'is', coluna: c, valor: v });
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op === 'is') this.filtros.push({ tipo: 'not_is', coluna: c, valor: v });
    return this;
  }
  in(c: string, v: unknown[]) {
    this.filtros.push({ tipo: 'in', coluna: c, valor: v });
    return this;
  }
  gte(c: string, v: unknown) {
    this.filtros.push({ tipo: 'gte', coluna: c, valor: v });
    return this;
  }
  lte(c: string, v: unknown) {
    this.filtros.push({ tipo: 'lte', coluna: c, valor: v });
    return this;
  }
  gt(c: string, v: unknown) {
    this.filtros.push({ tipo: 'gt', coluna: c, valor: v });
    return this;
  }
  lt(c: string, v: unknown) {
    this.filtros.push({ tipo: 'lt', coluna: c, valor: v });
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) {
    this.ordem = { coluna: c, asc: o?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.teto = n;
    return this;
  }

  private executar(): { data: Linha[]; error: { code?: string; message: string } | null } {
    const tabela = this.db.tabela(this.tabela);
    const casam = () => tabela.filter((l) => this.filtros.every((f) => passa(l, f)));

    if (this.operacao === 'insert') {
      const linhas = Array.isArray(this.carga) ? this.carga : [this.carga as Linha];
      const criadas: Linha[] = [];
      for (const l of linhas) {
        for (const chaves of this.db.unicos[this.tabela] ?? []) {
          const conflito = tabela.find(
            (e) => e.deleted_at == null && chaves.every((k) => e[k] != null && e[k] === l[k]),
          );
          if (conflito) {
            return {
              data: [],
              error: { code: '23505', message: `duplicate key (${chaves.join(',')})` },
            };
          }
        }
        const nova = { id: novoId(), created_at: new Date().toISOString(), ...l };
        tabela.push(nova);
        criadas.push(nova);
      }
      this.db.log.push({ op: 'insert', tabela: this.tabela, linhas: criadas });
      return { data: criadas, error: null };
    }

    if (this.operacao === 'update') {
      const alvo = casam();
      for (const l of alvo) Object.assign(l, this.carga);
      this.db.log.push({ op: 'update', tabela: this.tabela, linhas: alvo, patch: this.carga });
      return { data: alvo, error: null };
    }

    if (this.operacao === 'delete') {
      const alvo = casam();
      for (const l of alvo) tabela.splice(tabela.indexOf(l), 1);
      this.db.log.push({ op: 'delete', tabela: this.tabela, linhas: alvo });
      return { data: alvo, error: null };
    }

    let linhas = casam();
    if (this.ordem) {
      const { coluna, asc } = this.ordem;
      linhas = [...linhas].sort((a, b) => {
        const x = a[coluna] as string | number;
        const y = b[coluna] as string | number;
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    if (this.teto != null) linhas = linhas.slice(0, this.teto);
    return { data: linhas, error: null };
  }

  async maybeSingle() {
    const r = this.executar();
    return { data: r.data[0] ?? null, error: r.error };
  }
  async single() {
    const r = this.executar();
    if (r.error) return { data: null, error: r.error };
    const d = r.data[0];
    return d
      ? { data: d, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
  }
  then<T1 = unknown, T2 = never>(
    ok?: ((v: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>) | null,
    err?: ((e: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    const r = this.executar();
    const data = this.devolveLinhas || this.operacao === 'select' ? r.data : null;
    return Promise.resolve({ data, error: r.error }).then(ok ?? undefined, err ?? undefined);
  }
}

export interface RegistroLog {
  op: 'insert' | 'update' | 'delete';
  tabela: string;
  linhas: Linha[];
  patch?: Linha | Linha[] | null;
}

export class FakeSupabase {
  readonly tabelas: Record<string, Linha[]>;
  readonly unicos: Record<string, string[][]>;
  readonly log: RegistroLog[] = [];
  readonly rpcs: Record<string, (args: Linha) => unknown> = {};

  constructor(dados: Record<string, Linha[]> = {}, opts: Opcoes = {}) {
    this.tabelas = Object.fromEntries(
      Object.entries(dados).map(([k, v]) => [k, v.map((l) => ({ ...l }))]),
    );
    this.unicos = opts.unicos ?? {};
  }

  tabela(nome: string): Linha[] {
    if (!this.tabelas[nome]) this.tabelas[nome] = [];
    return this.tabelas[nome];
  }

  from(nome: string) {
    return new Consulta(this, nome);
  }

  async rpc(nome: string, args: Linha = {}) {
    const fn = this.rpcs[nome];
    if (!fn) return { data: null, error: { message: `rpc ${nome} não simulada` } };
    return { data: await fn(args), error: null };
  }

  /** Conveniência para asserts. */
  linhas(nome: string): Linha[] {
    return this.tabela(nome);
  }
}

export function fakeSupabase(dados: Record<string, Linha[]> = {}, opts: Opcoes = {}) {
  return new FakeSupabase(dados, opts);
}
