export default function Page() {
  return (
    <main style={{ padding: 48 }}>
      <p className="eyebrow">Nogma Design System</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-5xl)' }}>
        Gestor de <span className="mark-lime">Obras</span>
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>
        Se o heading está em lime sobre fundo preto e a palavra "Obras" tem highlight lime, os tokens carregaram OK.
      </p>
    </main>
  );
}
