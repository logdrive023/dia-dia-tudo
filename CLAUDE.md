# CLAUDE.md — instruções permanentes para o Claude Code neste projeto

"Tudo": gestão de cabelo vendido por grama + salão, na **Bolívia** (usado pela família; funcionárias falam espanhol).
React 18 + TypeScript + Tailwind + Dexie (IndexedDB) + Vitest. Contexto completo e fila de trabalho em
[CONTINUAR.md](CONTINUAR.md) — ler antes de começar. Responder ao dono **em português**.

## Regras do dono (sempre)

- **Não commitar nem dar push** sem pedido: o dono commita (mensagem "att").
- **Celular primeiro em TODO front-end** (tela, peça, CSS, ajuda, janela): pensar e desenhar primeiro para o celular;
  o computador é o acréscimo. Regras na seção "Front-end: celular primeiro".
- **Peças padrão, nunca à mão**: `Titulo`, `GrupoNumeros`/`NumeroGrande`, `FiltroLista`, `TabelaDados`,
  `JanelaCadastro`, `Interruptor`, `Carregando`, `PainelSelecao`, `MenuAcoes` (ver [DESENHO.md](docs/architecture/DESENHO.md) §11).
  Faltou algo → aumentar a peça central, não criar variação local.
- **Textos em PT** como chave; o espanhol vai em `src/shared/ui/es.ts` (conferir se a chave já existe). Novidades:
  cada texto `{ pt, es }` já ao escrever (`src/features/novidades/model/novidades.ts`).
- **Regra de negócio em serviço** (`src/core/services/`), nunca dentro do componente; cada informação aparece uma vez.
- **Tudo configurável** (taxas, fuso, listas) — nunca inventar taxa de imposto ([FISCAL.md](docs/business/FISCAL.md)).
- **Funcionária só vê o que é dela**: decidir em `src/core/services/visibilidade.ts`; teste `funcionariaNaoVe`.
- Senha só como resumo (hash com sal); o admin nunca vê senha de ninguém.
- Não mexer nos dados de exemplo do dono em `localhost`: usar `http://127.0.0.1:5174` na própria aba.
- Recomendar primeiro (dar a opção recomendada), não inventar (conferir no código antes de afirmar).
- Arquivos do projeto em UTF-8 sem BOM: no PowerShell 5.1 **nunca** reescrever arquivo com Get-Content/Set-Content.

## Validação proporcional ao risco (obrigatória em toda tarefa)

Não rodar tudo a cada mudança. Seguir estes passos, sem precisar que o dono peça:

1. **Entender a mudança** e listar os arquivos tocados.
2. **Ver o plano**: `npm run validar:plano` (lê o que mudou no git, o grafo de imports e diz o nível, o porquê e os
   testes que importam os arquivos mudados).
3. **Rodar o nível certo**: `npm run validar` (ou `node scripts/validar.mjs --nivel N <arquivos>`).
4. **Registrar** no fim da resposta o que rodou e o resultado (o script também grava em
   `node_modules/.cache/validar/historico.log`).
5. **Completo quando houver motivo técnico** (lista abaixo) e **sempre antes de entregar/commit**:
   `npm run validar:tudo`.

| Nível | Quando | O que roda |
|---|---|---|
| 0 | só documentação (`.md`, imagens) | nada |
| 1 | texto/tradução (`es.ts`), ajuste visual numa tela/peça sem teste direto, script de apoio | `tsc -b` (com cache, ~2–8 s) |
| 2 | funcionalidade de uma tela/peça com teste, serviço de regra de negócio, CSS global, teste | `tsc -b` + **só os testes que importam o arquivo** |
| 3 | núcleo (`core/domain`, `ports`, `seguranca`, `modulos`, `areas`, `dados`), contrato (`services/index.ts`), contexto, permissões (`visibilidade`, `usuarios`), auditoria, persistência (`adapters/`), `app/` (App, Shell, criarBackend), `shared/ui/contexto`/`i18n`, `shared/navegacao`, contrato de domínio (`features/*/index.ts`), peça com ≥ 25 dependentes (`shared/ui/base.tsx`…), configuração do projeto, deploy, contrato da API, **refatoração em vários módulos**, entrega | `tsc -b` + suíte inteira + `vite build` |

Regras:
- **Na dúvida, o nível mais alto.** O nível depende do impacto (quem depende do arquivo), não da quantidade.
- Nunca desligar, pular ou "considerar aprovado" teste sem rodar; nunca `any`/`!`/`@ts-ignore` para calar erro.
- Não repetir o que já passou sem mudança: o script compara o conteúdo e pula (use `--forcar` para repetir).
- Não rodar `npm run build` só para conferir tipos (`tsc -b` já faz); o nível 3 roda `vite build` direto.
- Em sequência, nunca em paralelo (o Vitest usa 6 processos; junto com o `tsc` só disputa a CPU).
- Testes "do app inteiro" (montam o `App`: `telas`, `macacoTelas`, `qrSemLogin`, `cidades`, `listaVendas`,
  `precosTela`) só no nível 3 — são os mais lentos e dependem de tudo.
- Tela mexida → também conferir no celular: **uma** chamada a
  `varredura.html?rotas=<telas>&larguras=320,360,390&so=problemas` + no máximo 1–2 capturas.
- Operação Caos (`caos/`, ~5 min) não roda na suíte normal nem no `validar` automático (tem 1 reprovação conhecida de
  propósito, CAOS-D-05, em `caos/RELATORIO.md`): quando mexer em estoque, caixa, vendas, compras ou concorrência, rodar
  `node scripts/validar.mjs --caos` (o plano avisa) e comparar com o relatório — reprovação nova = bug.

## Arquitetura (onde cada coisa fica)

Arquitetura por domínio — **ler [ARQUITETURA.md](docs/architecture/ARQUITETURA.md) antes de criar ou mover arquivo**. Resumo:

- `src/app/` composição (App, Shell, 404, criarBackend) · `src/features/<dominio>/` cada domínio (pages, components,
  hooks, model, tests + **`index.ts` = contrato público**) · `src/shared/` só o que 2+ domínios usam (`ui/` com as
  peças padrão, `navegacao/`) · `src/core/` regras de negócio (services, domain, ports, areas) · `src/adapters/`
  persistência e integrações.
- Pode importar: `app → features → shared → core ← adapters`. Domínio usa outro **só pelo `index.ts`**; nunca o app.
  Testado em `src/__tests__/arquitetura.test.ts` (camadas, contrato público, ciclos).
- Funcionalidade nova vai para o domínio dela; tela só organiza (seções por props, estado no hook `use<Tela>`, contas
  em `model/` com teste); regra de negócio em `core/services`. Peças comuns dos serviços em `core/services/contexto.ts`
  (`ehAdmin`, `euPessoa`, `ehEquipe`, `conversorPara`); datas em `core/domain/datas.ts`.
- Tipos em 3 projetos (`tsconfig.app/test/node.json`, `tsc -b`): o app não enxerga Node nem testes.

## Front-end: celular primeiro (sempre)

Vale para qualquer pedido de front, mesmo quando o pedido não fala em celular (refatorar, criar tela, ajustar peça).

- **Ordem de pensar:** 320–390 px, toque, uma mão → depois tablet e computador. Classe Tailwind sem prefixo = celular;
  `sm:`/`md:` só acrescentam para telas maiores. Nunca desenhar no computador e "esconder" no celular.
- **Lista** = linha curta que abre no lugar. **Tabela larga** rola dentro do próprio quadro ou vira cartões (ex.: "Ver:
  Por medida" nos preços); a página nunca rola para o lado.
- **Barra de ações:** no celular, só a ação principal à vista e o resto no `MenuAcoes` (⋯); nada de botão sozinho
  numa linha com espaço sobrando, nem ícone "i" solto na ponta.
- **Ajuda e legenda:** texto longo vira `Info` (abre no toque, nunca depende de passar o mouse); legenda cabe numa
  linha no celular ou fica recolhida.
- **Toque:** alvo confortável para o dedo e espaço entre botões vizinhos; campo numérico com `inputMode` certo.
- **Ao entregar tela mexida:** conferir em 320/360/390 com a varredura (ver "Validação") e dizer como ficou no celular.

## Como atender cada pedido (especialista por tipo)

Antes de agir, identificar o tipo do pedido e assumir o especialista certo: foco só no que importa para ele e resposta
no formato dele. Pensar num roteiro curto (papel · tarefa · escopo · formato) para gastar menos contexto.

| Especialista | Quando | Foco (ignorar o resto) | Formato da resposta |
|---|---|---|---|
| **Frontend e UX/UI** (React + Tailwind) | criar, refatorar ou otimizar componente e tela; estado, hooks, CSS/Tailwind, eventos do navegador | experiência de uso (fluxo, clareza, menos toques), consistência com as peças padrão (§ Regras do dono), acabamento visual, arquitetura de componentes, estado, acessibilidade (rótulo, `aria-*`, foco, contraste), larguras (celular primeiro), desempenho da tela; ignorar banco/servidor | 1) decisões de UX/UI (2–3 itens curtos) · 2) código React + Tailwind pronto · 3) notas visuais/responsivas (se mexeu em layout) |
| **Backend / DevOps / Go** | API (`api-contract/`, `adapters/api`), esquema e consultas de dados, regra de servidor, futura API em Go, Docker/K8s, CI/CD, deploy | idiomas de Go (goroutines/canais), arquitetura limpa, fluxo de dados, validação da API, contêineres | 1) tabela de endpoints ou de infraestrutura · 2) código Go ou configuração pronta para produção |
| **Depuração** | erro no console, stack trace, travamento, teste falhando, falha assíncrona | stack trace, mutação de variável, fluxo assíncrono, casos de borda | 1) **Causa raiz** (1–2 frases, o defeito exato) · 2) **Correção** passo a passo |
| **Build e qualidade** | erro do `tsc`, lint, falha do Vite, dependência | tipos (`.d.ts`), `tsconfig*.json`, `vite.config.ts`, dependências | 1) comando ou correção rápida · 2) código/configuração corrigidos |
| **Arquitetura e documentação** | descoberta do projeto, desenho de arquitetura, organizar ou padronizar `.md` | visão geral, mapa de domínios, estrutura de pastas | 1) domínios / arquitetura · 2) tabela de endpoints ou de arquivos |

## Como responder

- Começar direto pelo conteúdo: sem saudação nem "vou fazer…".
- Tabelas compactas e listas para dado estruturado; texto técnico e enxuto.

## Documentação (`.md`)

- Na raiz só `README.md`, `CLAUDE.md` e `CONTINUAR.md` (fila de trabalho, lida antes de começar). O resto vai em
  `docs/`: `architecture/` (arquitetura, desenho, regras do sistema) · `audit/` (auditorias) · `business/` (fiscal,
  fluxos do negócio).
- Cada documento em `docs/` começa com `# Título` (um só) e, logo abaixo,
  `**Atualizado:** dd/mm/aaaa · **Situação:** vigente | histórico (motivo)`; seções a partir de `##`. Sem "Autor": o
  git já registra.
- Bloco de código sempre com a linguagem (`ts`, `bash`; desenho de pastas ou fluxo = `text`).
- Uma informação num lugar só: assunto que já tem documento → completar o existente, não criar outro; achou repetição
  entre documentos → propor juntar.
- Mover ou renomear documento → atualizar no mesmo passo todos os links e menções (procurar pelo nome em todo o projeto).
