# Runbook — Backup do banco e restore de teste

> Escrito em **2026-09-10** (Fase 5.0). O que existe, como pegar, como
> restaurar, e como **provar** que restaura — que é a única parte que importa.

---

## O que existe hoje

| Camada | O que é | Quem faz | Onde |
|---|---|---|---|
| **Supabase (interno)** | Backup diário do plano gratuito | Supabase | Painel → Database → Backups. **Não verificado**: a API diz `pitr_enabled: false` e lista 0 backups |
| **GitHub Actions (externo)** | `pg_dump` semanal, cifrado com AES-256 | `.github/workflows/backup-banco.yml` | Artifacts do workflow, 90 dias |

O segundo existe porque backup no mesmo fornecedor do banco protege contra
erro humano, não contra perda do fornecedor. E porque o primeiro ninguém
conseguiu conferir.

### O que o dump externo cobre

- `public` — **todo o dado do cliente**: obras, fornecedores, pagamentos,
  documentos (metadados), mensagens, automações, base de conhecimento
- `auth` — usuários do painel (melhor esforço; se o pooler negar, o backup
  segue sem ele)
- `storage` — metadados dos arquivos (melhor esforço)

### O que NÃO cobre

- **Os arquivos no bucket** (fotos de nota, PDFs). O dump guarda o caminho,
  não os bytes. Os bytes ficam no Storage do Supabase, sem cópia externa —
  ver "O que ainda falta" no fim.
- `pgmq` (jobs em voo), `vault` (segredos), `cron` (recriado pelas migrations)

---

## Rodar um backup agora

```bash
gh workflow run backup-banco.yml
gh run watch
```

Ou pelo navegador: <https://github.com/NogmaBR/CRM-CAVALCANTI/actions/workflows/backup-banco.yml>
→ **Run workflow**.

O resumo da execução mostra as contagens do momento (obras, pagamentos,
soma em R$). **Anote-as**: é contra elas que o restore se confere.

---

## Baixar e decifrar

1. Abra a execução em Actions → **Artifacts** → baixe o `.tar.gz.enc`
   (ou `gh run download <run-id>`)
2. A frase está em `.env.local`, variável `BACKUP_PASSPHRASE`. **Não está em
   lugar nenhum versionado.** Quem perder o `.env.local` e o secret do GitHub
   perde o acesso a todos os backups — guarde a frase também no gerenciador
   de senhas da Nogma.

```bash
# Decifrar e extrair (gera dump/public.dump, dump/auth-storage.dump, dump/contagens.txt)
node --env-file=.env.local -e "process.stdout.write(process.env.BACKUP_PASSPHRASE)" > /tmp/frase
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:/tmp/frase \
  -in crm-cavalcanti-YYYYMMDD-HHMM.tar.gz.enc | tar xzf - -C dump/
rm /tmp/frase
cat dump/contagens.txt
```

> Não existe `pg_restore` nesta máquina (nem `psql`). Instale o cliente do
> PostgreSQL 17 — <https://www.postgresql.org/download/windows/>, marcando só
> "Command Line Tools" — ou faça o restore de dentro de um container:
> `docker run --rm -it -v "$PWD/dump:/dump" postgres:17 bash`.

---

## Restore de teste — o que prova que o backup serve

**Nunca em produção.** Num projeto descartável.

### 1. Crie um projeto vazio no Supabase

<https://supabase.com/dashboard/new> → qualquer nome (`crm-restore-teste`),
região `sa-east-1`, senha gerada. Free tier permite 2 projetos.

### 2. Aplique as migrations nele

O dump é de **dados**, com `--no-owner --no-privileges`. As extensões
(`pgvector`, `pgmq`, `pg_cron`, `pg_net`), os tipos e as funções vêm das
migrations, não do dump.

```bash
# Aponte para o projeto novo (ref e token dele) e aplique tudo em ordem
for f in supabase/migrations/*.sql; do
  SUPABASE_PROJECT_REF=<ref-do-teste> node --env-file=.env.local scripts/apply-migration.mjs "$(basename "$f")"
done
```

### 3. Restaure os dados

Use a string do pooler em **modo sessão** do projeto de teste (Settings →
Database → Connection string → Session pooler).

```bash
pg_restore --dbname="<url-sessao-do-teste>" \
  --no-owner --no-privileges --data-only --disable-triggers \
  --schema=public dump/public.dump
```

`--data-only` porque o schema já veio das migrations. `--disable-triggers`
porque a ordem das tabelas no dump não respeita as FKs de triggers de
auditoria.

### 4. Confira as contagens

No SQL Editor do projeto de teste:

```sql
SELECT 'obras', count(*) FROM obras WHERE deleted_at IS NULL
UNION ALL SELECT 'fornecedores', count(*) FROM fornecedores WHERE deleted_at IS NULL
UNION ALL SELECT 'pagamentos', count(*) FROM pagamentos WHERE deleted_at IS NULL
UNION ALL SELECT 'pagamentos_total_brl', sum(valor) FROM pagamentos WHERE deleted_at IS NULL;
```

**Tem que bater com `dump/contagens.txt`, linha a linha.** Em 2026-09-10 a
produção tinha 10 obras, 8 fornecedores, 80 pagamentos, R$ 453.500,00.

### 5. Apague o projeto de teste

Settings → General → Delete project. Ele tem dado real do cliente.

### 6. Registre

Anote aqui embaixo a data e o resultado. Backup sem restore registrado não
conta.

| Data | Artifact | Contagens bateram? | Quem |
|---|---|---|---|
| — | — | — | — |

---

## Se o workflow falhar

| Sintoma | Causa provável |
|---|---|
| `Segredo(s) ausente(s)` | `BACKUP_DB_URL` ou `BACKUP_PASSPHRASE` sumiram dos secrets do repositório |
| `usa a porta 6543` | A URL é do modo transação. `pg_dump` exige sessão: porta 5432 |
| `password authentication failed` | Senha do banco foi rotacionada e o secret não. Regrave o `BACKUP_DB_URL` |
| `could not connect` / timeout | Network restrictions do Supabase bloqueando os IPs do GitHub. Hoje está `0.0.0.0/0` |
| `O dump tem só N tabelas` | Conectou num banco vazio, ou o usuário não enxerga `public` |

Falha de workflow agendado manda e-mail para quem fez o último commit na
`main`. Se ninguém receber, é porque as notificações do GitHub estão
desligadas na conta.

---

## O que ainda falta (e é ação humana)

1. **Ligar o PITR no Supabase**, se o plano permitir — é o único que
   restaura para "5 minutos antes do erro"
2. **Um restore de teste feito e registrado na tabela acima.** Enquanto a
   tabela estiver vazia, o backup é uma hipótese
3. **Cópia dos arquivos do bucket** — o dump não cobre. Opção mais simples:
   `supabase storage` via CLI num segundo workflow, ou rsync do bucket para
   um S3. Vale decidir quando houver volume; hoje o bucket tem poucos
   arquivos
4. **Guardar a `BACKUP_PASSPHRASE` no gerenciador de senhas.** Hoje ela
   existe em dois lugares (`.env.local` desta máquina e o secret do GitHub),
   e o secret não pode ser lido de volta
