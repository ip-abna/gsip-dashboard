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

A chave em uso fica no projeto `gs-ip-509623` do Google Cloud, na conta Google da ABNA.
Para trocá-la, repita os passos abaixo nesse projeto. Use a conta da ABNA, não uma
conta pessoal.

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
`/edit` na URL da planilha) ou `DEFAULT_RANGE` (só o nome da aba, ex.:
`Respostas ao formulário 4`).

## Antes de mexer no formulário ou na planilha

O painel lê a aba `Respostas ao formulário 4` e acha cada coluna pelo título da pergunta.

- **Não desvincule nem religue o formulário.** Religar cria uma aba nova
  ("Respostas ao formulário 5"), e o painel continua lendo a antiga. Se precisar
  religar, troque o `DEFAULT_RANGE` pelo nome da aba nova.
- **Renomear uma pergunta renomeia a coluna.** Maiúsculas e espaços a mais não
  importam. Trocar palavras faz o painel perder o dado sem avisar: ele aparece como
  0 ou vazio. Se renomear, atualize o título em `src/utils/DataParser.ts`.
- **Pergunta nova vira coluna nova** no fim da aba. O painel lê a aba inteira, mas
  só mostra a pergunta nova depois que alguém programar isso.
- **Deixe a planilha em Português (Brasil)**, em **Arquivo → Configurações →
  Localidade**. O painel lê as datas como dd/mm/aaaa. Em outra localidade, 04/11
  vira 11/04.
- A coluna `ID_Resposta` e as abas `Materiais` e `Materiais Concatenados` vêm de um
  script da planilha (**Extensões → Apps Script**), não do formulário. O painel não
  usa nenhum deles.

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
