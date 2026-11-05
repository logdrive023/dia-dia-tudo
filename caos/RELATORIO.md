# Operação Caos — relatório (05/11/2026)

Testes de estresse, concorrência e integridade, **separados da suíte normal**: `npm run test:caos`
(config `vitest.caos.config.ts`, pasta `caos/`). Só dados fictícios, em backends isolados (memória e IndexedDB falso
com **duas abas no mesmo banco**, cada uma com a sua fila — concorrência de verdade). O conferidor `caos/integridade.ts`
roda depois de cada cenário: autodiagnóstico do sistema (saldo × movimentos, caixa × transações, pagamentos × total,
contas), registros órfãos, saldo negativo/não inteiro e códigos repetidos.

## Números

| | Antes das correções | Depois |
|---|---|---|
| Testes de caos | 165 | 165 |
| Aprovados | 121 | **164** |
| Reprovados (= bug reproduzido) | 44 | **1** (CAOS-D-05, desempenho, P3) |
| Bloqueados | 0 | 0 |
| Suíte normal | 285 | **331** (todos passam) |

Baterias: `compras-estoque` (41), `vendas-caixa` (35), `concorrencia` (31), `combinacoes` (25), `mes` (14 — 30 dias,
9 usuários, 461 operações com semente fixa), `relatorios-verdade` (16), `volume` (1), `perfil-compra` (1), `sanidade` (1).

## Bugs encontrados (todos com teste que reproduz) e situação

| ID | P | Módulo | O que acontecia | Situação |
|---|---|---|---|---|
| A-01 | P0 | Triagem | Parte com id de pacote existente **sobrescrevia** o pacote (2.000 g sumiam; origem apontando para si mesmo) | ✅ recusado antes de mexer |
| A-02 | P0 | Triagem | Duas partes com o mesmo id → 600 g sumiam | ✅ recusado |
| B-01 | P0 | Pagamentos | Cotação digitada absurda (1 US$ = 1.000.000 Bs) quitava Bs 14.000 com US$ 0,01 | ✅ cotação a mais de ±50% da do sistema é recusada; tolerância fixa |
| A-03 | P1 | Compras/custo | Conferência de peso criava ou perdia custo nos pacotes | ✅ custo por grama refeito no peso conferido |
| A-04 | P1 | Compras | Cancelar a 2ª compra de um produto deixava o custo dela no custo médio | ✅ estorna o custo |
| A-05 | P1 | Triagem | Separação repetida (mesmo id, partes novas) separava duas vezes | ✅ repetição pelo id da separação |
| B-02/03 | P1 | API | Segunda edição legítima do mesmo registro era descartada (chave = id da entidade) | ✅ chave por pedido; o servidor espera o pedido igual em andamento |
| B-04 | P1 | Vendas/caixa | Venda fiado / atendimento em dia já encerrado | ✅ mesma regra do dia fechado |
| B-05, C-03/04 | P1 | Sessão | Comando disparado e "sair" logo depois → venda sem dono | ✅ sessão copiada ao enfileirar; sair/entrar na fila |
| C-01/02 | P1 | Sessão | Usuária desativada ou admin rebaixada seguia agindo na aba aberta | ✅ usuário relido a cada comando |
| C-05…C-10 | P1 | Cadastros/preços/config/usuários/item/viagem | Tela velha salvava por cima da mudança de outra pessoa (sem aviso) | ✅ `versaoBase` / `antes` em todas as telas; recusa "alterado por outra pessoa" |
| C-12 | P1 | Auditoria | Configurações (sócias, impostos) sem registro | ✅ registro antes → depois |
| C-14 | P1 | Comissões | Duas abas pagavam a mesma comissão (a pagar negativo) | ✅ não paga mais do que deve |
| D-01/02 | P1 | Entradas × saídas | Estornos de salário/despesa/entrada contados errado | ✅ mesma regra do DRE |
| A-06 | P2 | Triagem | Separar/unificar dizia "ok" sem fazer nada | ✅ recusa com motivo |
| A-07, C-16 | P2 | Compras | Compra não cancelava mesmo depois de desfazer a triagem/cancelar a venda | ✅ movimentos que se anulam são ignorados |
| B-06 | P2 | Vendas em aberto | Funcionária descartava a venda em aberto de outra | ✅ só a dona (ou admin) |
| C-11 | P2 | Viagens | "Desfazer" velho desfazia a mudança de outra aba | ✅ recusa se a compra já mudou |
| C-13 | P2 | Auditoria | Unidades sem registro | ✅ |
| C-15 | P2 | Vendas em aberto | Salvamento atrasado ressuscitava venda já fechada | ✅ ignorado |
| C-17 | P2 | Abas | Outras abas não sabiam da mudança | ✅ aviso entre abas (BroadcastChannel) |
| D-03 | P2 | Entradas × saídas | Período invertido dava salário negativo | ✅ 0 |
| A-08 | P3 | Compras | Conferência aceitava peso absurdo | ✅ limite |
| D-04 | P3 | Caixa | Encerrava dia futuro | ✅ recusado |
| **D-05** | **P3** | **Desempenho** | Ciclo compra→pedido→triar fica mais lento com o volume | ⚠️ **melhorou, não resolvido**: triarLotes 499→76 ms, pedido 328→187 ms (250 compras); ainda cresce (a tela do pedido lê todos os itens e anexos para as fotos) |

Achados durante as correções (também corrigidos): caminho do cabelo do pacote misturado sem compra (a triagem da
unificação tem o mesmo id do pacote); "outras compras da pessoa" no pedido; botão dentro de botão (selo de etiqueta e
de viagem nas linhas do celular).

## O que ficou bem (passou desde o início)

Duas vendas da última grama (só uma passa), 10 vendas simultâneas num lote, mesma venda reenviada (5× em paralelo,
resposta perdida, repetição), cancelar duas vezes, fechar o dia com venda em aberto, descontos extremos, conservação
de gramas em 150 passos aleatórios, códigos únicos com 20 compras em paralelo em duas abas, relatórios × dados
recalculados (painel, contábil, caixa de cada dia, comissões, auditoria), mês inteiro íntegro todos os dias.

## Não deu para testar (e por quê)

- **Vários aparelhos com servidor real**: ainda não há backend; o servidor simulado usa o mesmo motor da fila.
- **Relógio diferente entre aparelhos** e **fuso**: o relógio do teste é único.
- **Timeout de rede real** no cliente: a resposta perdida foi simulada.
- **Volume de 10.000 compras**: parou em ~600 por tempo (é o próprio D-05).

## Riscos novos (não testados)

1. `ajustarEstoque` aceita lote inativo (cancelado/desfeito).
2. Somar `custoPrincipal` de toda a genealogia conta custo duas vezes (pai + filhos).
3. Venda em aberto não reserva o pacote (duas podem segurar o mesmo; vence quem fecha primeiro).
4. Soma de linhas perto do limite passa do MAX_VALOR (cada linha é conferida, a soma não).
5. Funcionária pode lançar `salvarCotacao` (muda a cotação de todos).
6. `decimalParaRacional` tira todos os pontos: "6.96" vira 696.
7. Cache de repetição do servidor simulado nunca expira.
8. `reabrirDia` mantém o dinheiro contado do fechamento antigo.
9. `atenderAgendamento` sem conferência de dona (uma funcionária fecha o atendimento de outra).
10. Relatório de período fechado não é congelado (cancelar/corrigir reescreve o dia já declarado; só fica a nota).
11. RTS conta meses de calendário (2 dias na virada = 2 meses).
12. Crédito de IVA usa compras ainda não recebidas; o painel só as concluídas.
13. Auditoria sem `limite` devolve 1.000 linhas e diz o total maior (tela sem paginação esconderia).
14. Auditoria e outbox só crescem (≈2,6 e 1,3 linhas por comando, nada limpa).
15. Importar/limpar apaga anexos fora da transação (falha no meio = registro sem arquivo).
16. `entrar` sem esperar + comando logo depois pode rodar com o papel antigo.

## Próximos passos sugeridos

1. D-05: índice por compra/dono nas consultas da tela do pedido (fotos e itens só da compra).
2. Riscos 3, 5, 9 (regras de quem pode o quê) e 10 (congelar período declarado) — são regras de negócio: decidir antes.
3. Manter `npm run test:caos` rodando antes de cada entrega grande.
