# Migracao Online com Vercel

## Resumo executivo

Hoje o CRM funciona como um aplicativo desktop/web local:

- frontend em `React + Vite`
- backend em `Express`
- banco local em `SQLite` com `better-sqlite3`
- sincronizacao do CRM salva em um unico JSON dentro da tabela `app_state`

Para tornar o sistema realmente online, multiusuario e seguro em producao, a solucao recomendada e:

1. publicar o frontend na Vercel
2. hospedar a API em ambiente web/serverless
3. migrar o banco de `SQLite` para `Postgres`
4. migrar anexos e documentos para storage de objetos
5. endurecer autenticacao, auditoria e backups

## O que existe hoje no projeto

### Frontend

- O frontend consome a API centralmente por [src/lib/api.ts](C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula\src\lib\api.ts).
- A URL da API era fixa em `127.0.0.1:3001` em [src/lib/apiConfig.ts](C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula\src\lib\apiConfig.ts).
- O sincronismo inteiro do CRM e feito em [src/components/StateSyncProvider.tsx](C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula\src\components\StateSyncProvider.tsx).

### Backend

- A API fica em [server/index.mjs](C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula\server\index.mjs).
- O banco e aberto com `better-sqlite3`.
- O estado principal do CRM e salvo em `app_state.state_json`, em vez de entidades relacionais completas.

### Desktop

- O app Electron sobe a API local e aponta o frontend para `http://127.0.0.1:3001` em [electron/main.mjs](C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula\electron\main.mjs).

## Principal bloqueio para ficar 100% online

O problema nao e o React. O principal bloqueio e o modelo de persistencia.

Hoje:

- o backend salva quase todo o CRM em um unico JSON
- esse JSON fica dentro de um banco SQLite local
- o Electron assume que a API esta no proprio computador do usuario

Isso funciona localmente, mas nao e a melhor base para producao web porque:

- SQLite local nao entrega multiusuario real distribuido
- o JSON unico em `app_state` dificulta concorrencia, filtros, relatorios e auditoria fina
- documentos e anexos ainda nao estao preparados para storage online dedicado

## Arquitetura recomendada

### Opcao recomendada

- Frontend: `Vite` publicado na `Vercel`
- API: `Express` adaptado para ambiente web/serverless
- Banco: `Postgres` hospedado online
- Arquivos: `Vercel Blob`, `S3` ou equivalente
- Autenticacao: JWT com `JWT_SECRET` forte, com opcao futura de refresh token/cookies

### Banco recomendado

`Postgres` e a melhor opcao aqui porque resolve:

- multiusuario real
- consultas e filtros mais eficientes
- trilha de auditoria melhor
- evolucao para dashboards e relatorios
- possibilidade de normalizar leads, tarefas, follow-ups, usuarios, campanhas e logs

## Estrategia de migracao por fases

### Fase 1

Objetivo: colocar o frontend online sem quebrar o fluxo atual.

- manter o frontend em React/Vite
- permitir configurar a API remota
- separar o conceito de `API local` e `API online`

Status:

- concluido nesta rodada
- a tela [src/pages/ConnectionPage.tsx](C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula\src\pages\ConnectionPage.tsx) agora testa e salva uma API remota
- [src/lib/apiConfig.ts](C:\Users\rober\Downloads\friendly-case-keeper-main - Copia\CRM M de Paula\src\lib\apiConfig.ts) deixou de ser fixo em localhost

### Fase 2

Objetivo: subir a API em ambiente online.

- expor a API em dominio HTTPS
- configurar variaveis de ambiente
- validar CORS, JWT e logs

Observacao:

- a documentacao oficial do Vercel confirma deploy de apps Express e uso de Vercel Functions
- a documentacao oficial tambem reforca o uso de environment variables no projeto

### Fase 3

Objetivo: migrar persistencia para banco duravel.

Migrar estas estruturas para tabelas relacionais reais:

- `users`
- `audit_logs`
- `leads`
- `lead_notes`
- `lead_followups`
- `lead_tasks`
- `lead_documents`
- `campaigns`
- `ad_groups`
- `ads`
- `areas_of_law`
- `services`
- `standard_tasks`
- `kanban_stages`
- `prospect_leads`
- `prospect_followups`
- `prospect_tasks`
- `prospect_kanban_stages`
- `weekly_snapshots`
- `notifications`

O campo `app_state.state_json` deve virar apenas mecanismo temporario de transicao, nao modelo final.

### Fase 4

Objetivo: anexos e operacao de producao.

- mover documentos para Blob/S3
- implementar backup automatizado do banco
- adicionar observabilidade
- endurecer politicas de senha e sessao

## Sequencia tecnica recomendada

1. Manter o frontend atual e publicar na Vercel.
2. Clonar a API atual para um backend online.
3. Criar o schema Postgres.
4. Escrever um script de migracao do `lawcrm.sqlite` para Postgres.
5. Trocar a API para ler/gravar no Postgres.
6. Substituir o `PUT /api/state` monolitico por endpoints mais granulares.
7. Migrar anexos para storage online.
8. Desativar a dependencia obrigatoria do Electron.

## Recomendacao objetiva

Se a meta e colocar rapido no ar com seguranca, eu recomendo:

1. usar a interface atual quase como esta
2. publicar o frontend na Vercel
3. reimplementar a persistencia em Postgres antes de chamar isso de versao online final

Migrar apenas o frontend sem trocar o banco nao resolve o problema principal.

## Fontes oficiais consultadas

- Vercel Functions: [vercel.com/docs/functions](https://vercel.com/docs/functions/)
- Express no Vercel: [vercel.com/docs/frameworks/backend/express](https://vercel.com/docs/frameworks/backend/express)
- Vite na Vercel: [vercel.com/docs/frameworks/frontend/vite](https://vercel.com/docs/frameworks/frontend/vite)
- Variaveis de ambiente e `vercel.json`: [vercel.com/docs/project-configuration/vercel-json](https://vercel.com/docs/project-configuration/vercel-json)

Inferencia a partir das fontes:

- Vercel Functions sao adequadas para hospedar a API
- filesystem local nao deve ser tratado como banco duravel de producao
- por isso, `better-sqlite3` local nao e a solucao final para uma versao 100% online
