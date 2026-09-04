**Data display** — Card, Badge, Tag, Avatar, Stat.

```jsx
<Card title="Automação de faturas" subtitle="Ativa desde março" interactive accent>
  <p>142 documentos processados esta semana.</p>
</Card>

<Badge variant="solid-lime" dot>Ativo</Badge>
<Badge variant="success">Concluído</Badge>
<Badge variant="outline">Rascunho</Badge>

<Tag onRemove={() => remove(id)}>Financeiro</Tag>
<Avatar name="Ana Prado" status="online" />
<Stat label="Horas economizadas / mês" value="128h" delta="+18%" caption="vs. trimestre anterior" />
```

Card: `interactive` (hover lift), `flat`, `accent` (lime top border). Stat values render in the Agency display face. Badge variants cover neutral/petroleum/lime/solid/status. Avatar falls back to initials on petroleum with lime text.
