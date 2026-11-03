# Continuar daqui (passagem de bastão)

> Leia este arquivo primeiro ao abrir o projeto em outro computador ou numa conversa nova com o Claude.
> Ele junta o que não está óbvio no código: como o dono quer as coisas, o que foi feito por último e o que falta.
> Detalhes de regra de negócio e arquitetura estão em [SISTEMA.md](SISTEMA.md) (fonte principal);
> visão do fluxo compra → triagem → venda em [PROMPT-compra-triagem-venda.md](PROMPT-compra-triagem-venda.md);
> desenho original em [DESENHO.md](DESENHO.md).
>
> Atualizado em 03/11/2026 (tarde).

---

## 1. O que é

**Tudo**: sistema de gestão para comércio de cabelo **por gramas** (compra, triagem/separação, estoque, venda pela
tabela de preço), salão (agenda, equipe, comissões), caixa, contas de pessoas, empréstimos, viagens de compra e produtos.

- React 18 + TypeScript strict + Vite 5 + Tailwind 3 + PWA (vite-plugin-pwa, `registerType: 'prompt'`).
- Local-first: IndexedDB com Dexie 4 (schema v5). Pronto para virar API trocando `VITE_STORAGE=api` + `VITE_API_URL`
  (envelope criptografado `/v1/k` e `/v1/r`; contrato em `api-contract/openapi.yaml`).
- Testes: Vitest + fake-indexeddb + Testing Library (31 arquivos, 147 testes em 03/11/2026).
- Publicação: push na `main` → GitHub Actions roda `npm test` e `npm run build` → GitHub Pages
  (`https://logdrive023.github.io/dia-dia-tudo/`). Se um teste falhar, não publica.

## 2. Rodar em outro computador

```bash
git clone https://github.com/logdrive023/dia-dia-tudo.git
```

```bash
npm ci
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

- O dev server abre em `http://localhost:5173` (ou 5174 se a porta estiver ocupada).
- Os dados de demonstração ficam no navegador. Para ver dados de exemplo novos (ex.: etiquetas já impressas),
  use Configurações › Dados › reiniciar a demonstração.
- Node 22 (o mesmo da CI).

## 3. Como o dono quer as coisas (regras de trabalho)

**UX (vale para todas as telas):**
- **Simples, "bater o olho e entender".** Menos informação, mas a mais importante. Nada de dado repetido na mesma linha.
- **Mobile first, mas bom no computador e tablet.** Sempre conferir em 360px e 1280px; sem rolagem para o lado.
- **Resumo primeiro, detalhe se a pessoa quiser**: linha resumida que expande no lugar (sem ir para outra tela),
  "+ mais", "Avançado ▸", ⋯.
- **Cada registro tem um botão principal claro + menu ⋯** com atalhos para tudo o que está ligado (compra de origem,
  fornecedor, rastrear, vendas, separar, etiqueta…). "Fácil ir para todos os lados e se localizar."
- **Tooltip ⓘ (componente `Info`) com exemplo curto** e números redondos. Ex.: "2.000 g × 3,5 = Bs 7.000".
- **Tudo customizável**, nada fixo (moedas, cotações, códigos, colunas, campos da compra, tabelas).
- **Triagem e Compra são "a alma do negócio"**; Etiquetas tão importante quanto a Triagem.
- **Rastreio por grama**: uma venda pode vir de N compras; tudo é movimento (livro caixa em gramas), nada some.
- **Corrigir tem de ser fácil**: errou → 2/3 botões, grava no histórico, gera de novo e segue a vida.
- Teclado do celular **nunca** abre sozinho (o `Entrada` ignora `autoFocus` em tela de toque; use `focoSempre` só
  quando faz sentido, ex.: busca).
- Modais só para coisas curtas; formulário grande vira página.
- Idiomas: português e espanhol.

**Papéis:**
- **Funcionária**: papel bem pequeno, focado em vender cabelo (modo caixa, ver o pacote para vender, sem custo).
  Estoque, triagem, compras, custos e configurações são do **administrador**. Tela/consulta nova **não** é liberada para
  funcionária por padrão (`src/core/services/permissoes.ts`: `COMANDOS_FUNCIONARIO` / `CONSULTAS_FUNCIONARIO`).

**Git:**
- O dono faz os commits ele mesmo (mensagem "att"). O Claude **não** faz commit/push sem ser pedido.

## 4. Convenções do código

- **Comandos e consultas** em `src/core/services/index.ts` são o contrato das telas e da API. Regra nova =
  serviço em `src/core/services/` + entrada no catálogo + permissão + nome em `historico.ts` (`NOMES_ACAO`) + teste.
- Tudo que muda grava auditoria (`auditar`) e movimentos (`movEstoque` com saldoAntes/saldoDepois e porNome,
  `movCaixa` por moeda, `movConta`).
- Estado da tela na URL (`useParamTela`) para links e "voltar" funcionarem.
- Peças de tela em `src/ui/` (principais: `base.tsx` com Entrada/Info/Botao/Cartao/Janela/Abas/Pagina,
  `compartilhados.tsx` com CampoCotacao/useCotacoes/conv/ValoresConvertidos, `menuAcoes.tsx` com `acoesLote`,
  `etiquetas.tsx`, `linhaTempo.tsx`, `rastreioTotal.tsx`, `historicoPacote.tsx`, `valorMoeda.tsx`).
- **Tradução**: textos em português são as chaves; o espanhol fica em `src/ui/es.ts`. Toda string nova precisa de
  entrada lá (antes da chave final `}`), conferindo se a chave já existe (com e sem aspas) para não duplicar.
- CSS global em `src/index.css` usa `:where()` (especificidade zero) para não brigar com o Tailwind.
- Testes de tela: `src/__tests__/setup.ts` usa `asyncUtilTimeout: 10000` porque a CI é lenta (já quebrou por isso).

## 5. Menu (03/11/2026)

- **Computador — Dia a dia** (segue o caminho do cabelo): Painel, Comprar, Triagem, Estoque, Vender, Caixa, Agenda.
  **Estoque e compras**: Etiquetas, Viagens, Livro do cabelo, Tabelas de preço. Depois Pessoas e Gestão.
- **Celular**: Painel, Comprar, Triagem, Vender, Caixa + Mais (Agenda e o resto no "Mais"; 7 botões não cabem em 360px).
  Definido em `src/ui/Shell.tsx` (`MENU` e `CELULAR`).

## 6. Feito nas últimas rodadas (nov/2026, ainda sem commit no momento desta nota)

- **Aviso "Nova versão disponível"**: foi para o canto de baixo; "Atualizar" força recarregar (no computador não fazia nada).
- **Teclado abrindo sozinho no celular**: corrigido em todo o sistema (`Entrada` + `ehToque()`), com teste.
- **Tooltip** fora da tela no celular: agora em portal com posição limitada à tela.
- **Modo caixa** no celular: barra de total não cobre mais o "+ mais".
- **Caixa**: lançar despesa simples (tiles Dar/Entrada/Despesa/Retirada), saldo unificado em Bs com "Ver em US$/R$"
  e cotação editável (guardada no aparelho).
- **Etiquetas** (`#/etiquetas`): tela própria com filtros (Sem etiqueta / Já impressa / Todas, compra, medida, data, busca),
  acessível do menu, do lote, do ⋯ de qualquer lote, da compra, da Triagem e do Estoque. Marca quem imprimiu e quando.
  Depois de separar aparece um cartão "N pacotes novos · sem etiqueta" (Imprimir / Depois).
  **Errou? Gerar nova**: cancela a antiga com motivo, grava no histórico e imprime a "2ª via" (mesmo código, leitura continua).
  **Na Triagem**: selo "🏷 Sem etiqueta" / "✓ Etiqueta" em cada pacote, "N sem etiqueta" + "Imprimir N",
  e em Triagens feitas "1 de 2 com etiqueta".
- **Nova compra (Cabelo e Produtos)**: seções numeradas 1 De quem · 2 O que veio · 3 Detalhes; peso e valor lado a lado;
  preço por grama; botão diz o que falta; valor em US$/R$ com cotação editável, gravado em Bs (original vai na observação);
  Produtos com quantidade × custo unitário.
- **Estoque**: linhas mais limpas (sem atributo repetido, "Veio de" com código da compra e fornecedor clicáveis, peso
  "de X" só quando mudou, status com ponto colorido, ícone de câmera no lugar de "SEM FOTO", barra de ferramentas em uma linha).
- **Livro do cabelo**: cartões Entrou/Saiu/Saldo/Perdas, botões por tipo, agrupado por dia com subtotal, cores por tipo,
  código da compra de origem certo (antes aparecia "🛒 ?"). Corrigido: compra cancelada contava como venda.
- **Tabelas de preço**: lista com faixa de preço e números em caixinhas; "Usada em" expande no lugar com as linhas
  (medida, gramas × fator, valor) e link para abrir a venda/compra.
- **Página da venda no celular**: proteções globais de largura (datas/selects/grids) para não cortar à direita.

### Rodada de 03/11/2026 (tarde)

- **Triagem**: seções numeradas (① Para separar · ② Prontos para vender) separadas por linha. "Prontos para vender" virou
  tabela (Medida | Lotes | Peso | Valor | ⋯, linha de Total); no celular a coluna Lotes vai para baixo da medida.
  Na lista "Para separar" do celular, o botão principal fica embaixo, com a largura toda ("Ver quadro" fica no ⚙).
- **Triagens feitas**: 4 números (Triagens, Entrou, Saiu, Perda %) do que está filtrado; filtros no endereço
  (`tp` período 7/30 dias/mês, `tb` busca, e em ⚙ Filtros: `tq` quem, `tc` compra, `tperda` perda acima de X%, `to` ordenar);
  uma linha por triagem (T-0001 · data · quem · bruto → líquido · perda % · pacotes · etiquetas) que abre no lugar com a
  cadeia e o rastreio.
- **Impressão de etiquetas** (`ImprimirEtiquetas`): no visual do sistema (painel à esquerda/em cima, prévia à direita,
  rodapé com o total). **Cópias de cada** (todas ou por pacote; 0 tira do papel e não marca como impressa). Papel
  Rolo 50 × 30 ou Folha A4 (**21 por folha**, 3 × 7) com prévia folha a folha e **Começar na etiqueta N** (folha já usada).
  Rodapé: "40 etiqueta(s) · 3 folhas A4 (10 + 21 + 9) · sobram 12 na última". **Limite por vez**: 210 na A4 (10 folhas) e
  200 no rolo (`LIMITE_IMPRESSAO`); acima disso o Imprimir fica desligado com o aviso. O papel escolhido fica lembrado.
- **Tela Etiquetas**: seleção em lote mais clara (Selecionar todos os filtrados · Só os sem etiqueta · Limpar, contagem e
  peso), linha marcada destacada, Shift + clique marca um intervalo no computador.
- **Comprar (celular)**: linha curta por pedido (fornecedor · total · código · etapa · "2 pendências") que abre no lugar
  (progresso, data, itens, peso, parada, pendências, "Abrir pedido →"). A tabela continua no computador. "O que falta"
  e "⚙ Etapas e regras" na mesma linha, os filtros embaixo com a largura toda.
- **Venda › De onde veio este cabelo**: só as compras desta venda; a conta da compra inteira foi para "Ver rastreio completo".
- **Conferido no navegador (item 2 da fila antiga)**: página da venda em 360 px com fonte 115–175% sem passar da tela;
  "Separar" do rodapé da separação responde ao clique de mouse; aviso de nova versão aparece no canto (build + `vite preview`)
  e "Atualizar" recarrega na versão nova. Para repetir: `.claude/launch.json` › `tudo-preview` (precisa de `--base /dia-dia-tudo/`).

## 7. O que falta (fila)

1. **Conferir num Android de verdade** (o navegador de teste só simula): fonte grande do sistema e o "Separar" com o dedo.
2. Outras telas no celular com o mesmo padrão "linha curta que abre no lugar" (Vendas, Estoque, Pessoas), se o dono pedir.
3. Pendências maiores (de [SISTEMA.md](SISTEMA.md) §7): servidor/API e sincronização entre aparelhos, segurança no servidor,
   devolução parcial de produto, leitura de QR própria para iPhone/Firefox, testes de longa duração.

## 8. Para o Claude numa conversa nova

- Comece lendo este arquivo e o [SISTEMA.md](SISTEMA.md).
- As anotações de memória do Claude ficam só no computador antigo; o essencial delas está na seção 3 acima.
- Ao terminar uma mudança: `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build` e conferir a tela em 360px e 1280px.
- Ao mudar o sistema, atualizar o [SISTEMA.md](SISTEMA.md) e este arquivo (seções 6 e 7).
