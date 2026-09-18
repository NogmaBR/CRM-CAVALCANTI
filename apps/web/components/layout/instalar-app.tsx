'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import './instalar-app.css';

/**
 * PM5 — o convite para instalar o CRM na tela inicial do celular.
 *
 * Android/Chrome: o navegador dispara `beforeinstallprompt`; guardamos o
 * evento e o botão chama `prompt()`. iOS não tem esse evento — mostramos a
 * instrução (Compartilhar → Adicionar à Tela de Início) uma vez. Já
 * instalado (`display-mode: standalone`) não aparece. "Agora não" some por
 * 30 dias (localStorage; falha em privado é ignorada).
 */
const CHAVE = 'nogma-instalar-app-adiado';
const DIAS = 30;

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function adiado(): boolean {
  try {
    const v = localStorage.getItem(CHAVE);
    return !!v && Date.now() - Number(v) < DIAS * 86_400_000;
  } catch {
    return false;
  }
}

function adiar() {
  try {
    localStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    /* privado */
  }
}

export function InstalarApp() {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [ios, setIos] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const instalado =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (instalado || adiado()) return;

    const ehIos = /iphone|ipad|ipod/iu.test(navigator.userAgent);
    const ehMobile = ehIos || /android/iu.test(navigator.userAgent);
    if (!ehMobile) return;

    if (ehIos) {
      setIos(true);
      setVisivel(true);
      return;
    }
    const ouvir = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoDeInstalacao);
      setVisivel(true);
    };
    window.addEventListener('beforeinstallprompt', ouvir);
    return () => window.removeEventListener('beforeinstallprompt', ouvir);
  }, []);

  if (!visivel) return null;

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'accepted') setVisivel(false);
  }

  function fechar() {
    adiar();
    setVisivel(false);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: banner de status (padrão do projeto)
    <div className="instalar-app" role="status">
      <Download size={18} aria-hidden="true" className="instalar-app__icone" />
      <div className="instalar-app__texto">
        <strong>Coloque o CRM na tela inicial</strong>
        {ios ? (
          <span>
            Toque em <em>Compartilhar</em> e depois em <em>Adicionar à Tela de Início</em>.
          </span>
        ) : (
          <span>Abre em tela cheia, como um aplicativo, direto no painel.</span>
        )}
      </div>
      {!ios ? (
        <button type="button" className="instalar-app__botao" onClick={instalar}>
          Instalar
        </button>
      ) : null}
      <button
        type="button"
        className="instalar-app__fechar"
        onClick={fechar}
        aria-label="Agora não"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
