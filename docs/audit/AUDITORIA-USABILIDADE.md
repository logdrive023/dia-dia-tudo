# Auditoria de usabilidade — compras × viagens (04/11/2026)

**Atualizado:** 04/11/2026 · **Situação:** histórico (retrato da auditoria nessa data)

Como foi feita: li as regras no código, rodei cada cenário contra o servidor de verdade (um teste temporário, já apagado) e percorri as telas como alguém que nunca usou o sistema (celular, 375 px). **Nada foi alterado no sistema.**
Legenda: ✅ comprovado (rodei) · 🔎 lido no código · ❓ hipótese (precisa validar).

## Resposta curta: estamos cumprindo?

**Em parte.** Os fluxos de uma coisa só estão bons: registrar uma compra, separar, vender, ver a ficha. As telas explicam bem e os erros dizem o que fazer.

**Onde falha** é na relação entre compra e viagem. Ali o usuário precisa pensar como desenvolvedor:
- saber a ordem certa (criar a viagem antes de comprar);
- saber que "mover" são duas operações em duas telas;
- saber que viagem encerrada tem regras diferentes para ligar e para tirar;
- descobrir sozinho onde fica a ligação de várias compras de uma vez.

Existem também duas falhas que estragam dados: uma minha, da última mudança, e uma ainda não confirmada.

---

## 🔴 Crítico

### 1. Ligar compra a viagem encerrada depois que o gasto já foi para o custo dos pacotes ✅
- **Situação:** o usuário esqueceu de ligar uma compra. A viagem já foi encerrada, e o gasto (Bs 500) já foi somado ao custo dos pacotes. Ele liga a compra agora.
- **Hoje:** liga. Os pacotes da compra antiga continuam carregando **todo** o gasto (custo 1.500 contra 1.000 da compra ligada depois). A viagem passa a contar a compra nova no resultado, mas o custo dela fica sem a parte do gasto.
- **Problema:** custo e lucro errados, sem nenhum aviso. **Isso entrou com a mudança anterior (ligar a qualquer momento), feita por mim.**
- **Solução:** ao ligar, tirar ou mover uma compra em viagem que já tem gasto incorporado, **refazer a divisão do gasto automaticamente**: desfazer e incorporar de novo, o que o sistema já sabe fazer ao reabrir. Mostrar antes: "O gasto desta viagem será redividido entre 3 compras".
- **Tipo:** lógica e automatização. **Impacto:** custo certo sem a pessoa entender o que é "rateio".

### 2. Regras contraditórias sobre viagem encerrada ✅
| Ação | Viagem encerrada |
|---|---|
| Ligar compra pelo pedido | ✅ pode (desde a última mudança) |
| Criar compra já com a viagem | ❌ recusa ("já foi encerrada") |
| "Vincular compras" na tela da viagem | ❌ o botão some |
| Tirar a compra da viagem | ❌ recusa ("reabra para mudar") |
| Mover para outra viagem | ❌ impossível (precisa tirar antes, e tirar é recusado) |

- **Problema:** dá para colocar uma compra numa viagem encerrada, mas não dá para tirar. Se ligou na errada, **fica presa** até alguém descobrir que precisa "reabrir a viagem". Isso é uma regra escondida.
- **Solução:** uma regra só. **Ligar, tirar e mover valem sempre**, em qualquer tela. Se a viagem estiver encerrada, o sistema avisa ("encerrada há X dias") e, se precisar, refaz a divisão do gasto (item 1).
- **Tipo:** lógica. **Impacto:** a pessoa corrige o erro na hora, sem conhecer "reabrir".

### 3. Operações que gravam vários registros não são "tudo ou nada" ❓
- **Situação:** o usuário liga 50 compras, cancela uma compra (estorno + estoque) ou faz uma triagem, e no meio a página atualiza, a bateria acaba ou a internet cai (com a API).
- **Hoje 🔎:** não achei nenhuma transação no código. Cada registro é gravado um de cada vez. A validação vem antes, então dado inválido não grava nada, mas uma interrupção no meio pode deixar metade gravada.
- **Solução:** gravar cada comando numa transação única (no aparelho e na API).
- **Tipo:** lógica (infraestrutura). **Pendente:** validar forçando uma interrupção.

---

## 🟠 Alto

### 4. Viagem duplicada é aceita, e não existe "apagar viagem" ✅
- **Hoje:** criar "Feira Oruro · Oruro · mesma data" duas vezes cria VG-0001 e VG-0002 sem aviso. Não existe comando para apagar ou juntar viagens.
- **Problema:** a duplicada fica para sempre: aparece nos filtros, conta como "prospecção" (viagem sem compra) e confunde na hora de ligar ("qual das duas?").
- **Solução:**
  - ao criar, avisar "Já existe VG-0001 · Feira Oruro · 04/11. É a mesma?" com os botões [Usar a que existe] [Criar outra];
  - permitir **apagar** uma viagem sem compras e sem gastos.
- **Tipo:** feedback e lógica.

### 5. Ligar várias de uma vez: uma compra problemática barra todas ✅ (Cenário B)
- **Situação:** 10 compras selecionadas. 4 sem viagem, 3 já nesta viagem, 3 em outra.
- **Hoje:** recusa **tudo** e cita só a primeira ("A compra P-0004 já está na viagem VG-0003. Tire de lá antes."). As 4 sem viagem também não são ligadas.
- **Solução:** antes de confirmar, mostrar o resumo:
  > 10 selecionadas → **4 serão ligadas** · 3 já estão nesta viagem (ficam como estão) · **3 estão em outra viagem** (VG-0003 ×2, VG-0005 ×1)
  > [Ligar só as 4 sem viagem] [Mover as 3 também]

  O servidor devolve esse resumo (uma consulta de "prévia") e aplica a opção escolhida.
- **Tipo:** lógica e feedback. **Impacto:** nada é sobrescrito sem a pessoa ver, e nada trava por causa de uma compra.

### 6. Mover uma compra de uma viagem para outra exige 2 telas ✅ (Cenário C)
- **Hoje:** "Ligar à VG-B" recusa. É preciso abrir a viagem A, tocar em "tirar", ir à viagem B e ligar.
- **Solução:** escolher B para uma compra que está em A pergunta "P-0001 está em VG-A (Feira Oruro). Mover para VG-B?", e uma confirmação faz tudo. Isso vale igual na operação individual e em massa (item 5).
- **Tipo:** lógica.

### 7. Esquecer a viagem é fácil, e corrigir em massa está escondido ✅ (Cenário A)
- **Hoje:**
  - na Nova compra, a viagem fica em "Detalhes (opcional) → + Viagem";
  - se não existe viagem aberta, o campo **nem aparece** e nada lembra a pessoa;
  - se quem comprou está numa viagem aberta, ela já vem marcada sozinha (isso é bom e fica).
- **Depois:**
  - a lista de **Compras não tem seleção**, então não dá para marcar várias e ligar;
  - ligar várias só existe **dentro da tela da viagem** ("Vincular compras"), que já sugere as compras do período feitas por quem viajou. Isso é bom, mas quem está na lista de Compras não sabe que é ali.
- **Solução:**
  - **seleção na lista de Compras** (o mesmo painel de seleção da Triagem e do Estoque), com a ação "✈️ Ligar a uma viagem" usando a escolha de viagem padrão e o resumo do item 5;
  - na Nova compra, quando houver viagem aberta, mostrar a viagem à vista (não atrás de "+").
- **Tipo:** layout e automatização. **Impacto:** esquecer a viagem deixa de ser um problema; corrige-se 20 compras em 3 toques.

### 8. Compra de outra época é ligada sem aviso ✅
- **Hoje:** uma compra de 01/01/2025 é ligada a uma viagem de 11/2026 sem nada.
- **Solução:** não bloquear (pode ser correção), mas avisar no resumo: "P-0006 é de 01/01/2025, fora das datas da viagem".
- **Tipo:** feedback.

---

## 🟡 Médio

### 9. Palavras de quem fez o sistema 🔎
- **Termos difíceis:** "triagem", "bruto", "separar", "Coluna: LP", "rateio", "incorporar o gasto", "prospecção", "capital de compra".
- **Mesma ação com duas palavras:** "Vincular compras" (tela da viagem) e "Ligar a uma viagem" (pedido).
- **Primeira frase da Nova compra:** "Ao registrar, o cabelo já vai para a triagem". Quem chega não sabe o que é triagem.
- **Solução:**
  - um verbo só ("Ligar");
  - nas telas de primeiro contato, trocar o termo pela ação ("vai para a fila de separar por tamanho e cor");
  - manter o nome do módulo.
- Não é caso de tooltip: é o texto em si.
- **Tipo:** layout e texto.

### 10. Sem desfazer nas operações em massa ✅
- **Hoje:** depois de ligar 50 compras, desfazer é "tirar" uma a uma, e só com a viagem aberta.
- **Solução:** a confirmação vem com **[Desfazer]** por alguns segundos, que tira exatamente as que acabaram de ser ligadas.
- **Tipo:** feedback.

### 11. "Feito" mesmo quando nada mudou ✅
- **Hoje:** ligar de novo as mesmas compras não estraga nada (bom), mas a tela diz "Compras ligadas à viagem." quando o servidor respondeu "0 ligadas".
- **Solução:** a mensagem segue o resultado: "Nada mudou: as 2 já estavam nesta viagem".
- **Tipo:** feedback.

### 12. "Vincular compras" já abre com as sugeridas marcadas 🔎
- **Hoje:** todas as sugeridas vêm marcadas. Um toque em "Ligar 12 compras" liga compras que a pessoa nem olhou.
- **Solução:** manter a sugestão marcada (economiza tempo), mas com o resumo "12 marcadas: de Paula e Wagner, de 02/11 a 07/11" acima do botão.
- **Tipo:** feedback.

---

## ✅ O que está certo (preservar)
- Repetir a mesma ligação não duplica nada.
- Dado inválido não grava nada: a conferência é feita antes de salvar.
- Ligar 50 de uma vez funciona.
- Compra cancelada sai dos números da viagem e continua mostrando de onde veio (histórico).
- A funcionária só liga compra à viagem em que ela está.
- A recusa diz o código da compra e da viagem.
- Se quem comprou está numa viagem aberta, a viagem já vem escolhida na Nova compra.

---

## Ordem recomendada
1. **Item 1** (custo errado), que é consequência da minha última mudança. Até corrigir, ligar compra a viagem encerrada **com gasto incorporado** deveria voltar a exigir reabrir.
2. **Itens 2 + 6**: uma regra só (ligar, tirar e mover sempre) e mover numa ação.
3. **Itens 5 + 7 + 10**: seleção na lista de Compras, resumo antes de confirmar e desfazer. Isso resolve os cenários A e B de uma vez.
4. **Item 4**: aviso de viagem duplicada e apagar viagem vazia.
5. **Item 3**: transação (validar antes; é a base para a API).
6. **Itens 8, 9, 11, 12**: textos e avisos.

**Fora do escopo desta rodada (não testei):** vendas, empréstimos, agenda e o perfil funcionária de ponta a ponta. Pode ser a próxima.

---

## Correções feitas (04/11/2026)

| Item | O que mudou | Como fica garantido |
|---|---|---|
| **1** custo errado | Toda operação que muda as compras de uma viagem com o gasto já no custo **refaz a divisão sozinha**: ligar, tirar, mover, desfazer, criar compra já com a viagem, cancelar compra. Vale também para a funcionária. | Teste `comprasViagemRegra`: custo certo depois de cada operação |
| **2** regras contraditórias | Uma regra só: ligar, tirar e mover **valem sempre**, com a viagem aberta ou encerrada, em todas as telas (pedido, lista de Compras, tela da viagem, nova compra). | Mesmo teste (compra presa em viagem encerrada é movida) |
| **3** tudo ou nada | **Minha auditoria estava errada:** cada comando já roda numa transação (`src/adapters/noAparelho.ts`), no aparelho e na memória. Eu procurei na pasta errada. Agora há um teste que quebra a gravação no meio e confere que nada fica pela metade. | Teste `tudoOuNada` (aparelho e memória) |
| **4** viagem repetida | Ao criar, se existe uma viagem **parecida em andamento** (mesma cidade ou nome parecido, datas perto), aparece o aviso com **Sim, criar outra mesmo assim** e **Não, usar a VG-…**. O servidor também confere (`confirmarParecida`). Viagem vazia (sem compras, gastos ou dinheiro) pode ser **apagada** pelo ⋯ da ficha. | Teste de viagem parecida e apagar |
| **5** lote misto | **Prévia** antes de mudar: "N entram · N já estão nesta (ficam) · N estão em outra (VG-… ×2)". Com compra em outra viagem: **Ligar e mover** ou **Ligar só as sem viagem**. Sem confirmar, nada muda pela metade. | Teste do lote misto |
| **6** mover | Uma ação só ("Trocar de viagem" no pedido, "mover" na prévia). | Teste |
| **7** esquecer a viagem | Nova compra: com viagem em andamento, o campo fica **à vista** e o resumo do passo diz "✈️ sem viagem". Lista de Compras: **marcar várias** (painel padrão) → **Ligar as N a uma viagem** / **Tirar N da viagem**. | Conferido na tela |
| **8** fora das datas | Aviso na prévia: "Fora das datas da viagem: P-0005 (03/11)". | Teste |
| **9** palavras | "Vincular" virou **Ligar** em todo lugar. A Nova compra diz "entra na fila para separar por tamanho e cor (Triagem)". A aba "Rateio" virou **Divisão do gasto**. | — |
| **10** desfazer | Depois de ligar ou mover: **↩ Desfazer**, que volta cada compra exatamente para onde estava (e redivide o gasto). | Teste |
| **11** mensagem | O resultado segue o que aconteceu: "2 compras agora em VG-0001 · 2 ligadas" ou "Nada mudou: já estavam em VG-0001". | — |
| **12** sugeridas marcadas | Acima do botão: "N marcadas · de Paula, Wagner · 02/11 – 07/11", e depois a mesma prévia. | — |
