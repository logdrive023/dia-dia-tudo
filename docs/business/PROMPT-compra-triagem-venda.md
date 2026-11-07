# Evolução da lógica — Compra → Triagem → Venda (o "livro do cabelo")

**Atualizado:** 03/11/2026 · **Situação:** histórico (pedido original do fluxo)

Evolua o sistema que já existe. **Não comece do zero, não recrie o que já funciona e não mude a estrutura sem necessidade.**
Antes de mexer, leia o que já existe e diga onde cada item abaixo se encaixa. Só depois implemente, reaproveitando o que está pronto.

Objetivo: **facilitar a vida de quem opera, não complicar.** A compra e a venda levam segundos. A triagem é onde o trabalho de
verdade acontece, e o sistema deixa tudo organizado e à vista.

---

## 1. A grande chave: o cabelo se mistura, e o sistema acompanha

**Não é porque entrou junto que sai junto, e está tudo bem.**

- Uma **compra** pode virar **vários pacotes** na triagem.
- Um **pacote** pode juntar cabelo de **várias compras**.
- Uma **venda** pode levar cabelo de **N compras de origem**.

O sistema precisa responder, para qualquer venda: **"este cabelo veio de quais compras, em quantos gramas de cada uma?"**. E, para
qualquer compra: **"para onde foi cada grama?"** (em quais pacotes, em quais vendas, quanto ainda há, quanto virou perda).

Exemplo (o caso típico):

```text
Compra C1 · Maria · 10 kg bruto
        │
   Triagem T-1 (separou)
        ├── Pacote P1 · 2 kg loiro
        ├── Pacote P2 · 2 kg moreno
        └── Pacote P3 · 6 kg aleatório (ainda não identificado)

Compra C2 · Celso · 4 kg bruto
        │
   Triagem T-2 (juntou P3 2 kg + C2 4 kg e separou)
        └── Pacote P4 · 6 kg castanho 50 cm   ← veio de C1 (2 kg) + C2 (4 kg)

Venda V-9 · Ana · 1 kg do P1 + 1,5 kg do P4
        → origem: C1 1,5 kg (1 kg via P1 + 0,5 kg via P4) · C2 1 kg (via P4)
```

A proporção de cada compra dentro de um pacote misturado é guardada pelos gramas que entraram. O rastreio total que já existe
(genealogia) deve ser a base disso; não criar outro.

## 2. Como funciona na vida real

- O cabelo é **comprado por peso**, quase sempre **bruto/misturado** (comprimentos, cores e qualidades juntos). Quem compra
  **registra rápido e trata depois**.
- Na triagem ele é separado por **comprimento (cm)**, **cor**, **textura**, **qualidade** (virgem, com química, grisalho) e
  **categoria** de preço. Fios curtos demais e sujeira viram **perda**.
- **Lavar e secar é opcional.** Muita gente não faz. Se a triagem fizer, existe a etapa e o peso antes e depois fica registrado; se
  não fizer, não aparece nada a mais. **Nada disso é obrigatório.**
- Problemas comuns do mercado: peso recebido diferente do comprado, fios curtos misturados e cabelo com química vendido como virgem.
  Por isso a conferência do peso na chegada existe, mas é **opcional, de um toque**.
- A venda é por **medida + gramas** (ex.: 60 cm | 2.008 g × fator da tabela), e um pacote pode ser vendido em partes.

## 3. O livro do cabelo (como um livro caixa)

Assim como o caixa é a soma dos movimentos de dinheiro, **o estoque de cabelo é a soma dos movimentos de gramas**. Nada some e nada é
apagado.

| Lançamento | Exemplo | Efeito |
|---|---|---|
| Entrada (compra) | C1 · Maria · 10 kg bruto | +10.000 g aguardando triagem |
| Conferência (opcional) | pesou 9.850 g | −150 g diferença de peso (com motivo) |
| Triagem: sai do bruto | T-1 consome 10 kg | −10.000 g do bruto |
| Triagem: entram os pacotes | P1 2 kg · P2 2 kg · P3 6 kg | +10.000 g em 3 pacotes |
| Lavagem/secagem (opcional) | P3 6.000 → 5.700 g | −300 g perda de lavagem |
| Perda | sujeira, fios curtos | −g perda (com %) |
| Venda | V-9 · 1 kg do P1 | −1.000 g |
| Ajuste | contagem achou 20 g a menos | −20 g (com motivo) |

- **Cada compra fecha a conta**: comprado = em pacotes + vendido + perda + diferença. O sistema mostra ✓ quando fecha e avisa quando
  não fecha.
- Tela **"Livro do cabelo"**: todos os lançamentos em ordem, com filtros (compra, pacote, pessoa, período, tipo) e exportação; cada
  linha abre o registro de origem.

## 4. O histórico de cada pacote (o log do item)

**Cada pacote tem seu próprio histórico de movimentações**, no mesmo formato do caixa do dia:

```text
Pacote P4 · 50 cm · Castanho                        agora 4.500 g

03/11/26  aberto
  ● Agora 4.500 g
  ○ Começou o dia com 4.500 g                         [detalhes ▾]

01/11/26  encerrado
  ● Terminou o dia com 4.500 g
  ○ Venda V-9 · Ana · 1.500 g            19:54   6.000 → 4.500  [fechar ▴]
      Tipo: Venda · Data e hora: 01/11/26 19:54
      Antes: 6.000 g · Movimentou: −1.500 g · Depois: 4.500 g
      Quem: Paula · Referência: venda V-9 (abre a venda)
  ○ Entrou da triagem T-2 · 6.000 g      10:12   0 → 6.000   [detalhes ▾]
      Origem: 2.000 g do P3 (compra C1 · Maria) + 4.000 g da compra C2 · Celso
```

- Agrupado **por dia**, com o saldo do começo e do fim do dia; cada movimento mostra **antes → depois**, quem fez, a hora e a
  **referência clicável** (compra, triagem, venda ou ajuste).
- "Detalhes" abre a ficha do movimento. No movimento de entrada da triagem, aparecem **as compras de origem com os gramas de cada uma**.
- Reaproveitar os movimentos de estoque e a linha do tempo que já existem.

## 5. Compra: registra o que entrou (rápido)

- Mínimo obrigatório: **peso** e **valor** (fornecedor recomendado, mas opcional). Todo o resto pode ficar para a triagem.
- No fim, uma pergunta: **"Já vai separar agora?"**
  - **Sim** → abre a triagem dessa compra.
  - **Depois** → entra como **"Aguardando triagem"** e vira **pendência visível** (Painel, Triagem e a própria compra, com os dias
    parado). **Material não identificado nunca some.**
- Opcional, com um toque: foto, estado na chegada, peso conferido, viagem. Usar o formulário simples que já existe.

## 6. Triagem: o centro do sistema

- Etapas **padronizadas e configuráveis** (o quadro de colunas já existe). Padrão: **Aguardando → Separado → Pronto para venda**,
  com "Vendido" automático. Etapas opcionais como **Lavagem/Secagem** só aparecem se a empresa ligar.
- **Separar**: de uma compra ou de um pacote, gerar N pacotes digitando só **peso + o que é** (cor, medida…); o que sobra é perda,
  calculada na hora.
- **Deixar parte para depois**: um pacote pode sair como **"Não identificado"** (ex.: os 6 kg aleatórios) e continua como pendência
  até alguém separar.
- **Juntar**: pacotes de compras diferentes podem virar um só, e a origem de cada grama fica guardada.
- Cada operação recebe um número (T-…), com quem fez e quando. Atributos vêm da configuração; nada fixo no código.

## 7. Identificação: ID + código + rótulo

- **ID**: interno e permanente; nunca muda e nunca é reaproveitado.
- **Código do pacote**: curto e legível, pela regra escolhida (incremental, por pessoa M1/C1, da compra M1-1, M1-1a…) ou digitado na
  hora; nunca repete, e se repetir o sistema diz qual registro já usa.
- **Rótulo**: nome de exibição ("50 cm · Castanho"). Mudar o rótulo não muda o ID nem o código.
- **Situação**: Aguardando · Não identificado · Separado · Pronto para venda · Vendido (parcial ou total).

## 8. Etiqueta e leitura: o código abre o pacote

Modo escolhido pela empresa (Configurações › Códigos) e ajustável em cada compra ou triagem:

1. **QR Code + código de barras (Code 128)**: para leitor "pistola" no balcão.
2. **Só QR Code**: para quem usa só o celular.
3. **Sem etiqueta**: o código aparece grande para escrever à mão.

**Ler o QR ou o código de barras abre a página do pacote no sistema**, com:
- código, rótulo, foto e situação;
- **peso atual** (o impresso é o de entrada; depois de vender uma parte, vale o do sistema);
- **compras de origem com os gramas de cada uma**, a triagem que o gerou e as vendas que já saíram dele;
- o **histórico do item** (item 4) e as ações rápidas: Vender · Separar · Ajustar · Mover.

O QR leva para o endereço do pacote no sistema (ex.: `…/#/lotes/<id>`). Quem não tem login vê a tela de entrar e depois cai no pacote.
O código de barras leva o código do pacote, e o leitor "pistola" o digita no campo de busca, que abre o pacote direto.

Boas práticas: uma etiqueta por pacote físico (pacote separado ganha etiqueta nova); etiqueta enxuta (código grande, rótulo curto,
peso de entrada + data, compra de origem); 50×30 mm térmica ou folha A4; em cabelo, tag com furo presa por elástico ou adesivo no
saquinho; **impressão em massa** no fim da triagem ("Imprimir N etiquetas").

## 9. Logística

- Campo opcional **"Onde está"** (prateleira, caixa, unidade).
- Ler o código em todo ponto de contato: chegada, triagem, venda e contagem.
- **Contagem de estoque** por leitura: o que falta, o que sobrou e o que está fora do lugar. Diferença vira ajuste com motivo no livro.

## 10. Venda: registra o que saiu

- Ler o código (ou buscar por código ou rótulo), informar as **gramas** e o preço vem da tabela. Estoque, livro e histórico do pacote
  atualizam sozinhos.
- Sem leitor: escolher medida e categoria, e o sistema sugere o pacote mais antigo.
- Na venda aparece **"De onde veio este cabelo"**: as N compras de origem com os gramas de cada uma, as triagens e os pacotes usados.

## 11. Ajustes por tela (o que existe hoje → o que mudar)

Levantamento feito nas telas atuais. **Tudo é ajuste do que já existe**; tela nova só onde não houver o que reaproveitar.

### 11.1 Compra (Nova compra + página do pedido)

Já existe: formulário simples e configurável, linhas Bruto/Pela tabela, "Repetir a última", código, fotos, viagem, rastreio da compra.

Mudar:
1. **Depois de registrar, sem pergunta e sem travar** (a maioria das compras é feita em viagem: compra, lança e separa em casa).
   Aparece só a confirmação **"Compra registrada ✓ · o cabelo ficou na Triagem, esperando para separar"**, com um link discreto
   **"Separar agora"** (opcional). Em compra de viagem, só a confirmação e "Ver na Triagem".
2. **O bruto entra na triagem na hora.** Hoje o lote só nasce depois de andar as etapas da compra até "No estoque" (incluindo "Pago").
   Regra nova: ao registrar, o peso bruto já aparece como **"Aguardando triagem"**. O pagamento é separado: o pedido pode continuar
   "a pagar" sem travar a triagem.
3. **A conferência de peso vira lançamento**, sem sobrescrever o que foi comprado. Exemplo: "Comprou 10.000 g · pesou 9.850 g →
   −150 g de diferença", com motivo. Funciona mesmo depois de pago.
4. **Simplificar a página do pedido:**
   - O cartão "Andar a triagem" passa a se chamar **"Pagamento e entrega"**, porque triagem é a outra tela.
   - "Repetir esta compra" e "Rastrear" aparecem **uma vez só** (hoje aparecem 2 e 3 vezes).
   - Um só lugar para digitar os códigos dos lotes.
5. **Linha de fechamento no topo do pedido**: `10 kg comprados = 4 kg em pacotes + 5,4 kg vendidos + 0,6 kg de perda ✓`.

Tooltips (ⓘ):
- **Peso**: "O peso total que veio, mesmo misturado. *Ex.: 10 kg bruto da Maria.*"
- **Bruto / Pela tabela**: "Bruto: veio tudo junto, separa depois. Pela tabela: já veio separado por medida. *Ex.: 10 kg bruto · ou · 60 cm | 2 kg × 17,5.*"
- **Conferência**: "Pesou na chegada e deu diferente? *Ex.: comprou 10.000 g, pesou 9.850 g → 150 g de diferença.*"
- **Aguardando triagem**: "Pode separar quando voltar; o cabelo fica esperando na Triagem. *Ex.: comprou na viagem, separa em casa.*"

### 11.2 Triagem e separação

Já existe: quadro com colunas configuráveis, "Esperando há mais tempo", "Pronto para vender", juntar e separar com número T-…,
perda calculada ao vivo e lista de triagens feitas.

Mudar:
1. **Situação "Não identificado"**: na separação, uma linha **"Deixar para depois"** cria um pacote não identificado com o que sobrou
   (ex.: 6 kg aleatório), em vez de virar perda. Ele fica como pendência até alguém separar.
2. **Lavagem/limpeza opcional**: sai das colunas padrão, que passam a ser **Aguardando → Separado → Pronto para venda** (com
   "Vendido" automático). Quem lava liga a coluna; ao passar por ela, o sistema pergunta o peso depois (opcional) e registra a diferença.
3. **Depois de separar, "Imprimir N etiquetas?"** com os pacotes recém-criados, e depois volta para o quadro.
4. **Tela de separar mais limpa**: cada linha pede só **peso + o que é** (cor, medida…). Rateio do custo, coluna de preço de
   referência, "valor de referência" e códigos manuais vão para **"Avançado ▸"**.
5. **Um caminho principal para terminar**: o botão **"Separar"**. "Marcar como triado" e "Mover para…" vão para o menu ⋯; arrastar
   continua no computador.
6. Tirar o "Perda no mês" que aparece duas vezes.

Tooltips (ⓘ), que hoje não existem nesta tela:
- **Separar**: "Digite o peso e o que é cada parte; o que sobrar é perda. *Ex.: 10 kg bruto → 2 kg loiro + 2 kg moreno + 6 kg para depois.*"
- **Deixar para depois**: "O que ainda não deu para separar fica guardado e aparece como pendência. *Ex.: 6 kg aleatório.*"
- **Juntar**: "Junta pacotes de compras diferentes; a origem de cada grama fica guardada. *Ex.: 2 kg do P3 (compra da Maria) + 4 kg da compra do Celso → P4 com 6 kg.*"
- **Perda**: "O que não virou pacote. *Ex.: separou 10.000 g, saíram 9.400 g → 600 g (6%) de perda.*"
- **Lavagem**: "Opcional. Se lavar, digite o peso depois. *Ex.: 6.000 g → 5.700 g (−300 g).*"
- **Avançado › Valor de referência**: "Divide o custo pelo valor de mercado. *Ex.: 60 cm vale mais que 30 cm, então leva mais do custo.*"

### 11.3 Venda (Vender + detalhe da venda)

Já existe: botões de medida, a conta `medida | gramas × fator`, lote automático (o mais antigo, dividindo entre lotes quando um não
basta), abrir a venda já com um lote escolhido, e "De onde veio este cabelo" no detalhe.

Mudar:
1. **Campo "Ler ou buscar pacote"** no topo da venda de cabelo. Aceita leitor pistola, câmera e digitação (código, código antigo ou
   rótulo). Achou: o pacote entra com medida e categoria preenchidas, e só falta digitar as gramas.
2. **A categoria vem da configuração de atributos**; hoje a lista está fixa na tela.
3. **Coluna e fator ficam recolhidos** quando vêm da cliente ou da tabela. A tela mostra só "60 cm · 17,5 · Bs 35.140", com "trocar"
   para abrir.
4. **Origem em gramas por compra** no detalhe da venda, inclusive quando o pacote é misturado: "**1,5 kg da compra C1 · Maria ·
   1 kg da compra C2 · Celso**". Hoje aparece o caminho inteiro das compras, e não a parte que foi nesta venda.
5. A origem também aparece para quem vendeu: a funcionária vê de onde veio o cabelo, sem ver o custo.

Tooltips (ⓘ):
- **Lote automático**: "Pega o pacote mais antigo; se não bastar, divide. *Ex.: 1.500 g = 1.000 g do P1 + 500 g do P4.*"
- **Ler ou buscar**: "Aponte o leitor ou a câmera para a etiqueta, ou digite o código. *Ex.: P4 ou M1-2.*"
- **De onde veio**: "As compras que formaram este cabelo, em gramas. *Ex.: 1,5 kg da Maria + 1 kg do Celso.*"

### 11.4 Etiqueta e leitura

Já existe: QR com o endereço do pacote (`#/lotes/<id>`), etiquetas de 50×30 mm e A4, impressão de várias de uma vez, leitor pela
câmera que abre o pacote, busca pelo código atual ou antigo.

Mudar:
1. **Code 128** na etiqueta, e a escolha **QR + barras · só QR · sem etiqueta** (em Configurações › Códigos, ajustável em cada compra
   ou triagem).
2. **Leitor pistola**: em qualquer busca, um código exato **abre o pacote direto** (Estoque, Triagem) ou **adiciona na venda**
   (Vender). Hoje só filtra a lista.
3. **Botão de câmera sempre visível.** Onde o navegador não lê códigos, mostrar: "use a câmera do celular no QR".
4. Conferir que, sem login, ler o QR leva para a tela de entrar e **depois cai no pacote**.

Tooltip:
- **Tipo de etiqueta**: "QR + barras: para leitor de balcão. Só QR: para celular. Sem etiqueta: escreva o código à mão. *Ex.: tag presa com elástico no pacote.*"

### 11.5 Página do pacote e livro do cabelo

Já existe: saldo antes e depois gravado em cada movimento, barra "Caminho", barra "cada grama", rastreio total com "confere ✓", log da
triagem e linha do tempo por dia.

Mudar:
1. **Um único "Histórico do pacote"** no formato do caixa do dia (item 4), no lugar dos 3 blocos que hoje se repetem (Movimentos,
   Log da triagem e Linha do tempo). Organizado por dia, com saldo inicial e final, **antes → depois**, hora, **quem fez** (gravar o
   usuário no movimento) e **referência clicável**.
2. **No movimento de entrada da triagem**, "detalhes" mostra as compras de origem com os gramas de cada uma.
3. **Cabeçalho do pacote com 1 botão principal** ("Vender" ou "Separar", conforme a situação) + menu ⋯. Hoje são 5 ou mais botões.
4. **Tela "Livro do cabelo"**, a única tela nova: todos os lançamentos de gramas, com filtros e exportação.
5. **No Painel, "X kg aguardando triagem / não identificados"**, com os dias parado, levando à Triagem.

Tooltips (ⓘ):
- **Histórico**: "Tudo o que entrou e saiu deste pacote, dia a dia. *Ex.: 6.000 → 4.500 g na venda V-9.*"
- **Confere ✓**: "Comprado = em pacotes + vendido + perda. *Ex.: 10 kg = 4 + 5,4 + 0,6.*"

### 11.6 Regra dos tooltips (todas as telas)

- Uma frase dizendo o que é, e **sempre um exemplo** com números redondos e coisas do dia a dia (Maria, Celso, 60 cm, 2 kg).
- O exemplo fica num **quadrinho destacado** (o ⓘ atual já separa o "Ex.:"), com no máximo 2 linhas e sem jargão.
- Em português e espanhol.
- Prioridade: Separar, Deixar para depois, Juntar, Perda, Ler ou buscar, De onde veio e Já vai separar agora?.

Não alterar: o formulário simples de compra, as colunas configuráveis, os códigos configuráveis, o rastreio total, as fotos e o
caixa. Só estender e simplificar.

---

**Princípio:** a compra registra o que entrou · a triagem separa e identifica · o pacote guarda seu histórico · a venda registra o que
saiu · **o livro do cabelo mostra, grama por grama, de quais compras veio cada venda.**
