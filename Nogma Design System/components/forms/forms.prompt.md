**Forms** — Nogma text and choice inputs. All share the label / hint / error chrome and a 44px control height.

```jsx
<Input label="E-mail" type="email" placeholder="voce@empresa.com" hint="Usamos só para login." />
<Input label="Valor" leading="R$" error="Campo obrigatório" />
<Textarea label="Descreva o processo" rows={4} />
<Select label="Setor" options={["Financeiro","Operações","Vendas"]} />
<Checkbox label="Aceito os termos" description="Você pode cancelar quando quiser." />
<Switch label="Notificações" tone="lime" defaultChecked />
<RadioGroup name="plano" value={v} onChange={setV}
  options={[{value:"start",label:"Start"},{value:"pro",label:"Pro"}]} />
```

Focus rings use the petroleum `--ring`. Checked states fill lime (Checkbox) or petroleum (Switch/Radio). Pass `error` to any field to show the danger state.
