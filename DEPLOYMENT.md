# Como publicar o painel

O painel é um site estático. Cada push na `main` gera o build e publica em
**https://ip-abna.github.io/gsip-dashboard/**.

O deploy não usa segredos do GitHub para o Google Sheets. A chave da API e o ID da
planilha ficam em `src/services/GoogleSheetsService.ts` (`DEFAULT_API_KEY` e
`DEFAULT_SPREADSHEET_ID`). Esses valores vão no JavaScript do site de qualquer jeito.
Quem protege a chave é a restrição por site no Google Cloud (passo 2).

## 1. Ligar o GitHub Pages (uma vez)

No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 2. Criar a chave da API do Google (uma vez)

A chave em uso fica no projeto `gs-ip-509623` do Google Cloud, na conta Google da ABNA.
Para trocá-la, repita os passos abaixo nesse projeto. Use a conta da ABNA, não uma
conta pessoal.

1. Abra o [Google Cloud Console](https://console.cloud.google.com/).
2. No seletor de projetos, no topo, escolha `gs-ip-509623`. Se for começar do zero,
   crie um projeto (ex.: `gsip-dashboard`).
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

## 3. Ligar o formulário a uma planilha (uma vez)

O formulário não cria a planilha sozinho, nem quando recebe uma resposta. Alguém cria
uma vez, e ela fica no Drive de quem clicou. Por isso, entre antes na conta Google da
ABNA.

1. Abra o formulário e vá na aba **Respostas**.
2. Clique em **Vincular ao Planilhas** e escolha **Criar uma nova planilha**. Se o
   formulário já estiver ligado a uma planilha, o botão vira **Ver no Planilhas**. Nesse
   caso, abra o menu **⋮** ao lado dele e escolha a opção de destino das respostas.
3. O Google cria a planilha com todas as respostas que estão no formulário, numa aba
   chamada "Respostas ao formulário 1".
4. Na planilha, em **Arquivo → Configurações**, confira o fuso horário **(GMT-03:00)
   São Paulo**. É ele que decide a hora no "Carimbo de data/hora".
5. Em **Compartilhar → Acesso geral**, escolha **Qualquer pessoa com o link → Leitor**.
   A chave da API só lê planilhas públicas.
6. Copie o ID da planilha (o trecho entre `/d/` e `/edit` na URL) para
   `DEFAULT_SPREADSHEET_ID` em `src/services/GoogleSheetsService.ts` e faça push.

A planilha antiga para de receber respostas, mas guarda as que já tinha.

## Antes de mexer no formulário ou na planilha

O painel lê a aba de respostas mais nova ("Respostas ao formulário N") e acha cada
coluna pelo título da pergunta.

- **Religar o formulário é seguro.** O Google cria uma aba nova ("Respostas ao
  formulário 5") com todas as respostas, e o painel passa a ler essa aba sozinho.
- **Renomear uma pergunta renomeia a coluna.** Maiúsculas e espaços a mais não
  importam. Trocar palavras faz o painel perder o dado, e ele mostra no topo o aviso
  "Parte dos dados da planilha não aparece no painel", com o nome da pergunta. Para
  corrigir, volte o texto antigo ou atualize o título em `src/utils/DataParser.ts`.
- **Renomear ou criar uma opção** em "Selecione o Estado", "Qual Estrutura Prestou
  Atividade" ou "Formato do Atendimento" tira do painel as respostas com a opção nova.
  O mesmo aviso diz quantas e qual opção. As opções que o painel conhece ficam em
  `src/utils/DataParser.ts`.
- **Pergunta nova vira coluna nova** no fim da aba. O painel lê a aba inteira, mas
  só mostra a pergunta nova depois que alguém programar isso.
- **A localidade da planilha pode ser qualquer uma.** O painel lê as datas na ordem
  que ela usa (04/11 no Brasil, 11/4 nos EUA) e recebe os números sem formatação.
- A coluna `ID_Resposta` e as abas `Materiais` e `Materiais Concatenados` vêm de um
  script da planilha (**Extensões → Apps Script**), não do formulário. O painel não
  usa nenhum deles. Numa planilha nova eles não existem, e o painel funciona igual.

## Publicar

- **Automático**: todo push na `main` publica.
- **Manual**: aba **Actions → Deploy to GitHub Pages → Run workflow**.

Para ver o build de produção antes, rode `bun run build` e depois `bun run preview`.
Ele abre em `http://localhost:4173`.

## Quando algo dá errado

Abra o site, aperte F12 e veja a aba **Console**.

- **Página em branco, com erros 404 em `assets/`**: o site buscou os arquivos no
  caminho errado. Confira se `vite.config.ts` tem `base: './'`.
- **"O Google negou o acesso" (403)**: a chave não aceita o endereço do site. Adicione
  o domínio nas restrições da chave (passo 2). Se o domínio já está lá, confira se a
  planilha está pública (passo 3).
- **"Planilha não encontrada" (404)**: o `DEFAULT_SPREADSHEET_ID` está errado.
- **"O Google recusou a requisição" (400)**: a chave em `DEFAULT_API_KEY` está errada
  ou foi apagada. Crie outra (passo 2).
- **"A planilha não tem uma aba de respostas"**: o formulário não está ligado a esta
  planilha. Ligue pelo passo 3.
- **Aviso "Parte dos dados da planilha não aparece no painel"**: abra o aviso. Ele diz
  qual pergunta ou opção mudou. Veja "Antes de mexer no formulário ou na planilha".
- **O build falhou**: veja o log na aba **Actions**. Rode `bun run build` na sua
  máquina para reproduzir.
