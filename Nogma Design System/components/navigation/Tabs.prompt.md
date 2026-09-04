**Tabs** — section switcher. `line` (underline) for page-level nav, `pill` (segmented) for compact filters.

```jsx
<Tabs variant="line" defaultValue="ativos" onChange={setTab}
  items={[
    {value:"ativos", label:"Ativos", count:12},
    {value:"pausados", label:"Pausados", count:3},
    {value:"todos", label:"Todos"},
  ]} />

<Tabs variant="pill" items={[{value:"mes",label:"Mês"},{value:"ano",label:"Ano"}]} />
```

Controlled (`value`+`onChange`) or uncontrolled (`defaultValue`). Active indicator is petroleum.
