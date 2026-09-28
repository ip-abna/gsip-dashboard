# Como publicar o painel

O painel é um site estático. Cada push na `main` gera o build e publica em
**https://ip-abna.github.io/gsip-dashboard/**.

O deploy não usa segredos do GitHub e não tem chave de API. O painel lê as
respostas através de um proxy (Apps Script) que roda dentro de uma planilha
privada e publica só as colunas que o painel mostra, sem Email, Nome e Telefone.
O endereço do proxy fica em `src/services/ResponsesProxy.ts` (`DEFAULT_PROXY_URL`)
e o código do script em `apps-script/Code.gs`.

## 1. Ligar o GitHub Pages (uma vez)

No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 2. Ligar o formulário a uma planilha (uma vez)

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
5. Não compartilhe a planilha. Ela fica privada: só o proxy (passo 3) lê ela, com a
   sua conta.

A planilha antiga para de receber respostas, mas guarda as que já tinha.

## 3. Publicar as respostas com o proxy (uma vez por planilha)

O script mora na planilha que ele lê. Cole na planilha nova, nunca na antiga.

1. Na planilha nova: **Extensões → Apps Script**. Apague o que está lá, cole
   `apps-script/Code.gs` e salve.
2. **Implantar → Novo deploy → app da Web**:
   - Executar como: **eu**
   - Acesso: **Qualquer pessoa**
3. Autorize quando o Google pedir e copie o endereço (termina em `/exec`).
4. Abra o endereço no navegador: deve mostrar `{"rows":[…],"locale":"pt_BR"}`.
   Procure `Email` na página. Sem resultado, nomes e contatos não vazam.
5. Copie o endereço para `DEFAULT_PROXY_URL` em `src/services/ResponsesProxy.ts`
   e faça push.

Mudou o script depois? Cole de novo no Apps Script e vá em **Implantar →
Gerenciar implantações → Nova versão**. O endereço continua o mesmo. Mantenha
`apps-script/Code.gs` igual ao que está lá: ele é a cópia de segurança.

## Antes de mexer no formulário ou na planilha

O proxy lê a aba de respostas mais nova ("Respostas ao formulário N") e o painel acha
cada coluna pelo título da pergunta.

- **Religar o formulário é seguro.** O Google cria uma aba nova ("Respostas ao
  formulário 5") com todas as respostas, e o proxy passa a ler essa aba sozinho. Sem
  redeploy.
- **Renomear uma pergunta renomeia a coluna.** Maiúsculas e espaços a mais não
  importam. Trocar palavras faz o painel perder o dado, e ele mostra no topo o aviso
  "Parte dos dados da planilha não aparece no painel", com o nome da pergunta. Para
  corrigir, volte o texto antigo ou atualize o título em `src/utils/DataParser.ts`.
- **Renomear ou criar uma opção** em "Selecione o Estado", "Qual Estrutura Prestou
  Atividade" ou "Formato do Atendimento" tira do painel as respostas com a opção nova.
  O mesmo aviso diz quantas e qual opção. As opções que o painel conhece ficam em
  `src/utils/DataParser.ts`.
- **Pergunta nova vira coluna nova** no fim da aba. O proxy publica ela, mas o painel
  só mostra depois que alguém programar isso.
- **Nunca deixe a planilha pública.** O proxy é a única porta de saída, e ele barra
  Email, Nome e Telefone (lista `BLOCKED_COLUMNS` em `apps-script/Code.gs`).
- A coluna `ID_Resposta` e as abas `Materiais` e `Materiais Concatenados` vêm de um
  outro script da planilha antiga, não do formulário. O painel não usa nenhum deles.

## Publicar

- **Automático**: todo push na `main` publica.
- **Manual**: aba **Actions → Deploy to GitHub Pages → Run workflow**.

Para ver o build de produção antes, rode `bun run build` e depois `bun run preview`.
Ele abre em `http://localhost:4173`.

## Quando algo dá errado

Abra o site, aperte F12 e veja a aba **Console**.

- **Página em branco, com erros 404 em `assets/`**: o site buscou os arquivos no
  caminho errado. Confira se `vite.config.ts` tem `base: './'`.
- **"Erro de rede"**: o navegador não alcançou o Google. Confira sua conexão e tente
  de novo.
- **"O proxy respondeu com erro"**: o Google está instável. Tente em instantes.
- **"O proxy não tem respostas para entregar"**: o formulário não está ligado a esta
  planilha. Ligue pelo passo 2. Sem redeploy: o proxy lê a planilha ao vivo.
- **"O proxy devolveu um formato que o painel não entende"**: o `Code.gs` na planilha
  está desatualizado. Cole o atual (passo 3) e crie uma nova versão do deploy.
- **Aviso "Parte dos dados da planilha não aparece no painel"**: abra o aviso. Ele diz
  qual pergunta ou opção mudou. Veja "Antes de mexer no formulário ou na planilha".
- **O build falhou**: veja o log na aba **Actions**. Rode `bun run build` na sua
  máquina para reproduzir.
