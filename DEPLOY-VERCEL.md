# Deploy na Vercel

## O que ja esta pronto

- frontend Vite configurado
- API Express exportada para `api/index.mjs`
- `vercel.json` com rewrite de `SPA` e `/api`
- backend preparado para `Postgres` via `DATABASE_URL`
- scripts de deploy em `package.json`

## O que ainda precisa existir fora do codigo

Antes do primeiro deploy, voce ainda precisa criar ou conectar:

1. um repositorio remoto GitHub/GitLab/Bitbucket para esta pasta
2. um projeto na Vercel apontando para esse repositorio
3. um banco `Postgres`
4. as variaveis:
   - `DATABASE_URL`
   - `JWT_SECRET`

## Comandos uteis

Instalar dependencias:

```bash
npm install
```

Login na Vercel:

```bash
npx vercel login
```

Primeiro deploy de preview:

```bash
npm run vercel:preview
```

Deploy de producao:

```bash
npm run vercel:prod
```

## Sobre o banco de dados

O codigo ja esta preparado para gravar:

- administrador inicial
- usuarios
- leads
- campanhas
- configuracoes
- auditoria
- estado geral do CRM

Mas isso so acontece depois que `DATABASE_URL` apontar para um Postgres real.

Sem essa variavel, o sistema responde que o banco nao esta configurado.
