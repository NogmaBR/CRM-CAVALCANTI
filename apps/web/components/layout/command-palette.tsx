'use client';

import { IconButton } from '@/components/nogma/IconButton';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  AlertCircle,
  Building2,
  FileBarChart,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Receipt,
  Search,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Paleta de comando (⌘K / Ctrl K).
 *
 * Duas fontes: atalhos fixos (ir para uma tela, criar algo) filtrados no
 * cliente, e resultados de `/api/busca` (obras, fornecedores, pagamentos)
 * quando há pelo menos 2 caracteres. A busca no servidor usa a sessão do
 * usuário, então a RLS continua valendo.
 */

interface Item {
  id: string;
  grupo: 'Ir para' | 'Criar' | 'Obras' | 'Fornecedores' | 'Pagamentos';
  label: string;
  meta?: string;
  href: string;
  icon: LucideIcon;
}

const ATALHOS: Item[] = [
  { id: 'nav-painel', grupo: 'Ir para', label: 'Painel', href: '/painel', icon: LayoutDashboard },
  { id: 'nav-obras', grupo: 'Ir para', label: 'Obras', href: '/obras', icon: Building2 },
  { id: 'nav-pag', grupo: 'Ir para', label: 'Pagamentos', href: '/pagamentos', icon: Receipt },
  { id: 'nav-docs', grupo: 'Ir para', label: 'Documentos', href: '/documentos', icon: FileText },
  { id: 'nav-wa', grupo: 'Ir para', label: 'WhatsApp', href: '/whatsapp', icon: MessageSquare },
  { id: 'nav-pend', grupo: 'Ir para', label: 'Pendentes', href: '/pendentes', icon: AlertCircle },
  { id: 'nav-forn', grupo: 'Ir para', label: 'Fornecedores', href: '/fornecedores', icon: Users },
  { id: 'nav-rel', grupo: 'Ir para', label: 'Relatórios', href: '/relatorios', icon: FileBarChart },
  { id: 'nav-cfg', grupo: 'Ir para', label: 'Configurações', href: '/config', icon: Settings },
  { id: 'new-obra', grupo: 'Criar', label: 'Nova obra', href: '/obras/novo', icon: Plus },
  { id: 'new-pag', grupo: 'Criar', label: 'Novo pagamento', href: '/pagamentos/novo', icon: Plus },
  { id: 'new-doc', grupo: 'Criar', label: 'Novo documento', href: '/documentos/novo', icon: Plus },
  {
    id: 'new-forn',
    grupo: 'Criar',
    label: 'Novo fornecedor',
    href: '/fornecedores/novo',
    icon: Plus,
  },
];

interface ResultadoBusca {
  obras: Array<{ id: string; nome: string; cliente: string | null }>;
  fornecedores: Array<{ id: string; nome: string; categoria: string | null }>;
  pagamentos: Array<{
    id: string;
    descricao: string | null;
    valor: number;
    data: string | null;
    obra: string | null;
  }>;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [remoto, setRemoto] = useState<ResultadoBusca | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl K abre; Esc fecha (o Radix cuida do Esc).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Busca remota com debounce; ignora respostas fora de ordem.
  useEffect(() => {
    if (!open) return;
    const termo = q.trim();
    if (termo.length < 2) {
      setRemoto(null);
      setCarregando(false);
      return;
    }
    const ctrl = new AbortController();
    setCarregando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        setRemoto((await res.json()) as ResultadoBusca);
        setAtivo(0);
      } catch {
        if (!ctrl.signal.aborted) setRemoto(null);
      } finally {
        if (!ctrl.signal.aborted) setCarregando(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const itens = useMemo<Item[]>(() => {
    const termo = normalizar(q);
    const fixos = termo
      ? ATALHOS.filter((a) => normalizar(a.label).includes(termo))
      : ATALHOS.filter((a) => a.grupo === 'Ir para');
    const dinamicos: Item[] = [];
    if (remoto) {
      for (const o of remoto.obras) {
        dinamicos.push({
          id: `obra-${o.id}`,
          grupo: 'Obras',
          label: o.nome,
          meta: o.cliente ?? undefined,
          href: `/obras/${o.id}`,
          icon: Building2,
        });
      }
      for (const f of remoto.fornecedores) {
        dinamicos.push({
          id: `forn-${f.id}`,
          grupo: 'Fornecedores',
          label: f.nome,
          meta: f.categoria ?? undefined,
          href: `/fornecedores/${f.id}`,
          icon: Truck,
        });
      }
      for (const p of remoto.pagamentos) {
        dinamicos.push({
          id: `pag-${p.id}`,
          grupo: 'Pagamentos',
          label: p.descricao?.trim() || p.obra || 'Pagamento',
          meta: `${formatBRL(p.valor)}${p.data ? ` · ${formatData(p.data)}` : ''}`,
          href: `/pagamentos/${p.id}`,
          icon: Receipt,
        });
      }
    }
    return [...dinamicos, ...fixos];
  }, [q, remoto]);

  const ir = useCallback(
    (href: string) => {
      setOpen(false);
      setQ('');
      router.push(href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, Math.max(itens.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = itens[ativo];
      if (item) {
        e.preventDefault();
        ir(item.href);
      }
    }
  }

  // Mantém o item ativo visível ao navegar com as setas.
  useEffect(() => {
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);

  const grupos = useMemo(() => {
    const ordem: Item['grupo'][] = ['Obras', 'Fornecedores', 'Pagamentos', 'Ir para', 'Criar'];
    return ordem
      .map((g) => ({ g, itens: itens.filter((i) => i.grupo === g) }))
      .filter((x) => x.itens.length > 0);
  }, [itens]);

  const termo = q.trim();
  const vazio = itens.length === 0 && !carregando;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQ('');
      }}
    >
      <Dialog.Trigger asChild>
        <IconButton
          label="Buscar (⌘K)"
          icon={<Search size={19} />}
          className="nos-search-trigger"
        />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="nos-cmdk-overlay" />
        <Dialog.Content
          className="nos-cmdk"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <VisuallyHidden>
            <Dialog.Title>Buscar e navegar</Dialog.Title>
          </VisuallyHidden>
          <div className="nos-cmdk__input">
            <Search size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setAtivo(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Buscar obra, fornecedor, pagamento ou ir para…"
              aria-label="Buscar"
              role="combobox"
              aria-expanded="true"
              aria-controls="nos-cmdk-lista"
              aria-activedescendant={itens[ativo] ? `cmdk-${itens[ativo].id}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd>esc</kbd>
          </div>
          <div
            className="nos-cmdk__list"
            id="nos-cmdk-lista"
            // biome-ignore lint/a11y/useSemanticElements: listbox de combobox; <select> não aceita grupos com ícone e meta
            role="listbox"
            tabIndex={-1}
            ref={listaRef}
          >
            {vazio ? (
              <div className="nos-cmdk__empty">
                {termo.length < 2 ? 'Digite para buscar.' : `Nada encontrado para “${termo}”.`}
              </div>
            ) : null}
            {carregando && itens.length === 0 ? (
              <div className="nos-cmdk__empty">Buscando…</div>
            ) : null}
            {grupos.map(({ g, itens: lista }) => (
              <div key={g}>
                <div className="nos-cmdk__group">{g}</div>
                {lista.map((item) => {
                  const idx = itens.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      id={`cmdk-${item.id}`}
                      data-idx={idx}
                      // biome-ignore lint/a11y/useSemanticElements: opção de combobox customizada
                      role="option"
                      aria-selected={idx === ativo}
                      className="nos-cmdk__item"
                      onMouseEnter={() => setAtivo(idx)}
                      onClick={() => ir(item.href)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span className="nos-cmdk__label">{item.label}</span>
                      {item.meta ? <span className="nos-cmdk__meta">{item.meta}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="nos-cmdk__foot">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navegar
            </span>
            <span>
              <kbd>↵</kbd> abrir
            </span>
            <span>
              <kbd>esc</kbd> fechar
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
