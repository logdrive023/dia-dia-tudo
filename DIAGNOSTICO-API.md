# Diagnóstico da API — desenho final (Go + SQLite/PostgreSQL)

**Atualizado:** 09/11/2026 · **Situação:** vigente (substitui a versão de 05/11/2026, que está no git em `d1d2980`)

Diretrizes definitivas para levar o app "Tudo" do aparelho para o servidor. Vale junto com o
[CLAUDE.md do servidor](../dia-dia-tudo-backend/CLAUDE.md) e com o contrato em
[api-contract/openapi.yaml](api-contract/openapi.yaml). Em conflito, vale o **código**; o documento se corrige.

## 0. Decisões definitivas

| # | Tema | Decisão | O que muda em relação à versão anterior |
|---|---|---|---|
| D1 | Transporte | **Canal cifrado**: `POST /v1/k` (aperto de mão) e `POST /v1/r` (todo o resto). A "rota" é o **nome** do comando ou da consulta. | Sai o plano de `POST /v1/comandos/{nome}`, REST e `backendHttp.ts`. O canal já funciona dos dois lados. |
| D2 | Login | Token opaco dentro da `Mensagem`, nunca em cabeçalho ou cookie. Sessões passam para a tabela `sessoes`. | Sai JWT + refresh em cookie. |
| D3 | Banco | **Um SQL só para os dois bancos**: SQLite no desenvolvimento e numa instalação simples, PostgreSQL 16 em produção. | Sai o DDL exclusivo do Postgres como migração direta: ele vira desenho lógico ([Anexo A](#anexo-a--ddl-de-referência-postgresql)). |
| D4 | Camadas | As que já existem: `canal → handler → usecase → domain ← repository`. | Sai `http/service/platform` e o uso de `sqlc`/`goose`. |
| D5 | Regra | Mesmo nome, mesmo JSON e **mesma mensagem de erro** do app. `src/core/services` é a especificação; os testes do app são o contrato. | Sai a geração de servidor pelo OpenAPI. |
| D6 | Transação | **Um comando = uma transação**, com travas em ordem fixa ([§2.3](#23-transação-e-concorrência)). | Continua a regra, agora no desenho real. Ainda não existe no servidor. |
| D7 | Multi-empresa | `empresa_id` vem **só do token**. Filial = `locais`. Login é único no sistema inteiro. | Reforça: toda gravação confere a empresa ([§3.8](#38-multi-empresa-filiais-e-b2b)). |
| D8 | Paginação | No servidor, opcional por consulta e compatível com a resposta atual ([§4.3](#43-paginação)). | Sai o cursor `(data, id)`: a tela usa número de página. |
| D9 | Modo Teste | **Só no aparelho.** Produção não tem cenário nem "zerar tudo". | Novo. |
| D10 | Offline | **Escrever exige internet** na V1 quando o modo é servidor. O modo aparelho continua funcionando sozinho. | Mantém a decisão. O `outbox` continua sem uso. |

## 1. Discovery: o documento antigo e o projeto de hoje

### 1.1 Números

| Medida | Documento (05/11) | Hoje (09/11) |
|---|---|---|
| Comandos / consultas em `src/core/services/index.ts` | 85 / 92 | **95 / 104** |
| Permitidos à funcionária (comandos / consultas) | 20 / 36 | **23 / 42** |
| Linhas em `src/core/services/*.ts` | 11.343 | **13.094** |
| Nomes já portados para Go | — | **2 de 199** (`locais`, `salvarLocal`), mais o login |
| Tabelas no servidor | — | `usuarios`, `auditoria`, `locais`, `turnos` |

### 1.2 O que se aproveita

| Parte | Como fica |
|---|---|
| Mapa de entidades e as entidades "fantasma" (triagem, venda em aberto, contadores) | **Aproveitado** em [§3.2](#32-o-que-sai-do-config-e-do-json) |
| DDL de 64 tabelas, conferido num Postgres de verdade | **Aproveitado como desenho lógico** ([Anexo A](#anexo-a--ddl-de-referência-postgresql)); tabelas e restrições valem, os tipos seguem [§3.1](#31-dialeto-único) |
| Separar `compras` × `vendas`, promover `campos` com regra para colunas, tabelas de preço versionadas | **Mantido** |
| Riscos de concorrência e a tabela do que cada comando grava junto | **Mantido** em [§2.3](#23-transação-e-concorrência) e [§6](#6-ordem-de-implementação-e-riscos) |
| Perfis, `config.funcionaria*`, permissões efetivas | **Mantido** em [§5](#5-permissões-admin--funcionária) |
| QR da etiqueta (código aleatório, só logado, revogar ao reimprimir) | **Mantido** em [§3.9](#39-etiquetas-qr-e-vitrine), sem `GET /v1/qr` |

### 1.3 O que estava errado ou ficou velho

| Assunto | O documento dizia | A realidade |
|---|---|---|
| Rotas | REST + `Idempotency-Key` + `Authorization` | Canal cifrado; `api-contract/openapi.yaml` só tem `/v1/k` e `/v1/r`; o `CLAUDE.md` do servidor proíbe rotas REST |
| Catálogo | Faltam 9 comandos e 10 consultas | `abrirTurno`, `fecharTurno`, `anotarTurno`, `reduzirNaVendaAberta`, `salvarDivisaoVenda`, 4 do Imposto de Renda; `turnoAtual`, `turnos`, `custoDaVenda`, `reposicao`, `metas`, `documentoVenda`, `divisaoVenda`, `impostoRenda`, `exerciciosFiscais`, `feriados` |
| Turnos | `fim NOT NULL`, tabela `turno_valores` | Turno aberto existe (`fim` vazio, migração 002); valores por moeda em JSON |
| Tipos | `DOMAIN`, `timestamptz`, `jsonb`, `text[]`, `EXCLUDE`, GIN | O servidor usa só o que roda nos dois bancos |
| Vendas em aberto | Pacote vendido sai de todas | Regra nova: só sai se o saldo não der mais; existe venda de parte do pacote |
| Etiquetas | Imprimir marca como impressa | Imprimir só envia; `marcarEtiquetasImpressas` só depois de confirmar no papel |
| Vitrine | `mostrarPreco` | `modoPreco`: `contato` (padrão), `tabela` ou `individual` |
| Auditoria de lotes | Só `auditoria` e `genealogia` | Existe o livro de origem em gramas (`origem.ts`), que depende da **ordem exata** dos movimentos |

### 1.4 Lacunas por assunto

| Assunto | O que faltava | Resposta |
|---|---|---|
| Viagens | Frete identificado, trava de incorporação única | [§3.3](#33-viagens-e-rateio-de-frete) |
| Agenda | Feriados por país e região, conflitos, atendimento agendado | [§3.7](#37-agenda) |
| Turnos | Turno aberto, trava em `moverCaixa`, conferência cega | [§3.5](#35-turnos) |
| Filiais / B2B | Empresa pública sem login; B2B não existe como conceito | [§3.8](#38-multi-empresa-filiais-e-b2b) |
| Auditoria de lotes | Ordem global dos movimentos | [§3.6](#36-auditoria-de-lotes) |
| Paginação | Totais dos cartões dependem da lista inteira | [§4.3](#43-paginação) |
| Modo Teste | Não existia | [§7](#7-guia-de-migração-e-consistência) |

### 1.5 Defeitos achados no servidor atual

Nenhum foi corrigido nesta revisão, que só trata do documento. Todos entram na Fase 0.

| # | Defeito | Onde | Efeito | Correção |
|---|---|---|---|---|
| S1 | `ON CONFLICT (id) DO UPDATE` sem conferir a empresa | `internal/repository/locais.go` | Uma empresa que envie o `id` de um registro de outra **sobrescreve** os dados dela | `DO UPDATE … WHERE tabela.empresa_id = excluded.empresa_id` e recusar se nenhuma linha mudou |
| S2 | Não há transação por comando | Só as migrações usam `BeginTx` | Comando com várias gravações pode ficar pela metade | [§2.3](#23-transação-e-concorrência) |
| S3 | Sessões, tokens e idempotência em memória | `internal/handler/rpc.go`, `internal/canal/servidor.go` | Reiniciar derruba todos; não dá para ter duas instâncias | Tabelas `sessoes` e `idempotencia` (as sessões do canal ficam em memória ou Redis) |
| S4 | Sem caminho para consulta sem login | `RPC.Executar` exige token | `configuracoes`, `usuariosDemo` e `vitrine` não funcionam | [§4.4](#44-consultas-sem-login) |
| S5 | Visibilidade da funcionária não portada | Só as listas de nomes em `permissoes.go` | Ao portar venda ou pessoa, custo e comissão vazam | [§5](#5-permissões-admin--funcionária), obrigatório a partir da Fase 1 |
| S6 | `INTEGER` no Postgres tem 32 bits | Regra atual "só TEXT e INTEGER" | Dinheiro acima de 21 milhões em centavos estoura | `BIGINT` em dinheiro e quantidade ([§3.1](#31-dialeto-único)) |

### 1.6 Clean Architecture: dá para reaproveitar?

**Sim, sem mudar a estrutura.** `domain` não conhece banco, `usecase` só usa portas e `repository` implementa as portas para os
dois bancos. O `cmd/gerar` já cria o esqueleto. Faltam só peças transversais: transação, travas, paginação e visibilidade.

## 2. Arquitetura limpa

### 2.1 Camadas

```text
app React (telas → useConsulta / useComando)
   │  porta Backend (src/core/ports/backend.ts)
   ├─ BackendNoAparelho   memory (testes) · local (IndexedDB, Modo Teste)
   └─ BackendApi          canal cifrado
                               │  POST /v1/k · POST /v1/r
                               ▼
internal/canal       envelope, anti-repetição, relógio, idempotência
internal/handler     nome → regra (rotas.go), token, permissões, visibilidade
internal/usecase     as regras (espelho de src/core/services)
internal/domain      entidades, erros de regra, portas, dinheiro, datas
internal/repository  SQL único + migrations/NNN_*.sql
                               │
                     SQLite (local) · PostgreSQL 16 (produção)
```

Dependência sempre para dentro: `handler → usecase → domain ← repository`. O `usecase` nunca importa `database/sql`.

### 2.2 Caminho de um comando

```text
/v1/r → abre o envelope → confere relógio e repetição
      → idempotência: mesma chave devolve a mesma resposta
      → token → Sessao (a empresa vem daqui, nunca do corpo)
      → PodeComando(perfil, nome) → visibilidade antes do comando
      → BEGIN → regra (travas em ordem) → auditoria → COMMIT
      → grava a resposta da idempotência → fecha o envelope
Recusa de regra: ROLLBACK, a tentativa vai para a auditoria e a resposta é { ok: false, erro: { mensagem, campo } }.
```

### 2.3 Transação e concorrência

Porta nova em `domain` (nomes sugeridos):

```go
type Transacoes interface {
	Em(ctx context.Context, f func(tx Tx) error) error
}

type Tx interface {
	// Travar segura as linhas até o fim da transação, sempre em ordem crescente de id.
	Travar(ctx context.Context, tabela, empresaID string, ids ...string) error
	ProximoNumero(ctx context.Context, empresaID, sequencia string) (int64, error)
}
```

| Banco | `Em` | `Travar` |
|---|---|---|
| SQLite | `BEGIN IMMEDIATE` (um escritor por vez) | não faz nada |
| PostgreSQL | `READ COMMITTED` | `SELECT id … WHERE empresa_id = ? AND id IN (…) ORDER BY id FOR UPDATE` |

**Ordem fixa das travas** (evita deadlock): sequências → dia do caixa → itens por id → pessoa/conta → viagem/adiantamento.

| Operação | Trava | Por quê |
|---|---|---|
| `concluirVenda`, `reduzirNaVendaAberta` | itens da venda | Duas pessoas vendendo o mesmo pacote |
| `triarLotes`, `desfazerTriagem`, `tirarDaMistura` | todos os lotes envolvidos | Venda no meio da triagem |
| `pagarComissao` | pessoa | Dois pagamentos do mesmo "a pagar" |
| `encerrarDia`, `moverCaixa` | dia do caixa | Venda no instante do encerramento |
| `abrirTurno`, `fecharTurno` | usuário (e `ux_turnos_aberto`) | Dois turnos abertos |
| `incorporarCustoViagem`, `reabrirViagem` | viagem, depois lotes | Lote vendido entre a prévia e a incorporação |

### 2.4 Regras que valem em todo o código

- Dinheiro em inteiro na menor unidade; câmbio e fator com `math/big.Rat`, igual a `dinheiro.ts`.
- "Hoje" e o dia do caixa são calculados no servidor, pelo `empresas.fuso_horario`.
- `id` novo vem do app (ULID) e é a base da idempotência. O servidor valida o formato.
- Erro interno vira HTTP 500 sem detalhe; recusa de regra vai dentro do envelope.

## 3. Estrutura de dados

### 3.1 Dialeto único

| Desenho lógico (Anexo A) | Migração real | Observação |
|---|---|---|
| `ident` | `TEXT` | ULID |
| `dinheiro`, `quantidade`, `bigint` | `BIGINT` | Inteiro de 64 bits nos dois bancos |
| `pontos_base`, `integer`, `versao` | `INTEGER` | |
| `boolean` | `INTEGER CHECK (x IN (0, 1))` | |
| `timestamptz`, `date` | `TEXT` ISO 8601 | Mesma forma do app; ordena como texto |
| `numeric`, `fator` | `TEXT` | Como o app ("17,5"); contas no `domain` |
| `jsonb` | `TEXT` com JSON | Só para o que nunca entra em `WHERE` |
| `text[]` (`auditoria.ligados`) | Tabela `auditoria_ligados (auditoria_id, alvo_id)` | Precisa de índice |
| `EXCLUDE USING gist` (turnos) | Índice parcial + regra no `usecase` | |
| `pg_trgm`, GIN | Só migração opcional de Postgres | A busca funciona sem eles, mais lenta |
| `num_nonnulls`, `btrim` | `origem_tipo` + `origem_id`; validação no `usecase` | |

Valem nos dois bancos: `CHECK`, `FOREIGN KEY`, índice parcial, `ON CONFLICT … DO UPDATE … WHERE`, `RETURNING`.

**Colunas-base** de toda tabela de negócio: `id, empresa_id, criado_em, atualizado_em, criado_por, versao, apagado_em`.
Razões (`mov_*`, `auditoria`) não têm `versao` nem `apagado_em`: só crescem. Chave natural por empresa quando o id do app não é
único entre empresas: dia do caixa `(empresa_id, data)`, configuração `(empresa_id, chave)`.

### 3.2 O que sai do `config` e do JSON

| Hoje | Vai para |
|---|---|
| `config` `vendaAberta:<id>` | `vendas_abertas`, `venda_aberta_linhas` |
| `config` `turno:<id>`, `turnoAberto:<usuário>` | `turnos` |
| `config` `contador-<letra>` | `sequencias` |
| `config` `cidade:<id>` | `cidades` |
| `config` `irExercicios`, `irObrigacoes` | `ir_exercicios`, `ir_exercicio_eventos`, `ir_obrigacoes` |
| `config.funcionaria*` | `perfil_permissoes`, `usuario_permissoes` |
| Versões de tabela na `auditoria` | `tabela_preco_versoes` e filhas |
| `item.triagem` e `campos.separacaoId` | `triagens`, `triagem_colunas` |
| `Transacao.linhas/pagamentos/historico` | `compra_linhas`, `venda_linhas`, `pagamentos`, `etapa_eventos` |
| `viagem.despesas/carteira/incorporacao` | Tabelas de viagem ([§3.3](#33-viagens-e-rateio-de-frete)) |
| `geral.vitrine.ocultos`, `geral.vitrine.precos` | `itens.vitrine_oculto`, `itens.vitrine_fator` |

**Total: 65 tabelas** (as 67 do desenho anterior, menos `turno_valores` e `refresh_tokens`).

### 3.3 Viagens e rateio de frete

- **Frete é despesa**, categoria `frete` em `viagem_despesas` (`CATEGORIAS_VIAGEM_PADRAO`). Não ganha tabela própria.
- O **rateio** vale para o gasto inteiro da viagem: `viagens.rateio` = `grama` ou `valor`. O último leva o resto, e a soma fecha exata.
- O rateio **por compra é calculado**, não gravado. O que se grava é o resultado **por lote**, ao incorporar:
  `viagem_incorporacao_lotes` com `custo_antes`, `extra` e `custo_depois`.
- **Reversível**: `reabrirViagem` marca `desfeita_em` e o custo dos lotes volta. Só uma incorporação viva por viagem
  (`ux_viagem_incorporacao_viva`).
- Se as compras de uma viagem incorporada mudam, o rateio é refeito na mesma transação (`redividirGasto`).
- Lote já vendido fica de fora da incorporação; `linha.custoPrincipal` é foto da hora.

### 3.4 Vendas, cancelamento e estorno

Nada é apagado. `vendas.etapa`: `agendado`, `novo`, `concluido`, `cancelado`.

| Passo de `cancelarVenda` | Grava em |
|---|---|
| Exige motivo; funcionária só desmarca agendamento dela | — |
| Dia já encerrado: anota a alteração | `dia_alteracoes` |
| Devolve cada pacote | `mov_estoque`, motivo `cancelamento` |
| Estorna cada pagamento **no dia de hoje** | `mov_caixa`, tipo `estorno`, com origem na venda |
| Estorna o fiado | `mov_conta` |
| Muda a etapa, com quem e por quê | `vendas`, `etapa_eventos`, `auditoria` |

Vale para todos os razões: **corrigir é lançar outro movimento**, nunca editar. `itens.saldo` é cache de `mov_estoque`, sempre
gravado junto; a consulta `diagnostico` confere os dois.

**Vendas em aberto** não baixam estoque, não entram em caixa nem em relatório.

| Regra | Onde fica |
|---|---|
| "Aberta há 15 min" | `aberta_em` não muda ao salvar de novo; a tela calcula a idade |
| Só a dona ou o administrador mexe | `criado_por` |
| Pacote em outra venda: avisar antes | Índice `ix_venda_aberta_item` |
| Vender parte (`reduzirNaVendaAberta`) | A outra só diminui se as duas passarem do saldo |
| Ao fechar uma venda | A própria some; nas outras, o pacote só sai se o saldo não der mais |

### 3.5 Turnos

Aberto = `fim` vazio. Valores por moeda ficam em JSON, porque só são filtrados por pessoa e período.

- `ux_turnos_aberto` garante um turno aberto por pessoa. A sobreposição de turnos fechados é conferida no `usecase`.
- Com o controle ligado, `moverCaixa` exige turno aberto. **Porte `moverCaixa` antes da regra de turnos.**
- **Conferência cega**: a funcionária nunca recebe `esperado` nem `diferenca`.
- `esperado` = troco inicial + dinheiro vivo lançado pela pessoa + estornos desses lançamentos. QR, Pix e cartão não entram.

### 3.6 Auditoria de lotes

| Pergunta | Consulta | De onde vem |
|---|---|---|
| Quem fez o quê | `auditoria`, `logDetalhado`, `linhaDoTempo` | `auditoria` + `auditoria_ligados` |
| De que lote veio | `genealogia`, `rastreio` | `item_origens` com CTE recursiva (nos dois bancos) |
| Quantas gramas de cada compra | `origemDoPacote`, `origemDaVenda` | `mov_estoque` |
| Movimentos de um pacote | `movimentosDoItem`, `historicoPacote` | `mov_estoque` |

O livro de `origem.ts` lê os movimentos **na ordem em que aconteceram**, entre pacotes diferentes. Hoje a ordem vem do ULID, o que
não é seguro com vários processos. Por isso `mov_estoque.ordem` vem de `sequencias` (`mov_estoque`), na mesma transação. Isso
enfileira as gravações de estoque de **uma** empresa, o que é aceitável neste volume. As tentativas recusadas também ficam na
`auditoria`.

### 3.7 Agenda

`eventos` (com `evento_feitos`) e vendas `agendado` formam o calendário. Os feriados vêm de `config`
(`feriadosPais`, `feriadosRegiao`, `feriadosAjustes`), lidos inteiros, e **uma região vale para a empresa toda**. Filiais em regiões
diferentes pedem `locais.feriados_regiao`, que só deve entrar quando existir esse caso.

### 3.8 Multi-empresa, filiais e B2B

| Conceito | Como é |
|---|---|
| Empresa (tenant) | `empresas`; `empresa_id` em toda tabela de negócio e no começo de todo índice |
| Filial | `locais` da empresa; `usuarios.local_id` e `local_id` em vendas e caixa |
| Login | Único no sistema; a empresa vem do usuário. Não há tela de escolher empresa |
| Isolamento | Toda leitura filtra por empresa e toda gravação usa o `WHERE` de S1. Teste obrigatório: a empresa B não lê nem altera a A |
| Reforço (opcional) | Row-Level Security só no Postgres |
| No aparelho | `empresaId` é fixo (`demo`); o importador troca pelo da empresa real |
| **B2B** | **Não existe como conceito no código.** Cliente atacadista hoje = `pessoas` + coluna própria na tabela de preço + fiado em `mov_conta`. Portal para o cliente comprar fica fora da V1 e precisa de definição do dono |

### 3.9 Etiquetas, QR e vitrine

- `itens.etiqueta_impressa_em` significa **confirmada no papel**, não enviada à impressora.
- QR: `itens.qr_codigo` único, inclusive entre apagados; códigos trocados em `item_qr_anteriores`; leituras recusadas em
  `qr_leituras`. Abre pela consulta `pacoteDoQr`, só logado.
- Vitrine: `modoPreco` e `mensagens` (texto do WhatsApp por idioma) ficam em `configuracoes`; por pacote, `itens.vitrine_oculto` e `itens.vitrine_fator`.

### 3.10 Migrações previstas

Numeração a partir de 003, uma por fase ([§6](#6-ordem-de-implementação-e-riscos)). Cada arquivo roda uma vez e nunca é editado.
Este bloco foi **executado em SQLite e em PostgreSQL 16** em 09/11/2026 com 18 casos (válidos passam; turno duplicado, ordem repetida,
saldo que não fecha, rateio inválido, incorporação dupla e quantidade zero são recusados; outra empresa não sobrescreve). No Postgres
rodou dentro de transação desfeita. As tabelas `itens` e `turnos` vêm de outras migrações.

```sql
-- ========== fundação ==========
CREATE TABLE empresas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,               -- o endereço público da vitrine
  moeda_principal TEXT NOT NULL,
  fuso_horario TEXT NOT NULL DEFAULT 'America/La_Paz',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  apagado_em TEXT
);

CREATE TABLE sessoes (
  token_hash TEXT PRIMARY KEY,             -- guarda só o resumo do token
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  usuario_id TEXT NOT NULL,
  criada_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  revogada_em TEXT
);
CREATE INDEX ix_sessoes_usuario ON sessoes (empresa_id, usuario_id);

CREATE TABLE idempotencia (
  empresa_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  chave TEXT NOT NULL,                     -- "nome:id" (Mensagem.chave)
  resposta TEXT,                           -- NULL = ainda rodando
  criada_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  PRIMARY KEY (empresa_id, usuario_id, chave)
);

CREATE TABLE sequencias (
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,                      -- 'P', 'L', 'T', 'V', 'VG', 'mov_estoque'…
  valor BIGINT NOT NULL DEFAULT 0 CHECK (valor >= 0),
  PRIMARY KEY (empresa_id, nome)
);

-- ========== permissões (padrão do sistema → empresa → pessoa) ==========
CREATE TABLE perfil_permissoes (
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  perfil TEXT NOT NULL CHECK (perfil IN ('funcionario')),
  chave TEXT NOT NULL CHECK (chave IN ('vende', 'agenda', 'tela', 'config', 'idioma')),
  valor TEXT NOT NULL,
  ligado INTEGER NOT NULL DEFAULT 1 CHECK (ligado IN (0, 1)),
  atualizado_em TEXT NOT NULL,
  atualizado_por TEXT,
  PRIMARY KEY (empresa_id, perfil, chave, valor)
);

CREATE TABLE usuario_permissoes (
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  usuario_id TEXT NOT NULL,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  ligado INTEGER NOT NULL CHECK (ligado IN (0, 1)),
  PRIMARY KEY (empresa_id, usuario_id, chave, valor)
);

-- ========== turnos (completa a 002) ==========
CREATE UNIQUE INDEX ux_turnos_aberto ON turnos (empresa_id, usuario_id) WHERE fim IS NULL;
CREATE INDEX ix_turnos_periodo ON turnos (empresa_id, inicio);

-- ========== estoque: o razão ==========
CREATE TABLE mov_estoque (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  ordem BIGINT NOT NULL,                   -- ordem real dos movimentos na empresa (sequencias 'mov_estoque')
  item_id TEXT NOT NULL REFERENCES itens(id),
  data TEXT NOT NULL,
  delta BIGINT NOT NULL CHECK (delta <> 0),
  saldo_antes BIGINT NOT NULL CHECK (saldo_antes >= 0),
  saldo_depois BIGINT NOT NULL CHECK (saldo_depois >= 0),
  motivo TEXT NOT NULL,
  origem_tipo TEXT CHECK (origem_tipo IN ('compra', 'venda', 'triagem', 'lote', 'viagem')),
  origem_id TEXT,
  corrige_id TEXT REFERENCES mov_estoque(id),
  descricao TEXT,
  por_nome TEXT,
  criado_em TEXT NOT NULL,
  criado_por TEXT NOT NULL,
  CHECK (saldo_depois = saldo_antes + delta),
  UNIQUE (empresa_id, ordem)
);
CREATE INDEX ix_mov_estoque_item ON mov_estoque (empresa_id, item_id, ordem);
CREATE INDEX ix_mov_estoque_origem ON mov_estoque (empresa_id, origem_tipo, origem_id);

-- ========== vendas em aberto ==========
CREATE TABLE vendas_abertas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  aberta_em TEXT NOT NULL,                 -- de onde sai "Aberta há 15 min"; não muda ao salvar de novo
  salva_em TEXT NOT NULL,
  por_nome TEXT,
  pessoa_id TEXT,
  vendedor_id TEXT,
  local_id TEXT,
  coluna_id TEXT,
  obs TEXT,
  desconto_modo TEXT CHECK (desconto_modo IN ('pct', 'valor')),
  desconto_pct TEXT,
  desconto_valor BIGINT CHECK (desconto_valor >= 0),
  moeda TEXT,
  total_mostrado BIGINT,
  moeda_total TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  criado_por TEXT NOT NULL,                -- a dona: só ela ou o administrador mexe
  versao INTEGER NOT NULL DEFAULT 1,
  apagado_em TEXT
);
CREATE INDEX ix_vendas_abertas ON vendas_abertas (empresa_id, aberta_em) WHERE apagado_em IS NULL;

CREATE TABLE venda_aberta_linhas (
  id TEXT PRIMARY KEY,
  venda_aberta_id TEXT NOT NULL REFERENCES vendas_abertas(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES itens(id),
  quantidade BIGINT NOT NULL CHECK (quantidade > 0),
  preco_manual BIGINT CHECK (preco_manual >= 0)
);
CREATE INDEX ix_venda_aberta_item ON venda_aberta_linhas (empresa_id, item_id);

-- ========== viagens e rateio ==========
CREATE TABLE viagens (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  destino TEXT,
  na_bolivia INTEGER NOT NULL DEFAULT 0 CHECK (na_bolivia IN (0, 1)),
  inicio TEXT NOT NULL,
  fim TEXT,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'encerrada')),
  orcamento BIGINT CHECK (orcamento >= 0),
  orcamento_compra BIGINT CHECK (orcamento_compra >= 0),
  rateio TEXT NOT NULL DEFAULT 'grama' CHECK (rateio IN ('grama', 'valor')),
  encerrada_em TEXT,
  encerrada_data TEXT,
  encerrada_por_nome TEXT,
  encerramento_obs TEXT,
  obs TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  criado_por TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  apagado_em TEXT,
  CHECK (fim IS NULL OR fim >= inicio),
  CHECK (status = 'aberta' OR encerrada_em IS NOT NULL)
);
CREATE UNIQUE INDEX ux_viagens_codigo ON viagens (empresa_id, codigo) WHERE apagado_em IS NULL;
CREATE INDEX ix_viagens_status ON viagens (empresa_id, status, inicio) WHERE apagado_em IS NULL;

CREATE TABLE viagem_despesas (
  id TEXT PRIMARY KEY,
  viagem_id TEXT NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL,
  data TEXT NOT NULL,
  em TEXT NOT NULL,
  categoria_id TEXT NOT NULL,              -- 'frete' é uma categoria, não uma tabela
  moeda TEXT NOT NULL,
  valor BIGINT NOT NULL CHECK (valor > 0),
  valor_principal BIGINT NOT NULL CHECK (valor_principal >= 0),
  cotacao TEXT,                            -- JSON: a foto da cotação usada
  nota TEXT,
  por TEXT NOT NULL,
  por_nome TEXT NOT NULL,
  anulada_em TEXT,
  anulada_por_nome TEXT,
  anulada_motivo TEXT,
  CHECK ((anulada_em IS NULL) = (anulada_motivo IS NULL))
);
CREATE INDEX ix_viagem_despesas ON viagem_despesas (empresa_id, viagem_id, categoria_id);

CREATE TABLE viagem_incorporacoes (
  id TEXT PRIMARY KEY,
  viagem_id TEXT NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL,
  em TEXT NOT NULL,
  por_nome TEXT NOT NULL,
  total BIGINT NOT NULL CHECK (total >= 0),
  desfeita_em TEXT,
  desfeita_motivo TEXT
);
CREATE UNIQUE INDEX ux_viagem_incorporacao_viva ON viagem_incorporacoes (viagem_id) WHERE desfeita_em IS NULL;

CREATE TABLE viagem_incorporacao_lotes (
  incorporacao_id TEXT NOT NULL REFERENCES viagem_incorporacoes(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES itens(id),
  codigo TEXT,
  gramas BIGINT NOT NULL CHECK (gramas > 0),
  inicial BIGINT NOT NULL CHECK (inicial > 0),
  extra BIGINT NOT NULL CHECK (extra >= 0),
  custo_antes BIGINT NOT NULL CHECK (custo_antes >= 0),
  custo_depois BIGINT NOT NULL CHECK (custo_depois >= custo_antes),
  PRIMARY KEY (incorporacao_id, item_id)
);
```

As demais tabelas seguem o Anexo A, convertidas por [§3.1](#31-dialeto-único), quando a fase delas chegar.

## 4. Contrato da API

### 4.1 Transporte

Só dois endereços, `POST`, corpo binário, sem query string, cookie ou cabeçalho de autorização. Detalhe do envelope:
[api-contract/openapi.yaml](api-contract/openapi.yaml). Além deles, `GET /saude`. Mudou o canal num lado, muda igual no outro
(`src/core/seguranca/envelope.ts` e `internal/canal`).

```json
{ "tipo": "comando", "nome": "fecharTurno", "dados": { "id": "01J…", "contado": { "BOB": 53000 } },
  "id": "msg-1", "ts": 1794240000000, "token": "…", "chave": "fecharTurno:01J…" }
```

`tipo`: `comando`, `consulta`, `auth`, `backup`, `arquivo`.

### 4.2 Resposta e erros

| Situação | Resposta |
|---|---|
| Certo | `{ re, ok: true, r, ts }` |
| Recusa de regra | `{ re, ok: false, erro: { mensagem, campo? }, ts }` |
| Relógio fora da janela | `{ re, ok: false, falha: "relogio", ts }`: nada executou; o app ajusta e repete |
| Outra pessoa alterou antes | Recusa de regra com a mensagem da trava de versão (`versaoBase`) |
| Sem login ou sem permissão | Recusa de regra com as mensagens do app |
| Erro interno | HTTP 500 sem corpo |

**Idempotência**: mesma `chave` da mesma pessoa devolve a resposta guardada, sem executar de novo.

### 4.3 Paginação

Hoje a consulta devolve tudo e a tela pagina (`usePaginacao`, em 15 telas). Com a API:

```json
// pedido: os filtros de sempre, mais página e tamanho
{ "de": "2026-11-01", "busca": "ana", "pagina": 3, "porPagina": 25 }
// resposta quando veio "pagina"
{ "itens": [], "total": 248, "pagina": 3, "porPagina": 25, "resumo": { "vendido": 25069080 } }
```

- **Sem `pagina`, a resposta continua sendo a lista de hoje**: dá para migrar tela por tela.
- Tamanhos aceitos: 10, 25, 50, 100.
- `resumo` existe porque os cartões somam a lista inteira (ex.: "Vendido" em `ListaVendas`); paginada, a tela não teria como somar.
- Filtros e busca passam a ir para o servidor junto com a página.
- Primeiras a migrar: `vendas`, `estoque`, `auditoria`, `logDetalhado`, `comprasDetalhadas`, `vendasDetalhadas`, `livroCabelo`,
  `viagens`, `pessoas`. `caixaDoDia` e `painel` passam a somar em SQL.

### 4.4 Consultas sem login

`SEM_LOGIN` no app: `vitrine`, `configuracoes`, `usuariosDemo`.

| Consulta | No servidor |
|---|---|
| `vitrine` | Aceita sem token, com `{ loja: "<slug>" }` para saber a empresa. Só dados públicos |
| `configuracoes` | Sem token, só o necessário para a tela de entrar (nome, idioma). **Nunca a configuração inteira** |
| `usuariosDemo` | **Não existe em produção** |

### 4.5 Mudanças de outros aparelhos

Hoje `aoMudar` da API não ouve ninguém. Criar a consulta **`mudancas`** `{ desde }` → `{ marca, areas[] }`, chamada a cada ~15 s,
para recarregar só as telas das áreas alteradas. Fica dentro do canal e não precisa de rota nova.

### 4.6 Contratos principais

Perm.: **A** administrador · **F** funcionária também, com o filtro de visibilidade. Todo comando devolve `{ id }`, salvo indicação.
Situação no Go: todos **a portar**.

**Viagens**

| Nome | Tipo | Entrada | Perm. |
|---|---|---|---|
| `salvarViagem` | cmd | `id, nome, destino?, naBolivia?, viajantes[], inicio, fim?, orcamento?, orcamentoCompra?, rateio?, obs?, versaoBase?` | A |
| `adiantarViagem` | cmd | `id, viagemId, moeda, forma, valor, obs?` | A |
| `registrarDespesaViagem` | cmd | `id, viagemId, categoria, moeda, valor, data?, nota?` | F (viagem dela) |
| `anularDespesaViagem` | cmd | `viagemId, despesaId, motivo` | F (o que lançou) |
| `vincularCompras` | cmd | `viagemId, compraIds[], mover?` | A |
| `desvincularCompra` | cmd | `viagemId, compraId` | A |
| `desfazerLigacao` | cmd | `antes[{ compraId, viagemId?, agora? }]` | A |
| `encerrarViagem` | cmd | `viagemId, contado{}, forma?, reembolsar?, incorporar?, fim?, obs?` | A |
| `incorporarCustoViagem` | cmd | `viagemId, seHouver?` | A |
| `reabrirViagem` | cmd | `viagemId, motivo` | A |
| `apagarViagem` | cmd | `viagemId, motivo?` | A |
| `salvarCategoriasViagem` | cmd | `categorias[]` ou `null` | A |
| `viagens` | cons | `status?, viajanteId?, busca?, viagemId?` | F |
| `viagem` | cons | `id` → KPIs, DRE, rateio, plano de incorporação | A |
| `previaLigarCompras` | cons | `viagemId, compraIds[]` | A |
| `viagensParecidas` | cons | `id?, nome?, destino?, inicio?, fim?` | A |
| `painelViajante` | cons | `viagemId?` | F |
| `categoriasViagem`, `viagensParaFiltro` | cons | — | F |

**Turnos**

| Nome | Tipo | Entrada | Perm. |
|---|---|---|---|
| `abrirTurno` | cmd | `id, trocoInicial?` | F |
| `fecharTurno` | cmd | `id, contado{moeda: valor}, obs?` | F |
| `anotarTurno` | cmd | `id, nota` | A |
| `turnoAtual` | cons | — | F |
| `turnos` | cons | `de?, ate?, usuarioId?` (funcionária sem `esperado` e `diferenca`) | F |

**Vendas em aberto**

| Nome | Tipo | Entrada | Perm. |
|---|---|---|---|
| `salvarVendaAberta` | cmd | `id, linhas[{ id, itemId, quantidade, precoManual? }], pessoaId?, colunaId?, vendedorId?, localId?, obs?, desconto?, moeda?, total?, moedaTotal?` | F (a dela) |
| `descartarVendaAberta` | cmd | `id, motivo?` | F (a dela) |
| `tirarDaVendaAberta` | cmd | `id, itemId, para?` | F |
| `reduzirNaVendaAberta` | cmd | `id, itemId, quantidade, para?` | F |
| `vendasAbertas` | cons | — → `[{ id, abertaEm, salvaEm, minha, porNome, cliente, total, moedaTotal, linhas[], venda }]` | F (só as dela) |

**Cancelamento**

| Nome | Tipo | Entrada | Perm. |
|---|---|---|---|
| `cancelarVenda` | cmd | `id, motivo` | A; F só desmarca o agendamento dela |
| `corrigirVenda` | cmd | `id, linhas[], motivo, diferenca?` | A |
| `cancelarCompra` | cmd | `id, motivo` | A |
| `estornarLancamento` | cmd | `lancamentoId, motivo?` | A |

**Auditoria e rastreio** (todas administrador)

| Nome | Entrada |
|---|---|
| `auditoria` | `de?, ate?, usuarioId?, acao?, categoria?, busca?, alvoId?, limite?` |
| `registroAuditoria` | `id` |
| `logDetalhado` | `de?, ate?, usuarioId?, acao?, busca?, limite?` |
| `linhaDoTempo` | `id` |
| `genealogia`, `rastreio`, `movimentosDoItem`, `historicoPacote`, `livroCabelo` | ver `triagem.ts`, `estoque.ts`, `livro.ts` |
| `origemDoPacote` | `itemId, gramas?` |
| `origemDaVenda` | `vendaId` |

### 4.7 Catálogo completo

Gerado de `src/core/services/index.ts` e `permissoes.ts`. O sinal ᶠ marca o que a funcionária também pode; sem ele, só administrador.
A fonte da verdade é o código.

| Domínio | Tipo | Nomes |
|---|---|---|
| `caixa` | comandos | `lancarCaixa` · `estornarLancamento` · `encerrarDia` · `reabrirDia` |
| `estoque` | comandos | `salvarItem` · `ajustarEstoque` · `transformarLote` · `separarLote` · `marcarLotes` · `editarAtributosLote` · `marcarEtiquetasImpressas` · `refazerEtiqueta` · `reservarLote` · `prepararQrEtiquetas` |
| `codigos` | comandos | `salvarCodigos` · `salvarSigla` · `trocarCodigoCompra` · `trocarCodigoLote` |
| `triagem` | comandos | `unificarLotes` · `moverFaseTriagem` · `salvarFluxoTriagem` · `triarLotes` · `desfazerTriagem` · `tirarDaMistura` |
| `precos` | comandos | `salvarTabelaPreco` |
| `contas` | comandos | `registrarAcerto` · `ajustarConta` |
| `compras` | comandos | `criarCompra` · `avancarTriagem` · `pagarCompra` · `cancelarCompra` · `conferirPesoCompra` · `definirValorCompra` |
| `vendasAbertas` | comandos | `salvarVendaAberta`ᶠ · `descartarVendaAberta`ᶠ · `tirarDaVendaAberta`ᶠ · `reduzirNaVendaAberta`ᶠ |
| `turnos` | comandos | `fecharTurno`ᶠ · `abrirTurno`ᶠ · `anotarTurno` |
| `cidades` | comandos | `salvarCidade`ᶠ |
| `formCompra` | comandos | `salvarFormCompra` |
| `vendas` | comandos | `concluirVenda`ᶠ · `atenderAgendamento`ᶠ · `cancelarVenda`ᶠ · `corrigirVenda` |
| `divisao` | comandos | `salvarDivisaoVenda` |
| `impostoRenda` | comandos | `classificarDocumentoFiscal` · `registrarObrigacaoFiscal` · `removerObrigacaoFiscal` · `mudarSituacaoExercicio` |
| `comissoes` | comandos | `pagarComissao` |
| `agenda` | comandos | `salvarEvento`ᶠ · `excluirEvento`ᶠ · `concluirEvento`ᶠ · `receberAtendimento`ᶠ |
| `servicosSalao` | comandos | `criarServicoRapido`ᶠ · `revisarServico` · `restaurarBibliotecaServicos` |
| `usuarios` | comandos | `salvarUsuario` · `trocarMinhaSenha`ᶠ |
| `emprestimos` | comandos | `criarEmprestimo` · `pagarEmprestimo` |
| `cadastros` | comandos | `salvarPessoa`ᶠ · `salvarLocal` · `salvarCotacao`ᶠ · `salvarCambio` · `registrarBuscaCambio`ᶠ · `salvarConfig` · `salvarModulo` · `salvarFluxoCompra` · `salvarAtributos` · `registrarAnexo`ᶠ · `removerAnexo` |
| `equipe` | comandos | `pagarSalario` |
| `fotos` | comandos | `definirMiniatura`ᶠ |
| `viagens` | comandos | `salvarViagem` · `adiantarViagem` · `registrarDespesaViagem`ᶠ · `anularDespesaViagem`ᶠ · `vincularCompras` · `desvincularCompra` · `encerrarViagem` · `desfazerLigacao` · `apagarViagem` · `incorporarCustoViagem` · `reabrirViagem` · `salvarCategoriasViagem` |
| `financiamentos` | comandos | `criarFinanciamento` · `registrarEntregaFinanciamento` · `receberFinanciamento` · `pagarDiferencaFinanciamento` · `abaterComissaoFinanciamento` · `encerrarFinanciamento` · `ajustarFinanciamento` |
| `cadastros` | consultas | `fluxosCompra` · `atributosItem` · `pessoas`ᶠ · `fichaPessoa`ᶠ · `locais`ᶠ · `configuracoes`ᶠ · `cambio` · `anexosDe`ᶠ |
| `painel` | consultas | `painel` · `operacao` · `diagnostico` |
| `resumo` | consultas | `resumoMenu`ᶠ |
| `caixa` | consultas | `caixaDoDia` · `diasDoCaixa` |
| `estoque` | consultas | `estoque`ᶠ · `catalogo`ᶠ · `movimentosDoItem` · `fichaItem` · `pacoteVenda`ᶠ · `rastreio` · `pacoteDoQr`ᶠ |
| `codigos` | consultas | `codigos` · `codigoDisponivel` · `modoEtiqueta`ᶠ |
| `triagem` | consultas | `triagem` · `fluxosTriagem` · `genealogia` · `triagens` · `mistura` |
| `origem` | consultas | `origemDoPacote` · `origemDaVenda` |
| `leitura` | consultas | `lerCodigoPacote`ᶠ |
| `vendasAbertas` | consultas | `vendasAbertas`ᶠ |
| `turnos` | consultas | `turnoAtual`ᶠ · `turnos`ᶠ |
| `vendas` | consultas | `custoDaVenda`ᶠ · `vendas`ᶠ · `venda`ᶠ · `agenda`ᶠ · `conflitosAgenda`ᶠ |
| `reposicao` | consultas | `reposicao` |
| `metas` | consultas | `metas`ᶠ |
| `vitrine` | consultas | `vitrine` |
| `viagemCurta` | consultas | `viagensParaFiltro`ᶠ |
| `cidades` | consultas | `cidades`ᶠ |
| `livro` | consultas | `livroCabelo` · `historicoPacote` |
| `precos` | consultas | `tabelasPreco`ᶠ · `tabelaVigente`ᶠ · `listaTabelasPreco` · `versoesEmUso`ᶠ · `historicoTabela` · `versoesTabela` · `compararVersoes` · `tabelaPreco` · `calcularPreco`ᶠ |
| `contas` | consultas | `contas` · `contaPessoa` |
| `equipe` | consultas | `organograma`ᶠ · `resumoFuncionario`ᶠ · `unidades` · `sugestaoSalario` · `ultimoLancamento` |
| `historico` | consultas | `linhaDoTempo` · `logDetalhado` |
| `auditoria` | consultas | `auditoria` · `registroAuditoria` |
| `relatorios` | consultas | `dre` · `livroCaixa` · `inventario` · `balanco` · `vendasDetalhadas` · `comprasDetalhadas` |
| `compras` | consultas | `filaTriagem` · `compra` · `pedido` |
| `formCompra` | consultas | `formCompra` |
| `documentos` | consultas | `documentoVenda` |
| `divisao` | consultas | `divisaoVenda` |
| `impostoRenda` | consultas | `impostoRenda` · `exerciciosFiscais` |
| `agenda` | consultas | `calendario`ᶠ · `feriados` · `agendaFiltros`ᶠ · `evento`ᶠ |
| `contabilidade` | consultas | `relatorioContabil` · `impostosOperacao`ᶠ |
| `comissoes` | consultas | `comissoes`ᶠ |
| `servicosSalao` | consultas | `servicosReceitaInsumos` |
| `usuarios` | consultas | `usuarios` · `usuariosDemo`ᶠ |
| `emprestimos` | consultas | `emprestimos` · `emprestimo` |
| `fotos` | consultas | `fotosDoLote`ᶠ · `etiquetas`ᶠ |
| `viagens` | consultas | `viagens`ᶠ · `viagem` · `previaLigarCompras` · `viagensParecidas` · `painelViajante`ᶠ · `categoriasViagem`ᶠ |
| `financiamentos` | consultas | `financiamentos`ᶠ · `financiamento`ᶠ · `origemFinanciamento` |

## 5. Permissões: admin × funcionária

Três camadas, nesta ordem, todas no servidor:

| Camada | No app | No Go | Decide |
|---|---|---|---|
| 1. Perfil | `permissoes.ts` | `handler/permissoes.go` | Qual nome a pessoa pode chamar |
| 2. Liberação | `config.funcionaria*`, `exigirTelaLiberada` | `perfil_permissoes`, `usuario_permissoes` | O que a empresa libera: vender, agenda, telas |
| 3. Visibilidade | `visibilidade.ts` | Pacote a criar, porta 1:1 | Quais registros e campos ela recebe |

- **Permissão efetiva** = padrão do sistema → empresa → pessoa. Administrador não tem linhas: pode tudo.
- **Gerente** não é um terceiro perfil: é funcionária com `verAgendaEquipe`, que vê a equipe da unidade.
- **Campos que a funcionária nunca recebe**: custo, margem, fornecedor, salário, documento, comissão de colegas (`SENSIVEIS`).
- **Saída por perfil**: em Go, estruturas separadas para administrador e funcionária, em vez de apagar campos depois. Assim, campo
  novo nasce escondido. O teste `funcionariaNaoVe` é o contrato.
- **Divisão interna da venda**: `podeVerDivisao` (administrador ou dona da linha, só com divisão de verdade).
- Senha: resumo PBKDF2 com sal, calculado no servidor; o administrador nunca vê senha de ninguém.
- Ao portar: copiar a linha de `permissoes.ts` para `permissoes.go`. Regra nova de visibilidade entra primeiro no app, com teste.

## 6. Ordem de implementação e riscos

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0 · Fundação** | S1–S4 e S6, `Transacoes`/`Tx`, `empresas`, `sessoes`, `idempotencia`, `sequencias`, paginação, `auditoria_ligados` | Reinício não derruba sessão; teste empresa A × B passa nos dois bancos |
| **1 · Cadastros e permissões** | `configuracoes`, `pessoas`, `usuarios`, cotações, visibilidade, permissões | `funcionariaNaoVe` contra o servidor |
| **2 · Caixa e turnos** | `moverCaixa`, dia do caixa, conta corrente, `turnos` | Conferência cega; trava de turno aberto |
| **3 · Estoque** | Itens, `mov_estoque` com `ordem`, reservas | Teste de duas vendas simultâneas no Postgres |
| **4 · Compras** | Criar, etapas, pagar, cancelar, conferir peso | Testes de compra do app |
| **5 · Vendas** | Concluir, cancelar, corrigir, vendas em aberto, comissões | `caosVendas`, `modoCaixaEstresse` |
| **6 · Triagem e preços** | Triagens, genealogia, origem em gramas, etiquetas, QR, tabelas | `diagnosticoEstoque`, testes de triagem |
| **7 · Viagens e dívidas** | Carteira, despesas, rateio, incorporação, adiantamentos, empréstimos | Testes de viagem e financiamento |
| **8 · Agenda e equipe** | Eventos, calendário, feriados, salários, serviços | Testes de calendário |
| **9 · Relatórios** | Painel, DRE, balanço, contábil, IR, auditoria em SQL | `relatorios-verdade.caos` |
| **10 · Corte** | Importador, rodar em paralelo, trocar por empresa | [§7.4](#74-virada-para-produção) |

| Risco | Mitigação |
|---|---|
| Conta diferente entre TS e Go (arredondamento, câmbio, rateio) | Rodar os cenários do app contra o servidor (`npm run test:ponta`), com entradas e saídas iguais |
| Corridas que a fila única do aparelho esconde | [§2.3](#23-transação-e-concorrência) e teste de concorrência em todo comando de estoque e caixa |
| Diferença entre SQLite e Postgres | Suíte de repositório nos dois bancos no CI. **Concorrência só vale se testada no Postgres** |
| Consultas que leem tudo | SQL com índice por fase; `caixaDoDia` não soma todo o histórico |
| Todo comando recarrega todas as telas | Consulta `mudancas` e invalidação por área |
| Volume (CAOS-D-05) | Paginação no servidor e índices |
| Duas fontes de "é admin" | `usuarios.perfil` vale; remover `pessoa.acesso` |
| Comissão identificada por texto (`categoria === 'Comissões'`) | Coluna `finalidade` em `mov_caixa` |
| Sessões do canal em memória | Com mais de uma instância, Redis ou afinidade |

## 7. Guia de migração e consistência

### 7.1 Os modos de dados

| Modo | Onde ficam os dados | Para quê | Modo Teste? |
|---|---|---|---|
| `memory` | Memória | Testes automáticos | — |
| `local` | IndexedDB do aparelho | Demonstração, site publicado hoje | **Sim** |
| `api` + SQLite | Arquivo no servidor | Desenvolvimento, instalação simples | Não |
| `api` + PostgreSQL | Banco gerenciado | Produção | Não |

A escolha é única, em `src/app/criarBackend.ts` (`VITE_STORAGE`, `VITE_API_URL`). As telas não mudam. A troca manual fica só em
desenvolvimento ou com `VITE_PERMITIR_TROCAR_DADOS=1`.

### 7.2 Modo Teste e cenários

- Vive em `src/adapters/cenarios.ts` e `ModoTeste.tsx`. Cenários `loja`, `turnoErro`, `vazio`, montados **pelos mesmos comandos das telas**.
- Com `backend.tipo === 'api'`, a tela se recusa: no servidor nada é apagado por ela.
- **Dados de teste no servidor** (desenvolvimento e homologação): um programa a criar, `cmd/semear`, que cria uma empresa à parte e chama os
  mesmos `usecase`. Recusa rodar se `AMBIENTE=producao`. Não existe "zerar tudo" em produção.
- A senha de acesso da demonstração é só para o modo aparelho.

### 7.3 Do aparelho para o servidor

Formato de origem: backup `tudo-backup` versão 1 (`noAparelho.exportar`), com coleções e arquivos.

1. **Congelar**: sem vendas durante a importação. Fazer o backup e guardar o arquivo original.
2. **Conferir antes**: rodar `diagnostico` no aparelho. Com problema, corrigir primeiro.
3. **Importar** com um programa a criar, `cmd/importar`, numa transação por empresa, nesta ordem:

   | # | Dados | Atenção |
   |---|---|---|
   | 1 | Empresa, moedas, configuração | Trocar `empresaId: demo` |
   | 2 | Usuários, pessoas, locais | Resumo e sal da senha vêm iguais |
   | 3 | Sequências | Maior número usado por letra, ou o contador se for maior |
   | 4 | Itens, triagens, origens | `campos` com regra viram colunas |
   | 5 | Tabelas de preço e versões | Versões saem da `auditoria` |
   | 6 | Compras, vendas, linhas, pagamentos, etapas | Separar `transacoes` por `tipo` |
   | 7 | Razões `mov_*` | Manter a ordem; `mov_estoque.ordem` segue a ordem dos ids. Ids derivados (`-u`, `-corr-N`, `-<n>`) ficam iguais |
   | 8 | Viagens, adiantamentos, empréstimos | `incorporacao` e desfeitas viram linhas |
   | 9 | Vendas em aberto, turnos, cidades, IR | Saem do `config`. `abertaEm` ausente usa `criadoEm` |
   | 10 | Agenda, anexos, auditoria | Arquivos para o armazenamento do servidor |

4. **Reconciliar** antes de confirmar. Qualquer diferença desfaz a importação:

   | Conferência | Deve bater |
   |---|---|
   | Por item | `itens.saldo` = soma de `mov_estoque.delta` |
   | Por moeda e dia | Soma de `mov_caixa` igual à do app |
   | Por pessoa | Saldo de `mov_conta` |
   | Global | Totais de vendas e compras; `diagnostico` sem problemas |
   | Quantidade | Registros por coleção = linhas importadas |

5. **Reimportação** é idempotente: mesmo `id` não duplica.

### 7.4 Virada para produção

1. Rodar em paralelo por uma semana, comparando painel, caixa e estoque; diferença zero para seguir.
2. Virar por empresa ou unidade, trocando `VITE_STORAGE=api`.
3. Guardar o backup do aparelho; a volta é possível até a primeira venda no servidor.
4. Backup do Postgres diário com teste de restauração, antes da primeira empresa real.

### 7.5 Regras permanentes de consistência

- Mudança de esquema = arquivo novo em `migrations/`, que precisa rodar nos dois bancos.
- Comando novo no app: `index.ts`, `permissoes.ts`, `historico.ts`, `openapi.yaml` e este catálogo.
- Campo novo em registro: conferir `visibilidade.ts` e o importador.
- Mudou canal ou funcionalidade portada: rodar `scripts\ponta-a-ponta.ps1`.

## Anexo A — DDL de referência (PostgreSQL)

Desenho lógico das tabelas, **histórico nos tipos**. Conferido em 05/11/2026 num PostgreSQL 16. Não rodar direto: as migrações reais
seguem [§3.1](#31-dialeto-único). Onde divergir de [§3](#3-estrutura-de-dados), vale §3: `turnos`, `turno_valores`, `refresh_tokens`,
`vendas_abertas`, `mov_estoque` e `auditoria.ligados` mudaram.

```sql
-- =====================================================================
-- 0. EXTENSÕES E DOMÍNIOS
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- busca por nome/código com ILIKE '%x%'
CREATE EXTENSION IF NOT EXISTS btree_gist; -- EXCLUDE com igualdade + intervalo (turnos da mesma pessoa não se sobrepõem)

CREATE DOMAIN ident        AS text    CHECK (VALUE ~ '^[0-9A-Za-z][0-9A-Za-z_-]{0,63}$');
CREATE DOMAIN dinheiro     AS bigint  CHECK (VALUE BETWEEN -10000000000 AND 10000000000);
CREATE DOMAIN quantidade   AS bigint  CHECK (VALUE BETWEEN -10000000000 AND 10000000000);
CREATE DOMAIN pontos_base  AS integer CHECK (VALUE BETWEEN 0 AND 10000);
CREATE DOMAIN codigo_moeda AS char(3) CHECK (VALUE ~ '^[A-Z]{3}$');
CREATE DOMAIN fator        AS numeric(18,6) CHECK (VALUE > 0);

COMMENT ON DOMAIN ident        IS 'Identificador. ULID (26 caracteres Crockford) nos registros novos; aceita ids legados derivados ("<ulid>-u", "<ulid>-corr-1", "AAAA-MM-DD").';
COMMENT ON DOMAIN dinheiro     IS 'Valor monetário inteiro na MENOR unidade da moeda (centavos; guarani sem casas). Limite ±10 bilhões, igual ao app.';
COMMENT ON DOMAIN quantidade   IS 'Quantidade inteira na unidade base do item (grama, peça, vez de serviço).';
COMMENT ON DOMAIN pontos_base  IS 'Percentual em pontos-base: 10000 = 100%, 5000 = 50%, 1 = 0,01%.';
COMMENT ON DOMAIN codigo_moeda IS 'Código ISO 4217 de 3 letras (BOB, USD, BRL, PYG).';
COMMENT ON DOMAIN fator        IS 'Fator decimal exato (ex.: 3,5 por grama) — o app guarda texto "3,5"; aqui NUMERIC exato.';

-- =====================================================================
-- 1. PLATAFORMA E SEGURANÇA
-- =====================================================================
CREATE TABLE moedas (
  codigo   codigo_moeda PRIMARY KEY,
  nome     text     NOT NULL CHECK (length(btrim(nome)) > 0),
  simbolo  text     NOT NULL CHECK (length(btrim(simbolo)) > 0),
  casas    smallint NOT NULL CHECK (casas BETWEEN 0 AND 4),
  pais     text     NOT NULL
);

CREATE TABLE empresas (
  id              ident PRIMARY KEY,
  nome            text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  moeda_principal codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  fuso_horario    text NOT NULL DEFAULT 'America/La_Paz',
  idioma          text NOT NULL DEFAULT 'pt' CHECK (idioma IN ('pt','es')),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  versao          integer NOT NULL DEFAULT 1 CHECK (versao >= 1)
);

CREATE TABLE usuarios (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  login            text NOT NULL CHECK (login ~ '^[a-z0-9._-]{3,30}$'),
  nome             text NOT NULL CHECK (length(btrim(nome)) > 0),
  perfil           text NOT NULL CHECK (perfil IN ('admin','funcionario')),
  pessoa_id        ident,            -- FK adicionada depois de "pessoas"
  local_id         ident,            -- FK adicionada depois de "locais"
  senha_hash       text NOT NULL,
  ativo            boolean NOT NULL DEFAULT true,
  sistema          boolean NOT NULL DEFAULT false,
  ultimo_acesso_em timestamptz
);
CREATE UNIQUE INDEX ux_usuarios_login ON usuarios (login) WHERE apagado_em IS NULL;          -- login (entrar)
CREATE INDEX ix_usuarios_empresa ON usuarios (empresa_id, ativo);                              -- tela Usuários; "pelo menos 1 admin ativo"

CREATE TABLE refresh_tokens (
  id              ident PRIMARY KEY,
  empresa_id      ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  usuario_id      ident NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash      bytea NOT NULL UNIQUE,
  familia_id      ident NOT NULL,
  emitido_em      timestamptz NOT NULL DEFAULT now(),
  expira_em       timestamptz NOT NULL,
  revogado_em     timestamptz,
  substituido_por ident REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent      text,
  ip              inet,
  CHECK (expira_em > emitido_em)
);
CREATE INDEX ix_refresh_usuario ON refresh_tokens (usuario_id) WHERE revogado_em IS NULL;     -- revogar todos ao desativar usuário
CREATE INDEX ix_refresh_familia ON refresh_tokens (familia_id);                               -- detecção de reuso (revoga a família)

CREATE TABLE idempotencia (
  empresa_id  ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  usuario_id  ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  chave       text  NOT NULL CHECK (length(chave) BETWEEN 8 AND 200),
  comando     text  NOT NULL,
  hash_dados  bytea NOT NULL,
  status      text  NOT NULL CHECK (status IN ('em_andamento','concluido')),
  resposta    jsonb,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  expira_em   timestamptz NOT NULL,
  PRIMARY KEY (empresa_id, usuario_id, chave),
  CHECK (status = 'em_andamento' OR resposta IS NOT NULL)
);
CREATE INDEX ix_idempotencia_expira ON idempotencia (expira_em);                               -- limpeza periódica

CREATE TABLE auditoria (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  acao          text NOT NULL CHECK (length(acao) BETWEEN 1 AND 60),
  alvo_id       ident,
  resumo        text NOT NULL,
  usuario_nome  text,
  ligados       text[] NOT NULL DEFAULT '{}',
  dados         jsonb,
  recusado      boolean NOT NULL DEFAULT false
);
CREATE INDEX ix_auditoria_quando ON auditoria (empresa_id, criado_em DESC);                    -- tela Auditoria / logDetalhado (período, paginado)
CREATE INDEX ix_auditoria_alvo   ON auditoria (empresa_id, alvo_id, criado_em DESC);           -- linhaDoTempo de um registro
CREATE INDEX ix_auditoria_ligados ON auditoria USING gin (ligados);                            -- linhaDoTempo pelos registros ligados
CREATE INDEX ix_auditoria_acao   ON auditoria (empresa_id, acao, criado_em DESC);              -- filtro por ação / área
CREATE INDEX ix_auditoria_usuario ON auditoria (empresa_id, criado_por, criado_em DESC);       -- filtro por usuário

-- =====================================================================
-- 2. CONFIGURAÇÃO E REFERÊNCIA
-- =====================================================================
CREATE TABLE modulos (
  empresa_id    ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  id            text  NOT NULL CHECK (id ~ '^[a-z][a-z0-9_-]{1,30}$'),
  nome          text  NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  personalizado boolean NOT NULL DEFAULT false,
  definicao     jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  versao        integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  PRIMARY KEY (empresa_id, id),
  CHECK (personalizado OR definicao IS NULL)
);

CREATE TABLE configuracoes (
  empresa_id     ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  chave          text  NOT NULL CHECK (chave IN ('geral','codigos','formCompra','fluxosCompra','atributosItem','categoriasViagem','cambioStatus')),
  valor          jsonb NOT NULL CHECK (jsonb_typeof(valor) IN ('object','array')),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por ident REFERENCES usuarios(id) ON DELETE RESTRICT,
  versao         integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  PRIMARY KEY (empresa_id, chave)
);

CREATE TABLE formas_pagamento (
  empresa_id  ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  id          text  NOT NULL CHECK (id ~ '^[a-z0-9_-]{1,30}$'),
  nome        text  NOT NULL CHECK (length(btrim(nome)) > 0),
  vivo        boolean NOT NULL DEFAULT false,
  moedas      char(3)[] NOT NULL CHECK (cardinality(moedas) >= 1),
  desconto_bp pontos_base,
  ordem       smallint NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (empresa_id, id)
);

CREATE TABLE socios (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  nome      text NOT NULL CHECK (length(btrim(nome)) > 0),
  parte_bp  pontos_base NOT NULL CHECK (parte_bp > 0),
  pessoa_id ident            -- FK depois de "pessoas"
);
CREATE INDEX ix_socios_empresa ON socios (empresa_id) WHERE apagado_em IS NULL;               -- divisão do lucro

CREATE TABLE sequencias (
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  chave      text  NOT NULL CHECK (chave IN ('compra','lote','triagem','venda','viagem','adiantamento')),
  ultimo     bigint NOT NULL DEFAULT 0 CHECK (ultimo >= 0),
  prefixo    text  NOT NULL DEFAULT '',
  digitos    smallint NOT NULL DEFAULT 4 CHECK (digitos BETWEEN 0 AND 10),
  PRIMARY KEY (empresa_id, chave)
);

CREATE TABLE cotacoes (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  moeda       codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  valor       numeric(24,12) NOT NULL CHECK (valor > 0),
  valor_texto text NOT NULL,
  sentido     text NOT NULL CHECK (sentido IN ('basePorMoeda','moedaPorBase')),
  contra      codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  data        date NOT NULL,
  uso         text NOT NULL DEFAULT 'base' CHECK (uso IN ('base','venda','compra')),
  fonte       text NOT NULL DEFAULT 'manual' CHECK (fonte IN ('manual','auto'))
);
CREATE INDEX ix_cotacoes_vigente ON cotacoes (empresa_id, moeda, uso, data DESC, criado_em DESC) WHERE apagado_em IS NULL;  -- última cotação por moeda/uso (cotacoesAtuais)

CREATE TABLE cidades (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  nome         text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 80),
  departamento text,
  pais         text NOT NULL DEFAULT 'Bolívia',
  chave_busca  text NOT NULL
);
CREATE UNIQUE INDEX ux_cidades_chave ON cidades (empresa_id, chave_busca) WHERE apagado_em IS NULL;   -- "não duplica" sem acento/maiúscula

-- =====================================================================
-- 3. CADASTROS
-- =====================================================================
CREATE TABLE locais (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  nome       text NOT NULL CHECK (length(btrim(nome)) > 0),
  apelido    text,
  tipo       text NOT NULL CHECK (tipo IN ('salao','ponto','outro')),
  rua text, numero text, bairro text, cidade text, pais text, referencia text
);
CREATE INDEX ix_locais_empresa ON locais (empresa_id) WHERE apagado_em IS NULL;                -- lista de unidades / filtros

CREATE TABLE pessoas (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  nome              text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  telefone          text,
  documento         text,
  obs               text,
  comissao_bp       pontos_base,
  local_id          ident REFERENCES locais(id) ON DELETE RESTRICT,
  cargo             text,
  salario_moeda     codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  salario_valor     dinheiro CHECK (salario_valor >= 0),
  salario_periodo   text CHECK (salario_periodo IN ('mes','semana','dia')),
  superior_id       ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  ver_agenda_equipe boolean NOT NULL DEFAULT false,
  sigla             text CHECK (sigla ~ '^[A-Z0-9]{1,6}$'),
  CHECK (superior_id IS NULL OR superior_id <> id),
  CHECK ((salario_valor IS NULL) = (salario_moeda IS NULL))
);
CREATE INDEX ix_pessoas_nome  ON pessoas USING gin (nome gin_trgm_ops);                         -- busca de pessoa (buscaPessoa)
CREATE INDEX ix_pessoas_local ON pessoas (empresa_id, local_id) WHERE apagado_em IS NULL;       -- equipe por unidade
CREATE INDEX ix_pessoas_superior ON pessoas (superior_id) WHERE superior_id IS NOT NULL;        -- organograma
CREATE UNIQUE INDEX ux_pessoas_sigla ON pessoas (empresa_id, sigla) WHERE sigla IS NOT NULL AND apagado_em IS NULL; -- código "por pessoa"

CREATE TABLE pessoa_papeis (
  pessoa_id ident NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  papel     text  NOT NULL CHECK (papel IN ('cliente','fornecedor','doadora','profissional','funcionario','devedor','credor','socio')),
  PRIMARY KEY (pessoa_id, papel)
);
CREATE INDEX ix_pessoa_papeis_papel ON pessoa_papeis (papel, pessoa_id);                        -- pessoas({papel}) e visibilidade (clientes/equipe)

ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE RESTRICT;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_local  FOREIGN KEY (local_id)  REFERENCES locais(id)  ON DELETE RESTRICT;
ALTER TABLE socios   ADD CONSTRAINT fk_socios_pessoa   FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ux_usuarios_pessoa ON usuarios (pessoa_id) WHERE pessoa_id IS NOT NULL AND apagado_em IS NULL;  -- 1 usuário por pessoa

-- =====================================================================
-- 4. ESTOQUE E TRIAGEM
-- =====================================================================
CREATE TABLE triagem_colunas (
  empresa_id         ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  modulo_id          text  NOT NULL,
  id                 text  NOT NULL CHECK (id ~ '^[a-z0-9_-]{1,30}$'),
  nome               text  NOT NULL,
  ordem              smallint NOT NULL,
  cor                text,
  ajuda              text,
  entrada            boolean NOT NULL DEFAULT false,
  pronto             boolean NOT NULL DEFAULT false,
  separar_ao_entrar  boolean NOT NULL DEFAULT false,
  lembrar_fotos      boolean NOT NULL DEFAULT false,
  exigir_foto        boolean NOT NULL DEFAULT false,
  pedir_peso         boolean NOT NULL DEFAULT false,
  PRIMARY KEY (empresa_id, modulo_id, id),
  FOREIGN KEY (empresa_id, modulo_id) REFERENCES modulos(empresa_id, id) ON DELETE RESTRICT,
  UNIQUE (empresa_id, modulo_id, ordem)
);
CREATE UNIQUE INDEX ux_triagem_coluna_entrada ON triagem_colunas (empresa_id, modulo_id) WHERE entrada;  -- só 1 coluna de entrada

CREATE TABLE triagens (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  codigo            text NOT NULL,
  modulo_id         text NOT NULL,
  por_nome          text NOT NULL,
  quantidade_usada  quantidade CHECK (quantidade_usada > 0),
  perda             quantidade CHECK (perda >= 0),
  custo_extra       dinheiro NOT NULL DEFAULT 0 CHECK (custo_extra >= 0),
  motivo            text,
  desfeita_em       timestamptz,
  desfeita_por      ident REFERENCES usuarios(id) ON DELETE RESTRICT,
  desfeita_motivo   text,
  FOREIGN KEY (empresa_id, modulo_id) REFERENCES modulos(empresa_id, id) ON DELETE RESTRICT,
  CHECK ((desfeita_em IS NULL) = (desfeita_motivo IS NULL))
);
CREATE UNIQUE INDEX ux_triagens_codigo ON triagens (empresa_id, codigo);                        -- "T-0003" único
CREATE INDEX ix_triagens_lista ON triagens (empresa_id, modulo_id, criado_em DESC);            -- consulta triagens (aba da Triagem)

CREATE TABLE itens (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  modulo_id             text NOT NULL,
  tipo_item             text NOT NULL,
  nome                  text NOT NULL CHECK (length(btrim(nome)) > 0),
  unidade               text NOT NULL CHECK (unidade IN ('grama','peca','servico')),
  controla_estoque      boolean NOT NULL,
  ativo                 boolean NOT NULL DEFAULT true,
  saldo                 quantidade NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  preco_sugerido_moeda  codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  preco_sugerido_valor  dinheiro CHECK (preco_sugerido_valor >= 0),
  estoque_ideal         quantidade CHECK (estoque_ideal >= 0),
  duracao_min           integer CHECK (duracao_min BETWEEN 1 AND 1440),
  retorno_dias          integer CHECK (retorno_dias BETWEEN 1 AND 3650),
  comissao_bp           pontos_base,
  insumo_moeda          codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  insumo_valor          dinheiro CHECK (insumo_valor >= 0),
  custo_principal       dinheiro CHECK (custo_principal >= 0),
  quantidade_inicial    quantidade CHECK (quantidade_inicial > 0),
  origem_tipo           text CHECK (origem_tipo IN ('compra','transformacao','cadastro','unificacao')),
  origem_compra_id      ident,               -- FK depois de "compras"
  origem_pessoa_id      ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  codigo                text,
  codigo_busca          text,
  estado                text CHECK (estado IN ('Bruto','Não identificado','Separado')),
  comprimento_cm        integer CHECK (comprimento_cm BETWEEN 1 AND 500),
  categoria             text,
  fase_coluna_id        text,
  fase_desde            timestamptz,
  fase_obs              text,
  triagem_id            ident REFERENCES triagens(id) ON DELETE RESTRICT,
  triagem_papel         text CHECK (triagem_papel IN ('saida','intermediario')),
  rateio_custo          text CHECK (rateio_custo IN ('peso','valor')),
  etiqueta_impressa_em  timestamptz,
  etiqueta_impressa_por text,
  etiqueta_peso         quantidade CHECK (etiqueta_peso >= 0),
  etiqueta_via          integer NOT NULL DEFAULT 1 CHECK (etiqueta_via >= 1),
  etiqueta_cancelada_em timestamptz,
  etiqueta_cancelada_motivo text,
  etiqueta_cancelada_por text,
  qr_codigo             text,
  qr_gerado_em          timestamptz,
  vitrine_oculto        boolean NOT NULL DEFAULT false,
  reserva_para          text,
  reserva_pessoa_id     ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  reserva_ate           date,
  reserva_obs           text,
  reserva_em            timestamptz,
  reserva_por_nome      text,
  atributos             jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(atributos) = 'object'),
  FOREIGN KEY (empresa_id, modulo_id) REFERENCES modulos(empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, modulo_id, fase_coluna_id) REFERENCES triagem_colunas(empresa_id, modulo_id, id) ON DELETE RESTRICT,
  CHECK (controla_estoque OR saldo = 0),
  CHECK ((preco_sugerido_valor IS NULL) = (preco_sugerido_moeda IS NULL)),
  CHECK ((insumo_valor IS NULL) = (insumo_moeda IS NULL)),
  CHECK ((triagem_id IS NULL) = (triagem_papel IS NULL)),
  CHECK ((reserva_em IS NULL) = (reserva_para IS NULL)),
  CHECK (unidade = 'servico' OR (duracao_min IS NULL AND insumo_valor IS NULL)),
  CONSTRAINT ck_itens_qr_formato CHECK (qr_codigo IS NULL OR qr_codigo ~ '^[A-Za-z0-9]{16,40}$'),
  CONSTRAINT ck_itens_qr_par     CHECK ((qr_codigo IS NULL) = (qr_gerado_em IS NULL)),
  CONSTRAINT ck_itens_qr_lote    CHECK (qr_codigo IS NULL OR controla_estoque)
);
CREATE UNIQUE INDEX ux_itens_codigo ON itens (empresa_id, codigo_busca) WHERE codigo_busca IS NOT NULL AND apagado_em IS NULL; -- código do lote único (tipos.ts:95); leitura do QR/pistola
CREATE INDEX ix_itens_estoque ON itens (empresa_id, modulo_id, ativo) INCLUDE (saldo) WHERE apagado_em IS NULL;   -- consultas estoque/catalogo por módulo
CREATE INDEX ix_itens_com_saldo ON itens (empresa_id, modulo_id) WHERE saldo > 0 AND apagado_em IS NULL;          -- estoque somenteComSaldo / Etiquetas / Vender
CREATE INDEX ix_itens_fase ON itens (empresa_id, modulo_id, fase_coluna_id, fase_desde) WHERE controla_estoque AND apagado_em IS NULL; -- quadro da Triagem; "parados há N dias"
CREATE INDEX ix_itens_triagem ON itens (triagem_id) WHERE triagem_id IS NOT NULL;               -- desfazerTriagem / genealogia por triagem
CREATE INDEX ix_itens_origem_compra ON itens (origem_compra_id) WHERE origem_compra_id IS NOT NULL;  -- lotes da compra (pedido, cancelarCompra)
CREATE INDEX ix_itens_nome ON itens USING gin (nome gin_trgm_ops);                              -- busca por nome
CREATE INDEX ix_itens_sem_etiqueta ON itens (empresa_id) WHERE etiqueta_impressa_em IS NULL AND saldo > 0 AND apagado_em IS NULL; -- Etiquetas › "Sem etiqueta"
CREATE UNIQUE INDEX ux_itens_qr ON itens (qr_codigo) WHERE qr_codigo IS NOT NULL;               -- GET /v1/qr/{codigo}; único no banco inteiro (inclusive apagados): um QR nunca abre outro pacote
CREATE INDEX ix_itens_vitrine ON itens (empresa_id, modulo_id) WHERE saldo > 0 AND etiqueta_impressa_em IS NOT NULL AND NOT vitrine_oculto AND apagado_em IS NULL; -- GET /v1/vitrine (pacotes prontos e visíveis)

CREATE TABLE item_insumos (
  item_id ident NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  ordem   smallint NOT NULL CHECK (ordem >= 0),
  nome    text NOT NULL CHECK (length(btrim(nome)) > 0),
  valor   dinheiro NOT NULL CHECK (valor >= 0),
  PRIMARY KEY (item_id, ordem)
);

CREATE TABLE item_origens (
  filho_id   ident NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  pai_id     ident NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  tipo       text  NOT NULL CHECK (tipo IN ('transformacao','unificacao')),
  quantidade quantidade CHECK (quantidade > 0),
  triagem_id ident REFERENCES triagens(id) ON DELETE RESTRICT,
  PRIMARY KEY (filho_id, pai_id),
  CHECK (filho_id <> pai_id)
);
CREATE INDEX ix_item_origens_pai ON item_origens (pai_id);                                      -- genealogia para baixo (filhos de um lote)

CREATE TABLE item_compras (
  item_id   ident NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  compra_id ident NOT NULL,           -- FK depois de "compras"
  PRIMARY KEY (item_id, compra_id)
);
CREATE INDEX ix_item_compras_compra ON item_compras (compra_id);                               -- rastreio: "para onde foi o cabelo da compra M3"

CREATE TABLE codigos_anteriores (
  id ident PRIMARY KEY,
  empresa_id   ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em    timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  entidade     text NOT NULL CHECK (entidade IN ('compra','lote')),
  entidade_id  ident NOT NULL,
  codigo       text NOT NULL,
  codigo_busca text NOT NULL,
  motivo       text
);
CREATE INDEX ix_codigos_anteriores_busca ON codigos_anteriores (empresa_id, entidade, codigo_busca); -- busca por código antigo continua achando
CREATE INDEX ix_codigos_anteriores_dono  ON codigos_anteriores (entidade_id);

CREATE TABLE mov_estoque (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  item_id        ident NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  seq            integer NOT NULL CHECK (seq >= 1),
  data           date NOT NULL,
  delta          quantidade NOT NULL CHECK (delta <> 0),
  saldo_antes    quantidade NOT NULL CHECK (saldo_antes >= 0),
  saldo_depois   quantidade NOT NULL CHECK (saldo_depois >= 0),
  motivo         text NOT NULL CHECK (motivo IN ('compra','venda','uso','ajuste','perda','cancelamento','transformacao','correcao','unificacao')),
  venda_id       ident,               -- FK depois de "vendas"
  compra_id      ident,               -- FK depois de "compras"
  triagem_id     ident REFERENCES triagens(id) ON DELETE RESTRICT,
  lote_origem_id ident REFERENCES itens(id) ON DELETE RESTRICT,
  operacao_id    ident,
  corrige_id     ident REFERENCES mov_estoque(id) ON DELETE RESTRICT,
  descricao      text,
  por_nome       text,
  CHECK (saldo_depois = saldo_antes + delta),
  CHECK (num_nonnulls(venda_id, compra_id) <= 1),
  UNIQUE (item_id, seq)
);
CREATE INDEX ix_mov_estoque_item  ON mov_estoque (item_id, seq DESC);                           -- historicoPacote / movimentosDoItem / ficha
CREATE INDEX ix_mov_estoque_data  ON mov_estoque (empresa_id, data, motivo);                    -- livroCabelo por período; DRE custo; perda na separação
CREATE INDEX ix_mov_estoque_venda ON mov_estoque (venda_id) WHERE venda_id IS NOT NULL;         -- cancelar/corrigir venda; "foi vendido?"
CREATE INDEX ix_mov_estoque_compra ON mov_estoque (compra_id) WHERE compra_id IS NOT NULL;      -- conferência de peso; cancelar compra
CREATE INDEX ix_mov_estoque_triagem ON mov_estoque (triagem_id) WHERE triagem_id IS NOT NULL;   -- desfazerTriagem

-- =====================================================================
-- 5. TABELAS DE PREÇO (versionadas)
-- =====================================================================
CREATE TABLE tabelas_preco (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  modulo_id        text NOT NULL,
  nome             text NOT NULL CHECK (length(btrim(nome)) > 0),
  categoria        text,
  valida_desde     date NOT NULL,
  moeda            codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  unidade_medida   text NOT NULL,
  fator_por        text NOT NULL CHECK (fator_por IN ('grama','unidade')),
  versao_publicada integer NOT NULL DEFAULT 1 CHECK (versao_publicada >= 1),
  FOREIGN KEY (empresa_id, modulo_id) REFERENCES modulos(empresa_id, id) ON DELETE RESTRICT
);
CREATE INDEX ix_tabelas_vigente ON tabelas_preco (empresa_id, modulo_id, categoria, valida_desde DESC) WHERE apagado_em IS NULL; -- tabelaVigente / tabelasPreco

CREATE TABLE tabela_preco_versoes (
  id ident PRIMARY KEY,
  tabela_id    ident NOT NULL REFERENCES tabelas_preco(id) ON DELETE CASCADE,
  numero       integer NOT NULL CHECK (numero >= 1),
  publicada_em timestamptz NOT NULL DEFAULT now(),
  publicada_por ident REFERENCES usuarios(id) ON DELETE RESTRICT,
  por_nome     text,
  nota         text NOT NULL DEFAULT '',
  nome         text NOT NULL,
  categoria    text,
  valida_desde date,
  UNIQUE (tabela_id, numero)
);

CREATE TABLE tabela_preco_colunas (
  versao_id ident NOT NULL REFERENCES tabela_preco_versoes(id) ON DELETE CASCADE,
  coluna_id text  NOT NULL CHECK (length(coluna_id) BETWEEN 1 AND 40),
  nome      text  NOT NULL CHECK (length(btrim(nome)) > 0),
  pessoa_id ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  ordem     smallint NOT NULL,
  PRIMARY KEY (versao_id, coluna_id),
  UNIQUE (versao_id, ordem)
);
CREATE INDEX ix_tabela_colunas_pessoa ON tabela_preco_colunas (pessoa_id) WHERE pessoa_id IS NOT NULL;  -- "coluna do fornecedor" na compra

CREATE TABLE tabela_preco_medidas (
  versao_id ident   NOT NULL REFERENCES tabela_preco_versoes(id) ON DELETE CASCADE,
  medida    integer NOT NULL CHECK (medida > 0 AND medida < 10000),
  PRIMARY KEY (versao_id, medida)
);

CREATE TABLE tabela_preco_celulas (
  versao_id ident   NOT NULL,
  medida    integer NOT NULL,
  coluna_id text    NOT NULL,
  fator     fator   NOT NULL,
  fator_texto text  NOT NULL,
  PRIMARY KEY (versao_id, medida, coluna_id),
  FOREIGN KEY (versao_id, medida)    REFERENCES tabela_preco_medidas(versao_id, medida)    ON DELETE CASCADE,
  FOREIGN KEY (versao_id, coluna_id) REFERENCES tabela_preco_colunas(versao_id, coluna_id) ON DELETE CASCADE
);

-- =====================================================================
-- 6. COMPRAS, VENDAS, PAGAMENTOS, HISTÓRICO, VENDAS EM ABERTO
-- =====================================================================
CREATE TABLE compras (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  codigo            text NOT NULL,
  codigo_busca      text NOT NULL,
  modulo_id         text NOT NULL,
  data              date NOT NULL,
  etapa             text NOT NULL CHECK (length(etapa) BETWEEN 1 AND 30),
  pessoa_id         ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  comprador_id      ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  local_id          ident REFERENCES locais(id) ON DELETE RESTRICT,
  viagem_id         ident,            -- FK depois de "viagens"
  financiamento_id  ident,            -- FK depois de "financiamentos"
  moeda_principal   codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  total_principal   dinheiro NOT NULL CHECK (total_principal >= 0),
  sem_valor         boolean NOT NULL DEFAULT false,
  obs               text,
  impostos_estimados jsonb,
  doc_fiscal        text,
  doc_fiscal_numero text,
  atributos         jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(atributos) = 'object'),
  FOREIGN KEY (empresa_id, modulo_id) REFERENCES modulos(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT ck_compras_doc_fiscal CHECK (doc_fiscal IS NULL OR doc_fiscal IN ('factura','recibo','sem')),
  CONSTRAINT ck_compras_doc_numero CHECK (doc_fiscal_numero IS NULL OR (doc_fiscal IN ('factura','recibo') AND length(btrim(doc_fiscal_numero)) BETWEEN 1 AND 40))
);
CREATE INDEX ix_compras_sem_factura ON compras (empresa_id, data) WHERE doc_fiscal = 'sem' AND apagado_em IS NULL; -- Imposto de Renda: retenções RET-IUE/RET-IT do mês
CREATE UNIQUE INDEX ux_compras_codigo ON compras (empresa_id, codigo_busca) WHERE apagado_em IS NULL;   -- "P-0007"/"M3" único entre as compras
CREATE INDEX ix_compras_fila   ON compras (empresa_id, etapa, data DESC) WHERE apagado_em IS NULL;      -- filaTriagem (abertas/encerradas) paginada
CREATE INDEX ix_compras_data   ON compras (empresa_id, data);                                           -- comprasDetalhadas, DRE, painel por período
CREATE INDEX ix_compras_pessoa ON compras (empresa_id, pessoa_id, data DESC);                           -- ficha do fornecedor
CREATE INDEX ix_compras_viagem ON compras (viagem_id) WHERE viagem_id IS NOT NULL;                      -- compras da viagem; rateio
CREATE INDEX ix_compras_financ ON compras (financiamento_id) WHERE financiamento_id IS NOT NULL;        -- entregas do adiantamento

CREATE TABLE compra_linhas (
  id ident PRIMARY KEY,
  compra_id       ident NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  ordem           smallint NOT NULL,
  item_id         ident REFERENCES itens(id) ON DELETE RESTRICT,
  descricao       text NOT NULL,
  quantidade      quantidade NOT NULL CHECK (quantidade > 0),
  moeda           codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  total           dinheiro NOT NULL CHECK (total >= 0),
  total_principal dinheiro NOT NULL CHECK (total_principal >= 0),
  cotacao         jsonb CHECK (cotacao IS NULL OR (cotacao ? 'valor' AND cotacao ? 'sentido')),
  medida          integer CHECK (medida > 0),
  fator           fator,
  categoria       text,
  tabela_id       ident REFERENCES tabelas_preco(id) ON DELETE RESTRICT,
  tabela_versao   integer CHECK (tabela_versao >= 1),
  coluna_id       text,
  fator_tabela    fator,
  fator_manual    boolean NOT NULL DEFAULT false,
  calculo_texto   text,
  sem_valor       boolean NOT NULL DEFAULT false,
  ja_paga         boolean NOT NULL DEFAULT false,
  lote_nascido    boolean NOT NULL DEFAULT false,
  atributos       jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(atributos) = 'object'),
  UNIQUE (compra_id, ordem),
  CHECK (NOT lote_nascido OR item_id IS NOT NULL),
  CHECK ((tabela_id IS NULL) OR (tabela_versao IS NOT NULL AND coluna_id IS NOT NULL))
);
CREATE INDEX ix_compra_linhas_item ON compra_linhas (item_id) WHERE item_id IS NOT NULL;               -- lote nascido da linha (compras.ts:375); rastreio
CREATE UNIQUE INDEX ux_compra_linhas_lote ON compra_linhas (item_id) WHERE lote_nascido;            -- 1 lote nasce de no máximo 1 linha (catálogo pode repetir)

CREATE TABLE vendas (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  codigo           text NOT NULL,
  modulo_id        text NOT NULL,
  data             date NOT NULL,
  etapa            text NOT NULL CHECK (etapa IN ('agendado','novo','concluido','cancelado')),
  pessoa_id        ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  local_id         ident REFERENCES locais(id) ON DELETE RESTRICT,
  profissional_id  ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  agendado_para    timestamptz,
  moeda_principal  codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  total_principal  dinheiro NOT NULL CHECK (total_principal >= 0),
  cobrado_em       codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  cotacao_cobranca text,
  desconto_texto   text,
  obs              text,
  impostos_estimados jsonb,
  atributos        jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(atributos) = 'object'),
  FOREIGN KEY (empresa_id, modulo_id) REFERENCES modulos(empresa_id, id) ON DELETE RESTRICT,
  CHECK (etapa <> 'agendado' OR (agendado_para IS NOT NULL AND pessoa_id IS NOT NULL))
);
CREATE UNIQUE INDEX ux_vendas_codigo ON vendas (empresa_id, codigo);                                    -- "V-0012"
CREATE INDEX ix_vendas_periodo ON vendas (empresa_id, etapa, data DESC);                                -- vendas (lista/painel/DRE) paginada
CREATE INDEX ix_vendas_cliente ON vendas (empresa_id, pessoa_id, data DESC) WHERE pessoa_id IS NOT NULL; -- ficha da cliente
CREATE INDEX ix_vendas_local   ON vendas (empresa_id, local_id, data DESC);                             -- filtro unidade
CREATE INDEX ix_vendas_agenda  ON vendas (empresa_id, profissional_id, agendado_para) WHERE etapa = 'agendado'; -- agenda / conflitosAgenda
CREATE INDEX ix_vendas_criador ON vendas (empresa_id, criado_por, data DESC);                           -- filtro "feito por" e visibilidade da funcionária

CREATE TABLE venda_linhas (
  id ident PRIMARY KEY,
  venda_id           ident NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  ordem              smallint NOT NULL,
  item_id            ident NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  descricao          text NOT NULL,
  quantidade         quantidade NOT NULL CHECK (quantidade > 0),
  moeda              codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  total              dinheiro NOT NULL CHECK (total >= 0),
  total_principal    dinheiro NOT NULL CHECK (total_principal >= 0),
  cotacao            jsonb CHECK (cotacao IS NULL OR (cotacao ? 'valor' AND cotacao ? 'sentido')),
  bruto              dinheiro CHECK (bruto >= 0),
  desconto           dinheiro CHECK (desconto >= 0),
  desconto_principal dinheiro CHECK (desconto_principal >= 0),
  custo_principal    dinheiro CHECK (custo_principal >= 0),
  profissional_id    ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  comissao_bp        pontos_base,
  comissao_regra     text CHECK (comissao_regra IN ('linha','servico','profissional','padrao')),
  comissao_principal dinheiro CHECK (comissao_principal >= 0),
  insumo_principal   dinheiro CHECK (insumo_principal >= 0),
  insumos            jsonb CHECK (insumos IS NULL OR jsonb_typeof(insumos) = 'array'),
  insumo_motivo      text,
  base_comissao      dinheiro,
  parte_salao        dinheiro,
  preco_catalogo     dinheiro CHECK (preco_catalogo >= 0),
  motivo_preco       text,
  medida             integer CHECK (medida > 0),
  fator              fator,
  categoria          text,
  tabela_id          ident REFERENCES tabelas_preco(id) ON DELETE RESTRICT,
  tabela_versao      integer CHECK (tabela_versao >= 1),
  coluna_id          text,
  fator_tabela       fator,
  fator_manual       boolean NOT NULL DEFAULT false,
  calculo_texto      text,
  UNIQUE (venda_id, ordem),
  CHECK (desconto IS NULL OR (bruto IS NOT NULL AND desconto <= bruto AND total = bruto - desconto)),
  CHECK (insumo_principal IS NULL OR insumo_principal <= total_principal),
  CHECK (comissao_principal IS NULL OR profissional_id IS NOT NULL)
);
CREATE INDEX ix_venda_linhas_item ON venda_linhas (item_id);                                            -- vendas({itemId}); "para quem foi o pacote"
CREATE INDEX ix_venda_linhas_prof ON venda_linhas (profissional_id) WHERE profissional_id IS NOT NULL;  -- comissões por profissional
CREATE INDEX ix_venda_linhas_tabela ON venda_linhas (tabela_id, tabela_versao) WHERE tabela_id IS NOT NULL; -- versoesEmUso / "Usada em"

CREATE TABLE pagamentos (
  id ident PRIMARY KEY,
  empresa_id      ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  compra_id       ident REFERENCES compras(id) ON DELETE CASCADE,
  venda_id        ident REFERENCES vendas(id) ON DELETE CASCADE,
  tipo            text NOT NULL DEFAULT 'pagamento' CHECK (tipo IN ('pagamento','correcao')),
  forma_id        text NOT NULL,
  moeda           codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  valor           dinheiro NOT NULL CHECK (valor <> 0),
  valor_principal dinheiro NOT NULL,
  cotacao         jsonb CHECK (cotacao IS NULL OR (cotacao ? 'valor' AND cotacao ? 'sentido')),
  FOREIGN KEY (empresa_id, forma_id) REFERENCES formas_pagamento(empresa_id, id) ON DELETE RESTRICT,
  CHECK (num_nonnulls(compra_id, venda_id) = 1),
  CHECK (tipo = 'correcao' OR valor > 0)
);
CREATE INDEX ix_pagamentos_venda  ON pagamentos (venda_id)  WHERE venda_id  IS NOT NULL;               -- detalhe da venda; filtro por forma/moeda
CREATE INDEX ix_pagamentos_compra ON pagamentos (compra_id) WHERE compra_id IS NOT NULL;               -- pagamento da compra
CREATE INDEX ix_pagamentos_forma  ON pagamentos (empresa_id, forma_id, moeda);                          -- vendas({forma, moeda})

CREATE TABLE etapa_eventos (
  id ident PRIMARY KEY,
  compra_id    ident REFERENCES compras(id) ON DELETE CASCADE,
  venda_id     ident REFERENCES vendas(id) ON DELETE CASCADE,
  de           text NOT NULL DEFAULT '',
  para         text NOT NULL,
  em           timestamptz NOT NULL,
  por          ident REFERENCES usuarios(id) ON DELETE RESTRICT,
  por_nome     text,
  tipo         text NOT NULL DEFAULT 'etapa' CHECK (tipo IN ('etapa','correcao')),
  total_antes  dinheiro,
  total_depois dinheiro,
  motivo       text,
  ajustes      text[],
  CHECK (num_nonnulls(compra_id, venda_id) = 1),
  CHECK (tipo = 'etapa' OR motivo IS NOT NULL)
);
CREATE INDEX ix_etapa_eventos_compra ON etapa_eventos (compra_id, em) WHERE compra_id IS NOT NULL;     -- aba Histórico do pedido
CREATE INDEX ix_etapa_eventos_venda  ON etapa_eventos (venda_id, em)  WHERE venda_id  IS NOT NULL;     -- aba Correções da venda
CREATE INDEX ix_etapa_eventos_por    ON etapa_eventos (por, em);                                        -- vendas({usuarioId}) "quem concluiu"

CREATE TABLE vendas_abertas (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  pessoa_id      ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  vendedor_id    ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  local_id       ident REFERENCES locais(id) ON DELETE RESTRICT,
  coluna_id      text,
  obs            text,
  desconto_modo  text CHECK (desconto_modo IN ('pct','valor')),
  desconto_pct   numeric(6,3) CHECK (desconto_pct > 0 AND desconto_pct <= 100),
  desconto_valor dinheiro CHECK (desconto_valor > 0),
  moeda          codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  total_mostrado dinheiro,
  moeda_total    codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  salva_em       timestamptz NOT NULL DEFAULT now(),
  por_nome       text
);
CREATE INDEX ix_vendas_abertas_dona ON vendas_abertas (empresa_id, criado_por, salva_em DESC) WHERE apagado_em IS NULL; -- "as minhas em aberto"

CREATE TABLE venda_aberta_linhas (
  id ident PRIMARY KEY,
  venda_aberta_id ident NOT NULL REFERENCES vendas_abertas(id) ON DELETE CASCADE,
  item_id         ident NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  quantidade      quantidade NOT NULL CHECK (quantidade > 0),
  preco_manual    dinheiro CHECK (preco_manual >= 0)
);
CREATE INDEX ix_venda_aberta_linhas_item ON venda_aberta_linhas (item_id);                              -- "este pacote está numa venda em aberto?"

-- =====================================================================
-- 7. CAIXA E CONTA CORRENTE
-- =====================================================================
CREATE TABLE dias_caixa (
  empresa_id     ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  data           date  NOT NULL,
  status         text  NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','encerrado')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  encerrado_em   timestamptz,
  encerrado_por  ident REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  versao         integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  PRIMARY KEY (empresa_id, data),
  CHECK (status = 'aberto' OR encerrado_em IS NOT NULL)
);

CREATE TABLE dia_contagens (
  empresa_id ident NOT NULL,
  data       date  NOT NULL,
  moeda      codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  contado    dinheiro NOT NULL CHECK (contado >= 0),
  PRIMARY KEY (empresa_id, data, moeda),
  FOREIGN KEY (empresa_id, data) REFERENCES dias_caixa(empresa_id, data) ON DELETE CASCADE
);

CREATE TABLE dia_alteracoes (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL,
  data       date  NOT NULL,
  venda_id   ident NOT NULL REFERENCES vendas(id) ON DELETE RESTRICT,
  codigo     text,
  descricao  text NOT NULL,
  em         timestamptz NOT NULL DEFAULT now(),
  por_nome   text NOT NULL,
  FOREIGN KEY (empresa_id, data) REFERENCES dias_caixa(empresa_id, data) ON DELETE CASCADE
);
CREATE INDEX ix_dia_alteracoes_dia ON dia_alteracoes (empresa_id, data);                                -- aviso no caixaDoDia

-- Turno com conferência cega (turnos.ts): cada pessoa conta o efectivo da mão sem ver o esperado.
-- Razão append-only (perfil L): turno fechado não muda; não mexe no caixa do dia (que o admin encerra).
CREATE TABLE turnos (
  id           ident NOT NULL,
  empresa_id   ident NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  criado_por   ident NOT NULL,
  usuario_id   ident NOT NULL,
  por_nome     text  NOT NULL,
  inicio       timestamptz NOT NULL,
  fim          timestamptz NOT NULL,
  lancamentos  integer NOT NULL DEFAULT 0,
  situacao     text  NOT NULL,
  obs          text,
  CONSTRAINT pk_turnos PRIMARY KEY (id),
  CONSTRAINT fk_turnos_empresa    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_turnos_criado_por FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_turnos_usuario    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_turnos_periodo    CHECK (fim > inicio),
  CONSTRAINT ck_turnos_dono       CHECK (usuario_id = criado_por),
  CONSTRAINT ck_turnos_lancamentos CHECK (lancamentos >= 0),
  CONSTRAINT ck_turnos_situacao   CHECK (situacao IN ('confere','falta','sobra','falta e sobra')),
  CONSTRAINT ck_turnos_nome       CHECK (length(btrim(por_nome)) > 0),
  CONSTRAINT ck_turnos_obs        CHECK (obs IS NULL OR length(obs) <= 500),
  CONSTRAINT ex_turnos_sem_sobrepor EXCLUDE USING gist (empresa_id WITH =, usuario_id WITH =, tstzrange(inicio, fim, '[)') WITH &&)
);
CREATE INDEX ix_turnos_quando ON turnos (empresa_id, fim DESC);                                       -- Caixa › Turnos (admin), por período
CREATE INDEX ix_turnos_usuario ON turnos (empresa_id, usuario_id, fim DESC);                          -- turnoAtual: o fim do último turno da pessoa = começo do próximo
CREATE INDEX ix_turnos_diferenca ON turnos (empresa_id, fim DESC) WHERE situacao <> 'confere';        -- "turnos com diferença"

CREATE TABLE turno_valores (
  turno_id   ident        NOT NULL,
  moeda      codigo_moeda NOT NULL,
  esperado   dinheiro     NOT NULL,
  contado    dinheiro     NOT NULL,
  diferenca  bigint GENERATED ALWAYS AS (contado - esperado) STORED,
  CONSTRAINT pk_turno_valores PRIMARY KEY (turno_id, moeda),
  CONSTRAINT fk_turno_valores_turno FOREIGN KEY (turno_id) REFERENCES turnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_turno_valores_moeda FOREIGN KEY (moeda) REFERENCES moedas(codigo) ON DELETE RESTRICT,
  CONSTRAINT ck_turno_valores_contado CHECK (contado >= 0)
);

CREATE TABLE mov_caixa (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  data             date NOT NULL,
  moeda            codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  forma_id         text NOT NULL,
  delta            dinheiro NOT NULL CHECK (delta <> 0),
  tipo             text NOT NULL CHECK (tipo IN ('venda','compra','entrada','despesa','retirada','dar','emprestimo','recebimento','estorno','saldoInicial','correcao')),
  finalidade       text CHECK (finalidade IN ('comissao','salario','viagem','adiantamento','acerto')),
  descricao        text NOT NULL,
  categoria        text,
  valor_principal  dinheiro,
  venda_id         ident REFERENCES vendas(id) ON DELETE RESTRICT,
  compra_id        ident REFERENCES compras(id) ON DELETE RESTRICT,
  emprestimo_id    ident,             -- FK depois de "emprestimos"
  financiamento_id ident,             -- FK depois de "financiamentos"
  viagem_id        ident,             -- FK depois de "viagens"
  operacao_id      ident,
  socio_id         ident REFERENCES socios(id) ON DELETE RESTRICT,
  local_id         ident REFERENCES locais(id) ON DELETE RESTRICT,
  pessoa_id        ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  estorna_id       ident REFERENCES mov_caixa(id) ON DELETE RESTRICT,
  estornado_por    ident REFERENCES mov_caixa(id) ON DELETE RESTRICT,
  doc_fiscal           text,
  doc_fiscal_dedutivel boolean,
  doc_fiscal_numero    text,
  FOREIGN KEY (empresa_id, data)     REFERENCES dias_caixa(empresa_id, data)      ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, forma_id) REFERENCES formas_pagamento(empresa_id, id)  ON DELETE RESTRICT,
  CHECK (num_nonnulls(venda_id, compra_id, emprestimo_id, financiamento_id) <= 1),
  CHECK (estorna_id IS NULL OR estorna_id <> id),
  CONSTRAINT ck_mov_caixa_doc_tipo      CHECK (doc_fiscal IS NULL OR (tipo = 'despesa' AND doc_fiscal IN ('factura','recibo','sem'))),
  CONSTRAINT ck_mov_caixa_doc_dedutivel CHECK ((doc_fiscal IS NULL) = (doc_fiscal_dedutivel IS NULL) AND (doc_fiscal IS DISTINCT FROM 'sem' OR doc_fiscal_dedutivel = false)),
  CONSTRAINT ck_mov_caixa_doc_numero    CHECK (doc_fiscal_numero IS NULL OR (doc_fiscal IN ('factura','recibo') AND length(btrim(doc_fiscal_numero)) BETWEEN 1 AND 40))
);
CREATE INDEX ix_mov_caixa_dia     ON mov_caixa (empresa_id, data, moeda);                               -- caixaDoDia; livroCaixa; DRE
CREATE INDEX ix_mov_caixa_venda   ON mov_caixa (venda_id)   WHERE venda_id   IS NOT NULL;              -- cancelar/corrigir venda
CREATE INDEX ix_mov_caixa_compra  ON mov_caixa (compra_id)  WHERE compra_id  IS NOT NULL;              -- cancelar compra
CREATE INDEX ix_mov_caixa_viagem  ON mov_caixa (viagem_id)  WHERE viagem_id  IS NOT NULL;              -- carteira/encerrar viagem
CREATE INDEX ix_mov_caixa_pessoa  ON mov_caixa (empresa_id, pessoa_id, finalidade) WHERE pessoa_id IS NOT NULL; -- comissões pagas; salários; ultimoLancamento
CREATE INDEX ix_mov_caixa_categoria ON mov_caixa (empresa_id, categoria, data) WHERE categoria IS NOT NULL;     -- DRE por categoria
CREATE INDEX ix_mov_caixa_operacao ON mov_caixa (empresa_id, operacao_id) WHERE operacao_id IS NOT NULL;   -- "esta operação já lançou?" (pagarComissao, registrarAcerto, salário)

CREATE TABLE mov_conta (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  pessoa_id        ident NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,
  data             date NOT NULL,
  moeda            codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  delta            dinheiro NOT NULL CHECK (delta <> 0),
  tipo             text NOT NULL CHECK (tipo IN ('venda','compra','recebimento','pagamento','adiantamento','ajuste','estorno','comissao')),
  venda_id         ident REFERENCES vendas(id) ON DELETE RESTRICT,
  compra_id        ident REFERENCES compras(id) ON DELETE RESTRICT,
  financiamento_id ident,             -- FK depois de "financiamentos"
  operacao_id      ident,
  forma_id         text,
  descricao        text NOT NULL,
  CHECK (num_nonnulls(venda_id, compra_id) <= 1)
);
CREATE INDEX ix_mov_conta_pessoa ON mov_conta (empresa_id, pessoa_id, data);                            -- contaPessoa; saldo; contas({somenteAbertas})
CREATE INDEX ix_mov_conta_venda  ON mov_conta (venda_id)  WHERE venda_id  IS NOT NULL;                  -- estornarConta
CREATE INDEX ix_mov_conta_compra ON mov_conta (compra_id) WHERE compra_id IS NOT NULL;
CREATE INDEX ix_mov_conta_financ ON mov_conta (financiamento_id) WHERE financiamento_id IS NOT NULL;    -- saldo do adiantamento
CREATE INDEX ix_mov_conta_operacao ON mov_conta (empresa_id, operacao_id) WHERE operacao_id IS NOT NULL; -- idempotência (registrarAcerto, pagarComissao)

-- =====================================================================
-- 8. EMPRÉSTIMOS
-- =====================================================================
CREATE TABLE emprestimos (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  direcao           text NOT NULL CHECK (direcao IN ('dado','tomado')),
  pessoa_id         ident NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,
  moeda             codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  principal         dinheiro NOT NULL CHECK (principal > 0),
  juros_tipo        text NOT NULL CHECK (juros_tipo IN ('nenhum','simples','composto','fixo')),
  juros_taxa_mensal_bp pontos_base,
  juros_valor_fixo  dinheiro CHECK (juros_valor_fixo >= 0),
  inicio            date NOT NULL,
  situacao          text NOT NULL DEFAULT 'aberto' CHECK (situacao IN ('aberto','quitado','cancelado')),
  obs               text,
  CHECK (juros_tipo NOT IN ('simples','composto') OR juros_taxa_mensal_bp > 0),
  CHECK (juros_tipo <> 'fixo' OR juros_valor_fixo IS NOT NULL)
);
CREATE INDEX ix_emprestimos_lista ON emprestimos (empresa_id, situacao, direcao) WHERE apagado_em IS NULL; -- tela Empréstimos (filtros)
CREATE INDEX ix_emprestimos_pessoa ON emprestimos (pessoa_id);                                          -- ficha da pessoa

CREATE TABLE parcelas (
  id ident PRIMARY KEY,
  emprestimo_id ident NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  numero        smallint NOT NULL CHECK (numero BETWEEN 1 AND 120),
  vencimento    date NOT NULL,
  valor         dinheiro NOT NULL CHECK (valor > 0),
  UNIQUE (emprestimo_id, numero)
);
CREATE INDEX ix_parcelas_vencimento ON parcelas (vencimento);                                            -- "vencendo / atrasadas"

CREATE TABLE mov_divida (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  emprestimo_id ident NOT NULL REFERENCES emprestimos(id) ON DELETE RESTRICT,
  parcela_id    ident REFERENCES parcelas(id) ON DELETE RESTRICT,
  seq           integer NOT NULL CHECK (seq >= 1),
  data          date NOT NULL,
  delta         dinheiro NOT NULL CHECK (delta <> 0),
  saldo_antes   dinheiro NOT NULL,
  saldo_depois  dinheiro NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('principal','juros','pagamento','ajuste')),
  forma_id      text,
  operacao_id   ident,
  descricao     text,
  CHECK (saldo_depois = saldo_antes + delta),
  UNIQUE (emprestimo_id, seq)
);
CREATE INDEX ix_mov_divida_operacao ON mov_divida (emprestimo_id, operacao_id) WHERE operacao_id IS NOT NULL; -- idempotência do pagamento

-- =====================================================================
-- 9. VIAGENS DE COMPRA
-- =====================================================================
CREATE TABLE viagens (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  codigo            text NOT NULL,
  nome              text NOT NULL CHECK (length(btrim(nome)) > 0),
  destino           text,
  na_bolivia        boolean NOT NULL DEFAULT false,
  inicio            date NOT NULL,
  fim               date,
  status            text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','encerrada')),
  orcamento         dinheiro CHECK (orcamento >= 0),
  orcamento_compra  dinheiro CHECK (orcamento_compra >= 0),
  rateio            text NOT NULL DEFAULT 'grama' CHECK (rateio IN ('grama','valor')),
  encerrada_em      timestamptz,
  encerrada_data    date,
  encerrada_por_nome text,
  encerramento_obs  text,
  obs               text,
  CHECK (fim IS NULL OR fim >= inicio),
  CHECK (status = 'aberta' OR encerrada_em IS NOT NULL)
);
CREATE UNIQUE INDEX ux_viagens_codigo ON viagens (empresa_id, codigo);                                  -- "VG-0001"
CREATE INDEX ix_viagens_lista ON viagens (empresa_id, status, inicio DESC) WHERE apagado_em IS NULL;   -- viagens({status}) / viagensParaFiltro

CREATE TABLE viagem_viajantes (
  viagem_id ident NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  pessoa_id ident NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,
  PRIMARY KEY (viagem_id, pessoa_id)
);
CREATE INDEX ix_viagem_viajantes_pessoa ON viagem_viajantes (pessoa_id);                                -- painelViajante; "a viagem é dela?"

CREATE TABLE viagem_despesas (
  id ident PRIMARY KEY,
  viagem_id       ident NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  data            date NOT NULL,
  em              timestamptz NOT NULL DEFAULT now(),
  categoria_id    text NOT NULL,
  moeda           codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  valor           dinheiro NOT NULL CHECK (valor > 0),
  valor_principal dinheiro NOT NULL CHECK (valor_principal >= 0),
  cotacao         jsonb CHECK (cotacao IS NULL OR (cotacao ? 'valor' AND cotacao ? 'sentido')),
  nota            text,
  por             ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  por_nome        text NOT NULL,
  anulada_em      timestamptz,
  anulada_por_nome text,
  anulada_motivo  text,
  CHECK ((anulada_em IS NULL) = (anulada_motivo IS NULL))
);
CREATE INDEX ix_viagem_despesas_viagem ON viagem_despesas (viagem_id, data);                            -- aba Gastos; soma por moeda/categoria

CREATE TABLE viagem_carteira (
  id ident PRIMARY KEY,
  viagem_id    ident NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('adiantamento','devolucao','reembolso','diferenca')),
  data         date NOT NULL,
  em           timestamptz NOT NULL DEFAULT now(),
  moeda        codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  delta        dinheiro NOT NULL CHECK (delta <> 0),
  forma_id     text,
  mov_caixa_id ident REFERENCES mov_caixa(id) ON DELETE RESTRICT,
  por_nome     text NOT NULL,
  obs          text,
  anulada      boolean NOT NULL DEFAULT false,
  CHECK (tipo = 'diferenca' OR mov_caixa_id IS NOT NULL)
);
CREATE INDEX ix_viagem_carteira_viagem ON viagem_carteira (viagem_id, moeda);                           -- saldo da carteira por moeda

CREATE TABLE viagem_incorporacoes (
  id ident PRIMARY KEY,
  viagem_id   ident NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  em          timestamptz NOT NULL DEFAULT now(),
  por_nome    text NOT NULL,
  total       dinheiro NOT NULL CHECK (total >= 0),
  desfeita_em timestamptz,
  desfeita_motivo text
);
CREATE UNIQUE INDEX ux_viagem_incorporacao_vigente ON viagem_incorporacoes (viagem_id) WHERE desfeita_em IS NULL; -- no máximo 1 incorporação vigente

CREATE TABLE viagem_incorporacao_lotes (
  incorporacao_id ident NOT NULL REFERENCES viagem_incorporacoes(id) ON DELETE CASCADE,
  item_id         ident NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  codigo          text,
  gramas          quantidade NOT NULL CHECK (gramas > 0),
  inicial         quantidade NOT NULL CHECK (inicial > 0),
  extra           dinheiro NOT NULL CHECK (extra >= 0),
  custo_antes     dinheiro NOT NULL CHECK (custo_antes >= 0),
  custo_depois    dinheiro NOT NULL CHECK (custo_depois >= custo_antes),
  PRIMARY KEY (incorporacao_id, item_id)
);
CREATE INDEX ix_viagem_inc_lotes_item ON viagem_incorporacao_lotes (item_id);                           -- ficha do lote: "custo inclui viagem"

-- =====================================================================
-- 10. ADIANTAMENTOS A PARCEIROS (financiamentos)
-- =====================================================================
CREATE TABLE financiamentos (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  codigo            text NOT NULL,
  pessoa_id         ident NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,
  data              date NOT NULL,
  prazo             date,
  moeda             codigo_moeda NOT NULL REFERENCES moedas(codigo) ON DELETE RESTRICT,
  valor             dinheiro NOT NULL CHECK (valor > 0),
  valor_principal   dinheiro NOT NULL CHECK (valor_principal > 0),
  cotacao           jsonb CHECK (cotacao IS NULL OR (cotacao ? 'valor' AND cotacao ? 'sentido')),
  forma_id          text NOT NULL,
  viagem_id         ident REFERENCES viagens(id) ON DELETE RESTRICT,
  abater_comissoes  boolean NOT NULL DEFAULT false,
  obs               text,
  encerrado_em      timestamptz,
  encerrado_data    date,
  encerrado_por_nome text,
  encerrado_motivo  text,
  encerrado_saldo   dinheiro,
  FOREIGN KEY (empresa_id, forma_id) REFERENCES formas_pagamento(empresa_id, id) ON DELETE RESTRICT,
  CHECK (prazo IS NULL OR prazo >= data),
  CHECK ((encerrado_em IS NULL) = (encerrado_motivo IS NULL))
);
CREATE UNIQUE INDEX ux_financiamentos_codigo ON financiamentos (empresa_id, codigo);                    -- "AD-0001"
CREATE INDEX ix_financiamentos_lista ON financiamentos (empresa_id, pessoa_id, data DESC) WHERE apagado_em IS NULL; -- lista/filtros; "os dela"
CREATE INDEX ix_financiamentos_abater ON financiamentos (pessoa_id) WHERE abater_comissoes AND encerrado_em IS NULL; -- reterComissaoFinanciamentos

CREATE TABLE financiamento_eventos (
  id ident PRIMARY KEY,
  financiamento_id      ident NOT NULL REFERENCES financiamentos(id) ON DELETE CASCADE,
  tipo                  text NOT NULL CHECK (tipo IN ('entrega','recebimento','comissao','diferenca','baixa')),
  data                  date NOT NULL,
  em                    timestamptz NOT NULL DEFAULT now(),
  por_nome              text NOT NULL,
  compra_id             ident REFERENCES compras(id) ON DELETE RESTRICT,
  moeda                 codigo_moeda REFERENCES moedas(codigo) ON DELETE RESTRICT,
  valor                 dinheiro,
  forma_id              text,
  obs                   text,
  pagamento_comissao_id ident,
  CHECK (tipo <> 'entrega' OR compra_id IS NOT NULL)
);
CREATE INDEX ix_financ_eventos ON financiamento_eventos (financiamento_id, em);                         -- ficha do adiantamento
CREATE UNIQUE INDEX ux_financ_eventos_compra ON financiamento_eventos (compra_id) WHERE compra_id IS NOT NULL; -- uma compra = no máximo 1 entrega

-- FKs adiadas (ciclos)
ALTER TABLE itens        ADD CONSTRAINT fk_itens_origem_compra FOREIGN KEY (origem_compra_id) REFERENCES compras(id) ON DELETE RESTRICT;
ALTER TABLE item_compras ADD CONSTRAINT fk_item_compras_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE RESTRICT;
ALTER TABLE mov_estoque  ADD CONSTRAINT fk_mov_estoque_venda   FOREIGN KEY (venda_id)  REFERENCES vendas(id)  ON DELETE RESTRICT;
ALTER TABLE mov_estoque  ADD CONSTRAINT fk_mov_estoque_compra  FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE RESTRICT;
ALTER TABLE compras      ADD CONSTRAINT fk_compras_viagem      FOREIGN KEY (viagem_id) REFERENCES viagens(id) ON DELETE RESTRICT;
ALTER TABLE compras      ADD CONSTRAINT fk_compras_financ      FOREIGN KEY (financiamento_id) REFERENCES financiamentos(id) ON DELETE RESTRICT;
ALTER TABLE mov_caixa    ADD CONSTRAINT fk_mov_caixa_emprest   FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE RESTRICT;
ALTER TABLE mov_caixa    ADD CONSTRAINT fk_mov_caixa_financ    FOREIGN KEY (financiamento_id) REFERENCES financiamentos(id) ON DELETE RESTRICT;
ALTER TABLE mov_caixa    ADD CONSTRAINT fk_mov_caixa_viagem    FOREIGN KEY (viagem_id) REFERENCES viagens(id) ON DELETE RESTRICT;
ALTER TABLE mov_conta    ADD CONSTRAINT fk_mov_conta_financ    FOREIGN KEY (financiamento_id) REFERENCES financiamentos(id) ON DELETE RESTRICT;

-- =====================================================================
-- 11. AGENDA
-- =====================================================================
CREATE TABLE eventos (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  titulo      text NOT NULL CHECK (length(btrim(titulo)) > 0),
  data        date NOT NULL,
  hora        time,
  duracao_min integer CHECK (duracao_min BETWEEN 1 AND 1440),
  nota        text,
  pessoa_id   ident REFERENCES pessoas(id) ON DELETE RESTRICT,
  local_id    ident REFERENCES locais(id) ON DELETE RESTRICT,
  semanal     boolean NOT NULL DEFAULT false,
  repetir_ate date,
  CHECK (duracao_min IS NULL OR hora IS NOT NULL),
  CHECK (repetir_ate IS NULL OR (semanal AND repetir_ate >= data))
);
CREATE INDEX ix_eventos_calendario ON eventos (empresa_id, data) WHERE apagado_em IS NULL;              -- calendario({de, ate})
CREATE INDEX ix_eventos_semanais ON eventos (empresa_id, data, repetir_ate) WHERE semanal AND apagado_em IS NULL; -- repetição semanal no intervalo
CREATE INDEX ix_eventos_pessoa ON eventos (pessoa_id, data) WHERE apagado_em IS NULL;                    -- "a minha agenda"

CREATE TABLE evento_feitos (
  evento_id ident NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  data      date  NOT NULL,
  feito_em  timestamptz NOT NULL DEFAULT now(),
  feito_por ident REFERENCES usuarios(id) ON DELETE RESTRICT,
  PRIMARY KEY (evento_id, data)
);

-- =====================================================================
-- 12. ANEXOS (arquivo no object storage; aqui só os metadados)
-- =====================================================================
CREATE TABLE anexos (
  id ident PRIMARY KEY,
  empresa_id ident NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now(), criado_por ident NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1), apagado_em timestamptz,
  dono_id       ident NOT NULL,
  dono_tipo     text CHECK (dono_tipo IN ('compra','venda','item','pessoa','viagem','despesa','financiamento','outro')),
  categoria     text NOT NULL CHECK (categoria IN ('pedido','produto','comprovante','origem','resultado','outro')),
  nome          text NOT NULL,
  mime          text NOT NULL,
  tamanho       bigint NOT NULL CHECK (tamanho > 0 AND tamanho <= 52428800),
  storage_chave text NOT NULL UNIQUE,
  sha256        bytea,
  miniatura     bytea CHECK (miniatura IS NULL OR octet_length(miniatura) <= 65536)
);
CREATE INDEX ix_anexos_dono ON anexos (empresa_id, dono_id) WHERE apagado_em IS NULL;                   -- anexosDe({donoId}); fotosDoLote; pendência "sem comprovante"

-- =====================================================================
-- 12A. QR DA ETIQUETA (§12): códigos antigos e leituras
-- =====================================================================
-- O código vigente fica em itens.qr_codigo. Reimprimir (nova via) troca o código e o antigo vem para cá:
-- assim o servidor diz "etiqueta antiga" (e o admin vê de qual pacote era) em vez de "não existe".
CREATE TABLE item_qr_anteriores (
  codigo       text  NOT NULL,
  empresa_id   ident NOT NULL,
  item_id      ident NOT NULL,
  via          integer NOT NULL,
  revogado_em  timestamptz NOT NULL DEFAULT now(),
  revogado_por ident NOT NULL,
  motivo       text  NOT NULL,
  CONSTRAINT pk_item_qr_anteriores PRIMARY KEY (codigo),
  CONSTRAINT fk_item_qr_ant_empresa FOREIGN KEY (empresa_id)   REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_item_qr_ant_item    FOREIGN KEY (item_id)      REFERENCES itens(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_item_qr_ant_usuario FOREIGN KEY (revogado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_item_qr_ant_formato CHECK (codigo ~ '^[A-Za-z0-9]{16,40}$'),
  CONSTRAINT ck_item_qr_ant_via     CHECK (via >= 1),
  CONSTRAINT ck_item_qr_ant_motivo  CHECK (motivo IN ('reimpressao','lote_revogado','outro'))
);
CREATE INDEX ix_item_qr_ant_item ON item_qr_anteriores (item_id, revogado_em DESC);               -- histórico de etiquetas do pacote
-- Regra no serviço (não dá para CHECK entre tabelas): um código nunca está ao mesmo tempo aqui e em itens.qr_codigo;
-- gerar código novo confere as duas (o espaço é 57^16 ≈ 10^28: colisão só em teoria).

-- Leituras do QR: quem leu, quando, de onde e o que aconteceu. Fora da "auditoria" porque a leitura sem login
-- não tem usuário (auditoria.criado_por é NOT NULL) e porque o volume é outro (retenção curta).
CREATE TABLE qr_leituras (
  id          ident NOT NULL,
  lido_em     timestamptz NOT NULL DEFAULT now(),
  empresa_id  ident,
  codigo_lido text  NOT NULL,
  resultado   text  NOT NULL,
  item_id     ident,
  usuario_id  ident,
  ip          inet  NOT NULL,
  user_agent  text,
  CONSTRAINT pk_qr_leituras PRIMARY KEY (id),
  CONSTRAINT fk_qr_leituras_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_qr_leituras_item    FOREIGN KEY (item_id)    REFERENCES itens(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_qr_leituras_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_qr_leituras_codigo    CHECK (length(codigo_lido) BETWEEN 1 AND 64),
  CONSTRAINT ck_qr_leituras_resultado CHECK (resultado IN ('aberto','sem_login','antigo','invalido','limite','sem_permissao')),
  CONSTRAINT ck_qr_leituras_aberto    CHECK (resultado <> 'aberto' OR (item_id IS NOT NULL AND usuario_id IS NOT NULL AND empresa_id IS NOT NULL)),
  CONSTRAINT ck_qr_leituras_sem_login CHECK (resultado <> 'sem_login' OR usuario_id IS NULL),
  CONSTRAINT ck_qr_leituras_ua        CHECK (user_agent IS NULL OR length(user_agent) <= 300)
);
CREATE INDEX ix_qr_leituras_ip      ON qr_leituras (ip, lido_em DESC);                                 -- rate limit por IP (ex.: 30/min) e "quem está tentando adivinhar"
CREATE INDEX ix_qr_leituras_empresa ON qr_leituras (empresa_id, lido_em DESC) WHERE empresa_id IS NOT NULL; -- tela Auditoria › Leituras de QR
CREATE INDEX ix_qr_leituras_falhas  ON qr_leituras (lido_em DESC) WHERE resultado IN ('invalido','limite'); -- alerta de varredura
CREATE INDEX ix_qr_leituras_item    ON qr_leituras (item_id, lido_em DESC) WHERE item_id IS NOT NULL;  -- "quem leu este pacote"

-- =====================================================================
-- 12B. IMPOSTO DE RENDA (Bolívia: IVA, IT, IUE, retenções — impostoRenda.ts, IMPOSTO-RENDA.md)
-- =====================================================================
-- Exercício fiscal (gestión) por ano. O cierre vem do tipo de atividade (DS 24051 art. 39: comercial/serviços 31/12,
-- industrial 31/03…), guardado em configuracoes 'geral'. Fechar congela os números e a versão das regras.
CREATE TABLE ir_exercicios (
  empresa_id     ident   NOT NULL,
  ano            integer NOT NULL,
  situacao       text    NOT NULL DEFAULT 'aberto',
  inicio         date    NOT NULL,
  cierre         date    NOT NULL,
  fechado_em     timestamptz,
  fechado_por    ident,
  versao_regras  text,
  resumo         jsonb,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  versao         integer NOT NULL DEFAULT 1,
  CONSTRAINT pk_ir_exercicios PRIMARY KEY (empresa_id, ano),
  CONSTRAINT fk_ir_exercicios_empresa FOREIGN KEY (empresa_id)  REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ir_exercicios_fechou  FOREIGN KEY (fechado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_ir_exercicios_ano      CHECK (ano BETWEEN 2001 AND 2200),
  CONSTRAINT ck_ir_exercicios_situacao CHECK (situacao IN ('aberto','preparacao','pendencias','validacao','revisado','fechado')),
  CONSTRAINT ck_ir_exercicios_periodo  CHECK (cierre > inicio AND cierre <= inicio + interval '1 year'),
  -- fechado ⇒ tem o fechamento; reaberto mantém o ÚLTIMO fechamento (como o app), para comparar depois
  CONSTRAINT ck_ir_exercicios_fechado  CHECK (situacao <> 'fechado' OR fechado_em IS NOT NULL),
  CONSTRAINT ck_ir_exercicios_congelou CHECK (fechado_em IS NULL OR (fechado_por IS NOT NULL AND versao_regras IS NOT NULL AND resumo IS NOT NULL)),
  -- (timestamptz::date depende do fuso da sessão e não é IMMUTABLE; por isso o fuso fica escrito)
  CONSTRAINT ck_ir_exercicios_depois   CHECK (fechado_em IS NULL OR fechado_em >= ((cierre + 1)::timestamp AT TIME ZONE 'America/La_Paz')),
  CONSTRAINT ck_ir_exercicios_resumo   CHECK (resumo IS NULL OR jsonb_typeof(resumo) = 'object'),
  CONSTRAINT ck_ir_exercicios_versao   CHECK (versao >= 1)
);

-- Histórico de situação do exercício (append-only). Reabrir um fechado exige motivo.
CREATE TABLE ir_exercicio_eventos (
  id          ident   NOT NULL,
  empresa_id  ident   NOT NULL,
  ano         integer NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  criado_por  ident   NOT NULL,
  por_nome    text    NOT NULL,
  de          text    NOT NULL,
  para        text    NOT NULL,
  motivo      text,
  CONSTRAINT pk_ir_exercicio_eventos PRIMARY KEY (id),
  CONSTRAINT fk_ir_ex_eventos_exercicio FOREIGN KEY (empresa_id, ano) REFERENCES ir_exercicios(empresa_id, ano) ON DELETE CASCADE,
  CONSTRAINT fk_ir_ex_eventos_usuario   FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_ir_ex_eventos_de      CHECK (de   IN ('aberto','preparacao','pendencias','validacao','revisado','fechado')),
  CONSTRAINT ck_ir_ex_eventos_para    CHECK (para IN ('aberto','preparacao','pendencias','validacao','revisado','fechado')),
  CONSTRAINT ck_ir_ex_eventos_mudou   CHECK (de <> para),
  CONSTRAINT ck_ir_ex_eventos_reabrir CHECK (de <> 'fechado' OR length(btrim(coalesce(motivo, ''))) > 0)
);
CREATE INDEX ix_ir_ex_eventos_ano ON ir_exercicio_eventos (empresa_id, ano, criado_em);                  -- histórico do exercício na tela

-- Declarações e pagamentos feitos no SIAT (o sistema não declara sozinho: a pessoa registra o que fez).
CREATE TABLE ir_obrigacoes (
  id               ident   NOT NULL,
  empresa_id       ident   NOT NULL,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  criado_por       ident   NOT NULL,
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  versao           integer NOT NULL DEFAULT 1,
  apagado_em       timestamptz,
  apagado_motivo   text,
  ano              integer NOT NULL,
  periodo          text    NOT NULL,
  obrigacao        text    NOT NULL,
  formulario       text    NOT NULL,
  numero_orden     text,
  declarado_em     date,
  valor_declarado  dinheiro,
  pago_em          date,
  valor_pago       dinheiro,
  obs              text,
  por_nome         text    NOT NULL,
  CONSTRAINT pk_ir_obrigacoes PRIMARY KEY (id),
  CONSTRAINT fk_ir_obrigacoes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ir_obrigacoes_usuario FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_ir_obrigacoes_ano       CHECK (ano BETWEEN 2001 AND 2200),
  CONSTRAINT ck_ir_obrigacoes_obrigacao CHECK (obrigacao IN ('iva','it','iue','retIue','retIt','rcIva','rcv','eeff')),
  CONSTRAINT ck_ir_obrigacoes_periodo   CHECK (
               (obrigacao IN ('iue','eeff') AND periodo = ano::text)
            OR (obrigacao NOT IN ('iue','eeff') AND periodo ~ '^\d{4}-(0[1-9]|1[0-2])$')),
  CONSTRAINT ck_ir_obrigacoes_algo      CHECK (declarado_em IS NOT NULL OR pago_em IS NOT NULL),
  CONSTRAINT ck_ir_obrigacoes_valores   CHECK ((valor_declarado IS NULL OR valor_declarado >= 0) AND (valor_pago IS NULL OR valor_pago >= 0)),
  CONSTRAINT ck_ir_obrigacoes_pago      CHECK (valor_pago IS NULL OR pago_em IS NOT NULL),
  CONSTRAINT ck_ir_obrigacoes_formulario CHECK (length(btrim(formulario)) BETWEEN 1 AND 40),
  CONSTRAINT ck_ir_obrigacoes_orden     CHECK (numero_orden IS NULL OR length(btrim(numero_orden)) BETWEEN 1 AND 40),
  CONSTRAINT ck_ir_obrigacoes_apagado   CHECK ((apagado_em IS NULL) = (apagado_motivo IS NULL)),
  CONSTRAINT ck_ir_obrigacoes_versao    CHECK (versao >= 1)
);
CREATE INDEX ix_ir_obrigacoes_ano ON ir_obrigacoes (empresa_id, ano, obrigacao, periodo) WHERE apagado_em IS NULL; -- impostoRenda({ano}) mês a mês; "meses sem retenção"

-- =====================================================================
-- 12C. METAS DO MÊS (metas.ts). As opções de exibição (painel, mostrar valor, a funcionária vê) ficam em
--      configuracoes 'geral'.metas; aqui só a lista de metas.
-- =====================================================================
CREATE TABLE metas (
  id             ident NOT NULL,
  empresa_id     ident NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     ident NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  versao         integer NOT NULL DEFAULT 1,
  apagado_em     timestamptz,
  nome           text,
  alvo           text NOT NULL,
  local_id       ident,
  pessoa_id      ident,
  indicador      text NOT NULL,
  valor          bigint NOT NULL,
  ativa          boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_metas PRIMARY KEY (id),
  CONSTRAINT fk_metas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_metas_usuario FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_metas_local   FOREIGN KEY (local_id)   REFERENCES locais(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_metas_pessoa  FOREIGN KEY (pessoa_id)  REFERENCES pessoas(id)  ON DELETE RESTRICT,
  CONSTRAINT ck_metas_alvo      CHECK (alvo IN ('empresa','unidade','pessoa')),
  CONSTRAINT ck_metas_alvo_id   CHECK (
               (alvo = 'empresa' AND local_id IS NULL     AND pessoa_id IS NULL)
            OR (alvo = 'unidade' AND local_id IS NOT NULL AND pessoa_id IS NULL)
            OR (alvo = 'pessoa'  AND pessoa_id IS NOT NULL AND local_id IS NULL)),
  CONSTRAINT ck_metas_indicador CHECK (indicador IN ('faturamento','vendas','atendimentos')),
  CONSTRAINT ck_metas_valor     CHECK (valor > 0 AND valor <= 10000000000),
  CONSTRAINT ck_metas_nome      CHECK (nome IS NULL OR length(btrim(nome)) BETWEEN 1 AND 60),
  CONSTRAINT ck_metas_versao    CHECK (versao >= 1)
);
CREATE INDEX ix_metas_ativas ON metas (empresa_id) WHERE ativa AND apagado_em IS NULL;                  -- Painel / Vender: metas do mês
CREATE INDEX ix_metas_pessoa ON metas (pessoa_id) WHERE pessoa_id IS NOT NULL AND apagado_em IS NULL;   -- "as metas dela" (funcionária)
CREATE INDEX ix_metas_local  ON metas (local_id)  WHERE local_id  IS NOT NULL AND apagado_em IS NULL;   -- metas da unidade

-- =====================================================================
-- 13. COMENTÁRIOS — colunas-base (aplicados a TODAS as tabelas que as têm)
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public'
             AND column_name IN ('id','empresa_id','criado_em','criado_por','atualizado_em','versao','apagado_em','operacao_id','atributos','cotacao','por_nome')
  LOOP
    EXECUTE format('COMMENT ON COLUMN %I.%I IS %L', r.table_name, r.column_name,
      CASE r.column_name
        WHEN 'id'            THEN 'Identificador (ULID gerado no app ou no servidor). Chave primária.'
        WHEN 'empresa_id'    THEN 'Empresa dona do registro (multiempresa). Toda consulta filtra por ela.'
        WHEN 'criado_em'     THEN 'Instante (UTC) em que o registro foi criado.'
        WHEN 'criado_por'    THEN 'Usuário que criou (da sessão/JWT). Base do "quem fez".'
        WHEN 'atualizado_em' THEN 'Instante (UTC) da última alteração.'
        WHEN 'versao'        THEN 'Versão para trava otimista: sobe a cada alteração; o comando manda versaoBase e o servidor recusa se mudou.'
        WHEN 'apagado_em'    THEN 'Exclusão lógica (soft delete). NULL = ativo. Nada é apagado de verdade.'
        WHEN 'operacao_id'   THEN 'Id da operação (comando) que gerou o lançamento: agrupa e garante idempotência por operação.'
        WHEN 'atributos'     THEN 'Atributos dinâmicos configuráveis (Configurações › Atributos) que não têm regra de negócio própria.'
        WHEN 'cotacao'       THEN 'Foto IMUTÁVEL da cotação usada na hora ({moeda, valor texto decimal, sentido, contra, data, uso}). Nunca recalcular o passado.'
        WHEN 'por_nome'      THEN 'Nome de quem fez, gravado na hora (o nome do usuário pode mudar depois).'
      END);
  END LOOP;
END $$;

-- =====================================================================
-- 14. COMENTÁRIOS — tabelas e colunas de negócio
-- =====================================================================
COMMENT ON TABLE moedas IS 'Moedas suportadas (global). BOB principal; USD, BRL; PYG desligado por padrão.';
COMMENT ON COLUMN moedas.codigo  IS 'ISO 4217.';
COMMENT ON COLUMN moedas.nome    IS 'Nome da moeda.';
COMMENT ON COLUMN moedas.simbolo IS 'Símbolo exibido (Bs, US$, R$, ₲).';
COMMENT ON COLUMN moedas.casas   IS 'Casas decimais da menor unidade (2 = centavos; 0 = guarani).';
COMMENT ON COLUMN moedas.pais    IS 'País de referência.';

COMMENT ON TABLE empresas IS 'Inquilino (tenant). Hoje o app tem uma empresa; o modelo já nasce multiempresa (Base.empresaId).';
COMMENT ON COLUMN empresas.nome            IS 'Nome do negócio (Configurações › Geral).';
COMMENT ON COLUMN empresas.moeda_principal IS 'Moeda em que totais, custos e relatórios são consolidados. Não muda depois de haver vendas/compras.';
COMMENT ON COLUMN empresas.fuso_horario    IS 'Fuso IANA que define o "dia do caixa" e o "hoje" no servidor (o app usa o relógio do aparelho).';
COMMENT ON COLUMN empresas.idioma          IS 'Idioma padrão da interface (pt/es).';

COMMENT ON TABLE usuarios IS 'Quem entra no sistema. Senha só como hash (argon2id no servidor).';
COMMENT ON COLUMN usuarios.login            IS 'Login: 3–30 minúsculas, números, ponto ou traço. Único.';
COMMENT ON COLUMN usuarios.nome             IS 'Nome exibido e gravado nos registros.';
COMMENT ON COLUMN usuarios.perfil           IS 'admin = tudo; funcionario = lista fechada de comandos/consultas (permissoes.ts) + visibilidade.';
COMMENT ON COLUMN usuarios.pessoa_id        IS 'Pessoa (cadastro) ligada ao usuário: profissional, viajante, dona das vendas.';
COMMENT ON COLUMN usuarios.local_id         IS 'Unidade padrão do usuário.';
COMMENT ON COLUMN usuarios.senha_hash       IS 'Hash argon2id (sal embutido). Nunca a senha.';
COMMENT ON COLUMN usuarios.ativo            IS 'Desativado não entra nem executa comandos; revoga os refresh tokens.';
COMMENT ON COLUMN usuarios.sistema          IS 'Usuário técnico ("Sistema") para importações e tarefas automáticas.';
COMMENT ON COLUMN usuarios.ultimo_acesso_em IS 'Último login.';

COMMENT ON TABLE refresh_tokens IS 'Tokens de renovação do JWT (rotação com detecção de reuso por família).';
COMMENT ON COLUMN refresh_tokens.usuario_id      IS 'Dono do token.';
COMMENT ON COLUMN refresh_tokens.token_hash      IS 'SHA-256 do token opaco (o token em si nunca é guardado).';
COMMENT ON COLUMN refresh_tokens.familia_id      IS 'Família de rotação: reuso de um token já trocado revoga a família inteira.';
COMMENT ON COLUMN refresh_tokens.emitido_em      IS 'Emissão.';
COMMENT ON COLUMN refresh_tokens.expira_em       IS 'Expiração absoluta.';
COMMENT ON COLUMN refresh_tokens.revogado_em     IS 'Revogado (logout, troca, desativação).';
COMMENT ON COLUMN refresh_tokens.substituido_por IS 'Token que substituiu este na rotação.';
COMMENT ON COLUMN refresh_tokens.user_agent      IS 'Aparelho/navegador (auditoria).';
COMMENT ON COLUMN refresh_tokens.ip              IS 'IP de emissão (auditoria).';

COMMENT ON TABLE idempotencia IS 'Idempotência POR PEDIDO: a mesma chave (repetição automática do app) devolve a mesma resposta sem executar de novo.';
COMMENT ON COLUMN idempotencia.usuario_id IS 'Quem mandou (a chave vale por usuário).';
COMMENT ON COLUMN idempotencia.chave      IS 'Chave do app: "nomeComando:uuid" (backendApi.ts:89).';
COMMENT ON COLUMN idempotencia.comando    IS 'Nome do comando.';
COMMENT ON COLUMN idempotencia.hash_dados IS 'SHA-256 do corpo: mesma chave com corpo diferente = 422.';
COMMENT ON COLUMN idempotencia.status     IS 'em_andamento (cópia concorrente espera/recebe 409) ou concluido.';
COMMENT ON COLUMN idempotencia.resposta   IS 'Resposta devolvida (só sucesso; recusa de regra não é guardada, igual a apiSimulada.ts:136-139).';
COMMENT ON COLUMN idempotencia.expira_em  IS 'Validade (ex.: 24 h) para limpeza.';

COMMENT ON TABLE auditoria IS 'Log detalhado: toda ação e toda tentativa recusada. Append-only.';
COMMENT ON COLUMN auditoria.acao         IS 'Nome da ação (ex.: concluirVenda, recusado, entrar).';
COMMENT ON COLUMN auditoria.alvo_id      IS 'Registro principal afetado (polimórfico, sem FK).';
COMMENT ON COLUMN auditoria.resumo       IS 'Texto legível do que aconteceu.';
COMMENT ON COLUMN auditoria.usuario_nome IS 'Nome do usuário na hora.';
COMMENT ON COLUMN auditoria.ligados      IS 'Outros ids ligados (pessoa, itens…) para a linha do tempo deles.';
COMMENT ON COLUMN auditoria.dados        IS 'Dados estruturados opcionais (antes/depois). Substitui o JSON hoje guardado em resumo.';
COMMENT ON COLUMN auditoria.recusado     IS 'true = tentativa recusada pela regra (registrada fora da transação).';

COMMENT ON TABLE modulos IS 'Módulos do negócio (cabelo, salao, produtos, emprestimos) e os personalizados criados pela tela.';
COMMENT ON COLUMN modulos.id            IS 'Id do módulo (cabelo, salao…).';
COMMENT ON COLUMN modulos.nome          IS 'Nome exibido.';
COMMENT ON COLUMN modulos.ativo         IS 'Módulo ligado (Configurações › Módulos).';
COMMENT ON COLUMN modulos.personalizado IS 'Criado pela tela (salvarModulo).';
COMMENT ON COLUMN modulos.definicao     IS 'Definição do módulo personalizado (tipos de item, campos).';
COMMENT ON COLUMN modulos.atualizado_em IS 'Última alteração.';
COMMENT ON COLUMN modulos.versao        IS 'Trava otimista.';

COMMENT ON TABLE configuracoes IS 'Configurações lidas inteiras (chave → JSON): geral (inclui fiscal), regras de códigos, formulário de compra, etapas da compra, atributos, categorias de viagem, status do câmbio.';
COMMENT ON COLUMN configuracoes.chave          IS 'Qual configuração.';
COMMENT ON COLUMN configuracoes.valor          IS 'Conteúdo JSON validado pelo serviço.';
COMMENT ON COLUMN configuracoes.atualizado_em  IS 'Última alteração.';
COMMENT ON COLUMN configuracoes.atualizado_por IS 'Quem alterou.';
COMMENT ON COLUMN configuracoes.versao         IS 'Trava otimista (salvarConfig manda versaoBase).';

COMMENT ON TABLE formas_pagamento IS 'Formas de pagamento (dinheiro, QR, Pix, crédito…).';
COMMENT ON COLUMN formas_pagamento.id          IS 'Id curto (dinheiro, qr, pix…).';
COMMENT ON COLUMN formas_pagamento.nome        IS 'Nome exibido.';
COMMENT ON COLUMN formas_pagamento.vivo        IS 'Dinheiro vivo: conta "na mão" no caixa (o resto é "no banco").';
COMMENT ON COLUMN formas_pagamento.moedas      IS 'Moedas aceitas por esta forma.';
COMMENT ON COLUMN formas_pagamento.desconto_bp IS 'Desconto sugerido da forma (pontos-base).';
COMMENT ON COLUMN formas_pagamento.ordem       IS 'Ordem na tela.';
COMMENT ON COLUMN formas_pagamento.ativo       IS 'Forma em uso (desligar sem apagar o histórico).';

COMMENT ON TABLE socios IS 'Sócias que dividem o lucro (hoje dentro de config.geral.socios).';
COMMENT ON COLUMN socios.nome      IS 'Nome.';
COMMENT ON COLUMN socios.parte_bp  IS 'Parte do lucro (5000 = 50%).';
COMMENT ON COLUMN socios.pessoa_id IS 'Cadastro de pessoa, se houver.';

COMMENT ON TABLE sequencias IS 'Contadores dos códigos (P/L/T/V/VG/AD). Ler e incrementar com SELECT … FOR UPDATE na mesma transação do comando.';
COMMENT ON COLUMN sequencias.chave   IS 'Qual sequência.';
COMMENT ON COLUMN sequencias.ultimo  IS 'Último número usado.';
COMMENT ON COLUMN sequencias.prefixo IS 'Prefixo (ex.: "L-"). Mudar o prefixo não zera a contagem.';
COMMENT ON COLUMN sequencias.digitos IS 'Casas com zeros à esquerda.';

COMMENT ON TABLE cotacoes IS 'Cotações registradas (manual ou da internet), por uso (base/venda/compra).';
COMMENT ON COLUMN cotacoes.moeda       IS 'Moeda cotada.';
COMMENT ON COLUMN cotacoes.valor       IS 'Valor decimal exato.';
COMMENT ON COLUMN cotacoes.valor_texto IS 'Texto como digitado ("6,96"): o app converte por racional a partir do texto.';
COMMENT ON COLUMN cotacoes.sentido     IS 'basePorMoeda ou moedaPorBase.';
COMMENT ON COLUMN cotacoes.contra      IS 'Moeda contra a qual foi digitada (padrão BRL).';
COMMENT ON COLUMN cotacoes.data        IS 'Dia da cotação.';
COMMENT ON COLUMN cotacoes.uso         IS 'base (mercado), venda (recebo em outra moeda), compra (pago em outra moeda).';
COMMENT ON COLUMN cotacoes.fonte       IS 'manual ou auto (internet).';

COMMENT ON TABLE cidades IS 'Cidades cadastradas pelo usuário (as 340 da Bolívia vêm de fábrica no código).';
COMMENT ON COLUMN cidades.nome         IS 'Nome.';
COMMENT ON COLUMN cidades.departamento IS 'Departamento/estado.';
COMMENT ON COLUMN cidades.pais         IS 'País.';
COMMENT ON COLUMN cidades.chave_busca  IS 'nome|departamento|pais sem acento e minúsculo: impede duplicar.';

COMMENT ON TABLE locais IS 'Unidades (salões, pontos).';
COMMENT ON COLUMN locais.nome       IS 'Nome oficial.';
COMMENT ON COLUMN locais.apelido    IS 'Como a equipe chama ("Centro").';
COMMENT ON COLUMN locais.tipo       IS 'salao, ponto ou outro.';
COMMENT ON COLUMN locais.rua        IS 'Endereço: rua.';
COMMENT ON COLUMN locais.numero     IS 'Endereço: número.';
COMMENT ON COLUMN locais.bairro     IS 'Endereço: bairro.';
COMMENT ON COLUMN locais.cidade     IS 'Endereço: cidade.';
COMMENT ON COLUMN locais.pais       IS 'Endereço: país.';
COMMENT ON COLUMN locais.referencia IS 'Ponto de referência.';

COMMENT ON TABLE pessoas IS 'Clientes, fornecedores, profissionais, funcionárias, devedores, credores, sócias.';
COMMENT ON COLUMN pessoas.nome              IS 'Nome.';
COMMENT ON COLUMN pessoas.telefone          IS 'Telefone/WhatsApp.';
COMMENT ON COLUMN pessoas.documento         IS 'Documento (sensível: funcionária não vê).';
COMMENT ON COLUMN pessoas.obs               IS 'Observação.';
COMMENT ON COLUMN pessoas.comissao_bp       IS 'Comissão padrão da profissional.';
COMMENT ON COLUMN pessoas.local_id          IS 'Unidade onde trabalha/é atendida.';
COMMENT ON COLUMN pessoas.cargo             IS 'Cargo (organograma).';
COMMENT ON COLUMN pessoas.salario_moeda     IS 'Moeda do salário estimado.';
COMMENT ON COLUMN pessoas.salario_valor     IS 'Salário/diária estimado (o pago de verdade fica no caixa).';
COMMENT ON COLUMN pessoas.salario_periodo   IS 'mes, semana ou dia.';
COMMENT ON COLUMN pessoas.superior_id       IS 'A quem responde (organograma).';
COMMENT ON COLUMN pessoas.ver_agenda_equipe IS 'Funcionária vê a agenda das colegas da unidade.';
COMMENT ON COLUMN pessoas.sigla             IS 'Sigla no código "por pessoa" (hoje em config.codigos.siglas).';

COMMENT ON TABLE pessoa_papeis IS 'Papéis da pessoa (N:N com o domínio fixo de papéis).';
COMMENT ON COLUMN pessoa_papeis.pessoa_id IS 'Pessoa.';
COMMENT ON COLUMN pessoa_papeis.papel     IS 'Papel.';

COMMENT ON TABLE triagem_colunas IS 'Colunas configuráveis do quadro da Triagem por módulo (hoje config fluxoTriagem). "Vendido" é calculada e não entra aqui.';
COMMENT ON COLUMN triagem_colunas.modulo_id         IS 'Módulo.';
COMMENT ON COLUMN triagem_colunas.nome              IS 'Nome da coluna.';
COMMENT ON COLUMN triagem_colunas.ordem             IS 'Posição no quadro.';
COMMENT ON COLUMN triagem_colunas.cor               IS 'Cor.';
COMMENT ON COLUMN triagem_colunas.ajuda             IS 'Texto de ajuda.';
COMMENT ON COLUMN triagem_colunas.entrada           IS 'Coluna de entrada (bruto aguardando triagem).';
COMMENT ON COLUMN triagem_colunas.pronto            IS 'Pronto para venda (entrar marca o lote como Separado).';
COMMENT ON COLUMN triagem_colunas.separar_ao_entrar IS 'Soltar aqui abre a separação.';
COMMENT ON COLUMN triagem_colunas.lembrar_fotos     IS 'Lembra de tirar fotos.';
COMMENT ON COLUMN triagem_colunas.exigir_foto       IS 'Só sai com foto própria.';
COMMENT ON COLUMN triagem_colunas.pedir_peso        IS 'Ao sair pergunta o peso (perda de lavagem).';

COMMENT ON TABLE triagens IS 'NOVA entidade: a operação de triagem "T-0003" (juntar e/ou separar). Hoje só existe copiada em cada lote (item.triagem).';
COMMENT ON COLUMN triagens.codigo           IS 'Código curto (T-0003).';
COMMENT ON COLUMN triagens.modulo_id        IS 'Módulo.';
COMMENT ON COLUMN triagens.por_nome         IS 'Quem fez.';
COMMENT ON COLUMN triagens.quantidade_usada IS 'Quanto do lote de entrada foi usado.';
COMMENT ON COLUMN triagens.perda            IS 'Usado − (partes + para depois).';
COMMENT ON COLUMN triagens.custo_extra      IS 'Custo extra somado ao rateio.';
COMMENT ON COLUMN triagens.motivo           IS 'Observação/motivo.';
COMMENT ON COLUMN triagens.desfeita_em      IS 'Quando foi desfeita (os lotes de saída ficam inativos).';
COMMENT ON COLUMN triagens.desfeita_por     IS 'Quem desfez.';
COMMENT ON COLUMN triagens.desfeita_motivo  IS 'Por que desfez (obrigatório).';

COMMENT ON TABLE itens IS 'Catálogo (produto, serviço) e LOTES de cabelo. Saldo é cache da soma de mov_estoque.';
COMMENT ON COLUMN itens.modulo_id             IS 'Módulo.';
COMMENT ON COLUMN itens.tipo_item             IS 'Tipo dentro do módulo (lote, produto, servico…).';
COMMENT ON COLUMN itens.nome                  IS 'Nome (lote: montado dos atributos).';
COMMENT ON COLUMN itens.unidade               IS 'grama, peca ou servico.';
COMMENT ON COLUMN itens.controla_estoque      IS 'Tem saldo e movimentos.';
COMMENT ON COLUMN itens.ativo                 IS 'false = fora de uso (ou lote de triagem desfeita).';
COMMENT ON COLUMN itens.saldo                 IS 'CACHE do saldo; verdade = Σ mov_estoque.delta. Atualizado na mesma transação, com a linha travada.';
COMMENT ON COLUMN itens.preco_sugerido_moeda  IS 'Moeda do preço sugerido.';
COMMENT ON COLUMN itens.preco_sugerido_valor  IS 'Preço sugerido (gramas: por 100 g).';
COMMENT ON COLUMN itens.estoque_ideal         IS 'Estoque ideal (aviso).';
COMMENT ON COLUMN itens.duracao_min           IS 'Serviço: duração em minutos (agenda/conflitos).';
COMMENT ON COLUMN itens.retorno_dias          IS 'Serviço: retorno sugerido.';
COMMENT ON COLUMN itens.comissao_bp           IS 'Serviço: comissão própria (precedência linha > serviço > profissional > padrão).';
COMMENT ON COLUMN itens.insumo_moeda          IS 'Serviço: moeda dos insumos.';
COMMENT ON COLUMN itens.insumo_valor          IS 'Serviço: insumos fixos descontados antes da comissão.';
COMMENT ON COLUMN itens.custo_principal       IS 'Lote: custo total na moeda principal (sobe com incorporação de viagem).';
COMMENT ON COLUMN itens.quantidade_inicial    IS 'Lote: quantidade com que nasceu (base do custo proporcional).';
COMMENT ON COLUMN itens.origem_tipo           IS 'compra, transformacao (separação), unificacao ou cadastro.';
COMMENT ON COLUMN itens.origem_compra_id      IS 'Compra de onde o lote nasceu diretamente.';
COMMENT ON COLUMN itens.origem_pessoa_id      IS 'Fornecedor de origem (sensível para funcionária).';
COMMENT ON COLUMN itens.codigo                IS 'Código de etiqueta/busca (L-0007, M1-1a).';
COMMENT ON COLUMN itens.codigo_busca          IS 'Código normalizado (maiúsculo, sem espaços) — único entre lotes.';
COMMENT ON COLUMN itens.estado                IS 'Bruto, Não identificado ou Separado (hoje campos.estado).';
COMMENT ON COLUMN itens.comprimento_cm        IS 'Medida em cm (hoje campos.comprimento).';
COMMENT ON COLUMN itens.categoria             IS 'Normal, Tinte, CH… escolhe a tabela de preço (hoje campos.categoria).';
COMMENT ON COLUMN itens.fase_coluna_id        IS 'Coluna atual no quadro da Triagem.';
COMMENT ON COLUMN itens.fase_desde            IS 'Desde quando está na coluna.';
COMMENT ON COLUMN itens.fase_obs              IS 'Observação da movimentação.';
COMMENT ON COLUMN itens.triagem_id            IS 'Triagem que criou o lote (substitui item.triagem.id e campos.separacaoId).';
COMMENT ON COLUMN itens.triagem_papel         IS 'saida ou intermediario (juntado e separado no mesmo passo).';
COMMENT ON COLUMN itens.rateio_custo          IS 'Como o custo da separação foi dividido: peso ou valor.';
COMMENT ON COLUMN itens.etiqueta_impressa_em  IS 'Última impressão da etiqueta.';
COMMENT ON COLUMN itens.etiqueta_impressa_por IS 'Nome de quem imprimiu.';
COMMENT ON COLUMN itens.etiqueta_peso         IS 'Peso impresso (saldo diferente → reimprimir).';
COMMENT ON COLUMN itens.etiqueta_via          IS 'Via da etiqueta (sobe ao cancelar e gerar nova).';
COMMENT ON COLUMN itens.etiqueta_cancelada_em IS 'Última etiqueta cancelada: quando.';
COMMENT ON COLUMN itens.etiqueta_cancelada_motivo IS 'Última etiqueta cancelada: por quê.';
COMMENT ON COLUMN itens.etiqueta_cancelada_por IS 'Última etiqueta cancelada: quem.';
COMMENT ON COLUMN itens.qr_codigo             IS 'Código ALEATÓRIO do QR da etiqueta (…#/q/<código>, 16 caracteres sem ambíguos; app: novoCodigoQr). Não revela id, data, medida nem cor. Único no banco inteiro. Reimprimir (nova via) troca o código e o antigo vai para item_qr_anteriores. NULL = ainda sem código (etiqueta antiga usa #/lotes/<id>).';
COMMENT ON COLUMN itens.qr_gerado_em          IS 'Quando o código atual do QR foi gerado (prepararQrEtiquetas ao abrir a impressão, ou refazerEtiqueta).';
COMMENT ON COLUMN itens.vitrine_oculto        IS 'Minha vitrine: o administrador escondeu este pacote da página do comprador (app: geral.vitrine.ocultos).';
COMMENT ON CONSTRAINT ck_itens_qr_formato ON itens IS 'QR: só letras e números, 16 a 40 caracteres (o leitor aceita 10–40; o gerador faz 16).';
COMMENT ON CONSTRAINT ck_itens_qr_par     ON itens IS 'Código do QR e data de geração andam juntos.';
COMMENT ON CONSTRAINT ck_itens_qr_lote    ON itens IS 'Só pacote com estoque (lote) tem QR de etiqueta.';
COMMENT ON COLUMN itens.reserva_para          IS 'Reserva: para quem (texto livre, como hoje).';
COMMENT ON COLUMN itens.reserva_pessoa_id     IS 'Reserva: cliente cadastrada (opcional, recomendado).';
COMMENT ON COLUMN itens.reserva_ate           IS 'Reserva: até quando.';
COMMENT ON COLUMN itens.reserva_obs           IS 'Reserva: observação.';
COMMENT ON COLUMN itens.reserva_em            IS 'Reserva: quando foi feita.';
COMMENT ON COLUMN itens.reserva_por_nome      IS 'Reserva: quem fez.';

COMMENT ON TABLE item_insumos IS 'Itens de insumo do serviço (Tinta 15 + Água oxigenada 5 = 20).';
COMMENT ON COLUMN item_insumos.item_id IS 'Serviço.';
COMMENT ON COLUMN item_insumos.ordem   IS 'Ordem.';
COMMENT ON COLUMN item_insumos.nome    IS 'Nome do insumo.';
COMMENT ON COLUMN item_insumos.valor   IS 'Valor na moeda do insumo do serviço.';

COMMENT ON TABLE item_origens IS 'GENEALOGIA: de que lote(s) um lote veio (separação: 1 pai; unificação: N pais).';
COMMENT ON COLUMN item_origens.filho_id   IS 'Lote gerado.';
COMMENT ON COLUMN item_origens.pai_id     IS 'Lote de origem.';
COMMENT ON COLUMN item_origens.tipo       IS 'transformacao ou unificacao.';
COMMENT ON COLUMN item_origens.quantidade IS 'Quanto do pai entrou no filho (unificação: o saldo que o pai pôs).';
COMMENT ON COLUMN item_origens.triagem_id IS 'Triagem da ligação.';

COMMENT ON TABLE item_compras IS 'DERIVADA: todas as compras de onde o cabelo do lote vem (fecho da genealogia; hoje origem.compraIds).';
COMMENT ON COLUMN item_compras.item_id   IS 'Lote.';
COMMENT ON COLUMN item_compras.compra_id IS 'Compra de origem.';

COMMENT ON TABLE codigos_anteriores IS 'Códigos que compra/lote já tiveram (trocados pelo admin): continuam achando na busca.';
COMMENT ON COLUMN codigos_anteriores.entidade     IS 'compra ou lote.';
COMMENT ON COLUMN codigos_anteriores.entidade_id  IS 'Id da compra ou do lote.';
COMMENT ON COLUMN codigos_anteriores.codigo       IS 'Código antigo.';
COMMENT ON COLUMN codigos_anteriores.codigo_busca IS 'Código antigo normalizado.';
COMMENT ON COLUMN codigos_anteriores.motivo       IS 'Motivo da troca.';

COMMENT ON TABLE mov_estoque IS 'Razão do estoque (append-only). Saldo = soma; cada movimento guarda antes/depois.';
COMMENT ON COLUMN mov_estoque.item_id        IS 'Item/lote.';
COMMENT ON COLUMN mov_estoque.seq            IS 'Sequência por item (1,2,3…): UNIQUE impede dois movimentos concorrentes com o mesmo saldo_antes.';
COMMENT ON COLUMN mov_estoque.data           IS 'Dia de negócio.';
COMMENT ON COLUMN mov_estoque.delta          IS '+ entrada, − saída.';
COMMENT ON COLUMN mov_estoque.saldo_antes    IS 'Saldo antes.';
COMMENT ON COLUMN mov_estoque.saldo_depois   IS 'Saldo depois (= antes + delta).';
COMMENT ON COLUMN mov_estoque.motivo         IS 'Motivo do movimento.';
COMMENT ON COLUMN mov_estoque.venda_id       IS 'Venda de origem (venda, uso, cancelamento, correção).';
COMMENT ON COLUMN mov_estoque.compra_id      IS 'Compra de origem (entrada, conferência de peso, cancelamento).';
COMMENT ON COLUMN mov_estoque.triagem_id     IS 'Triagem de origem (separação/unificação/desfazer).';
COMMENT ON COLUMN mov_estoque.lote_origem_id IS 'Lote-mãe/unificado ligado ao movimento (hoje origemId = id do lote).';
COMMENT ON COLUMN mov_estoque.corrige_id     IS 'Movimento que este corrige.';
COMMENT ON COLUMN mov_estoque.descricao      IS 'Descrição legível.';

COMMENT ON TABLE tabelas_preco IS 'Tabela de preço (linhas = medida, colunas = comprador/canal, célula = fator). O conteúdo vigente é a versão publicada.';
COMMENT ON COLUMN tabelas_preco.modulo_id        IS 'Módulo.';
COMMENT ON COLUMN tabelas_preco.nome             IS 'Nome.';
COMMENT ON COLUMN tabelas_preco.categoria        IS 'Categoria do produto (Normal, Tinte, CH).';
COMMENT ON COLUMN tabelas_preco.valida_desde     IS 'A partir de quando vale.';
COMMENT ON COLUMN tabelas_preco.moeda            IS 'Moeda dos valores.';
COMMENT ON COLUMN tabelas_preco.unidade_medida   IS 'Rótulo da medida das linhas (cm).';
COMMENT ON COLUMN tabelas_preco.fator_por        IS 'grama (valor = gramas × fator) ou unidade.';
COMMENT ON COLUMN tabelas_preco.versao_publicada IS 'Número da versão vigente (trava otimista da grade: versaoBase).';

COMMENT ON TABLE tabela_preco_versoes IS 'Cada publicação (foto completa). Hoje guardada como JSON na auditoria (acao tabelaPrecoVersao).';
COMMENT ON COLUMN tabela_preco_versoes.tabela_id     IS 'Tabela.';
COMMENT ON COLUMN tabela_preco_versoes.numero        IS 'v1, v2…';
COMMENT ON COLUMN tabela_preco_versoes.publicada_em  IS 'Quando publicou.';
COMMENT ON COLUMN tabela_preco_versoes.publicada_por IS 'Quem publicou.';
COMMENT ON COLUMN tabela_preco_versoes.nota          IS 'O que mudou e por quê.';
COMMENT ON COLUMN tabela_preco_versoes.nome          IS 'Nome da tabela nesta versão.';
COMMENT ON COLUMN tabela_preco_versoes.categoria     IS 'Categoria nesta versão.';
COMMENT ON COLUMN tabela_preco_versoes.valida_desde  IS 'Vigência nesta versão.';

COMMENT ON TABLE tabela_preco_colunas IS 'Colunas (comprador/canal) de uma versão.';
COMMENT ON COLUMN tabela_preco_colunas.versao_id IS 'Versão.';
COMMENT ON COLUMN tabela_preco_colunas.coluna_id IS 'Id estável da coluna (as vendas guardam colunaId).';
COMMENT ON COLUMN tabela_preco_colunas.nome      IS 'Nome (Iver, Henry, Paraguai).';
COMMENT ON COLUMN tabela_preco_colunas.pessoa_id IS 'Pessoa ligada à coluna (fornecedor/comprador).';
COMMENT ON COLUMN tabela_preco_colunas.ordem     IS 'Ordem.';

COMMENT ON TABLE tabela_preco_medidas IS 'Medidas (linhas) de uma versão, inclusive as ainda sem valor.';
COMMENT ON COLUMN tabela_preco_medidas.versao_id IS 'Versão.';
COMMENT ON COLUMN tabela_preco_medidas.medida    IS 'Medida (ex.: 40 cm).';

COMMENT ON TABLE tabela_preco_celulas IS 'Fator de cada medida × coluna (hoje valores["40|iver"] = "3,5").';
COMMENT ON COLUMN tabela_preco_celulas.versao_id   IS 'Versão.';
COMMENT ON COLUMN tabela_preco_celulas.medida      IS 'Medida.';
COMMENT ON COLUMN tabela_preco_celulas.coluna_id   IS 'Coluna.';
COMMENT ON COLUMN tabela_preco_celulas.fator       IS 'Fator exato.';
COMMENT ON COLUMN tabela_preco_celulas.fator_texto IS 'Fator como digitado/normalizado ("3,5"): é dele que o app calcula.';

COMMENT ON TABLE compras IS 'Pedido de compra (cabeçalho). O lote de cabelo nasce no registro (não no pagamento).';
COMMENT ON COLUMN compras.codigo             IS 'P-0007 / M3.';
COMMENT ON COLUMN compras.codigo_busca       IS 'Código normalizado, único entre compras.';
COMMENT ON COLUMN compras.modulo_id          IS 'Módulo.';
COMMENT ON COLUMN compras.data               IS 'Dia do caixa da compra.';
COMMENT ON COLUMN compras.etapa              IS 'Etapa configurável do fluxo (recebido, conferido, pago, concluido) ou cancelado/recusado.';
COMMENT ON COLUMN compras.pessoa_id          IS 'Fornecedor.';
COMMENT ON COLUMN compras.comprador_id       IS 'Quem da equipe comprou.';
COMMENT ON COLUMN compras.local_id           IS 'Unidade.';
COMMENT ON COLUMN compras.viagem_id          IS 'Viagem de compra (rateio dos gastos).';
COMMENT ON COLUMN compras.financiamento_id   IS 'Entrega que abate um adiantamento (não sai do caixa).';
COMMENT ON COLUMN compras.moeda_principal    IS 'Moeda principal na hora.';
COMMENT ON COLUMN compras.total_principal    IS 'Σ linhas na moeda principal.';
COMMENT ON COLUMN compras.sem_valor          IS 'Pendência "sem valor" (peso registrado, valor depois).';
COMMENT ON COLUMN compras.obs                IS 'Observação.';
COMMENT ON COLUMN compras.impostos_estimados IS 'SÓ REGISTRO dos impostos estimados na hora (nunca cobrados).';
COMMENT ON COLUMN compras.doc_fiscal        IS 'Documento que veio com a compra: factura (dá crédito de IVA), recibo ou sem (compra sem factura ⇒ retenção RET-IUE 5% + RET-IT 3%, F-570/F-410). NULL = ainda não classificado (pendência no Imposto de Renda). App: campos.docFiscal.';
COMMENT ON COLUMN compras.doc_fiscal_numero IS 'Número da factura/recibo (não existe para "sem").';
COMMENT ON CONSTRAINT ck_compras_doc_fiscal ON compras IS 'factura, recibo ou sem.';
COMMENT ON CONSTRAINT ck_compras_doc_numero ON compras IS 'Número só para factura/recibo, até 40 caracteres.';

COMMENT ON TABLE compra_linhas IS 'Linhas da compra.';
COMMENT ON COLUMN compra_linhas.compra_id       IS 'Compra.';
COMMENT ON COLUMN compra_linhas.ordem           IS 'Ordem.';
COMMENT ON COLUMN compra_linhas.item_id         IS 'Item de catálogo comprado OU o lote que nasceu desta linha.';
COMMENT ON COLUMN compra_linhas.descricao       IS 'Descrição.';
COMMENT ON COLUMN compra_linhas.quantidade      IS 'Gramas/peças.';
COMMENT ON COLUMN compra_linhas.moeda           IS 'Moeda da linha.';
COMMENT ON COLUMN compra_linhas.total           IS 'Valor na moeda da linha (com fator: gramas × fator).';
COMMENT ON COLUMN compra_linhas.total_principal IS 'Valor convertido (cotação de compra).';
COMMENT ON COLUMN compra_linhas.medida          IS 'Medida da tabela usada.';
COMMENT ON COLUMN compra_linhas.fator           IS 'Fator usado.';
COMMENT ON COLUMN compra_linhas.categoria       IS 'Categoria usada.';
COMMENT ON COLUMN compra_linhas.tabela_id       IS 'Tabela usada.';
COMMENT ON COLUMN compra_linhas.tabela_versao   IS 'Versão da tabela que valia na hora (carimbo).';
COMMENT ON COLUMN compra_linhas.coluna_id       IS 'Coluna usada.';
COMMENT ON COLUMN compra_linhas.fator_tabela    IS 'Fator que a tabela dava.';
COMMENT ON COLUMN compra_linhas.fator_manual    IS 'Fator mudado à mão.';
COMMENT ON COLUMN compra_linhas.calculo_texto   IS 'Memória do cálculo ("60 | 137 × 15 = Bs 2.055").';
COMMENT ON COLUMN compra_linhas.sem_valor       IS 'Linha sem valor ainda.';
COMMENT ON COLUMN compra_linhas.ja_paga         IS 'Linha já paga no ato (pagamento parcial).';
COMMENT ON COLUMN compra_linhas.lote_nascido    IS 'true = o item_id é o LOTE que nasceu desta linha (módulo "lote por compra").';

COMMENT ON TABLE vendas IS 'Venda ou atendimento (agendado → concluido; cancelado).';
COMMENT ON COLUMN vendas.codigo           IS 'V-0012.';
COMMENT ON COLUMN vendas.modulo_id        IS 'Módulo do primeiro item.';
COMMENT ON COLUMN vendas.data             IS 'Dia do caixa (agendado: dia do agendamento).';
COMMENT ON COLUMN vendas.etapa            IS 'agendado, novo (transitório), concluido, cancelado.';
COMMENT ON COLUMN vendas.pessoa_id        IS 'Cliente.';
COMMENT ON COLUMN vendas.local_id         IS 'Unidade.';
COMMENT ON COLUMN vendas.profissional_id  IS 'Profissional padrão.';
COMMENT ON COLUMN vendas.agendado_para    IS 'Início do atendimento agendado.';
COMMENT ON COLUMN vendas.moeda_principal  IS 'Moeda principal na hora.';
COMMENT ON COLUMN vendas.total_principal  IS 'Σ linhas (líquido) na moeda principal.';
COMMENT ON COLUMN vendas.cobrado_em       IS 'Moeda de cobrança (modo caixa).';
COMMENT ON COLUMN vendas.cotacao_cobranca IS 'Cotação digitada na hora ("1,28").';
COMMENT ON COLUMN vendas.desconto_texto   IS 'Texto do desconto da venda.';
COMMENT ON COLUMN vendas.obs              IS 'Observação.';
COMMENT ON COLUMN vendas.impostos_estimados IS 'SÓ REGISTRO dos impostos estimados.';

COMMENT ON TABLE venda_linhas IS 'Linhas da venda com a FOTO da hora (preço, custo, comissão, insumos, desconto, tabela).';
COMMENT ON COLUMN venda_linhas.venda_id           IS 'Venda.';
COMMENT ON COLUMN venda_linhas.ordem              IS 'Ordem.';
COMMENT ON COLUMN venda_linhas.item_id            IS 'Item/lote vendido.';
COMMENT ON COLUMN venda_linhas.descricao          IS 'Descrição.';
COMMENT ON COLUMN venda_linhas.quantidade         IS 'Gramas/peças/vezes.';
COMMENT ON COLUMN venda_linhas.moeda              IS 'Moeda da linha.';
COMMENT ON COLUMN venda_linhas.total              IS 'Valor LÍQUIDO (bruto − desconto).';
COMMENT ON COLUMN venda_linhas.total_principal    IS 'Líquido convertido (cotação de venda).';
COMMENT ON COLUMN venda_linhas.bruto              IS 'Valor cheio (gramas × fator).';
COMMENT ON COLUMN venda_linhas.desconto           IS 'Desconto na moeda da linha.';
COMMENT ON COLUMN venda_linhas.desconto_principal IS 'Desconto na moeda principal.';
COMMENT ON COLUMN venda_linhas.custo_principal    IS 'Custo do que saiu (proporcional do lote) na hora.';
COMMENT ON COLUMN venda_linhas.profissional_id    IS 'Profissional da linha.';
COMMENT ON COLUMN venda_linhas.comissao_bp        IS '% da comissão usado.';
COMMENT ON COLUMN venda_linhas.comissao_regra     IS 'De onde veio o %.';
COMMENT ON COLUMN venda_linhas.comissao_principal IS 'Comissão ganha (base × %).';
COMMENT ON COLUMN venda_linhas.insumo_principal   IS 'Insumos (custo) descontados antes da comissão.';
COMMENT ON COLUMN venda_linhas.insumos            IS 'Detalhe imutável dos insumos [{nome, valorPrincipal}].';
COMMENT ON COLUMN venda_linhas.insumo_motivo      IS 'Motivo de mudar os insumos do catálogo.';
COMMENT ON COLUMN venda_linhas.base_comissao      IS 'total_principal − insumos.';
COMMENT ON COLUMN venda_linhas.parte_salao        IS 'base − comissão.';
COMMENT ON COLUMN venda_linhas.preco_catalogo     IS 'Preço do catálogo na hora.';
COMMENT ON COLUMN venda_linhas.motivo_preco       IS 'Motivo de cobrar menos que o catálogo.';
COMMENT ON COLUMN venda_linhas.medida             IS 'Medida.';
COMMENT ON COLUMN venda_linhas.fator              IS 'Fator usado.';
COMMENT ON COLUMN venda_linhas.categoria          IS 'Categoria.';
COMMENT ON COLUMN venda_linhas.tabela_id          IS 'Tabela.';
COMMENT ON COLUMN venda_linhas.tabela_versao      IS 'Versão da tabela na hora.';
COMMENT ON COLUMN venda_linhas.coluna_id          IS 'Coluna.';
COMMENT ON COLUMN venda_linhas.fator_tabela       IS 'Fator que a tabela dava.';
COMMENT ON COLUMN venda_linhas.fator_manual       IS 'Fator mudado à mão.';
COMMENT ON COLUMN venda_linhas.calculo_texto      IS 'Memória do cálculo.';

COMMENT ON TABLE pagamentos IS 'Pagamentos de compra ou venda (inclui a diferença de correção).';
COMMENT ON COLUMN pagamentos.compra_id       IS 'Compra (XOR venda).';
COMMENT ON COLUMN pagamentos.venda_id        IS 'Venda (XOR compra).';
COMMENT ON COLUMN pagamentos.tipo            IS 'pagamento ou correcao (pode ser negativo).';
COMMENT ON COLUMN pagamentos.forma_id        IS 'Forma.';
COMMENT ON COLUMN pagamentos.moeda           IS 'Moeda paga.';
COMMENT ON COLUMN pagamentos.valor           IS 'Valor na moeda paga.';
COMMENT ON COLUMN pagamentos.valor_principal IS 'Valor na moeda principal (cotação guardada).';

COMMENT ON TABLE etapa_eventos IS 'Histórico de etapas e correções (antes → depois) de compra/venda.';
COMMENT ON COLUMN etapa_eventos.compra_id    IS 'Compra (XOR venda).';
COMMENT ON COLUMN etapa_eventos.venda_id     IS 'Venda (XOR compra).';
COMMENT ON COLUMN etapa_eventos.de           IS 'Etapa anterior.';
COMMENT ON COLUMN etapa_eventos.para         IS 'Etapa nova.';
COMMENT ON COLUMN etapa_eventos.em           IS 'Quando.';
COMMENT ON COLUMN etapa_eventos.por          IS 'Usuário.';
COMMENT ON COLUMN etapa_eventos.tipo         IS 'etapa ou correcao.';
COMMENT ON COLUMN etapa_eventos.total_antes  IS 'Correção: total antes.';
COMMENT ON COLUMN etapa_eventos.total_depois IS 'Correção: total depois.';
COMMENT ON COLUMN etapa_eventos.motivo       IS 'Motivo.';
COMMENT ON COLUMN etapa_eventos.ajustes      IS 'Ajustes legíveis linha a linha.';

COMMENT ON TABLE vendas_abertas IS 'Rascunho do caixa (não baixa estoque nem caixa). Hoje em config "vendaAberta:<id>". O id vira o id da venda ao fechar.';
COMMENT ON COLUMN vendas_abertas.pessoa_id      IS 'Cliente.';
COMMENT ON COLUMN vendas_abertas.vendedor_id    IS 'Vendedora.';
COMMENT ON COLUMN vendas_abertas.local_id       IS 'Unidade.';
COMMENT ON COLUMN vendas_abertas.coluna_id      IS 'Coluna da tabela de preço escolhida.';
COMMENT ON COLUMN vendas_abertas.obs            IS 'Observação.';
COMMENT ON COLUMN vendas_abertas.desconto_modo  IS 'pct ou valor.';
COMMENT ON COLUMN vendas_abertas.desconto_pct   IS 'Desconto em %.';
COMMENT ON COLUMN vendas_abertas.desconto_valor IS 'Desconto em valor.';
COMMENT ON COLUMN vendas_abertas.moeda          IS 'Moeda do desconto/cobrança.';
COMMENT ON COLUMN vendas_abertas.total_mostrado IS 'Total que a tela mostrava (só para a lista; o preço vale o da hora de fechar).';
COMMENT ON COLUMN vendas_abertas.moeda_total    IS 'Moeda do total mostrado.';
COMMENT ON COLUMN vendas_abertas.salva_em       IS 'Último salvamento automático.';

COMMENT ON TABLE venda_aberta_linhas IS 'Pacotes guardados numa venda em aberto.';
COMMENT ON COLUMN venda_aberta_linhas.venda_aberta_id IS 'Venda em aberto.';
COMMENT ON COLUMN venda_aberta_linhas.item_id         IS 'Pacote.';
COMMENT ON COLUMN venda_aberta_linhas.quantidade      IS 'Quantidade.';
COMMENT ON COLUMN venda_aberta_linhas.preco_manual    IS 'Preço digitado (pacote sem preço de tabela).';

COMMENT ON TABLE dias_caixa IS 'Dia do caixa: nasce aberto no primeiro lançamento; encerrado recusa lançamentos.';
COMMENT ON COLUMN dias_caixa.empresa_id    IS 'Empresa.';
COMMENT ON COLUMN dias_caixa.data          IS 'Dia (fuso da empresa).';
COMMENT ON COLUMN dias_caixa.status        IS 'aberto ou encerrado.';
COMMENT ON COLUMN dias_caixa.criado_em     IS 'Quando o dia nasceu.';
COMMENT ON COLUMN dias_caixa.criado_por    IS 'Quem fez o primeiro lançamento.';
COMMENT ON COLUMN dias_caixa.encerrado_em  IS 'Quando encerrou.';
COMMENT ON COLUMN dias_caixa.encerrado_por IS 'Quem encerrou.';
COMMENT ON COLUMN dias_caixa.atualizado_em IS 'Última alteração.';
COMMENT ON COLUMN dias_caixa.versao        IS 'Trava otimista; e a linha é travada (FOR UPDATE) por todo lançamento do dia.';

COMMENT ON TABLE dia_contagens IS 'Dinheiro vivo contado no encerramento, por moeda.';
COMMENT ON COLUMN dia_contagens.empresa_id IS 'Empresa.';
COMMENT ON COLUMN dia_contagens.data       IS 'Dia.';
COMMENT ON COLUMN dia_contagens.moeda      IS 'Moeda.';
COMMENT ON COLUMN dia_contagens.contado    IS 'Valor contado.';

COMMENT ON TABLE dia_alteracoes IS 'Vendas de um dia encerrado corrigidas/canceladas depois (a diferença entra no dia em que corrigiu).';
COMMENT ON COLUMN dia_alteracoes.empresa_id IS 'Empresa.';
COMMENT ON COLUMN dia_alteracoes.data       IS 'Dia encerrado afetado.';
COMMENT ON COLUMN dia_alteracoes.venda_id   IS 'Venda alterada.';
COMMENT ON COLUMN dia_alteracoes.codigo     IS 'Código da venda.';
COMMENT ON COLUMN dia_alteracoes.descricao  IS 'O que aconteceu.';
COMMENT ON COLUMN dia_alteracoes.em         IS 'Quando.';
COMMENT ON COLUMN dia_alteracoes.por_nome   IS 'Quem.';

COMMENT ON TABLE turnos IS 'Turno com CONFERÊNCIA CEGA (Caixa › Fechar meu turno): a pessoa conta o efectivo da mão sem ver o esperado; a diferença fica no nome dela. Append-only. Não mexe no caixa do dia. Esperado/contado por moeda em turno_valores.';
COMMENT ON COLUMN turnos.usuario_id  IS 'De quem é o turno (dono do dinheiro contado). Sempre quem está na sessão: ninguém fecha o turno de outra pessoa (fecharTurno usa sessao.usuarioId).';
COMMENT ON CONSTRAINT ck_turnos_dono ON turnos IS 'O turno é fechado pela própria pessoa.';
COMMENT ON COLUMN turnos.inicio      IS 'Começo: o fim do último turno da pessoa, ou 00:00 do dia se nunca fechou.';
COMMENT ON COLUMN turnos.fim         IS 'Quando fechou (instante da contagem).';
COMMENT ON COLUMN turnos.lancamentos IS 'Quantos lançamentos em dinheiro dela entraram na conta do esperado.';
COMMENT ON COLUMN turnos.situacao    IS 'confere, falta, sobra, ou "falta e sobra" (moedas diferentes). Calculada pelo serviço a partir de turno_valores.';
COMMENT ON COLUMN turnos.obs         IS 'Explicação da pessoa (ex.: "dei troco a mais").';
COMMENT ON CONSTRAINT ex_turnos_sem_sobrepor ON turnos IS 'Dois turnos da mesma pessoa não se sobrepõem no tempo (precisa de btree_gist).';
COMMENT ON CONSTRAINT ck_turnos_periodo      ON turnos IS 'O fim vem depois do começo.';
COMMENT ON CONSTRAINT ck_turnos_situacao     ON turnos IS 'Situações possíveis do turno.';
COMMENT ON TABLE turno_valores IS 'Por moeda: quanto deveria ter (esperado), quanto a pessoa contou (contado) e a diferença.';
COMMENT ON COLUMN turno_valores.turno_id  IS 'Turno.';
COMMENT ON COLUMN turno_valores.moeda     IS 'Moeda contada.';
COMMENT ON COLUMN turno_valores.esperado  IS 'Soma dos lançamentos em dinheiro da pessoa no período (a pessoa NÃO vê antes de contar).';
COMMENT ON COLUMN turno_valores.contado   IS 'O que a pessoa contou.';
COMMENT ON COLUMN turno_valores.diferenca IS 'contado − esperado (negativo = falta, positivo = sobra). Coluna gerada.';

COMMENT ON TABLE mov_caixa IS 'Razão do caixa: todo dinheiro que entra/sai. Nunca apagado: estorno cria o inverso.';
COMMENT ON COLUMN mov_caixa.data             IS 'Dia do caixa.';
COMMENT ON COLUMN mov_caixa.moeda            IS 'Moeda.';
COMMENT ON COLUMN mov_caixa.forma_id         IS 'Forma (vivo = na mão).';
COMMENT ON COLUMN mov_caixa.delta            IS '+ entra, − sai.';
COMMENT ON COLUMN mov_caixa.tipo             IS 'Tipo do lançamento.';
COMMENT ON COLUMN mov_caixa.finalidade       IS 'NOVO: finalidade explícita (hoje comissão é reconhecida por categoria = "Comissões").';
COMMENT ON COLUMN mov_caixa.descricao        IS 'Descrição.';
COMMENT ON COLUMN mov_caixa.categoria        IS 'Categoria da despesa (DRE).';
COMMENT ON COLUMN mov_caixa.valor_principal  IS 'Valor na moeda principal no dia (não muda com o câmbio).';
COMMENT ON COLUMN mov_caixa.venda_id         IS 'Origem: venda.';
COMMENT ON COLUMN mov_caixa.compra_id        IS 'Origem: compra.';
COMMENT ON COLUMN mov_caixa.emprestimo_id    IS 'Origem: empréstimo.';
COMMENT ON COLUMN mov_caixa.financiamento_id IS 'Origem: adiantamento.';
COMMENT ON COLUMN mov_caixa.viagem_id        IS 'Dinheiro de viagem (adiantamento, sobra, reembolso).';
COMMENT ON COLUMN mov_caixa.socio_id         IS 'Retirada de sócia.';
COMMENT ON COLUMN mov_caixa.local_id         IS 'Unidade da despesa.';
COMMENT ON COLUMN mov_caixa.pessoa_id        IS 'Pessoa paga (salário, comissão).';
COMMENT ON COLUMN mov_caixa.estorna_id       IS 'Este lançamento desfaz aquele.';
COMMENT ON COLUMN mov_caixa.estornado_por    IS 'Este foi desfeito por aquele.';
COMMENT ON COLUMN mov_caixa.doc_fiscal           IS 'Só em despesa: documento do gasto (factura, recibo ou sem). NULL = ainda não classificado. App: movCaixa.docFiscal.documento.';
COMMENT ON COLUMN mov_caixa.doc_fiscal_dedutivel IS 'O gasto abate no IUE? "sem" documento nunca abate; factura/recibo abatem salvo se marcado que não.';
COMMENT ON COLUMN mov_caixa.doc_fiscal_numero    IS 'Número da factura/recibo do gasto.';
COMMENT ON CONSTRAINT ck_mov_caixa_doc_tipo      ON mov_caixa IS 'Documento fiscal só em lançamento de despesa.';
COMMENT ON CONSTRAINT ck_mov_caixa_doc_dedutivel ON mov_caixa IS 'Classificado ⇒ diz se é dedutível; "sem" documento nunca é dedutível.';
COMMENT ON CONSTRAINT ck_mov_caixa_doc_numero    ON mov_caixa IS 'Número só para factura/recibo, até 40 caracteres.';

COMMENT ON TABLE mov_conta IS 'Conta corrente por pessoa: + a pessoa me deve; − eu devo. Saldo = soma.';
COMMENT ON COLUMN mov_conta.pessoa_id        IS 'Pessoa.';
COMMENT ON COLUMN mov_conta.data             IS 'Dia.';
COMMENT ON COLUMN mov_conta.moeda            IS 'Moeda (principal).';
COMMENT ON COLUMN mov_conta.delta            IS 'Valor.';
COMMENT ON COLUMN mov_conta.tipo             IS 'Tipo.';
COMMENT ON COLUMN mov_conta.venda_id         IS 'Origem: venda.';
COMMENT ON COLUMN mov_conta.compra_id        IS 'Origem: compra.';
COMMENT ON COLUMN mov_conta.financiamento_id IS 'Origem: adiantamento.';
COMMENT ON COLUMN mov_conta.forma_id         IS 'Forma (acerto).';
COMMENT ON COLUMN mov_conta.descricao        IS 'Descrição.';

COMMENT ON TABLE emprestimos IS 'Empréstimos dados/tomados (o sistema só registra e calcula o combinado).';
COMMENT ON COLUMN emprestimos.direcao              IS 'dado ou tomado.';
COMMENT ON COLUMN emprestimos.pessoa_id            IS 'Pessoa.';
COMMENT ON COLUMN emprestimos.moeda                IS 'Moeda.';
COMMENT ON COLUMN emprestimos.principal            IS 'Valor emprestado.';
COMMENT ON COLUMN emprestimos.juros_tipo           IS 'nenhum, simples, composto (Price) ou fixo.';
COMMENT ON COLUMN emprestimos.juros_taxa_mensal_bp IS 'Taxa ao mês.';
COMMENT ON COLUMN emprestimos.juros_valor_fixo     IS 'Juros fixos.';
COMMENT ON COLUMN emprestimos.inicio               IS 'Início.';
COMMENT ON COLUMN emprestimos.situacao             IS 'aberto, quitado ou cancelado.';
COMMENT ON COLUMN emprestimos.obs                  IS 'Observação.';

COMMENT ON TABLE parcelas IS 'Parcelas combinadas.';
COMMENT ON COLUMN parcelas.emprestimo_id IS 'Empréstimo.';
COMMENT ON COLUMN parcelas.numero        IS 'Número (1..120).';
COMMENT ON COLUMN parcelas.vencimento    IS 'Vencimento.';
COMMENT ON COLUMN parcelas.valor         IS 'Valor.';

COMMENT ON TABLE mov_divida IS 'Razão da dívida do empréstimo (principal + juros − pagamentos).';
COMMENT ON COLUMN mov_divida.emprestimo_id IS 'Empréstimo.';
COMMENT ON COLUMN mov_divida.parcela_id    IS 'Parcela abatida.';
COMMENT ON COLUMN mov_divida.seq           IS 'Sequência por empréstimo (trava concorrência).';
COMMENT ON COLUMN mov_divida.data          IS 'Dia.';
COMMENT ON COLUMN mov_divida.delta         IS 'Valor.';
COMMENT ON COLUMN mov_divida.saldo_antes   IS 'Saldo antes.';
COMMENT ON COLUMN mov_divida.saldo_depois  IS 'Saldo depois.';
COMMENT ON COLUMN mov_divida.tipo          IS 'principal, juros, pagamento, ajuste.';
COMMENT ON COLUMN mov_divida.forma_id      IS 'Forma do pagamento.';
COMMENT ON COLUMN mov_divida.descricao     IS 'Descrição.';

COMMENT ON TABLE viagens IS 'Viagem de compra: viajantes, orçamento, carteira, gastos, compras ligadas, prestação de contas.';
COMMENT ON COLUMN viagens.codigo             IS 'VG-0001.';
COMMENT ON COLUMN viagens.nome               IS 'Nome.';
COMMENT ON COLUMN viagens.destino            IS 'Destino.';
COMMENT ON COLUMN viagens.na_bolivia         IS 'Destino veio da lista de cidades da Bolívia.';
COMMENT ON COLUMN viagens.inicio             IS 'Ida.';
COMMENT ON COLUMN viagens.fim                IS 'Volta.';
COMMENT ON COLUMN viagens.status             IS 'aberta ou encerrada.';
COMMENT ON COLUMN viagens.orcamento          IS 'Orçamento dos gastos operacionais.';
COMMENT ON COLUMN viagens.orcamento_compra   IS 'Capital de compra previsto.';
COMMENT ON COLUMN viagens.rateio             IS 'Rateio do gasto entre compras: grama ou valor.';
COMMENT ON COLUMN viagens.encerrada_em       IS 'Encerramento: instante.';
COMMENT ON COLUMN viagens.encerrada_data     IS 'Encerramento: dia.';
COMMENT ON COLUMN viagens.encerrada_por_nome IS 'Encerramento: quem.';
COMMENT ON COLUMN viagens.encerramento_obs   IS 'Encerramento: observação.';
COMMENT ON COLUMN viagens.obs                IS 'Observação.';

COMMENT ON TABLE viagem_viajantes IS 'Quem viajou (N:N viagem × pessoa).';
COMMENT ON COLUMN viagem_viajantes.viagem_id IS 'Viagem.';
COMMENT ON COLUMN viagem_viajantes.pessoa_id IS 'Viajante.';

COMMENT ON TABLE viagem_despesas IS 'Gastos operacionais da viagem (saem da carteira, não do caixa). Anular guarda quem/quando/motivo.';
COMMENT ON COLUMN viagem_despesas.viagem_id        IS 'Viagem.';
COMMENT ON COLUMN viagem_despesas.data             IS 'Dia do gasto.';
COMMENT ON COLUMN viagem_despesas.em               IS 'Instante do registro.';
COMMENT ON COLUMN viagem_despesas.categoria_id     IS 'Categoria (config categoriasViagem).';
COMMENT ON COLUMN viagem_despesas.moeda            IS 'Moeda.';
COMMENT ON COLUMN viagem_despesas.valor            IS 'Valor.';
COMMENT ON COLUMN viagem_despesas.valor_principal  IS 'Valor na moeda principal (cotação de compra).';
COMMENT ON COLUMN viagem_despesas.nota             IS 'Nota.';
COMMENT ON COLUMN viagem_despesas.por              IS 'Quem lançou (viajante só anula o que lançou).';
COMMENT ON COLUMN viagem_despesas.anulada_em       IS 'Anulação: quando.';
COMMENT ON COLUMN viagem_despesas.anulada_por_nome IS 'Anulação: quem.';
COMMENT ON COLUMN viagem_despesas.anulada_motivo   IS 'Anulação: motivo.';

COMMENT ON TABLE viagem_carteira IS 'Movimentos da carteira da viagem por moeda (+ entra, − sai).';
COMMENT ON COLUMN viagem_carteira.viagem_id    IS 'Viagem.';
COMMENT ON COLUMN viagem_carteira.tipo         IS 'adiantamento, devolucao, reembolso, diferenca.';
COMMENT ON COLUMN viagem_carteira.data         IS 'Dia.';
COMMENT ON COLUMN viagem_carteira.em           IS 'Instante.';
COMMENT ON COLUMN viagem_carteira.moeda        IS 'Moeda.';
COMMENT ON COLUMN viagem_carteira.delta        IS 'Valor.';
COMMENT ON COLUMN viagem_carteira.forma_id     IS 'Forma.';
COMMENT ON COLUMN viagem_carteira.mov_caixa_id IS 'Lançamento de caixa ligado.';
COMMENT ON COLUMN viagem_carteira.obs          IS 'Observação.';
COMMENT ON COLUMN viagem_carteira.anulada      IS 'Diferença anulada ao reabrir (nada é apagado).';

COMMENT ON TABLE viagem_incorporacoes IS 'Gasto da viagem somado ao custo dos lotes (reversível ao reabrir).';
COMMENT ON COLUMN viagem_incorporacoes.viagem_id       IS 'Viagem.';
COMMENT ON COLUMN viagem_incorporacoes.em              IS 'Quando.';
COMMENT ON COLUMN viagem_incorporacoes.total           IS 'Total incorporado.';
COMMENT ON COLUMN viagem_incorporacoes.desfeita_em     IS 'Desfeita (reabrir): quando.';
COMMENT ON COLUMN viagem_incorporacoes.desfeita_motivo IS 'Desfeita: motivo.';

COMMENT ON TABLE viagem_incorporacao_lotes IS 'Antes → depois do custo de cada lote na incorporação.';
COMMENT ON COLUMN viagem_incorporacao_lotes.incorporacao_id IS 'Incorporação.';
COMMENT ON COLUMN viagem_incorporacao_lotes.item_id         IS 'Lote.';
COMMENT ON COLUMN viagem_incorporacao_lotes.codigo          IS 'Código do lote na hora.';
COMMENT ON COLUMN viagem_incorporacao_lotes.gramas          IS 'Saldo do lote na hora.';
COMMENT ON COLUMN viagem_incorporacao_lotes.inicial         IS 'Quantidade inicial do lote.';
COMMENT ON COLUMN viagem_incorporacao_lotes.extra           IS 'Parte do gasto que coube ao lote.';
COMMENT ON COLUMN viagem_incorporacao_lotes.custo_antes     IS 'Custo antes.';
COMMENT ON COLUMN viagem_incorporacao_lotes.custo_depois    IS 'Custo depois.';

COMMENT ON TABLE financiamentos IS 'Adiantamento a parceiro (AD-0001): sai do caixa como empréstimo operacional; entregas de cabelo abatem a dívida.';
COMMENT ON COLUMN financiamentos.codigo             IS 'AD-0001.';
COMMENT ON COLUMN financiamentos.pessoa_id          IS 'Parceiro.';
COMMENT ON COLUMN financiamentos.data               IS 'Data do adiantamento (não futura).';
COMMENT ON COLUMN financiamentos.prazo              IS 'Data limite para entregar.';
COMMENT ON COLUMN financiamentos.moeda              IS 'Moeda.';
COMMENT ON COLUMN financiamentos.valor              IS 'Valor.';
COMMENT ON COLUMN financiamentos.valor_principal    IS 'Valor na moeda principal (cotação de compra).';
COMMENT ON COLUMN financiamentos.forma_id           IS 'Forma.';
COMMENT ON COLUMN financiamentos.viagem_id          IS 'Viagem ligada.';
COMMENT ON COLUMN financiamentos.abater_comissoes   IS 'Abater sozinho das próximas comissões pagas.';
COMMENT ON COLUMN financiamentos.obs                IS 'Observação.';
COMMENT ON COLUMN financiamentos.encerrado_em       IS 'Encerramento manual: quando.';
COMMENT ON COLUMN financiamentos.encerrado_data     IS 'Encerramento: dia.';
COMMENT ON COLUMN financiamentos.encerrado_por_nome IS 'Encerramento: quem.';
COMMENT ON COLUMN financiamentos.encerrado_motivo   IS 'Encerramento: motivo.';
COMMENT ON COLUMN financiamentos.encerrado_saldo    IS 'Saldo que virou baixa.';

COMMENT ON TABLE financiamento_eventos IS 'Acontecimentos do adiantamento (o efeito na dívida está em mov_conta).';
COMMENT ON COLUMN financiamento_eventos.financiamento_id      IS 'Adiantamento.';
COMMENT ON COLUMN financiamento_eventos.tipo                  IS 'entrega, recebimento, comissao, diferenca, baixa.';
COMMENT ON COLUMN financiamento_eventos.data                  IS 'Dia.';
COMMENT ON COLUMN financiamento_eventos.em                    IS 'Instante.';
COMMENT ON COLUMN financiamento_eventos.compra_id             IS 'Entrega: compra criada.';
COMMENT ON COLUMN financiamento_eventos.moeda                 IS 'Moeda.';
COMMENT ON COLUMN financiamento_eventos.valor                 IS 'Valor.';
COMMENT ON COLUMN financiamento_eventos.forma_id              IS 'Forma.';
COMMENT ON COLUMN financiamento_eventos.obs                   IS 'Observação.';
COMMENT ON COLUMN financiamento_eventos.pagamento_comissao_id IS 'Pagamento de comissão que reteve este valor.';

COMMENT ON TABLE eventos IS 'Compromissos/lembretes da agenda (não mexem em dinheiro nem estoque).';
COMMENT ON COLUMN eventos.titulo      IS 'O que é.';
COMMENT ON COLUMN eventos.data        IS 'Dia (local).';
COMMENT ON COLUMN eventos.hora        IS 'Hora local; NULL = dia todo.';
COMMENT ON COLUMN eventos.duracao_min IS 'Duração.';
COMMENT ON COLUMN eventos.nota        IS 'Nota.';
COMMENT ON COLUMN eventos.pessoa_id   IS 'Para quem é.';
COMMENT ON COLUMN eventos.local_id    IS 'Unidade.';
COMMENT ON COLUMN eventos.semanal     IS 'Repete toda semana.';
COMMENT ON COLUMN eventos.repetir_ate IS 'Repetir até.';

COMMENT ON TABLE evento_feitos IS 'Ocorrências marcadas como feitas (no semanal, cada semana à parte).';
COMMENT ON COLUMN evento_feitos.evento_id IS 'Evento.';
COMMENT ON COLUMN evento_feitos.data      IS 'Ocorrência.';
COMMENT ON COLUMN evento_feitos.feito_em  IS 'Quando marcou.';
COMMENT ON COLUMN evento_feitos.feito_por IS 'Quem marcou.';

COMMENT ON TABLE anexos IS 'Metadados de fotos/comprovantes. O arquivo vai para object storage (S3/compatível).';
COMMENT ON COLUMN anexos.dono_id       IS 'Dono (polimórfico, SEM FK: a foto pode subir antes de a compra existir).';
COMMENT ON COLUMN anexos.dono_tipo     IS 'Tipo do dono (preenchido pelo servidor).';
COMMENT ON COLUMN anexos.categoria     IS 'pedido, produto, comprovante, origem, resultado, outro.';
COMMENT ON COLUMN anexos.nome          IS 'Nome do arquivo.';
COMMENT ON COLUMN anexos.mime          IS 'Tipo MIME (validado no servidor).';
COMMENT ON COLUMN anexos.tamanho       IS 'Bytes (limite 50 MB).';
COMMENT ON COLUMN anexos.storage_chave IS 'Chave do objeto no storage.';
COMMENT ON COLUMN anexos.sha256        IS 'Hash do conteúdo (deduplicação/integridade).';
COMMENT ON COLUMN anexos.miniatura     IS 'Miniatura ~240 px (≤ 64 KB) para listas (hoje data URL no registro).';

-- QR da etiqueta (12A)
COMMENT ON TABLE item_qr_anteriores IS 'Códigos de QR que já foram de um pacote e foram trocados (reimpressão ou lote revogado). Ler um deles = "etiqueta antiga": não abre nada.';
COMMENT ON COLUMN item_qr_anteriores.codigo       IS 'O código antigo (PK: nunca volta a ser usado).';
COMMENT ON COLUMN item_qr_anteriores.item_id      IS 'Pacote de que era (só o admin vê na auditoria).';
COMMENT ON COLUMN item_qr_anteriores.via          IS 'Via da etiqueta que tinha este código.';
COMMENT ON COLUMN item_qr_anteriores.revogado_em  IS 'Quando deixou de valer.';
COMMENT ON COLUMN item_qr_anteriores.revogado_por IS 'Quem trocou.';
COMMENT ON COLUMN item_qr_anteriores.motivo       IS 'reimpressao (nova via), lote_revogado (ex.: lote extraviado, §12 Q4) ou outro.';
COMMENT ON TABLE qr_leituras IS 'Cada leitura do QR em GET /v1/qr/{codigo}: base do limite de tentativas e do alerta de quem tenta adivinhar (§12 Q5). Retenção sugerida: 90 dias.';
COMMENT ON COLUMN qr_leituras.lido_em     IS 'Quando leu.';
COMMENT ON COLUMN qr_leituras.empresa_id  IS 'Empresa do pacote, quando o código existe (NULL em código inválido).';
COMMENT ON COLUMN qr_leituras.codigo_lido IS 'O que veio no endereço (cortado em 64 caracteres).';
COMMENT ON COLUMN qr_leituras.resultado   IS 'aberto, sem_login (página neutra), antigo (item_qr_anteriores), invalido, limite (bloqueado pelo rate limit), sem_permissao.';
COMMENT ON COLUMN qr_leituras.item_id     IS 'Pacote aberto/apontado (NULL em inválido).';
COMMENT ON COLUMN qr_leituras.usuario_id  IS 'Quem leu, se tinha login.';
COMMENT ON COLUMN qr_leituras.ip          IS 'IP de origem (rate limit por IP).';
COMMENT ON COLUMN qr_leituras.user_agent  IS 'Navegador/aparelho (cortado em 300).';
COMMENT ON CONSTRAINT ck_qr_leituras_aberto    ON qr_leituras IS 'Só abre com login e pacote conhecido.';
COMMENT ON CONSTRAINT ck_qr_leituras_sem_login ON qr_leituras IS 'sem_login não tem usuário.';

-- Imposto de Renda (12B)
COMMENT ON TABLE ir_exercicios IS 'Exercício fiscal (gestión) por ano: situação do trabalho de fechamento e o fechamento congelado (números + versão das regras). App: config irExercicios.';
COMMENT ON COLUMN ir_exercicios.ano           IS 'Ano do exercício (o do cierre).';
COMMENT ON COLUMN ir_exercicios.situacao      IS 'aberto, preparacao, pendencias, validacao, revisado, fechado.';
COMMENT ON COLUMN ir_exercicios.inicio        IS 'Primeiro dia do exercício.';
COMMENT ON COLUMN ir_exercicios.cierre        IS 'Último dia (cierre de gestión pelo tipo de atividade, DS 24051 art. 39).';
COMMENT ON COLUMN ir_exercicios.fechado_em    IS 'Último fechamento. Fica mesmo depois de reabrir.';
COMMENT ON COLUMN ir_exercicios.fechado_por   IS 'Quem fechou por último.';
COMMENT ON COLUMN ir_exercicios.versao_regras IS 'Versão das regras fiscais usadas no fechamento (tributosBO.ts).';
COMMENT ON COLUMN ir_exercicios.resumo        IS 'Números congelados no fechamento: receita, lucroContabil, lucroTributavel, iue, impostosApurados, impostosPagos (centavos).';
COMMENT ON CONSTRAINT ck_ir_exercicios_fechado  ON ir_exercicios IS 'Fechado tem data de fechamento.';
COMMENT ON CONSTRAINT ck_ir_exercicios_congelou ON ir_exercicios IS 'Fechamento sempre com quem, versão das regras e números.';
COMMENT ON CONSTRAINT ck_ir_exercicios_depois   ON ir_exercicios IS 'Só fecha depois do cierre (fuso de La Paz).';
COMMENT ON TABLE ir_exercicio_eventos IS 'Histórico de situação do exercício (append-only).';
COMMENT ON COLUMN ir_exercicio_eventos.ano    IS 'Exercício (FK composta com empresa_id).';
COMMENT ON COLUMN ir_exercicio_eventos.de     IS 'Situação antes.';
COMMENT ON COLUMN ir_exercicio_eventos.para   IS 'Situação depois.';
COMMENT ON COLUMN ir_exercicio_eventos.motivo IS 'Obrigatório para reabrir um exercício fechado.';
COMMENT ON CONSTRAINT ck_ir_ex_eventos_reabrir ON ir_exercicio_eventos IS 'Reabrir fechado exige motivo.';
COMMENT ON TABLE ir_obrigacoes IS 'Declarações/pagamentos feitos no SIAT, registrados pela pessoa (o sistema não declara). Base do "pago × apurado" e dos meses pendentes. App: config irObrigacoes.';
COMMENT ON COLUMN ir_obrigacoes.ano             IS 'Exercício a que pertence.';
COMMENT ON COLUMN ir_obrigacoes.periodo         IS '"AAAA-MM" nas mensais (IVA, IT, retenções, RC-IVA, RCV) ou "AAAA" nas anuais (IUE, EEFF).';
COMMENT ON COLUMN ir_obrigacoes.obrigacao       IS 'iva, it, iue, retIue, retIt, rcIva, rcv, eeff (tributosBO.ts).';
COMMENT ON COLUMN ir_obrigacoes.formulario      IS 'Formulário usado (F-200, F-400, F-500, F-570, F-410, F-608…).';
COMMENT ON COLUMN ir_obrigacoes.numero_orden    IS 'Número de orden do SIAT.';
COMMENT ON COLUMN ir_obrigacoes.declarado_em    IS 'Data da declaração.';
COMMENT ON COLUMN ir_obrigacoes.valor_declarado IS 'Valor declarado (centavos, moeda principal BOB).';
COMMENT ON COLUMN ir_obrigacoes.pago_em         IS 'Data do pagamento.';
COMMENT ON COLUMN ir_obrigacoes.valor_pago      IS 'Valor pago (centavos, moeda principal BOB).';
COMMENT ON COLUMN ir_obrigacoes.obs             IS 'Observação.';
COMMENT ON COLUMN ir_obrigacoes.apagado_motivo  IS 'Motivo de remover o registro (removerObrigacaoFiscal exige).';
COMMENT ON CONSTRAINT ck_ir_obrigacoes_periodo ON ir_obrigacoes IS 'Mensal = AAAA-MM; anual (IUE, EEFF) = o ano.';
COMMENT ON CONSTRAINT ck_ir_obrigacoes_algo    ON ir_obrigacoes IS 'Precisa da data da declaração ou do pagamento.';

-- Metas (12C)
COMMENT ON TABLE metas IS 'Metas do mês (Configurações › Metas): valem todo mês enquanto ativas; o realizado é calculado das vendas do mês.';
COMMENT ON COLUMN metas.nome      IS 'Nome opcional (ex.: "Meta da Sofia").';
COMMENT ON COLUMN metas.alvo      IS 'empresa, unidade (local_id) ou pessoa (pessoa_id).';
COMMENT ON COLUMN metas.local_id  IS 'Unidade, quando alvo = unidade.';
COMMENT ON COLUMN metas.pessoa_id IS 'Pessoa (profissional/vendedora), quando alvo = pessoa. A funcionária vê só as dela e as da unidade dela, se o admin ligar.';
COMMENT ON COLUMN metas.indicador IS 'faturamento (centavos na moeda principal), vendas ou atendimentos (quantidade).';
COMMENT ON COLUMN metas.valor     IS 'Alvo do mês, na unidade do indicador.';
COMMENT ON COLUMN metas.ativa     IS 'Desligada não aparece no Painel nem em Vender.';
COMMENT ON CONSTRAINT ck_metas_alvo_id ON metas IS 'O alvo e o id certo: empresa sem id; unidade com local; pessoa com pessoa.';
```
