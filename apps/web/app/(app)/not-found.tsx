import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <main id="main-content" style={{ maxWidth: 560, margin: '10vh auto', padding: 24 }}>
      <h1 style={{ fontSize: '1.25rem' }}>Página não encontrada</h1>
      <p>O que você procurava não existe ou foi arquivado.</p>
      <Link href="/painel" className="nos-btn">
        Voltar ao painel
      </Link>
    </main>
  );
}
