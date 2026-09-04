**IconButton** — icon-only action (toolbars, cards, nav). Always give an accessible `label`.

```jsx
<IconButton icon={<i data-lucide="settings" />} label="Configurações" variant="ghost" />
<IconButton icon={<i data-lucide="plus" />} label="Novo" variant="primary" round />
```

Variants: `ghost`, `outline`, `primary` (lime), `solid` (petroleum). Sizes match Button (`sm`/`md`/`lg`, min 44px hit target at md). `round` for circular.
