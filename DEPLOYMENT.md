# Como publicar o painel

O painel é um site estático. Cada push na `main` gera o build e publica em
**https://ip-abna.github.io/gsip-dashboard/**.

O deploy não usa segredos do GitHub para o Google Sheets. A chave da API, o ID da
planilha e a aba ficam em `src/services/GoogleSheetsService.ts` (`DEFAULT_API_KEY`,
`DEFAULT_SPREADSHEET_ID`, `DEFAULT_RANGE`). Esses valores vão no JavaScript do site de
qualquer jeito. Quem protege a chave é a restrição por site no Google Cloud (passo 2).

## 1. Ligar o GitHub Pages (uma vez)

No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 2. Criar a chave da API do Google (uma vez)

Use a conta Google da ABNA, não uma conta pessoal.

1. Abra o [Google Cloud Console](https://console.cloud.google.com/).
2. No seletor de projetos, no topo, crie um projeto (ex.: `gsip-dashboard`).
3. Em **APIs e serviços → Biblioteca**, procure **Google Sheets API** e clique em **Ativar**.
4. Em **APIs e serviços → Credenciais**, clique em **Criar credenciais → Chave de API**.
5. Abra a chave criada e configure:
   - **Restrições de aplicativos**: escolha **Sites** e adicione um item por linha:
     - `https://ip-abna.github.io/*` (o site publicado)
     - `http://localhost:3000/*` (o `bun run dev`)
     - `http://localhost:4173/*` (o `bun run preview`)
   - **Restrições de API**: escolha **Restringir chave** e marque só **Google Sheets API**.
6. Salve. A mudança pode levar alguns minutos para valer.
7. Copie a chave para `DEFAULT_API_KEY` em `src/services/GoogleSheetsService.ts` e faça push.

Use o domínio inteiro (`https://ip-abna.github.io/*`), não
`https://ip-abna.github.io/gsip-dashboard/*`. Quando o site chama a API do Google, o
navegador envia só o domínio, sem o caminho. Uma regra com `/gsip-dashboard/` bloqueia
o próprio site.

## 3. Deixar a planilha pública (uma vez)

Uma chave de API só lê planilhas públicas. Na planilha: **Compartilhar → Acesso geral →
Qualquer pessoa com o link → Leitor**.

Se a planilha ou a aba mudar, atualize `DEFAULT_SPREADSHEET_ID` (o trecho entre `/d/` e
`/edit` na URL da planilha) ou `DEFAULT_RANGE` (ex.: `Respostas ao formulário 4!A:CS`).

## Publicar

- **Automático**: todo push na `main` publica.
- **Manual**: aba **Actions → Deploy to GitHub Pages → Run workflow**.

Para ver o build de produção antes, rode `bun run build` e depois `bun run preview`.
Ele abre em `http://localhost:4173`.

## Quando algo dá errado

Abra o site, aperte F12 e veja a aba **Console**.

- **Página em branco, com erros 404 em `assets/`**: o site buscou os arquivos no
  caminho errado. Confira se `vite.config.ts` tem `base: './'`.
- **"Acesso negado" (403)**: a chave não aceita o endereço do site. Adicione o
  domínio nas restrições da chave (passo 2). Se o domínio já está lá, confira se a
  planilha está pública (passo 3).
- **"Planilha não encontrada" (404)**: o `DEFAULT_SPREADSHEET_ID` está errado.
- **"Requisição inválida" (400)**: a aba mudou de nome. Atualize o `DEFAULT_RANGE`.
- **O build falhou**: veja o log na aba **Actions**. Rode `bun run build` na sua
  máquina para reproduzir.

## Cloudflare Pages (opcional)

O workflow `.github/workflows/deploy-cloudflare.yml` também publica no Cloudflare Pages,
mas **só** se os segredos do Cloudflare existirem no repositório. Sem eles, o workflow
pula a si mesmo e só o GitHub Pages publica.

Para ligar:

1. Crie o projeto uma vez: `bunx wrangler pages project create abna-dashboard`
2. Em **Settings → Secrets and variables → Actions**, crie os segredos:
   - `CLOUDFLARE_API_TOKEN`: token com a permissão "Cloudflare Pages — Edit"
   - `CLOUDFLARE_ACCOUNT_ID`: o ID da conta, que aparece no painel do Cloudflare
3. Adicione o domínio do Cloudflare (ex.: `https://abna-dashboard.pages.dev/*`) nas
   restrições da chave do Google (passo 2).

Para usar outro nome de projeto, crie a variável de repositório (em **Variables**, não em
**Secrets**) `CLOUDFLARE_PAGES_PROJECT`.
