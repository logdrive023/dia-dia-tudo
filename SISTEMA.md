# Tudo · ecossistema de gerenciamento

> Cabelo (compra, separação, estoque em gramas, venda pela tabela), salão (agenda, equipe, unidades), empréstimos,
> produtos e **qualquer modalidade nova montada pela tela**. Funciona sem internet; hoje os dados ficam no aparelho
> (demonstração) e o sistema está pronto para virar API trocando uma configuração.

Publicação: `https://logdrive023.github.io/dia-dia-tudo/` (após o primeiro push na `main`, ver §9).

---

## 1. Como usar (o dia a dia)

| Quero… | Onde |
|---|---|
| Ver tudo do negócio, tocar num número e ver de onde vem | **Painel** (visão geral → por área → ficha) |
| Vender cabelo pela tabela (`40 \| 2.000 × 3,5 = Bs 7.000`) | **Vender › É cabelo?** |
| Atender/agendar no salão (unidade, cliente, serviço, quem atende) | **Vender › É serviço?** ou **Agenda** |
| Registrar um pedido de compra com fotos/PDF e andar a triagem | **Comprar** |
| Separar um lote bruto (40 kg → 20 kg preto + 19,5 kg castanho) | **Estoque › Separar** |
| Saber de onde veio e para onde foi cada grama | **Estoque › lote › Rastrear** ou **Comprar › compra › Rastrear** |
| Quem me deve / a quem devo, adiantamento, "falta" | **Pessoas e contas** |
| Caixa do dia por moeda, na mão × banco, encerrar com WhatsApp | **Caixa** |
| Organograma por salão, resumo da funcionária, pagar salário | **Equipe e unidades** |
| Entradas × saídas de cada salão ("ponta do lápis") | **Equipe e unidades › Entradas × saídas** |
| Resultado, divisão entre sócias, livro caixa, inventário, balanço, log | **Relatórios** (CSV e Imprimir/PDF) |
| Editar tabela de preço (grade medida × comprador) | **Tabelas de preço** |
| Idioma PT/ES, moedas e câmbio, sócias, módulos, criar modalidade, backup | **Configurações** |
| Trocar quem está usando (admin × funcionária) | rodapé do menu / "trocar" |

**Primeiro uso**: o app já monta sozinho 45 dias de operação **fictícia** (inspirada no caderno real) pelas mesmas regras das
telas — todas as contas batem (Configurações › Dados › Conferência das contas) — e abre a tela de **entrar**.

| Usuário (senha `1234`) | Perfil | Para testar |
|---|---|---|
| `admin` | Administrador | **vê tudo** |
| `bianca` | Administrador (diretora) | tudo, no nome dela |
| `paula`, `renata` | Funcionária (gerentes) | unidade dela |
| `sofia`, `lia`, `nina`, `clara`, `julia` | Funcionária | só a própria agenda, vender/atender, comissões dela |

**Menu**: agrupado (Hoje · Operação · Pessoas · Gestão) e **dinâmico**: cada item diz direto o que importa agora
(vendido hoje, "2 hoje" na agenda, "2 na triagem", "me devem Bs 20.323", parcelas atrasadas, lotes para separar).
Toque no **i** de qualquer item ou número: explicação + **quadro de exemplo**, em português e espanhol.

---

### Telas com endereço próprio (dá para copiar, abrir de novo e usar o "voltar")
| Endereço | Tela |
|---|---|
| `#/pedidos` | pedidos de compra em **tabela** (busca, ordenar por data/total/parada, situação e "o que falta") |
| `#/pedidos/novo` | **nova compra** (formulário em 3 passos + resumo ao lado: total, peso, custo/kg, conta do fornecedor) |
| `#/pedidos/:id` | **o pedido**: etapas, o que falta, itens, andar a triagem, pagamento, conta do fornecedor, lotes gerados, arquivos, linha do tempo, repetir |
| `#/precos` · `#/precos/:id` | tabelas de preço e a tela de cada uma: Tabela · Editar · **Versões** · **Comparar** |
| `#/separar?id=…` | separar um lote em vários |
| `#/emprestimos/novo` | novo empréstimo com prévia das parcelas |
| `#/vendas/:id` · `#/pessoas/:id` · `#/lotes/:id` · `#/emprestimos/:id` | detalhe de cada registro |

### O que falta (pendências)
- **Venda**: falta receber (fiado; some quando a pessoa acerta a conta) · pagamento por QR/transferência sem comprovante.
- **Compra**: sem fotos · sem comprovante de origem · falta pagar (considera os acertos com o fornecedor) · parada na triagem.
- As listas mostram **✓ Completa** ou o que falta, com filtro "Com pendência" e por tipo.
- **Atenção agora** (Painel): urgente → atenção → acompanhar; cada alerta abre e mostra os registros, e cada um leva
  **direto ao pedido/venda/empréstimo**; "Ver todos" abre a lista já filtrada.

### Painel
- Filtros em **chips** (período, moeda, unidade) com resumo do que está ativo e "limpar"; comparar em interruptor.
- Seções que **abrem e fecham** (lembradas): Atenção agora · Vendas · Dinheiro · Evolução · De onde vem o dinheiro · áreas.
- Comparação explícita ("vs período anterior"); sem porcentagem absurda quando não há base.
- Menu: ícones por grupo, **grupos que abrem e fecham**, trilho de ícones e **esconder a barra** inteira.

### Tabela de preço com versões
- Toda alteração **publica uma versão nova** (v1, v2…), com data, quem fez e nota ("o que mudou e por quê").
  Salvar sem mudar nada é recusado.
- **Comparar** quaisquer duas versões: grade com "era" riscado e "ficou" embaixo (verde subiu, vermelho desceu), resumo
  (mudaram, subiram, desceram, novos, removidos, medidas e compradores novos) e lista com a % de cada mudança.
- A tela mostra onde a tabela foi usada; cada venda/compra guarda o fator que usou (o passado não muda).

## 2. Regras de negócio

### 2.1 Dinheiro e moedas
- Sempre **inteiro na menor unidade** (centavos; guarani sem centavos). Digitação aceita `1.474,80`, `70`, `70,5`, `71.000`.
- Moedas: **BOB** (principal da demonstração), BRL, PYG, USD. Cotações digitadas como `1 USD = 5,40 BRL` ou `1 BRL = 1.450 PYG`;
  conversão exata (racionais em BigInt, um arredondamento). **Cada lançamento guarda a cotação usada**: o passado não muda.
- **Câmbio por moeda, dinâmico ou fixo, com taxa de VENDA e de COMPRA** (Configurações › Moedas e câmbio):
  - **Dinâmico** = cotação da internet (open.er-api.com, grátis) ± ajuste em % para venda e para compra.
    Ex.: base 1 USD = 6,96 Bs; venda −1% = 6,89 (recebo dólar valendo um pouco menos); compra +1% = 7,03.
  - **Fixo** = você digita contra a moeda principal: "para vender 1 USD = 6,90 Bs; para comprar 1 USD = 7,00 Bs".
    A internet não muda nada.
  - **Venda** é usada quando entra dinheiro em outra moeda (vendas, atendimentos, recebimentos); **compra** quando sai
    (compras, pagamento a fornecedor). Relatórios e "caixa agora" usam a **base**.
- **Base local**: toda busca na internet é **guardada no aparelho** (histórico com data e origem) — de todas as moedas,
  mesmo as desligadas. Sem internet, vale a última base guardada; a tela mostra quando foi a última busca boa.
  Quando buscar: **uma vez no começo do dia** (todas as vendas do dia usam a mesma) ou **na hora de usar** (a cada hora).
- A cotação usada fica gravada em cada venda/compra: mudar o câmbio depois não muda o passado.
- Formas: Dinheiro/efectivo (conta como "na mão"), QR (BOB/PYG), Pix/crédito/débito (BRL), transferência.

### 2.2 Tabela de preço (multiplicador)
- Grade **medida (cm) × coluna** (comprador ou fornecedor: Henry, P.W., Cirila…) → **fator por grama**.
  **Valor = gramas × fator**: `2.008 × 17,5 = Bs 35.140` (exato, sem arredondar por grama).
- Medida intermediária usa a linha de baixo (65 cm → linha 60). Célula vazia: digita-se o fator na hora.
- Tabela por **categoria** (Normal, Tinte, CH, CH+, Rojo, Quemado, Menudo, Entresaque) e **vale desde** (as tabelas mudam).
  Editar guarda a versão anterior; **Duplicar** cria a próxima versão sem redigitar. Coluna pode ser **ligada a uma pessoa**
  (ao escolher a pessoa, a coluna vem sozinha).
- A mesma tabela serve para **comprar** (coluna do fornecedor) e **vender** (coluna do comprador).

### 2.3 Compra, triagem e estoque
- Pedido de compra com **fotos, PDF e qualquer arquivo** (pedido, produto, comprovante, comprovante de origem).
- Etapas (cabelo): **Chegou → Conferido** (ajuste de peso/valor com motivo) → **Pago** (pode ser parte: o resto fica na conta do
  fornecedor) → **No estoque** (vira lote com código `L-0001`). Recusar/cancelar devolvem o dinheiro; nada é apagado.
- Cada módulo define as próprias etapas. Aviso de compra parada e de compra sem comprovante de origem.
- **Separação**: um lote vira N lotes; a diferença é **perda**. O custo é dividido **pelo valor de mercado** (gramas × fator de
  referência da tabela) — cabelo longo leva mais custo. Dividir por peso faria o curto parecer prejuízo e o longo lucro demais.
- Estoque = soma dos movimentos (conferido pelo diagnóstico). Ajuste e perda com motivo.

### 2.4 Venda
- Linhas de cabelo escolhem sozinhas o **lote mais antigo** daquela medida/categoria (dá para escolher) e **dividem entre lotes**
  quando um só não basta. Custo da linha = custo proporcional do lote → lucro real por venda.
- Pagamento em várias formas e moedas. **Com cliente identificada pode pagar em partes** (fiado) ou a mais (crédito): vai para a
  conta corrente. Sem cliente, o pagamento precisa fechar com o total.
- Atendimento do salão: unidade, cliente, serviços, quem atende (comissão), **agora ou agendado**; pode usar cabelo do estoque.
- Recibo no WhatsApp. Cancelar devolve estoque, estorna cada pagamento e a conta.

### 2.4.1 Corrigir uma venda (a qualquer momento, quantas vezes precisar)
- Venda › **Corrigir**: muda gramas/quantidade, fator ou valor de cada linha. O estoque acerta a diferença, o custo do lote e a
  comissão são recalculados.
- A diferença de dinheiro vai **para a conta da cliente** (passa a dever ou fica com crédito) ou **para o caixa agora**
  (recebi/devolvi, na forma e moeda escolhidas).
- **Nada é apagado**: cada correção fica no histórico com antes → depois, quem corrigiu, quando e o motivo
  (quadro "Correções" e linha do tempo).

### 2.4.2 Comissões: histórico do ganho × pagamento lançado
- **Ganho (histórico)**: nasce em cada venda/atendimento (valor da linha × % da profissional) e muda junto se a venda for
  corrigida ou cancelada. Já entra como custo no lucro da venda.
- **Pago (lançamento)**: Equipe › Comissões › **Pagar** (tudo ou parte) sai do caixa como categoria "Comissões".
- **A pagar = ganho − pago**. No resultado (DRE) o pagamento **não** vira despesa de novo (seria contar duas vezes).
- Extrato por profissional: cada ganho (venda, cliente, base × %) e cada pagamento, com filtro de período.

### 2.4.3 Agenda: horário ocupado
- Ao agendar, se a mesma profissional já tem atendimento que se sobrepõe (duração = soma dos serviços; sem duração, 60 min),
  aparece o aviso **"Horário ocupado: Ana Paula 14:00–15:30"**. Dá para **agendar mesmo assim** (fica marcado ⚠️ na agenda).

### 2.5 Conta corrente (o "caderno de quem deve")
- `+` = a pessoa me deve; `−` = eu devo a ela. Entram: vendas, compras, pagamentos na hora, **acertos** (recebi/paguei),
  **adiantamentos** (antes da mercadoria) e ajustes com motivo. Extrato com saldo linha a linha e botão **Cobrar** (WhatsApp).

### 2.6 Salão, equipe e unidades
- Funcionária: cargo, unidade, **a quem responde** (organograma; ciclo é recusado), **salário por mês, semana ou dia**, comissão,
  acesso (admin/funcionária).
- **Pagar salário** sugere o **último pagamento** (ou o do cadastro): repetir é um toque.
- Unidade na ponta do lápis: **entradas** (atendimentos) − salários (estimados e proporcionais aos dias) − comissões − cabelo
  usado − despesas da unidade = **margem**; mostra também os salários realmente pagos.
- Manutenção (ex.: mega hair a cada 45/60 dias): o painel avisa quem passou do prazo.

### 2.7 Empréstimos
- Dado ou tomado; juros nenhum/simples/composto (Price)/valor fixo; parcelas; pagamento parcial abate das mais antigas;
  situação em dia/vencendo/atrasada/quitado; atraso por faixa; cobrança no WhatsApp. Só registra o combinado.

### 2.8 Sócias e resultado
- Resultado (DRE): receita − custo do vendido − comissões = lucro bruto; − despesas = resultado.
- **Divisão entre sócias** (o "÷ 2" do caderno): resultado × parte − retiradas da sócia = quanto falta acertar.

### 2.9 Usuários, log e linha do tempo
- **Toda ação registra quem fez** (usuário da sessão) e quando. **Linha do tempo** de pedido/lote/pessoa/empréstimo:
  "pedido entrou dia X com Y, Z · Mariana conferiu · pagou · entrou no estoque · vendido para Henry (por Vero)".
- **Relatórios › Log**: filtra por usuário, ação e período ("o que a funcionária 1 fez do dia X ao Y"). Vendas também filtram
  por quem fez.
- **Login**: usuário + senha. A senha é guardada só como hash (PBKDF2 + sal), calculado fora da transação do banco, e
  **nunca** vai para o log nem para a fila de saída. Configurações › **Usuários**: criar, perfil, ligar à funcionária e à
  unidade, ativar/desativar (sempre fica pelo menos um admin), trocar a própria senha.
- **Permissões** (`src/core/services/permissoes.ts`): o backend confere antes de executar. Administrador: tudo. Funcionária:
  vender/atender, clientes, anexos, a própria agenda, unidade e comissões. Sem entrar, nada (só a lista de usuários de teste).
- **Pronto para a API**: `POST /v1/auth/entrar` devolve `{ token, sessao }`; o adaptador manda `Authorization: Bearer` em todo
  pedido e o servidor aplica a mesma lista de permissões (`src/adapters/api/backendApi.ts`).

---

## 3. Modularidade (plug-and-play)
- **Módulo = descrição** (`src/core/modulos.ts`): tipos de item e campos, etapas da triagem, pergunta do assistente de venda,
  recursos (estoque, tabela de preço, agenda), seções do painel e alertas. O núcleo não sabe o que é cabelo ou salão.
- Módulos de código: `src/modules/` (cabelo, salão, empréstimos, produtos). **Produtos é só configuração** (prova do genérico).
- **Modalidade pela tela** (Configurações › Módulos › Criar nova modalidade): escolhe estoque (peças/gramas), etapas da triagem,
  lote por compra (rastreio), **preço por tabela medida × comprador** (do cabelo), **atendimento com agenda** (do salão) e campos
  próprios. Menus, assistente de venda, painel e relatórios se ajustam sozinhos (teste `modalidade criada pela tela`).
- Ligar/desligar módulos: Configurações › Módulos.

---

## 4. Arquitetura (local hoje, API amanhã)

```
telas (screens/, ui/) ──► porta Backend (comando / consulta / anexar)
                              │
           ┌──────────────────┼────────────────────┐
   adapters/noAparelho.ts                 adapters/api/backendApi.ts
   (fila → transação → outbox → aviso)    (POST /v1/comandos/{nome}, GET /v1/consultas/{nome})
      │                │
 adapters/memory   adapters/local (IndexedDB/Dexie — ÚNICO lugar que conhece o banco)
                              │
                core/services (regras, só usam portas) ◄── core/modulos + src/modules
```

- **Comandos e consultas** (`src/core/services/index.ts`) são o contrato das telas e da futura API (`api-contract/openapi.yaml`).
- Registros com `id` ULID gerado no aparelho, `empresaId`, `criadoEm/atualizadoEm` (UTC), `versao`, `apagadoEm`, `criadoPor`.
- Todo comando grava na **fila de saída (outbox)** — base da sincronização futura. Chave de idempotência = id da operação.
- **Trocar para a API**: `VITE_STORAGE=api` e `VITE_API_URL=https://…` (ver `.env.example`). Telas e regras não mudam.
  A mesma suíte de contrato roda em memória, IndexedDB e **API simulada** (`src/adapters/api/apiSimulada.ts`).
- Migrar a demonstração: Configurações › Dados › Baixar backup → `POST /v1/backup` no servidor.

### Pastas
```
src/core/domain      dinheiro (moedas, conversão, fator), datas, ids (ULID), tipos, erros
src/core/ports       portas (repos, arquivos, sessão, relógio, Backend)
src/core/services    caixa, estoque (separação, rastreio), compras, vendas, contas, precos, emprestimos,
                     equipe, cadastros, painel (+diagnóstico), relatorios, historico (log/linha do tempo)
src/core/modulos*.ts contrato dos módulos e modalidades montadas pela tela
src/modules          cabelo, salão, empréstimos, produtos (+ registro)
src/adapters         memory, local (Dexie), api (+ simulada), noAparelho
src/app              criarBackend (escolhe o armazenamento), câmbio automático, dados de exemplo
src/ui               peças de tela, gráficos SVG, contexto, idioma (i18n.ts + es.ts), Shell
src/screens          uma tela por área
```

---

## 5. Idioma e aparência
- **Português ⇄ Español** em Configurações › Geral. O texto em português é a chave; o espanhol está em `src/ui/es.ts`
  (falta tradução → aparece em português). Novo idioma = novo dicionário.
- Cores básicas com função (marca, bom, alerta, ruim) em variáveis CSS; tema escuro automático.
- Mobile first (320 px, barra inferior + "Mais"), desktop com menu lateral e tabelas; botão 💱 de conversão sempre à mão.

---

## 6. Testes
```bash
npm test          # 29 testes: regras, contrato (memória × IndexedDB × API simulada), dados de exemplo, telas
npm run build     # tipos + build de produção (PWA)
npm run dev       # http://localhost:5173
```
- **Regras**: dinheiro/fator/conversão; compra bruta → triagem → separação → vendas parciais → rastreio; fiado; toque duplo;
  estoque insuficiente; tabela (célula, linha de baixo, versões); salário mês/semana/dia; organograma sem ciclo;
  modalidade criada pela tela; rateio por valor; log por usuário.
- **Clicar = somar**: a lista do detalhe soma o número do cartão (geral, cabelo e salão).
- **Telas**: todas as telas do menu abrem com os dados de exemplo; venda `60 | 2.008 × 17,5 = Bs 35.140` pela tela;
  funcionária só vê a agenda dela; troca para espanhol.
- **Correção de venda** (estoque, conta, caixa, histórico, corrigir duas vezes), **comissões** (a pagar = ganho − pago,
  sem contar duas vezes no DRE), **horário ocupado** (sobreposição e "agendar mesmo assim"), **login e permissões**
  (senha errada, funcionária sem acesso a caixa/relatórios, nada sem entrar).
- **Fronteira**: nenhum arquivo fora de `adapters/local` importa o Dexie; o núcleo não importa telas nem adaptadores.

---

## 7. Gaps encontrados nos pedidos (e o que foi feito)

Lendo os pedidos e o caderno real (PDF de contas), apareceram coisas que nenhum pedido citava e que o negócio usa todo dia:

| Gap | O caderno mostra | Feito |
|---|---|---|
| Quem deve / a quem devo | "Adelanto 13.000 − 7.588", "19.420 Falta", listas China/Mariana/Rosa com ✓ | **Conta corrente** por pessoa, fiado, adiantamento, acerto, cobrança |
| Divisão do lucro | "4.517 ÷ 2 = 2.258 + 3.703" | **Sócias** com parte e retiradas; relatório de divisão |
| Compra e venda do mesmo pedido | Cirila: vermelho (compra) × verde (venda) = 1.326 de margem | Mesma tabela para comprar e vender; custo do lote → lucro por venda |
| Tabelas mudam toda semana | ~20 tabelas desenhadas de novo, valores mudando (3,5 → 3,7) | Versões, "vale desde", duplicar, histórico |
| Categorias com preço próprio | T (Tinte), CH, CH+, Rojo, Quemado, Menudo, Entresaque | Categoria no lote e tabela por categoria |
| Faixas de medida | "50-55", "38-40", "79-80", "58-60" | Medida intermediária usa a linha de baixo; fator editável |
| Pagamento QR / efectivo / dólar | "50.000 qr", "44.000 Efect", "$ 620", "Bs 36" | Formas QR/efectivo; vários pagamentos e moedas numa venda |
| Custo de lote separado | Lotes por medida com preços muito diferentes | **Rateio do custo por valor de mercado** |
| Preço fechado sem fator | "155 × ? = 1.300" | Fator vazio → digita na hora |
| Gramas e quilos misturados | "2 kg → 7.000", "2008 × 17,5", "21,495 Kg" | Campo g/kg |
| Quem fez cada coisa | — | Usuário em toda ação, log filtrável, linha do tempo |
| Salário variável | — | Mês/semana/dia + repetir último pagamento |
| Contas sempre batendo | — | Diagnóstico (estoque, caixa, dívida, vendas, conta corrente) na tela e nos testes |

### Feito depois da primeira rodada
- **Corrigir venda** a qualquer momento, com histórico; **comissões** (ganho + pagamento); **horário ocupado**;
  **login e usuários** com perfis; **menu dinâmico**; **tooltips com exemplo** (pt/es); dados de exemplo **fictícios** e
  pré-carregados.

### Ainda não feito (decisões / próximos passos)
- **Segurança no servidor**: hoje o login protege o uso no aparelho; quem tem acesso ao navegador ainda acha os dados.
  A proteção completa vem com a API (o contrato e o adaptador já estão prontos).
- **Sincronizar aparelhos**: a fila de saída já existe; falta o servidor/sincronizador.
- **Devolução parcial** de produto (hoje: corrigir a quantidade ou cancelar).
- **Etiqueta do lote** (o código `L-0001` existe; falta imprimir etiqueta/QR).
- **Fiscal/legal**: só registra comprovante de origem; nota fiscal e impostos fora do escopo.
- Testes "macaco" e backtest de longa duração (como no Dia a Dia) para o novo núcleo.

---

## 8. Como criar um módulo em código
1. `src/modules/meu.ts` exportando um `ModuloDef` (veja `produtos.ts`, que é só configuração).
2. Uma linha em `src/modules/index.ts`.
3. Se precisar de regra nova, um serviço em `src/core/services/` + entrada em `index.ts` (comando/consulta) + teste.
4. Painel: devolva `Secao[]` em `painel(dados)` — cartões, barras, tabela, mapa ou funil (desenhados por `ui/graficos.tsx`).

## 9. Publicação (deploy automático)
- `.github/workflows/deploy.yml`: a cada push na `main` → `npm ci` → **testes** (se falhar, não publica) → build → GitHub Pages.
  Pull request roda só os testes e o build.
- Uma vez só no GitHub: **Settings › Pages › Source: GitHub Actions**.
```bash
git add -A
git commit -m "o que mudou"
git push
```
