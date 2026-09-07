# Fase 14 — Preferências de Usuário

Estado: **shipada em prod**. Cada usuário edita próprio perfil em
`/config/perfil` — nome, telefone, tema, timezone, opt-in de emails.

## Fluxo

```
1. Usuário (qualquer papel) acessa /config/perfil
2. getMyProfile() traz profile + email do auth.user + parsed_email_prefs
3. Form com 4 fieldsets:
   - Informações (nome, telefone, email readonly, papel readonly)
   - Aparência (tema radio-cards: light/black/dark)
   - Fuso horário (select IANA)
   - Notificações (3 checkboxes opt-in)
4. Submit → salvarPerfil action:
   - Zod PerfilUpdateSchema valida (nome min 2, phone digits-only, timezone whitelist)
   - UPDATE profiles WHERE user_id = auth.uid()
   - RLS profiles_self_update permite (mas bloqueia papel change via WITH CHECK)
5. revalidatePath('/config/perfil' + '/config/usuarios' pra refletir nome no admin)
6. redirect com ?success=Preferências salvas
```

## Migration 20260907180000

- ADD `email_prefs JSONB NOT NULL DEFAULT` (3 booleans: pagamentos_aguardando, pendencias_novas, digest_semanal — todos true por default exceto digest)
- ADD `timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'`
- CHECK constraint `char_length(timezone) > 0`

## Impacto em Fase 10 (email service)

`getRecipientsByPapel(papeis, prefKey?)` agora aceita segundo argumento
opcional. Quando informado, filtra recipients cujo
`email_prefs[prefKey] === true`. Adicionalmente, exclui `deleted_at != null`
(usuários arquivados na Fase 13 não recebem nada).

Wired em `send-email.tsx`:
- `sendPagamentoAguardandoEmail` → passa `'pagamentos_aguardando'`
- `sendPendenciaNovaEmail` → passa `'pendencias_novas'`
- `sendBoasVindasEmail` → sem prefKey (email de onboarding sempre envia)

**Efeito prático:** se admin desmarcar "Novo pagamento aguardando" no
próprio perfil, ele para de receber esses emails imediatamente.

## Radio-cards pattern (tema)

Padrão HTML puro sem JS via `input[type='radio']` hidden + CSS `:has()`.
Clique em qualquer área do card seleciona. 3 cards side-by-side com
preview de cor (branco / preto / petroleum).

## Checkbox unchecked handling

Checkbox HTML NÃO envia key no FormData quando desmarcado. Solução no
action:
```ts
const email_prefs = {
  pagamentos_aguardando: formData.get('email_prefs.pagamentos_aguardando') === 'on',
  pendencias_novas: formData.get('email_prefs.pendencias_novas') === 'on',
  digest_semanal: formData.get('email_prefs.digest_semanal') === 'on',
};
```
Todos os 3 keys sempre defined (true/false), Zod valida, UPDATE seta
JSONB completo.

## Sidebar

Adicionada entrada "Meu perfil" com ícone `User` em `SECONDARY` do
sidebar-nav, antes de "Configurações".

## Extensões futuras (Fase 14.x)

- **Theme provider client-side**: hoje o tema salvo não é aplicado
  automaticamente na próxima session — usuário precisa reload.
  Provider que lê profile.tema_preferido no mount + `document.documentElement.setAttribute`.
- **Wire timezone em emails/PDFs**: hoje timezone é armazenado mas
  não usado nas datas server-side. Passar `viewerTimezone` prop pros
  templates + usar em `toLocaleString({timeZone})`.
- **Digest semanal**: cron sábado 09:00 → email consolidado só pra
  users com `email_prefs.digest_semanal === true`.
- **Avatar upload**: Supabase Storage bucket avatars + form upload +
  URL em `profile.avatar_url`. Substitui iniciais no sidebar/topbar.
- **Locale (pt-BR/en/es)**: requer i18n framework — deferido, mercado
  é BR.
- **Quiet hours**: não notificar entre 22h-07h.
- **Notificação teste**: botão "Enviar teste" pra confirmar delivery.

## Segurança

- RLS `profiles_self_update` com WITH CHECK — user não promove a si
- Zod valida telefone (10-13 dígitos ou vazio) — previne injection
- Timezone whitelist (não input livre)
- Email prefs sempre validados por schema, defaults seguros

## Rollback

```sql
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_timezone_not_empty,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS email_prefs;
```
