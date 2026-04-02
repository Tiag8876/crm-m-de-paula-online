# CRM M de Paula Online

Esta pasta e a copia preservada da versao web/online do CRM, separada da aplicacao de computador.
A versao desktop original continua intacta em:
- `C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula`

## Arquitetura desta copia
- Frontend: `React + Vite`
- API: `Express` exportado para uso na Vercel em `api/index.mjs`
- Banco online: `Postgres` via `DATABASE_URL`
- Autenticacao: `JWT`
- Deploy alvo: `Vercel`

## O que foi adaptado
- Remocao da dependencia arquitetural do `Electron` para esta copia.
- Backend refeito para usar `Postgres` em vez de `SQLite` local.
- Endpoint Vercel criado em `api/index.mjs`.
- Arquivo `vercel.json` criado com rewrites para `SPA + API`.
- Arquivo `.env.example` criado com as variaveis necessarias.
- Tela `/connection` mantida para permitir override manual da API, se voce desejar usar outra URL.

## Variaveis de ambiente obrigatorias
Crie essas variaveis na Vercel Project Settings:

- `DATABASE_URL`
- `JWT_SECRET`

Variaveis opcionais:
- `VITE_API_BASE_URL`
- `API_PORT` para execucao local da API

## Rodar localmente
Instalar dependencias:
```bash
npm install
```

Rodar API local contra Postgres:
```bash
npm run dev:api
```

Rodar frontend:
```bash
npm run dev
```

## Estrutura importante
- `server/app.mjs`: backend online com Postgres
- `server/index.mjs`: bootstrap local da API
- `api/index.mjs`: entrada da API para a Vercel
- `vercel.json`: configuracao de deploy e rewrites
- `.env.example`: exemplo de configuracao de ambiente
- `docs/migracao-online-vercel.md`: estrategia e contexto da migracao

## Publicar na Vercel
1. Suba esta pasta `CRM M de Paula Online` para um repositorio Git.
2. Importe o repositorio na Vercel.
3. Configure `DATABASE_URL` e `JWT_SECRET`.
4. Execute o primeiro deploy.
5. Acesse `/setup` para criar o administrador inicial se o banco estiver vazio.

## Observacoes importantes
- O CRM continua usando `app_state.state_json` como transicao, agora persistido no Postgres.
- Isso ja permite operacao online persistente.
- A proxima melhoria recomendada e quebrar o estado monolitico em tabelas relacionais por entidade.

## Build
```bash
npm run build
```
