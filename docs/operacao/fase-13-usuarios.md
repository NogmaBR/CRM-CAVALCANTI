# Fase 13 — Gestão de Usuários + Convites

Estado: **shipada em prod**. Admin gerencia equipe em `/config/usuarios`,
convida novos membros por email, altera papéis, arquiva.

## Fluxo de convite

```
1. Admin acessa /config/usuarios/convidar
   → Fill email + nome + papel
   → Server action `convidarUsuario` valida admin + Zod
   → Chama Supabase admin.inviteUserByEmail(email, {
        data: { nome, papel },
        redirectTo: `${APP_URL}/definir-senha`
      })

2. Supabase Auth cria auth.user (email_confirmed_at=null)
   → Trigger `handle_new_user()` cria profile com papel do metadata

3. Supabase envia email default com link:
   https://<project>.supabase.co/auth/v1/verify?token=X&type=invite
     &redirect_to=https://crm-cavalcanti.vercel.app/definir-senha

4. Usuário clica no email
   → Supabase confirma email + gera code PKCE
   → Redireciona pra /definir-senha?code=XXX

5. /definir-senha page (server component):
   → supabase.auth.exchangeCodeForSession(code) — troca por session
   → Renderiza form "Nova senha + confirmar"

6. User submete form → definirSenha action
   → Zod valida (min 8, iguais)
   → supabase.auth.updateUser({ password })
   → Redirect /painel
```

## Papéis (RLS enforced)

| Papel | Descrição | RLS |
|---|---|---|
| `admin` | Acesso total, gerencia usuários e configurações | `has_role(['admin'])` em profiles ALL, audit_log SELECT, etc |
| `gestor` | Cria/edita obras, pagamentos, aprovações | SELECT/INSERT/UPDATE em obras/pagamentos/documentos |
| `financeiro` | Visualiza + edita pagamentos e documentos | Idem gestor mas mais restrito |
| `leitura` | Apenas visualização | Only SELECT em business tables |

Papel é enum Postgres `papel_usuario`. Muda via UI `/config/usuarios/{id}/editar`
(só admin). Trigger de auditoria (Fase 11) NÃO captura profile changes hoje
— se quiser auditar mudanças de papel, adicione trigger em migration futura.

## Middleware

`/definir-senha` está no whitelist `isAuthRoute` — usuário sem session
(recém convidado) consegue acessar. Page faz code exchange + validação
própria.

## Server actions

Em `apps/web/app/(app)/config/usuarios/actions.ts`:

- **`convidarUsuario(fd)`** — email + nome + papel → invite
- **`reenviarConvite(fd)`** — user_id → resend invite
- **`alterarPapelUsuario(fd)`** — user_id + papel → update (self-edit block)
- **`arquivarUsuario(fd)`** — user_id → soft-delete + signOut sessions
- **`restaurarUsuario(fd)`** — user_id → deleted_at=null

Todos validam admin via `createClient().auth.getUser()` +
`profiles.papel='admin'` check antes de proceder.

## Estados visuais

Cada linha na lista `/config/usuarios` mostra badge de status:

| Status | Critério | Ações disponíveis |
|---|---|---|
| Ativo | email_confirmed + last_sign_in | Editar papel, Arquivar |
| Convite pendente | ainda não confirmou email OU nunca logou | Reenviar, Cancelar |
| Arquivado | deleted_at != null | Restaurar |

Filter tabs: Ativos / Pendentes / Arquivados.

## Segurança

- **Admin check em pages**: `notFound()` (não redirect) → previne
  information leakage (não-admin vê 404, não "acesso negado")
- **Admin check em actions**: defensive mesmo com RLS ativa em profiles
  (`profiles_admin_all`) — quiser flexibilidade de RLS futura sem
  quebrar UI
- **Self-edit guard**: admin não pode alterar próprio papel nem arquivar
  a si mesmo (verificado em page + action, defense in depth)
- **Password strength**: min 8 chars validado no form E via server action;
  Supabase Auth também tem policies configuráveis no dashboard (mínimo,
  complexidade)
- **Invite links**: single-use PKCE code, expira em 24h por padrão
  (config Supabase). Se expirar, admin re-envia.
- **Archived users**: `signOut(userId)` revoga sessions ativas — user
  deslogado imediatamente. Se tentar logar, RLS não bloqueia (ainda pode
  logar), mas `/painel` deve mostrar mensagem "conta arquivada" (não
  implementado — Fase 13.x)

## Templates de email

Convite usa **template default do Supabase**. Personalização:

1. **Dashboard Supabase** → Auth → Email Templates → "Invite user"
2. Ou via **Management API**:
   ```
   PATCH /v1/projects/{ref}/config/auth
   body: { mailer_subjects_invite: '...', mailer_templates_invite_content: '...' }
   ```

Template usa variáveis: `{{ .Email }}`, `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`.

Alternativa (não implementada): usar Fase 10 `sendBoasVindasEmail`
disparando junto do invite (email dupla — Supabase default + nosso branded).

## Extensões futuras (Fase 13.x)

- **Audit trigger em profiles**: capturar quando papel muda (crítico —
  elevação de privilégio). Adicionar trigger na migration usando padrão
  Fase 11.
- **Bulk invite**: form CSV upload → cria N convites de uma vez
- **Personalizar template invite**: via Management API com HTML Nogma
- **Suspender temporariamente**: separado de arquivar (soft-delete
  reversível vs. suspensão temporária com data de reativação)
- **2FA obrigatório**: forçar `mfa_enabled` no auth.user pra admin
  (Fase 7.5 recomendou MFA — pending)
- **Login history viewer**: página `/config/usuarios/{id}/atividade`
  mostrando ip/user_agent/timestamp dos logins recentes
- **Convite expirado retry**: cron que detecta convites > 20h sem
  aceite e envia email de alerta pra admin
- **Sidebar condicional**: item "Usuários" só aparece pra admin
  (hoje entrada `/config` genérica cobre pra todos os papéis; alterar
  em sidebar-nav.tsx com filter por current user papel)

## Testar

Autenticado como admin:
1. Ir em `/config/usuarios` — vê apenas você (admin)
2. Clicar "Convidar" — form em `/config/usuarios/convidar`
3. Preencher email (não use seu próprio), nome, papel="gestor"
4. Submit — success banner
5. Verificar em `notificacoes_email` que Supabase enviou (email chega
   se domínio nogmacorp.com.br verificado; senão fica em spam)
6. Abrir email num navegador anônimo, clicar link
7. Deve cair em `/definir-senha` com form
8. Definir senha, submeter
9. Deve chegar em `/painel` como gestor
10. Voltar como admin em `/config/usuarios` → novo user aparece "ativo"
11. Editar papel do novo user → funciona
12. Arquivar → status muda pra arquivado

## Troubleshooting

**"Não pode editar seu próprio papel"** ao clicar Editar em si mesmo:
comportamento correto — self-elevation blocked.

**Convite não chega no email**: 
- Verificar spam
- Dashboard Supabase → Auth → Logs → filtrar por "invite" — deve ver
  registro do send
- Se domínio custom não verificado, Supabase manda de
  `noreply@mail.app.supabase.io` (spam alto)

**"Link expirado"** em /definir-senha:
- Supabase invite tem 24h TTL por default
- Admin re-envia via `/config/usuarios` → ação Reenviar

**Usuário arquivado ainda consegue logar**:
- Session ativa foi revogada mas ele pode logar de novo
- Não implementamos check em `/painel` — soft-delete é apenas UI hiding
- Fase 13.x: adicionar RLS `USING (deleted_at IS NULL OR is_admin())`
  em todas as tables OU middleware que redireciona archived → /login
  com msg
