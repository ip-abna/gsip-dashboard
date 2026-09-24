# Painel de Campanhas da ABNA

Relatório Nacional de RP/IP da ABNA - Associação Brasileira de Narcóticos Anônimos.

Um painel em React para visualizar os dados das campanhas de Narcóticos Anônimos a partir do Google Sheets.

## Tecnologias

- **Framework**: React 18+ com TypeScript
- **Ferramenta de build**: Vite 7+
- **Gerenciador de pacotes**: Bun
- **Estilização**: Tailwind CSS 4+
- **Gráficos**: Recharts
- **Testes**: Vitest + @testing-library/react + fast-check (PBT)
- **Implantação**: GitHub Pages (padrão) + Cloudflare Pages (opcional)

## Primeiros Passos

### Pré-requisitos

- [Bun](https://bun.sh/) instalado no seu sistema

### Instalação

```bash
bun install
```

Não precisa de `.env`: a chave da API e a planilha já estão no código (veja
[Google Sheets](#google-sheets)).

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
bun run dev

# Executar testes
bun run test

# Executar testes uma vez (modo CI)
bun run test:run

# Gerar build de produção
bun run build

# Pré-visualizar o build de produção
bun run preview
```

## Estrutura do Projeto

```
src/
├── components/     # Componentes React
├── contexts/       # Contextos React para gerenciamento de estado
├── services/       # Serviços de busca de dados
├── types/          # Definições de tipos TypeScript
├── utils/          # Funções utilitárias
└── test/           # Configuração e utilitários de teste
```

## Google Sheets

O painel lê as respostas do formulário direto de uma planilha pública do Google. A
chave da API, o ID da planilha e a aba ficam em `src/services/GoogleSheetsService.ts`.
Para testar outro valor na sua máquina sem mexer no código, copie `.env.example` para
`.env` e descomente a linha que quer trocar.

## Publicação

Todo push na `main` publica em https://ip-abna.github.io/gsip-dashboard/. O passo a
passo (GitHub Pages, chave do Google e o Cloudflare opcional) está em
[DEPLOYMENT.md](./DEPLOYMENT.md).

## Testes

O projeto usa uma abordagem dupla de testes:

- **Testes unitários**: Exemplos específicos e casos extremos usando Vitest
- **Testes baseados em propriedades**: Propriedades universais de correção usando fast-check

Execute todos os testes com:

```bash
bun run test:run
```

## Licença

Este projeto é de uso interno da ABNA (Associação Brasileira de Narcóticos Anônimos).
