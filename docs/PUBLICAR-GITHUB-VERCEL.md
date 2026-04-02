# Publicar no GitHub e Vercel

## GitHub
Se esta maquina ja estiver autenticada no GitHub por `git`, voce pode:

1. criar um repositorio vazio no GitHub chamado `crm-m-de-paula-online`
2. adicionar o remoto nesta pasta
3. fazer o primeiro push

Comandos depois que o repositorio remoto existir:
```bash
git remote add origin https://github.com/SEU_USUARIO/crm-m-de-paula-online.git
git push -u origin main
```

## Vercel
1. Importe o repositorio no painel da Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Configure as variaveis:
   - `DATABASE_URL`
   - `JWT_SECRET`

## Banco
A API online espera `Postgres` acessivel pela `DATABASE_URL`.
Se quiser usar Vercel + Neon/Postgres gerenciado, isso encaixa bem neste projeto.

## Primeiro acesso
Depois do deploy, abra:
- `/setup`

Isso cria o administrador inicial quando o banco estiver vazio.
