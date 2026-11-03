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
| Triar: juntar lotes/compras e separar (40 kg → 20 kg preto + 19,5 kg castanho), ver o que está pronto para vender | **Triagem** (quadro com colunas personalizáveis) |
| Imprimir/reimprimir etiquetas, ver quais pacotes ainda não têm (filtro "Sem etiqueta", compra, medida, entrada) | **Etiquetas** (menu; também no pacote "🏷 Etiqueta", no ⋯ de cada lote, na compra, na Triagem e depois de separar) |
| Ver cada grama: compra → triagem (T-…) → lote → venda | **Rastreio total** no lote, na compra, na venda e na triagem |
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
| `#/triagem` (`?aba=triagens&t=…`) | quadro da triagem e a lista de triagens feitas (T-0001…) |
| `#/separar?id=…` · `#/separar?ids=a,b` | separar um lote, ou juntar vários e separar (uma triagem com número) |
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
- **Etapas personalizáveis** (Configurações › Etapas da compra, ou ⚙ no pedido): nome, ordem, explicação, quantas etapas
  (2 a 10), **onde se cobra o pagamento**, o que lembrar em cada uma (fotos, comprovante) e **o que conta como "falta"**
  (sem fotos, sem comprovante de origem, parada há N dias). A última é sempre "entra no estoque". Não dá para tirar uma etapa
  onde ainda há pedido parado. "Voltar ao padrão" devolve as do sistema.
- **Nova compra = formulário simples** (uma página): fornecedor (busca, recentes, "+ Novo"), o que veio (conta ao vivo
  "60 | 2.008 × 17,5 = Bs 35.140") e o total; código, quem comprou, estado na chegada, fotos e observação ficam a um toque
  ("+ …"). O botão diz o que falta. **Configurável** em Configurações › Cabelo e estoque › Formulário de compra: campos,
  ordem, aberto/fechado, obrigatório, valores que já vêm, medidas favoritas, "uma página" ou "passo a passo".
  Cada compra pode escolher o tipo de código (Incremental · Por pessoa · Manual).
- **Atributos dinâmicos** (Configurações › Atributos): criar atributo (texto, número, lista, sim/não; obrigatório ou não),
  esconder o que não usa e mudar as opções das listas (ex.: nova cor). Medida, categoria e situação são fixos (o nome, o
  preço e a separação dependem deles). Aparecem na compra, no lote e nos filtros sem mexer em código.
- **Triagem (o passo mais importante: daqui saem as vendas)**: tela própria (#/triagem). Todo lote bruto que entra pela
  compra cai na coluna de **entrada**. As **colunas são do negócio** (Configurações › Etapas da triagem: nome, ordem, cor,
  explicação, "entrada", "pronto para venda", "separar ao entrar", "lembrar fotos"; "Vendido" é sempre a última e é
  calculada; não dá para tirar coluna com lote). Arrastar o cartão muda de coluna (ou "⋯ › Mover para…"); entrar numa
  coluna "pronto para venda" marca o lote como Separado. Cada **triagem** (juntar e/ou separar, num passo só) ganha um
  número **T-0001** com quem, quando, peso bruto → líquido e perda; uma compra pode ir para várias triagens e uma triagem
  pode misturar várias compras. A tela tem duas seções numeradas: **① Para separar** (uma linha por pacote, botão
  principal) e **② Prontos para vender**, uma **tabela por grupo** (Medida | Lotes | Peso | Valor | ⋯, com Total) em que
  cada linha abre os lotes com a origem, o preço pela tabela, a margem e Vender.
  **Triagens feitas**: números do que está filtrado (triagens, entrou, saiu, perda %), filtros no endereço (período, busca,
  quem, compra, perda acima de X%, ordenar) e uma linha por triagem que abre no lugar (compras → pacotes → vendas, rastreio).
- **Rastreio total** (`genealogia`): a partir de qualquer compra, lote, triagem ou venda mostra o grafo inteiro
  (compras → triagens → lotes → vendas) com as gramas de cada ligação e a conta "entrou = vendido + estoque + perda" ✓.
  A barra **Caminho** ("você está aqui") e o menu **⋯** levam a compra, fornecedor, lote de origem, rastreio e venda.
- **Separação**: um lote vira N lotes; a diferença é **perda**. O custo é dividido **pelo valor de mercado** (gramas × fator de
  referência da tabela) — cabelo longo leva mais custo. Dividir por peso faria o curto parecer prejuízo e o longo lucro demais.
- Estoque = soma dos movimentos (conferido pelo diagnóstico). Ajuste e perda com motivo.
- **Lista do estoque**: situação colorida (Disponível, Bruto, Parcial, Esgotado), filtros por situação, faixa de medida,
  qualquer atributo, lote de origem/compra e período; filtros favoritos; busca por código ou leitura pela câmera (quando o
  aparelho tem); tabela ou cartões; colunas à escolha; selecionar vários para **exportar CSV** ou **mudar um atributo de
  todos** (admin, cada lote fica com antes → depois no histórico).
- **Prontuário do lote** (#/lotes/:id): barra "cada grama" (vendido · separado · perda · em estoque) e três etapas ligadas:
  **Entrada** (fornecedor, pedido, peso bruto, custo, custo/kg, estado na chegada) → **Triagem** (em que lotes virou e a
  perda, ou de qual lote veio e os irmãos) → **Para onde foi** (cada venda com cliente, gramas, valor e lucro). Editar
  atributos (admin) refaz o nome do lote e fica no histórico.

### 2.3.1 Códigos (Configurações › Cabelo e estoque › Códigos)
- **Compra**: incremental (com prefixo, P-0001, ou sem, 1, 2, 3), **por pessoa** (sigla + sequência dela: Maria M1, M2;
  Celso C1 — sigla do fornecedor ou de quem da equipe comprou) ou **manual** (digitado; sugere o próximo).
- **Lote**: incremental, **da compra** (M1-1, M1-2; separado M1-1a, M1-1b; juntado M1+C3-1) ou manual.
- Todo código é **único**: digitar um que já existe é recusado dizendo qual registro usa ("Já existe: L-0006 · …").
- **Trocar código** depois (admin), com antes → depois no histórico; o código antigo continua achando o registro.

### 2.4 Venda
- Linhas de cabelo escolhem sozinhas o **lote mais antigo** daquela medida/categoria (dá para escolher) e **dividem entre lotes**
  quando um só não basta. Custo da linha = custo proporcional do lote → lucro real por venda.
- Pagamento em várias formas e moedas. **Com cliente identificada pode pagar em partes** (fiado) ou a mais (crédito): vai para a
  conta corrente. Sem cliente, o pagamento precisa fechar com o total.
- Atendimento do salão: unidade, cliente, serviços, quem atende (comissão), **agora ou agendado**; pode usar cabelo do estoque.
- Recibo no WhatsApp. Cancelar devolve estoque, estorna cada pagamento e a conta.

### 2.4.0 Modo caixa (venda rápida: Vender › ⚡ Modo caixa)
- Passa a pistola, lê o QR ou digita o código: o pacote entra **inteiro** com o preço da tabela; tocar nas gramas vende só
  uma parte; tocar na foto abre **Conferir** (foto, peso, compras de origem, histórico) sem sair da venda.
- **Cobrar em Bs, US$ ou R$**: fora da moeda principal aparece a **cotação** (vem a do dia, dá para trocar); total, desconto,
  pagamento e troco na moeda escolhida; a venda guarda "Cobrado em R$ · cotação 1 R$ = 1,30 Bs".
- **Desconto** em % ou valor (na moeda de cobrança, convertido pela cotação digitada). O serviço reparte o desconto entre
  as linhas: cada linha **continua ligada à tabela** (medida, fator, tabela, coluna) com o valor cheio (gramas × fator), o
  desconto e o total líquido. Comissão, lucro, caixa e relatórios usam o líquido; a venda guarda "desconto 2,5% = Bs 878,50"
  (recibo e detalhe). DRE: Receita de vendas (cheia) → (−) Descontos → = Receita líquida. Vendas antigas sem desconto: iguais.
- **Fechar** = um toque na forma de pagamento. Baixa no estoque e histórico na hora.
- **Dividir pagamento**: cada pagamento fora da moeda principal tem a sua cotação ("1 US$ = [6,96] Bs"), que vem da já
  digitada para aquela moeda ou da do sistema; cada pagamento guarda a sua e o detalhe da venda lista
  "US$ 100 · 1 US$ = 6,96 Bs". (Vender e Comprar continuam com a cotação do sistema.)
- Mesma tela no celular, tablet e computador com pistola (a pistola funciona como teclado).

### 2.4.1 Corrigir uma venda (a qualquer momento, quantas vezes precisar)
- Venda › **Corrigir**: muda gramas/quantidade, fator ou valor de cada linha. O estoque acerta a diferença, o custo do lote e a
  comissão são recalculados.
- A diferença de dinheiro vai **para a conta da cliente** (passa a dever ou fica com crédito) ou **para o caixa agora**
  (recebi/devolvi, na forma e moeda escolhidas).
- **Nada é apagado**: cada correção fica no histórico com antes → depois, quem corrigiu, quando e o motivo
  (quadro "Correções" e linha do tempo).

### 2.4.1.1 Período fechado
- O dinheiro de um dia **encerrado** não muda: a diferença de uma correção/cancelamento entra no caixa **do dia em que se
  corrigiu**. Mas o resultado daquele dia muda, então **só o administrador** corrige/cancela venda de dia encerrado, e o
  Caixa daquele dia mostra o aviso "Alterado depois de encerrado" com cada venda, motivo, data e quem fez.

### 2.4.2 Comissões: histórico do ganho × pagamento lançado
- **Ganho (histórico)**: nasce em cada venda/atendimento (valor da linha × % da profissional) e muda junto se a venda for
  corrigida ou cancelada. Já entra como custo no lucro da venda.
- **Pago (lançamento)**: Equipe › Comissões › **Pagar** (tudo ou parte) sai do caixa como categoria "Comissões".
- **A pagar = ganho − pago**. No resultado (DRE) o pagamento **não** vira despesa de novo (seria contar duas vezes).
- Extrato por profissional: cada ganho (venda, cliente, base × %) e cada pagamento, com filtro de período.

### 2.4.2.1 Salão: divisão 50/50 e insumos antes da comissão
- **% que vale** (precedência): ajuste na linha do atendimento (admin, ou funcionária se Configurações deixar) › % própria
  do serviço (Catálogo) › % da profissional (cadastro) › **padrão do salão (50%)**. A linha guarda qual regra valeu.
- **Insumos** (tinta, água oxigenada, descolorante…): custo fixo no catálogo (valor + itens com nome) e saem **antes** da
  divisão: base = valor − insumos; profissional = base × %; salão = base − profissional.
  Ex.: Tintura Bs 300 − insumos Bs 20 (Tinta 15 + Água oxigenada 5) = base 280 → salão 140 · profissional 140 (50%).
- No atendimento (Vender › serviço e Agenda › Atender): muda preço (abaixo do catálogo: funcionária diz o motivo; vai pro
  log), insumos (produto especial/quantidade extra, com motivo; **abaixo do catálogo só o admin**) e % (admin).
- **+ Serviço novo** na hora: nome e preço (duração, insumos, tipo, % opcionais); guarda no catálogo ("criado por", para
  o admin revisar) ou só para este atendimento. Nome repetido é recusado sugerindo o existente.
- Biblioteca padrão (Corte, Escova, Tintura, Mechas/Luzes, Descoloração, Hidratação, Depilação, Unhas, Maquiagem,
  Penteado, Barba): Catálogo › **Restaurar biblioteca padrão** (só cria o que falta).
- A linha guarda insumos, base, %, comissão e parte do salão: mudar o catálogo depois **não muda o passado**; corrigir a
  venda recalcula com o % guardado. Insumos são custo no DRE ("(−) Insumos dos serviços"), no lucro da venda e na
  margem da unidade. Relatórios › **Serviços: receita × insumos**. O recibo da cliente **não** mostra a divisão.

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
- **Funcionária: papel enxuto, focado na venda do cabelo** (modo caixa, ver pacote para vender); administrar estoque,
  triagem, compras e custos é do administrador. Ao abrir `#/lotes/<id>` (ex.: lendo o QR) ela vê o **pacote para vender**
  (consulta `pacoteVenda`): foto (toque amplia), código, rótulo (medida · categoria · cor), situação, peso disponível,
  preço de venda pela tabela e os códigos das compras de origem — sem custo, margem, preço do fornecedor nem histórico — e
  um botão **Vender** (abre o modo caixa com o pacote: `#/venda-rapida?lote=<id>`). Pacote bruto, não identificado ou
  esgotado: "Ainda não está pronto para vender", sem ações. A ficha completa (`fichaItem`) continua só do administrador.
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
   (fila → transação → outbox → aviso)    (POST /v1/k (handshake) e POST /v1/r (tudo criptografado; ver 'Segurança das requisições'))
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

### Segurança das requisições
Com a API ligada, **nada legível passa na rede**: só dois endereços, ambos `POST` com corpo binário cifrado.
- `POST /v1/k` — aperto de mão: chaves ECDH P-256 novas a cada sessão → HKDF-SHA-256 → duas chaves AES-GCM-256
  (uma por sentido). Com `VITE_API_CHAVE_PUBLICA` o app só aceita o servidor que assina o aperto de mão com a chave
  fixa (barra alguém no meio). `POST /v1/r` — **todo** o resto (comandos, consultas, login, backup, arquivos).
- Envelope `{ tipo, nome, dados, id, ts, token?, chave? }`, IV novo de 96 bits por mensagem, texto preenchido em
  degraus de 1 KB. Sem nome de comando ou parâmetro no endereço, sem query string, sem cookie, sem `Authorization`:
  o token vai **dentro** do envelope. Resposta e erros de regra também voltam cifrados (HTTP 200); falha de
  transporte é só um status sem corpo, e a tela mostra "Sem conexão…" ou "Erro no servidor…", sem detalhe técnico.
- Repetição: o servidor recusa `id` já visto e `ts` fora de ±5 min (o app acerta o relógio pelo servidor).
  Conteúdo alterado ou chave errada → recusa genérica. Código: `src/core/seguranca/envelope.ts`,
  `src/adapters/api/canalSeguro.ts`; lado do servidor (modelo): `src/adapters/api/apiSimulada.ts`;
  protocolo em `api-contract/openapi.yaml`; testes em `src/__tests__/seguranca.test.ts`.
- Build de produção: sem sourcemap, sem `console`/`debugger`, CSP estrito colocado no `index.html` pelo build (`vite.config.ts`; só scripts do próprio
  site, rede só para o site, o câmbio e a `VITE_API_URL`), `Referrer-Policy: no-referrer`. O câmbio só busca a
  cotação pública, sem dado do usuário, sem referrer e sem cookie. (No `npm run dev` o CSP fica desligado.)

**O que isso protege**: quem olha a rede (Wi-Fi, proxy, operadora), quem abre a aba Rede por curiosidade, endereços
no histórico e em registros de servidores intermediários. **O que não protege**: quem controla o aparelho e sabe
mexer no navegador ainda consegue ler a memória do app (as chaves e os dados abertos estão lá enquanto ele roda) —
a proteção de verdade é o servidor conferir as **permissões** de cada pedido pelo token. Também não substitui o
HTTPS (use os dois) e, sem `VITE_API_CHAVE_PUBLICA`, alguém no meio com um certificado falso poderia trocar as chaves.
**Próximo passo (opcional)**: cifrar o banco local (IndexedDB) em repouso com uma chave derivada da senha do login
(PBKDF2/Argon2 → AES-GCM), para que dados no aparelho não fiquem legíveis com o app fechado.

---

## 5. Idioma e aparência
- **Português ⇄ Español** em Configurações › Negócio › Geral. O texto em português é a chave; o espanhol está em `src/ui/es.ts`
  (falta tradução → aparece em português). Novo idioma = novo dicionário.
- Cores básicas com função (marca, bom, alerta, ruim) em variáveis CSS; tema escuro automático.
- Mobile first (320 px, barra inferior + "Mais"), desktop com menu lateral e tabelas; botão 💱 de conversão sempre à mão.

---

## 6. Testes
```bash
npm test          # 150 testes: regras, contrato (memória × IndexedDB × API simulada), dados de exemplo, telas
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

### Revisão de lógica e usabilidade (nov/2026)
- Permissões da funcionária fechadas: câmbio só pela busca da internet e dentro de ±20%; não muda comissão, salário, acesso
  nem cadastra funcionário; não vê salários, custos nem o resumo de colegas.
- Contas: estorno herda categoria/unidade/pessoa; produto comprado entra com custo médio; comissão paga guarda o valor do
  dia; acerto não duplica; moeda principal não troca com movimento; diagnóstico confere a conta corrente.
- Telas: filtros e abas no endereço (voltar reencontra a lista), aviso "Sair sem salvar?", confirmação antes de desfazer,
  números e itens levam à origem, alvos de toque ≥ 40 px, linhas clicáveis pelo teclado, sem rolagem lateral em 320 px,
  moeda principal no lugar do "Bs" fixo, datas no formato do idioma e textos em espanhol.
- **Linha do tempo como lista**: agrupada por dia, mais recente primeiro; cada evento diz o quê, quem e quando; itens com
  quantidade e valor; motivo e ajustes destacados; lotes que entram juntos viram um evento só.

### Ainda não feito (decisões / próximos passos)
- **Segurança no servidor**: hoje o login protege o uso no aparelho; quem tem acesso ao navegador ainda acha os dados.
  A proteção completa vem com a API (o contrato e o adaptador já estão prontos).
- **Sincronizar aparelhos**: a fila de saída já existe; falta o servidor/sincronizador.
- **Devolução parcial** de produto (hoje: corrigir a quantidade ou cancelar).
- ~~Etiqueta do lote~~: feito (foto + código + QR, rolo 50×30 mm ou folha A4 com 21 por folha). Na impressão: cópias de
  cada pacote, "começar na etiqueta N" (folha já usada), prévia folha a folha e limite de 210 (A4) / 200 (rolo) por vez.
- **Leitura de QR/código de barras dentro do sistema no iPhone (Safari) e no Firefox**: hoje a leitura pela câmera usa o
  recurso do navegador (Chrome/Android e computador); nos outros, a câmera normal do celular lê o QR e abre o pacote. Próximo passo:
  incluir uma biblioteca de leitura própria (≈ 1 dia), no mesmo botão "📷 Ler".
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
