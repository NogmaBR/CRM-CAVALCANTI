'use client';
import { TAMANHOS, type TamanhoDoTexto as Tamanho } from '@/lib/texto';
import { useState } from 'react';
import './tamanho-do-texto.css';

const ROTULO: Record<Tamanho, string> = {
  normal: 'A',
  grande: 'A+',
  maior: 'A++',
};

const DESCRICAO: Record<Tamanho, string> = {
  normal: 'Texto normal',
  grande: 'Texto grande',
  maior: 'Texto maior ainda',
};

/**
 * Três botões, um sempre marcado. Aplica na hora (`data-texto` no <html>) e
 * grava o cookie pela rota — o próximo carregamento já vem do servidor no
 * tamanho certo.
 */
export function TamanhoDoTexto({ initial = 'normal' }: { initial?: Tamanho }) {
  const [atual, setAtual] = useState<Tamanho>(initial);

  async function escolher(t: Tamanho) {
    if (t === 'normal') document.documentElement.removeAttribute('data-texto');
    else document.documentElement.setAttribute('data-texto', t);
    setAtual(t);
    await fetch('/api/texto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tamanho: t }),
    });
  }

  return (
    <fieldset className="texto-tamanho">
      <legend className="sr-only">Tamanho do texto</legend>
      {TAMANHOS.map((t) => (
        <button
          key={t}
          type="button"
          className={`texto-tamanho__botao texto-tamanho__botao--${t}`}
          aria-pressed={atual === t}
          aria-label={DESCRICAO[t]}
          title={DESCRICAO[t]}
          onClick={() => escolher(t)}
        >
          {ROTULO[t]}
        </button>
      ))}
    </fieldset>
  );
}
