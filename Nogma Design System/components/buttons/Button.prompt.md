**Button** — Nogma's action control. Use the lime `primary` for the single most important action on a view; petroleum `solid` for a strong alternative; `secondary`/`ghost` for supporting actions.

```jsx
<Button variant="primary" size="lg" onClick={start}>Começar agora</Button>
<Button variant="secondary">Ver detalhes</Button>
<Button variant="ghost" size="sm">Cancelar</Button>
```

Variants: `primary` (lime, glows on hover), `solid` (petroleum), `secondary` (outline), `ghost`, `danger`. Sizes: `sm` 36 · `md` 44 · `lg` 52. Props: `block`, `leadingIcon`, `trailingIcon`, `as`, plus native button attrs. On petroleum surfaces wrap in `.on-dark` so outline/ghost text flips to white.
