# Continuar daqui (passagem de bastão)

> Leia este arquivo primeiro ao abrir o projeto em outro computador ou numa conversa nova com o Claude.
> Ele junta o que não está óbvio no código: como o dono quer as coisas, o que foi feito por último e o que falta.
> Detalhes de regra de negócio e arquitetura estão em [SISTEMA.md](docs/architecture/SISTEMA.md) (fonte principal);
> visão do fluxo compra → triagem → venda em [PROMPT-compra-triagem-venda.md](docs/business/PROMPT-compra-triagem-venda.md);
> desenho original em [DESENHO.md](docs/architecture/DESENHO.md) (§11: peças padrão das telas);
> impostos e relatórios em [FISCAL.md](docs/business/FISCAL.md);
> auditoria de usabilidade em [AUDITORIA-USABILIDADE.md](docs/audit/AUDITORIA-USABILIDADE.md).
> O plano da API (banco, rotas, login, perfis, QR) está em `DIAGNOSTICO-API.md` — **fica só neste computador**
> (está no `.gitignore`); copie à mão se for trabalhar em outro.
>
> Atualizado em 05/11/2026.

---

## 1. O que é

**Tudo**: sistema de gestão para comércio de cabelo **por gramas** (compra, triagem/separação, estoque, venda pela
tabela de preço), salão (agenda, equipe, comissões), caixa e turnos, contas de pessoas, empréstimos, viagens de compra, produtos,
relatórios no padrão boliviano (IVA, IT, IUE) e a vitrine para compradores. O negócio é na **Bolívia** (moeda Bs);
vai ser usado pela família da namorada do dono — funcionárias falam espanhol.

- React 18 + TypeScript strict + Vite 5 + Tailwind 3 + PWA (vite-plugin-pwa, `registerType: 'prompt'`).
- Local-first: IndexedDB com Dexie 4 (schema v5). Pronto para virar API trocando `VITE_STORAGE=api` + `VITE_API_URL`
  (envelope criptografado `/v1/k` e `/v1/r`; contrato em `api-contract/openapi.yaml`).
- Testes: Vitest + fake-indexeddb + Testing Library (85 arquivos, 390 testes em 05/11/2026).
- Contrato: 92 comandos e 104 consultas (`node scripts/contrato.mjs` regenera `api-contract/`).
- **Simular internet**: o backend no aparelho espera 500 ms por chamada (`src/adapters/api/simularApi.ts`, `ATRASO_PADRAO`;
  Configurações › Dados › Simular internet) para as telas já se comportarem como com o servidor.
- **Senha de acesso da demonstração** (o site é público): só o hash SHA-256 fica em `src/features/acesso/model/acesso.ts`.
  Senhas de usuários: só hash com sal — nem o admin vê a senha de ninguém (ele usa "Gerar senha").
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
- **Celular é obrigatório**: lista = linha curta (quem · valor · código · situação) que abre no lugar; botão principal
  com a largura toda embaixo; nada de vários selos na mesma linha. O dono manda print quando fica "muita coisa junto".
- **Peças padrão, nunca à mão**: lista = `Titulo` + `GrupoNumeros`/`NumeroGrande` + `FiltroLista` + `TabelaDados`
  (no celular a prop `celular={{ titulo, valor, codigo, situacao, … }}`). Cadastro = `JanelaCadastro` + `GrupoCampos`.
  Liga/desliga = `Interruptor`/`Chave`. Carregar = `Carregando`. Faltou algo → aumentar a peça central (docs/architecture/DESENHO.md §11).
- **Cada informação aparece uma vez**; recomendar primeiro (dizer a opção recomendada antes das outras); não inventar
  dado (taxa de imposto nunca inventada: vem de fonte em `docs/business/FISCAL.md`, configurável).
- **Lógica nos serviços** (`src/core/services/`), a tela só mostra.
- **Novidades em PT e ES**: ao fechar uma rodada, entrada no topo de `src/features/novidades/model/novidades.ts` com cada texto `{ pt, es }`
  já escrito nas duas línguas (`novidades.test.ts` falha se o espanhol faltar).

**Papéis:**
- **Funcionária**: papel bem pequeno, focado em vender cabelo. Entra em **espanhol** (`funcionariaIdioma`, padrão `es`)
  e vê no padrão só **Vender, Agenda, Equipe e Configurações básicas**; o resto o admin liga em
  Configurações › O que a funcionária faz (`funcionariaTelas`, `funcionariaConfig`, `funcionariaAgenda`,
  `funcionariaNaoVende`). Pode trocar tema e idioma no aparelho dela.
- **"A funcionária NÃO PODE DE NENHUMA FORMA ver o que não pode"**: além de quais consultas ela chama
  (`permissoes.ts`: `COMANDOS_FUNCIONARIO` / `CONSULTAS_FUNCIONARIO`), o filtro central `visibilidade.ts`
  (`antesDaConsulta` / `depoisDaConsulta` / `antesDoComando`, `SENSIVEIS`, `exigirTelaLiberada`) decide **de quem** é o
  registro e **que campos** saem (sem custo, lucro, fornecedor, salário, comissão das colegas). Gerente vê os subordinados.
  Teste: `funcionariaNaoVe.test.ts`. Tela/consulta nova **não** é liberada para funcionária por padrão. Tudo o que ela
  faz (e o que é recusado) vai para a auditoria.
- Limite conhecido: sem servidor, a sessão fica no `localStorage` e os dados ficam só no aparelho (nada é compartilhado
  entre aparelhos). Proteção de verdade e sincronização só com a API.

**Git:**
- O dono faz os commits ele mesmo (mensagem "att"). O Claude **não** faz commit/push sem ser pedido.

## 4. Convenções do código

- **Comandos e consultas** em `src/core/services/index.ts` são o contrato das telas e da API. Regra nova =
  serviço em `src/core/services/` + entrada no catálogo + permissão + nome em `historico.ts` (`NOMES_ACAO`) + teste.
- Tudo que muda grava auditoria (`auditar`) e movimentos (`movEstoque` com saldoAntes/saldoDepois e porNome,
  `movCaixa` por moeda, `movConta`).
- Estado da tela na URL (`useParamTela`) para links e "voltar" funcionarem.
- Peças de tela em `src/shared/ui/` (principais: `base.tsx` com Entrada/Info/Botao/Cartao/Janela/Abas/Pagina,
  `compartilhados.tsx` com CampoCotacao/useCotacoes/conv/ValoresConvertidos, `menuAcoes.tsx` com `acoesLote`,
  `etiquetas.tsx`, `linhaTempo.tsx`, `rastreioTotal.tsx`, `historicoPacote.tsx`, `valorMoeda.tsx`).
- **Tradução**: textos em português são as chaves; o espanhol fica em `src/shared/ui/es.ts`. Toda string nova precisa de
  entrada lá (antes da chave final `}`), conferindo se a chave já existe (com e sem aspas) para não duplicar.
- **Tela = orquestrador** (refatoração de 05/11/2026): o arquivo `src/features/<dominio>/pages/X.tsx` só organiza; as seções ficam
  na subpasta da tela (`painel/`, `triagem/`, `caixa/`, `venda/`, `viagem/`, `estoque/`, `lote/`, `precos/`,
  `compra/`), cada uma recebendo os dados por props. O que as peças de uma tela dividem fica num arquivo comum da
  subpasta (`comum.ts`, `tipos.ts`, `caixaDia.ts`). Contas que a tela mostra vão para função pura (ex.:
  `painel/calculos.ts`), e os dados da tela num hook (ex.: `painel/usePainel.ts`: estado + consultas). Os nomes
  antigos continuam exportados de `Estoque.tsx` e `Comprar.tsx` (App e testes importam de lá).
- **Peças comuns dos serviços** em `contexto.ts`: `ehAdmin`, `euPessoa`, `ehEquipe`, `conversorPara`/
  `conversorPrincipal` (relatório: moeda sem cotação vale 0; para gravar operação use `paraPrincipal`). Datas:
  `dataCurta` ("05/11") e `dataComAno` ("05/11/2026") em `core/domain/datas.ts`. Media query: `useMidia`
  (`ui/midia.ts`). Não recriar essas contas dentro de serviço ou tela.
- **Arquitetura por domínio** (06/11/2026): `src/app` · `src/features/<dominio>` (19 domínios, `index.ts` público) ·
  `src/shared` · `src/core` · `src/adapters` — regras e mapa em [ARQUITETURA.md](docs/architecture/ARQUITETURA.md), testadas em
  `src/__tests__/arquitetura.test.ts`. Validação proporcional ao risco: `npm run validar` (política no CLAUDE.md).
- **Tipos em 3 projetos** (`tsc -b`, 06/11/2026): `tsconfig.app.json` (o app: só tipos do navegador e do Vite —
  usar `process`/Node no app dá erro), `tsconfig.test.json` (`src/__tests__` e `caos/`, usa o resultado do app),
  `tsconfig.node.json` (`vite.config.ts`, `vitest.caos.config.ts`); regras comuns em `tsconfig.base.json`, solução
  em `tsconfig.json`. Cache em `node_modules/.cache/tsc` (`npm run tipos:zerar` limpa). O deploy guarda esse cache.
- CSS global em `src/index.css` usa `:where()` (especificidade zero) para não brigar com o Tailwind.
- Testes de tela: `src/__tests__/setup.ts` usa `asyncUtilTimeout: 10000` porque a CI é lenta (já quebrou por isso).

## 5. Menu (05/11/2026)

Definido em `src/app/Shell.tsx` (`MENU` e `CELULAR`), em blocos por área, cada um com a sua cor:
- **Principal** (sempre aberto): Painel, Comprar, Triagem, Estoque, Etiquetas, Vender.
- **Dinheiro e agenda**: Caixa, Agenda. **Cabelo**: Viagens, Minha vitrine, Livro do cabelo, Tabelas de preço.
- **Pessoas**: Pessoas e contas, Equipe e unidades, Empréstimos, Adiantamentos.
- **Gestão**: Relatórios, Configurações (abre a sublista das 6 áreas: Negócio, Pessoas e acesso, Dinheiro e impostos,
  Compras, Estoque e triagem, Sistema), Auditoria, Novidades.
- **Celular**: Painel · Comprar · Triagem · Estoque · Vender + Mais.
- Endereços sem tela caem na **tela 404** (`NaoEncontrada.tsx`). `#/loja` = página pública da vitrine; `#/q/<código>` =
  QR da etiqueta.

## 6. Feito nas últimas rodadas

### Rodada de 07/11/2026 — servidor Go (começo)

- **Backend** em `../dia-dia-tudo-backend` (Go, Clean Architecture): fala o MESMO canal cifrado do app (`/v1/k`,
  `/v1/r`); SQLite ou Postgres (Docker), migrações automáticas; só **Unidades** portada (o modelo). Gerador de
  funcionalidade nova e scripts prontos — ver `README.md` e `CLAUDE.md` de lá.
- **Chave de teste** Configurações › Dados › *Onde ficam os dados* (só em desenvolvimento ou com
  `VITE_PERMITIR_TROCAR_DADOS=1`): aparelho × servidor (`src/adapters/modoDados.ts`, lida em `app/criarBackend.ts`).
- **Ponta a ponta** (`ponta-a-ponta/`, `npm run test:ponta`): o `BackendApi` de verdade contra o servidor Go.
- **Falta** (fila do backend): rodar o ponta a ponta no Postgres (precisa do Docker Desktop aberto), portar as outras
  funcionalidades, backup/arquivos, visibilidade da funcionária, sessões/idempotência fora da memória.

### Rodadas de 04 e 05/11/2026 (a última ainda sem commit no momento desta nota)

O texto para quem usa está em Novidades (`src/features/novidades/model/novidades.ts`); aqui vai o que importa para quem mexe no código.

- **Impostos e relatórios no padrão boliviano** (`docs/business/FISCAL.md`, taxas em `src/core/dados/impostos.ts`, motor
  `src/core/services/contabilidade.ts`): IVA e IT informativos na venda e na compra (nunca mudam o preço), gravados no
  histórico; estados financeiros com folha A4; DRE do Brasil como opção. Configurações › Fiscal em abas.
- **Imposto de Renda** (aba em Relatórios, `docs/business/FISCAL.md`): exercício fiscal inteiro, retenção de 8% (IUE 5% + IT 3%)
  na compra sem factura, documento anual e fechamento que congela os números.
- **Nota de venta**: o Resumo da venda é a nota (folha ou rolo 80 mm), sem validade fiscal; o caminho do cabelo foi para
  o Histórico.
- **Auditoria** (Gestão, só admin): log bruto de toda ação, com tentativas recusadas.
- **Configurações**: 6 áreas; cadastros no mesmo formato (`JanelaCadastro`); formas de pagamento que desligam
  (`FormaPagamento.desligada`: some da venda/compra/caixa, histórico fica); moedas e câmbio numa tela; tema e idioma
  num seletor só no cabeçalho (`PreferenciasCabecalho`).
- **Entrar** novo: "Esqueceu a senha?", modo de teste separado, senha com regra (8+, letra e número/especial) e olho
  (`SenhaInput`); o admin gera senha, não vê.
- **O que a funcionária faz** (Configurações): interruptores por tela, venda, agenda, seções de configuração (ver §3).
  O filtro respeita os papéis (gerente vê os subordinados).
- **Viagens**: 340 cidades da Bolívia, aviso de viagem repetida, Relatórios › Viagens (custo do kg por viagem e uma
  contra a outra).
- **Turno com conferência cega** (`turnos.ts`, `features/caixa/components/Turno.tsx`): cada pessoa conta o efectivo sem ver o
  esperado; diferença no nome dela; Caixa › Turnos para o admin.
- **Alerta de venda abaixo do custo** (`custoDaVenda` em `vendas.ts`, `AvisoAbaixoDoCusto`/`useAbaixoDoCusto`): pede
  confirmação e audita `vendaAbaixoDoCusto`; a funcionária vê o aviso, não o custo. Venda grava a vendedora.
- **Reposição** (Relatórios, `reposicao.ts`): por medida, quanto tem, vende por dia, quando acaba, quanto comprar.
- **Metas do mês** (`metas.ts`, `ui/metas.tsx`, `config/Metas.tsx`): empresa/unidade/pessoa, totalmente configuráveis.
- **Minha vitrine** (`vitrine.ts`, `Vitrine.tsx`, `Loja.tsx`): pacotes prontos com etiqueta numa página de loja com
  "Quero este" no WhatsApp; só dados públicos (nunca custo/fornecedor). Hoje abre no aparelho; com a API vira link público.
- **Bruto que juntou com outro**: `pacotesFinais` (`leitura.ts`) segue a cadeia da triagem até os pacotes finais
  ("passou por L-…") no caixa e no estoque.
- **QR da etiqueta seguro** (`DIAGNOSTICO-API.md` §12): o QR leva só um código aleatório de 16 caracteres (`Item.qr`,
  `novoCodigoQr`), endereço `#/q/<código>` → `AbrirQr.tsx` → `pacoteDoQr`. Sem login: página neutra
  (`EtiquetaInterna`), sem usuários de teste e sem montar dados de exemplo. **Reimprimir (nova via) troca o código**
  e o QR velho para de abrir; imprimir de novo a mesma etiqueta mantém. O código nasce em `prepararQrEtiquetas` ao
  abrir a janela de imprimir (admin). QR antigo `#/lotes/<id>` continua abrindo para quem entrou. Testes:
  `qrEtiqueta.test.ts`, `qrSemLogin.test.tsx`. **Ainda sem entrada em Novidades e sem conferir no navegador.**
- **Dados de exemplo** cobrem todos os cenários (viagens, turnos, vitrine, metas, QR novo…); `Carregando` animado e
  telas com transição suave; tela 404.

### Rodadas de 03/11/2026

- **Aviso "Nova versão disponível"**: foi para o canto de baixo; "Atualizar" força recarregar (no computador não fazia nada).
- **Teclado abrindo sozinho no celular**: corrigido em todo o sistema (`Entrada` + `ehToque()`), com teste.
- **Tooltip** fora da tela no celular: agora em portal com posição limitada à tela.
- **Modo caixa** no celular: barra de total não cobre mais o "+ mais".
- **Caixa**: lançar despesa simples (tiles Dar/Entrada/Despesa/Retirada), saldo unificado em Bs com "Ver em US$/R$"
  e cotação editável (guardada no aparelho).
- **Etiquetas** (`#/etiquetas`): tela própria com filtros (Sem etiqueta / Já impressa / Todas, compra, medida, data, busca),
  acessível do menu, do lote, do ⋯ de qualquer lote, da compra, da Triagem e do Estoque. Marca quem imprimiu e quando.
  Depois de separar aparece um cartão "N pacotes novos · sem etiqueta" (Imprimir / Depois).
  **Errou? Gerar nova**: cancela a antiga com motivo, grava no histórico e imprime a "2ª via" (mesmo código L-…; desde
  05/11 o QR da 2ª via é novo e o da cancelada para de abrir).
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

### Rodada de 03/11/2026 (noite) — fluxo principal no celular

- **Backtest no celular (360 px)**: comprar → separar → etiqueta → vender. Achados e corrigidos:
  - separação: cada parte mostrava 8 campos → agora Peso + Medida + Categoria + Cor à vista, o resto em "+ mais"
    (`CamposDinamicos` ganhou `principais`);
  - depois de separar ia para o bruto zerado (0 g · Esgotado) → vai para a Triagem (ou para o pacote, se for 1 só);
  - **bug**: modo caixa com `?lote=` dizia "Pacote não encontrado" (o estoque vazio contava como carregado) → corrigido;
  - "Vender" na página do pacote abre o **modo caixa** com o pacote dentro (total na hora, fecha em 2 toques);
  - atalhos de teclado do modo caixa só no computador.
- **Triagem com abas de verdade**: ⏳ Para separar · ✅ Prontos · ❓ Para depois · ✂️ Triagens feitas (`?aba=`; endereços
  antigos `?f=pronto` / `?f=depois` caem na aba certa). Prontos: lote numa linha (código · peso · valor · 💰), filtros atrás de ⚙.
- **Página do pacote** segmentada: "Este pacote já foi separado → L-0025 · L-0026" primeiro; Números · Origem e destino ·
  Detalhes; bruto só separado não mostra "vendido 0 / lucro 0".
- **Etiquetas**: filtros por compra, lote (ou de origem), fornecedor/cliente, quem gerou, quem imprimiu, medida, atributos
  do cabelo (listas) e peso; `estoque` devolve `criadoPorNome`.
- **Filtro padrão** (`src/shared/ui/filtroPadrao.tsx`): `BarraFiltros` (busca + ⚙ Filtros · N), `ChipsFiltros` (✕ por filtro),
  `PainelFiltros` + `GrupoFiltro` (blocos com título/ícone, 2 por linha no celular) + `CampoFaixa`, rodapé "Ver N resultados".
  **Já usado em Etiquetas.** Toda lista nova deve usar.
- **Tooltip (`Info`) com formato padrão**: frases em linhas ("Termo: descrição" com termo em negrito); exemplo em caixa
  (" · " vira etiquetas, "… = X" destaca o resultado); frases depois do exemplo viram "💡 dica".
- **Livro do cabelo**: cada dia é um bloco (fecha/abre), "Fechar todos os dias", modo **Compacto** (lembrado), fechamento
  por compra recolhível.
- **Comprar**: tabela com "O que falta" resumido ("○ 2 pendências ›") que abre uma linha embaixo; celular já era lista.
- **Tema claro/escuro/automático** em Configurações (ao lado do idioma), por aparelho (`src/shared/ui/tema.ts`, `data-tema` no `<html>`).

### Rodada de 03/11/2026 (madrugada)

- **Menu**: grupo **Principal** sempre aberto (Painel, Comprar, Triagem, Estoque, Etiquetas, Vender); Dinheiro e agenda ·
  Cabelo · Pessoas · Gestão começam fechados (`menu.gruposAbertos`). Celular: Painel · Comprar · Triagem · Estoque · Vender + Mais.
- **Novidades** (`#/novidades`, menu Gestão): changelog para quem usa. Conteúdo em `src/features/novidades/model/novidades.ts` —
  **a cada rodada, uma entrada nova no topo**.
- **Compra "Sem valor"** (checkbox em "O que veio"): registra só o peso (total 0, `campos.semValor`) e fica a pendência
  `semValor` ("Sem valor") até pôr o valor.
- **Pedido em abas**: Resumo (`ItensCompra` + `DestinoCompra`: barra, números e pacotes), Pagamento (etapas; cancelar
  concluída vira confirmação com motivo), Conta do fornecedor, Anexos, Histórico.
- **Pacote em abas**: Resumo = `VidaDoPacote` (🛒 → ✂️ → 🏷 → 💰, cada passo clicável) + números; Detalhes = Linha da vida
  (`src/shared/ui/linhaVida.tsx`, timeline com gramas por passo) + atributos; Histórico (dias em blocos, ícone/cor por tipo,
  referência obrigatória à vista); Arquivos. ⓘ ao lado da situação explica Bruto · Preparando · Não identificado ·
  Disponível · Parcial · Esgotado.
- **Venda em abas**: total e ações no alto; Resumo · Linha do tempo · Arquivos · Correções. Linha do tempo (todas) mostra
  "↗ referência" em cada evento.
- **Arquivos** (pacote, venda, pedido): busca + tipo e lista em tabela (arquivo · tipo · data · quem). Foto: 🗑 no visor.
- **Etiqueta "Outro tamanho"** (largura × altura em mm): QR, letra, foto e barras proporcionais; aviso se o QR < 15 mm.
- **Triagem**: filtro padrão nas abas Para separar / Para depois (fornecedor, compra, parado há N dias, etiqueta); total
  dos Prontos em destaque; ⚙ explica cada opção (o que muda e para quem).
- **Modo caixa**: com "+ mais" aberto, a barra do total vem depois dos campos (não cobre).
- **Equipe**: organograma minimalista (cartões com atendimentos e faturado; celular em lista por níveis).
- **Abas** (`Abas` sublinhado): até 4 dividem a largura e quebram a linha; mais que isso rolam sem barra.

## 7. O que falta (fila)

Já feito da fila antiga: filtro padrão nas listas (Estoque, Livro, Vendas, Triagem, Tabelas de preço e "Usada em"…),
Tabelas de preço refeitas e relatórios no padrão contábil boliviano.

1. **QR seguro**: escrever a entrada em Novidades (PT + ES) e conferir no navegador: ler o QR sem login (página
   neutra), logado (abre o pacote), reimprimir (QR velho dá "etiqueta antiga") e o caixa achando pelo QR novo e antigo.
2. **Commit** da rodada de 05/11 (o dono faz, mensagem "att").
3. **Funcionária na Compra e na Triagem**: hoje não tem interruptor para liberar (não foi pedido; avisar se pedirem).
4. **Configurações**: explicar em cada seção o que muda na prática quando altera (como foi feito no ⚙ da Triagem).
5. **Conferir num Android de verdade**: fonte grande do sistema e o "Separar" com o dedo.
6. **Servidor/API** (plano em `DIAGNOSTICO-API.md`: tabelas, rotas, login e perfis vindos do banco §10–11, QR §12):
   sincronização entre aparelhos, vitrine com link público, segurança de verdade. O front já chama tudo pelo contrato;
   entra um adaptador novo (`src/adapters/api/backendHttp.ts`, plano no §6.1), ao lado do atual `backendApi.ts`.
7. Pendências menores de [SISTEMA.md](docs/architecture/SISTEMA.md) §7: devolução parcial de produto, leitura de QR própria para
   iPhone/Firefox, testes de longa duração.

**Achados da refatoração de 05/11/2026 (avaliados, ainda não feitos):**

8. **Fuso horário da empresa na configuração** (médio, ~2–3 h com testes). Hoje não existe fuso: o "que dia é hoje"
   vem do relógio do aparelho (`dataLocal()`, `relogio.hoje()`) e alguns lugares cortam o horário em UTC.
   - Bug: horário UTC cortado com `slice(0, 10)` → na Bolívia (UTC−4), depois das 20h, aparece o dia seguinte. Casos
     achados: `dataComAno(i.criadoEm)` em `codigos.ts` ("no estoque desde"), `dataComAno(ctx.relogio.agora())` em
     `triagem.ts` (registro de "triagem desfeita") e o "N hoje" das Etiquetas (`toISOString().slice(0, 10)`); cerca
     de 8 lugares no total.
   - Brasil está 1 h à frente da Bolívia: quem abre do Brasil entre 0h e 1h lança no dia seguinte do caixa boliviano.
   - Proposta: campo **"Fuso horário da empresa"** em Configurações › Geral (padrão `America/La_Paz`) e uma função só
     para "que dia é hoje" e "de que dia é este horário" usando esse fuso; apontar os ~40 lugares para ela (20
     `dataLocal()`, 61 `relogio.hoje()` passam pelo relógio, 8 `toISOString().slice(0, 10)`, 18 `toLocale…`). Combina
     com o DDL da API, que já usa `America/La_Paz`.
9. ~~Botão ⓘ dentro do botão do faturamento no Painel~~ — **feito em 05/11/2026**: o bloco do faturamento
   (`painel/VisaoGeral.tsx`) virou `div` com papel de botão (o mesmo padrão do `NumeroGrande`), abre com Enter/Espaço;
   o ⓘ abre a explicação sem navegar.
10. **3 ciclos de import antigos** (listados em `src/__tests__/arquitetura.test.ts`, que barra ciclo novo):
    `core/services/estoque ↔ fotos`, `core/services/comissoes ↔ financiamentos` e o registro das Configurações
    (`features/config`: `configSecoes` aponta para os componentes e `Funcionaria` lista o registro — separar os dados
    da seção do componente). O de `precos` foi resolvido em 06/11 (`precos/model/situacao.ts`).
11. **ESLint enxuto** (vale a pena): só as regras dos hooks (ordem dos hooks como erro; dependências dos efeitos como
    aviso). Teria pego o bug de hooks de Comprar; a Venda rápida já tem 2 `eslint-disable`. Sem regras de estilo.
    Precisa baixar 2–3 pacotes de desenvolvimento do npm: pedir confirmação ao dono antes.
12. ~~Divisão por dentro de Nova compra e Venda rápida~~ — **feito em 06/11/2026**: `compra/hooks/useNovaCompra` + `compra/components/LinhaCompra`; `caixa/hooks/useModoCaixa` + `caixa/components/VendasEmAberto`.

## 8. Para o Claude numa conversa nova

- Comece lendo este arquivo e o [SISTEMA.md](docs/architecture/SISTEMA.md).
- As anotações de memória do Claude ficam só no computador antigo; o essencial delas está na seção 3 acima.
- **Conferir rápido** (o dono reclamou do build e da suíte a cada passo): enquanto mexe, `npm run tipos` (`tsc -b` com
  cache: ~2–8 s; frio ou mexendo em `core/domain/tipos.ts` ~30 s; `npm run tipos:vigiar` reconfere em ~3 s a cada
  salvar) e `npm run test:rapido` (~45 s, só serviços); a suíte toda (`npx vitest run`) e `npm run build` **uma vez no fim** da
  entrega. Celular: uma chamada a `varredura.html?rotas=<telas>&larguras=320,360,390&so=problemas` (resultado em
  `window.__resultado`) + no máximo 1–2 capturas.
- Não gravar nos dados de demonstração do navegador do dono: usar outra aba/porta (ex.: `http://127.0.0.1:5174`).
- Comando ou consulta novo: `node scripts/contrato.mjs` para regenerar o contrato.
- Ao mudar o sistema, atualizar o [SISTEMA.md](docs/architecture/SISTEMA.md) e este arquivo (seções 6 e 7).
