'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Foto que abre em tela cheia ao clicar. Um `<dialog>` nativo: fecha com Esc,
 * clique fora, ou o botão; sem biblioteca. O `src` é a rota do arquivo — o
 * navegador segue o 302 e a mesma imagem que está na página abre grande.
 */
export function ImagemComLightbox({
  src,
  alt,
  miniatura,
  className,
}: {
  /** Imagem em tamanho cheio. */
  src: string;
  alt: string;
  /** Opcional: o que aparece na página antes de abrir (miniatura ou a própria). */
  miniatura?: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);

  const abrir = useCallback(() => {
    setAberto(true);
    dialogRef.current?.showModal();
  }, []);
  const fechar = useCallback(() => {
    dialogRef.current?.close();
    setAberto(false);
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const aoFechar = () => setAberto(false);
    d.addEventListener('close', aoFechar);
    return () => d.removeEventListener('close', aoFechar);
  }, []);

  return (
    <>
      <button
        type="button"
        className={className ? `arq-imagem ${className}` : 'arq-imagem'}
        onClick={abrir}
        aria-label={`Ampliar ${alt}`}
      >
        <img src={miniatura ?? src} alt={alt} loading="lazy" decoding="async" />
      </button>
      <dialog
        ref={dialogRef}
        className="arq-lightbox"
        aria-label={alt}
        onClick={(e) => {
          // Clique no fundo (fora da imagem) fecha; na imagem, não.
          if (e.target === e.currentTarget) fechar();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') fechar();
        }}
      >
        <button type="button" className="arq-lightbox__fechar" onClick={fechar} aria-label="Fechar">
          ×
        </button>
        {aberto ? <img src={src} alt={alt} decoding="async" /> : null}
      </dialog>
    </>
  );
}
