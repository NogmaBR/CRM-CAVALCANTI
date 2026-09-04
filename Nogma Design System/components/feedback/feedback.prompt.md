**Feedback** — Alert, Progress, Tooltip, Dialog.

```jsx
<Alert variant="success" title="Automação ativada">
  O fluxo começa a rodar no próximo ciclo.
</Alert>

<Progress value={72} label="Migração de dados" showValue />
<Progress value={40} tone="lime" />

<Tooltip label="Copiar link"><IconButton icon={...} label="Copiar" /></Tooltip>

<Dialog open={open} onClose={close} title="Excluir automação?"
  description="Esta ação não pode ser desfeita."
  footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
             <Button variant="danger" onClick={confirm}>Excluir</Button></>} />
```

Alert variants map to the semantic status colors. Progress defaults to petroleum fill; `tone="lime"` for accent. Dialog is controlled and closes on Escape / overlay click.
