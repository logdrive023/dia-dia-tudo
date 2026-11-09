# Arquitetura por domínio

**Atualizado:** 08/11/2026 · **Situação:** vigente

Reorganizada em 06/11/2026. Objetivo: trabalhar num domínio (ex.: estoque) sem precisar entender vendas, compras ou
financeiro, e manter uma peça compartilhada num lugar só. As regras abaixo **são testadas**
(`src/__tests__/arquitetura.test.ts`): quebrou a regra, o teste falha.

## Camadas

```text
src/
  app/         composição: App (rotas → telas), Shell (menu), 404, criarBackend (escolhe o armazenamento)
  features/    um DOMÍNIO de negócio por pasta (telas, componentes, hooks, contas e testes do domínio)
  shared/      o que é de verdade comum a vários domínios: ui/ (peças padrão, contexto, idioma), navegacao/ (rotas)
  core/        REGRAS DE NEGÓCIO (vira o servidor): services (comandos e consultas), domain, ports, areas, dados
  adapters/    persistência e integrações: aparelho (IndexedDB), API, câmbio, dados de exemplo
  __tests__/   testes das regras (core) e do app inteiro
```

Por dentro do `core` e dos `adapters`:

```text
core/domain       dinheiro (moedas, conversão, fator), datas, ids (ULID), tipos, erros
core/ports        portas (repos, arquivos, sessão, relógio, Backend)
core/services     caixa, estoque (separação, rastreio), compras, vendas, contas, precos, emprestimos,
                  equipe, cadastros, painel (+diagnóstico), relatorios, historico (log/linha do tempo)
core/modulos*.ts  contrato dos módulos e modalidades montadas pela tela
core/areas        cabelo, salão, empréstimos, produtos (+ registro)
core/dados        tabelas de referência: impostos, tributos versionados (tributosBO), cidades, feriados, documentos
adapters/         memory, local (Dexie), api (+ simulada), noAparelho, câmbio automático (cambio.ts),
                  dados de exemplo (demo.ts)
shared/ui         peças padrão, gráficos SVG, contexto, idioma (i18n.ts + es.ts)
```

Fluxo de dados (porta `Backend`, outbox, troca para a API) e segurança das requisições: [SISTEMA.md](SISTEMA.md) §4.

Quem pode importar quem (a seta é "pode usar"):

```text
app ─► features ─► shared ─► core ◄─ adapters
```

- **core** não conhece tela, peça, app nem adaptador (só ports). É o que vai virar a API em Go.
- **shared** não conhece domínio nem app. Não é depósito: só entra o que dois ou mais domínios usam.
- **features**: um domínio **não importa o app** e **só usa outro domínio pelo `index.ts` dele** (o contrato público).
- **app** usa os domínios só pelo `index.ts`.
- **Sem ciclo de import novo**. Os 3 antigos (2 no core, 1 nas Configurações) estão listados no teste para resolver.
- **Tela não acessa persistência**: domínio não importa `adapters/`. As 4 telas de ferramenta do aparelho que ainda importam (Entrar, Dados, Modo teste, Moedas) estão listadas no teste; nenhuma nova entra.
- **O que só um domínio usa fica nele**: peça em `shared/` usada por um domínio só reprova no teste (nasce no domínio; sobe para `shared/` quando o segundo domínio precisar).
- **Imports relativos, sem atalho `@/`**: as regras acima leem o caminho relativo de cada import; um alias passaria por fora delas.

## Um domínio

```text
features/<dominio>/
  index.ts      CONTRATO PÚBLICO: as telas (para o App) e o pouco que outro domínio pode usar
  pages/        telas com rota (só organizam: estado da tela + seções)
  components/   seções e peças só deste domínio (recebem dados por props)
  hooks/        estado + consultas da tela (ex.: usePainel, useNovaCompra, useModoCaixa)
  model/        contas puras, tipos e constantes do domínio (sem JSX)
  tests/        testes de tela deste domínio
```

Cada domínio tem só as pastas de que precisa. Os 19 de hoje:

| Domínio | O que é | Contrato público além das telas |
|---|---|---|
| `painel` | a porta de entrada (números, pendências, análises) | — |
| `compra` | compras (lista, nova compra, ficha, pagamento) | `LigarCompras` (usado na viagem) |
| `triagem` | separar, juntar, etapas, prontos | — |
| `estoque` | estoque, etiquetas, livro do cabelo | `useCamposModulo`, `ehBruto`, `Linha`, `Ajustar` |
| `lote` | ficha do pacote, rastreio, QR, pacote para vender | `EditarAtributos` |
| `venda` | vender (assistente), lista e detalhe da venda | `NOME_ETAPA` |
| `caixa` | caixa do dia, turnos, modo caixa (venda rápida) | `BotaoFecharTurno`, `JanelaFecharTurno` |
| `viagem` | viagens de compra (lista, ficha, rateio, contas) | — |
| `precos` | tabelas de preço e histórico | — |
| `relatorio` | relatórios contábeis, IR, reposição, sócias | — |
| `agenda` | agenda e cobrança | `Receber` |
| `cadastros` | pessoas e contas | — |
| `financeiro` | empréstimos e adiantamentos a parceiros | — |
| `equipe` | equipe, unidades, comissões | — |
| `config` | configurações (índice, seções, fiscal, códigos…) | `GRUPOS_CONFIG`, `secoesDoPerfil` (menu) |
| `auditoria` · `novidades` · `acesso` · `vitrine` | log, changelog, entrar, vitrine/loja | — |

## Dados e API

- A tela nunca fala com o banco: usa `useConsulta` / `useComando` (`shared/ui/contexto`), que passam pela porta
  `Backend` (`core/ports`). Hoje o adaptador é o aparelho (`adapters/noAparelho`); amanhã a API
  (`adapters/api`). **Trocar a origem não mexe em tela nenhuma.**
- Os modelos ficam separados pelo papel: **DTO / contrato** = `core/services/index.ts` (+ `api-contract/`);
  **modelo de negócio** = `core/domain/tipos.ts`; **modelo da tela** = `features/<x>/model` e o retorno dos hooks.
- Componentes visuais recebem por props; o estado e as consultas ficam no hook da tela; as contas, em função pura no
  `model/` (com teste).

## Regras para código novo

1. Funcionalidade nova vai para o domínio dela (`features/<dominio>`). Domínio novo só se não couber em nenhum.
2. Não criar pasta global nova quando a responsabilidade é de um domínio.
3. Antes de criar peça, procurar em `shared/ui` (peças padrão: DESENHO.md §11). Usada por 2+ domínios → `shared`.
4. Regra de negócio fica em `core/services`, nunca no componente.
5. Outro domínio precisa de algo seu → exporte no `index.ts` (o mínimo), nunca importe o interno.
6. Sem abstração "para o futuro" e sem ciclo de import.
7. Mover arquivo: atualizar todos os imports (o teste de arquitetura e o `tsc -b` acusam o que faltou).
