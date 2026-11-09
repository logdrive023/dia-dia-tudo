# Ecossistema de gerenciamento: desenho antes do código

**Atualizado:** 07/11/2026 · **Situação:** histórico (desenho inicial), exceto o §11 (peças padrão), que é vigente

> Entrega da etapa "antes de escrever código" do prompt: modelo de dados, contrato dos módulos, mapa de telas,
> fluxo do assistente de venda e as dúvidas que precisam da sua resposta.
> **Nada foi programado ainda.** Depois da sua aprovação começa a Fase 1.

**Armazenamento (decidido)**: **tudo salvo local** para a demonstração, com tudo pronto para trocar por uma **API**
mudando uma configuração (seção 2). **Cabelo**: ajustado pela pesquisa de mercado (seção 9).

---

## 1. Visão em uma página

```text
             ┌──────── telas (features/<domínio>, shared/ui) ──────────┐
             │  Início · Comprar · Vender · Estoque · Caixa · Agenda   │
             │  Empréstimos · Pessoas · Locais · Relatórios · Config   │
             └───────────────┬────────────────────────────────────────┘
                             │ hooks (useConsulta, useComando)
             ┌───────────────▼────────────────────────────────────────┐
             │  core/services: COMANDOS DE NEGÓCIO                     │
             │  registrarCompra, avancarTriagem, concluirVenda,        │
             │  abrirDia, lancarCaixa, criarEmprestimo, pagarParcela…  │
             └───────┬──────────────────────────────┬─────────────────┘
                     │ usa só PORTAS (interfaces)    │ pede regras aos
             ┌───────▼────────────┐         ┌───────▼─────────────────┐
             │ core/ports         │         │ modules/ (registro)     │
             │ Repos, Anexos,     │         │ cabelo · salao ·        │
             │ Sessao, Transacao  │         │ emprestimos · produtos  │
             └───────┬────────────┘         └─────────────────────────┘
        ┌────────────┼──────────────────┐
  ┌─────▼─────┐ ┌────▼──────┐ ┌─────────▼─────────┐
  │ memory    │ │ local     │ │ api (esqueleto)   │
  │ (testes)  │ │ IndexedDB │ │ fetch + OpenAPI   │
  └───────────┘ └───────────┘ └───────────────────┘
        VITE_STORAGE = memory | local | api   (padrão: local)
```

---

## 2. Armazenamento: local agora, API depois

| Decisão | Como fica |
|---|---|
| Modo atual | **demonstração, 100% no aparelho** (IndexedDB), sem login e sem servidor |
| Troca para API | implementar `adapters/api` + `VITE_STORAGE=api` + `VITE_API_URL`; telas e regras não mudam |
| Fronteira | serviços só conhecem as **portas**; importar Dexie fora de `adapters/local` **quebra o lint e um teste** |
| Tudo assíncrono | toda porta devolve `Promise`, inclusive na memória |
| Operação composta | `uow.executar(fn)`: no local é transação do IndexedDB; na API é **um comando** (`POST /v1/comandos/concluirVenda`) |
| IDs | **ULID** gerado no aparelho (ordenável por tempo, sem colisão offline) |
| Campos de servidor | todo registro: `id, empresaId, criadoEm, atualizadoEm, versao, apagadoEm?, criadoPor` (no demo `empresaId = usuarioId = "demo"`) |
| Idempotência | o id da operação nasce ao abrir o formulário e viaja como `chaveIdempotencia` |
| Fila de saída | cada comando grava um registro em `outbox` (hoje só guardado; com a API, um sincronizador envia) |
| Fronteira de dados | DTOs em JSON puro: datas em texto ISO (UTC), dinheiro/gramas inteiros, moeda em código ISO |
| Anexos | porta `AnexosStore`: `salvar → {id, mime, tamanho, hash}`, `obterUrl(id)`, `remover(id)` |
| Garantia | **mesma suíte de testes de contrato** roda em `memory`, `local` e `api` (com API simulada por MSW) |
| Extras do demo | faixa "Modo demonstração", **Carregar dados de exemplo**, **Zerar demonstração** (com "voltar como estava"), backup JSON e CSV |
| Fora do escopo agora | juntar aparelhos (a API resolve; os dados já nascem prontos para isso) |

### Portas (interfaces) principais
```ts
interface Repo<T> {
  obter(id: Id): Promise<T | undefined>
  listar(filtro: Filtro<T>, pagina?: Pagina): Promise<Resultado<T>>
  salvar(registro: T): Promise<void>          // cria ou atualiza; confere `versao`
  apagarLogico(id: Id, motivo: string): Promise<void>
}
interface UnidadeDeTrabalho { executar<R>(fn: (repos: Repos) => Promise<R>): Promise<R> }
interface AnexosStore { salvar(f: Blob, meta: MetaAnexo): Promise<Anexo>; obterUrl(id: Id): Promise<string>; remover(id: Id): Promise<void> }
interface Sessao { atual(): { empresaId: Id; usuarioId: Id; nome: string } }
interface Relogio { agora(): string }          // testes usam relógio fixo
```

---

## 3. Modelo de dados

Convenções: **dinheiro** = inteiro na menor unidade da moeda; **quantidade** = inteiro na unidade base do item
(grama, peça, minuto); campos comuns da seção 2 omitidos abaixo.

### 3.1 Núcleo
| Tabela | Campos principais | Índices (local) |
|---|---|---|
| `pessoas` | nome, telefone, documento?, papeis[] (`cliente`, `fornecedor`, `profissional`, `devedor`, `credor`), obs, `campos{}` | nome, papeis* |
| `locais` | nome, rua, numero, bairro, cidade, pais, referencia, tipo (`salao`, `ponto`, `outro`) | nome |
| `itens` | moduloId, tipoItem, nome, unidade (`grama`, `peca`, `servico`, `minuto`), controlaEstoque, precoSugerido {moeda, valor}, estoqueIdeal?, grupo?, `campos{}`, ativo | moduloId, [moduloId+tipoItem], grupo |
| `transacoes` | tipo (`compra`, `venda`), moduloId, pessoaId?, localId?, diaId, etapa (código da triagem/situação), agendadoPara?, moedaPrincipal, totalPrincipal, `campos{}`, chaveIdempotencia | diaId, tipo, etapa, pessoaId, agendadoPara, &chaveIdempotencia |
| `linhas` | transacaoId, itemId, quantidade, moeda, precoUnitario, total, profissionalId?, comissao?, `campos{}` | transacaoId, itemId, profissionalId |
| `pagamentos` | transacaoId? / parcelaId?, forma, moeda, valor, cotacaoId, valorPrincipal, conferidoEm? | transacaoId, parcelaId |
| `movEstoque` | itemId, diaId, delta (+/−), saldoAntes, saldoDepois, motivo (`compra`, `venda`, `uso`, `ajuste`, `perda`, `cancelamento`, `correcao`), origem {tipo, id}, corrigeId? | itemId, diaId, origem.id |
| `dias` | data (AAAA-MM-DD), status (`aberto`, `encerrado`), contado {moeda: valor} | &[empresaId+data], status |
| `movCaixa` | diaId, moeda, forma, delta, tipo (`venda`, `compra`, `entrada`, `despesa`, `retirada`, `dar`, `emprestimo`, `recebimento`, `estorno`, `correcao`), origem {tipo, id}, descricao | diaId, [diaId+moeda], origem.id |
| `triagem` | transacaoId, de, para, ajustes {campo: [antes, depois]}, motivo | transacaoId |
| `moedas` | codigo (BRL, PYG, USD, BOB), nome, simbolo, casas (2, 0, 2, 2), ativa | &codigo |
| `cotacoes` | de, para, taxa (inteiro × 10⁸), data, fonte (`manual`, `auto`) | [de+para+data] |
| `anexos` | dono {tipo, id}, categoria (`pedido`, `produto`, `comprovante`, `resultado`, `outro`), mime, tamanho, hash, largura, altura | dono.id, categoria |
| `arquivos` | (só no adaptador local) blob original comprimido + miniatura | — |
| `config`, `auditoria`, `outbox`, `seguranca` | como no Dia a Dia (+ `outbox`: comando, dados, chave, enviadoEm?) | — |

### 3.2 Módulo Empréstimos (tabelas próprias, registradas pelo módulo)
| Tabela | Campos |
|---|---|
| `emprestimos` | direcao (`dado`, `tomado`), pessoaId, moeda, principal, juros {tipo: `nenhum`, `simples`, `composto`, `fixo`; taxaMensal em pontos-base; valorFixo?}, inicio, situacao |
| `parcelas` | emprestimoId, numero, vencimento, valor |
| `movDivida` | emprestimoId, parcelaId?, delta, saldoAntes, saldoDepois, tipo (`principal`, `juros`, `pagamento`, `ajuste`, `correcao`) |

### 3.3 Regras que o diagnóstico confere
- estoque do item = soma de `movEstoque.delta`;
- caixa do dia por moeda = veio de ontem + soma de `movCaixa.delta` daquela moeda;
- venda: soma das linhas = soma dos pagamentos (convertidos) = movimentos de caixa ligados;
- dívida: saldo = soma de `movDivida.delta`; situação da parcela derivada dos pagamentos;
- compra só gera estoque na etapa final da triagem.

### 3.4 Conversão de moeda (regra exata)
```text
taxa = quantas unidades de PARA valem 1 unidade de DE, guardada como inteiro × 10^8
valorPara = arredonda( valorDe × taxa × 10^(casasPara − casasDe) / 10^8 )   (BigInt; meio para o par)
```
Exemplo: 100,00 USD (10000) com 1 USD = 5,43 BRL → 10000 × 543000000 / 10^8 = 54300 = **543,00 BRL**.
Exemplo PYG: 50,00 BRL (5000) com 1 BRL = 1.420 PYG → 5000 × 142000000000 × 10^(0−2) / 10^8 = **71.000 PYG**.
O pagamento guarda o `cotacaoId` usado e o valor já convertido. O passado nunca é recalculado.

---

## 4. Contrato dos módulos

Um módulo é um objeto de configuração + (opcionalmente) comandos e telas próprias. O núcleo só lê o registro.

```ts
export default defineModulo({
  id: 'cabelo',
  nome: 'Cabelo',
  icone: 'cabelo',
  tiposItem: [{
    id: 'lote', nome: 'Lote de cabelo', unidade: 'grama', controlaEstoque: true,
    campos: [   // vindos da pesquisa de mercado (seção 9)
      { id: 'comprimento', tipo: 'numero', unidade: 'cm', obrigatorio: true },        // fio mais longo
      { id: 'comprimentoMinimo', tipo: 'numero', unidade: 'cm' },                      // fio mais curto
      { id: 'origem', tipo: 'lista', opcoes: ['Brasileiro', 'Brasileiro do Sul', 'Indiano', 'Vietnamita',
          'Peruano', 'Paraguaio', 'Boliviano', 'Chinês', 'Outro'] },
      { id: 'textura', tipo: 'lista', opcoes: ['Liso', 'Liso ondulado', 'Ondulado', 'Cacheado', 'Crespo'] },
      { id: 'cor', tipo: 'lista', opcoes: ['Preto', 'Castanho escuro', 'Castanho', 'Castanho claro',
          'Loiro', 'Loiro mesclado', 'Ruivo', 'Grisalho'] },
      { id: 'quimica', tipo: 'lista', opcoes: ['Virgem', 'Tingido', 'Descolorido', 'Com química (alisado/progressiva)'] },
      { id: 'remy', tipo: 'simNao', ajuda: 'Cutícula alinhada, da raiz à ponta. Não quer dizer virgem.' },
      { id: 'limpeza', tipo: 'lista', opcoes: ['Bruto', 'Semi limpo', 'Limpo'],
        ajuda: 'Semi limpo = tirou a maior parte dos fios curtos.' },
      { id: 'formato', tipo: 'lista', opcoes: ['Rabo/mecha bruta', 'Solto', 'Tela (costurado)', 'Fita adesiva',
          'Queratina', 'Tic-tac', 'Microlink'] },
      { id: 'qualidade', tipo: 'lista', opcoes: ['A', 'B', 'C'] },
      { id: 'comprovanteOrigem', tipo: 'anexo', ajuda: 'Nota ou recibo de quem vendeu (ex.: doadora identificada).' },
    ],
  }],
  triagem: {
    etapas: ['recebido', 'em_analise', 'decisao', 'pago', 'concluido'],
    analise: ['pesar (g)', 'medir maior e menor fio (cm)', 'química', 'remy', 'limpeza', 'fotos', 'comprovante de origem'],
    ajustaveis: ['quantidade', 'total', 'campos.*'],
    avisarSem: ['comprovanteOrigem'],
    avisarParadaDias: 3,
  },
  transformacoes: [   // genérico do núcleo: consome um lote e gera outro, registrando a perda
    { id: 'limpar', de: 'Bruto', para: 'Semi limpo | Limpo', registra: 'perda em gramas' },
    { id: 'montar', de: 'Solto | Limpo', para: 'Tela | Fita | Queratina…', registra: 'perda + custo de mão de obra' },
    { id: 'colorir', registra: 'muda cor/química, custo extra' },
  ],
  venda: {
    pergunta: 'É cabelo?',
    passos: ['escolherItem', 'quantidade', 'preco', 'cliente'],
    precoExibido: 'por 100 g',     // como o mercado anuncia; guardado como total da linha
    pacotes: [50, 100, 150, 200, 300],
    saidaDeLote: 'fifo-com-escolha',
    tabelaPreco: ['origem', 'comprimento (faixa de 5 cm)', 'textura', 'cor'],
  },
  relatorios: ['estoquePorTextura', 'lucroPorGrama'],
  indicadores: ['gramasEmEstoque', 'comprasNaTriagem'],
})
```

| Módulo | Tipos de item | Triagem | Pergunta no assistente | Extras |
|---|---|---|---|---|
| Cabelo | lote (grama) | 5 etapas | É cabelo? | custo por grama, lucro por grama, perda na limpeza/montagem, tabela de preço, aviso de compra sem comprovante de origem |
| Salão | serviço (minuto) | — | É serviço? → É no salão? | agenda, profissional, comissão, uso de cabelo do estoque, **manutenção do mega hair** (lembrete de retorno) |
| Empréstimos | — | — | (área própria, não é venda) | tabelas próprias, parcelas, cobrança no WhatsApp |
| Produtos gerais (prova) | peça (com cor) | 2 etapas | É produto? | **só configuração**, nenhum código no núcleo |

---

## 5. Mapa de telas

| Área | Celular (base) | Desktop (≥ 1024 px) |
|---|---|---|
| Navegação | barra inferior: **Início, Comprar, Vender, Caixa, Mais** | barra lateral fixa com todas as áreas |
| Início | cartões empilhados: dia, totais por moeda, triagem pendente, parcelas vencendo, agenda de hoje | grade de 3 colunas com os mesmos cartões |
| Comprar | fila de triagem em abas por etapa; **+ Nova compra** | quadro em colunas por etapa (arrastar avança) + detalhe ao lado |
| Vender | assistente em passos, um por tela | assistente à esquerda, resumo da venda fixo à direita |
| Estoque | lista por módulo/tipo com começou → agora | tabela com filtros por campo (textura, comprimento…) e exportar |
| Caixa | conta do dia por moeda, total convertido, lançar dinheiro | conta + movimentos lado a lado |
| Agenda | lista do dia por profissional | grade semana × profissional |
| Empréstimos | lista por situação; detalhe com parcelas | lista + detalhe lado a lado |
| Pessoas / Locais | lista + ficha | tabela + ficha lateral |
| Relatórios | cartões por relatório | tabelas e gráficos, exportar CSV |
| Configurações | moedas e cotações, formas de pagamento, módulos ativos, demo, backup | igual, em duas colunas |
| Sempre visível | faixa "Modo demonstração" · **conversor de moedas** (botão flutuante) | idem, conversor no topo |

---

## 6. Fluxo do assistente de venda

```text
[O que você está vendendo?]  (opções vindas dos módulos ativos)
   ├─ É cabelo? ── lote (sugere o mais antigo, dá para trocar) → gramas → preço/g ou total → cliente
   ├─ É serviço? ─ qual serviço? (um ou vários)
   │      └─ É no salão? ── sim → qual endereço? → qual cliente? → o que vai fazer?
   │                                (usa cabelo do estoque? quantas gramas, de qual lote)
   │                              → quem vai atender? (comissão) → agora ou agendar?
   │                         não → cliente → local livre (opcional)
   └─ É produto? (módulo de exemplo)
            ↓
[Pagamento]  uma forma só  |  por linha    · moeda de cada pagamento · conversão na hora
            ↓
[Anexos]     foto do pedido/resultado · comprovante (pode ficar "sem comprovante")
            ↓
[Resumo] → Confirmar → recibo no WhatsApp
```
Agendado: vira atendimento na agenda (etapa `agendado`); no dia, **Atender** abre o mesmo assistente já preenchido, e
estoque/caixa só mexem ao concluir.

---

## 7. Plano de fases (com o ajuste de armazenamento)

| Fase | Entrega |
|---|---|
| 1 | Portas, adaptadores **memory** e **local**, esqueleto **api**, `createRepositories`, núcleo (pessoas, locais, itens, transações, movimentos, moedas/conversão, anexos, caixa do dia), backup, modo demo, PWA, CI publicando no GitHub Pages |
| 2 | Módulo Cabelo: triagem, lotes em gramas, venda por grama, lucro por grama |
| 3 | Módulo Salão: serviços, profissionais, agenda, atendimento, uso de cabelo |
| 4 | Módulo Empréstimos |
| 5 | Relatórios, WhatsApp, dados de exemplo completos, módulo de exemplo, OpenAPI + API simulada + testes de contrato, `SISTEMA.md`, guias "Novo módulo" e "Como ligar a API" |

---

## 8. Dúvidas e decisões (preciso da sua resposta)

Para cada uma deixei uma **sugestão**. Se concordar com todas, basta dizer "pode seguir com as sugestões".

| # | Pergunta | Sugestão |
|---|---|---|
| 1 | ~~Armazenamento~~ | **Decidido**: tudo salvo local, pronto para virar API (seção 2) |
| 2 | Gramas inteiras ou com décimos (0,1 g)? | Inteiras (o mercado vende em pacotes de 50/100 g) |
| 3 | De qual lote sai o cabelo? | O mais antigo primeiro (FIFO), com troca manual |
| 4 | Como mostrar o preço do cabelo? | **"por 100 g"**, como o mercado anuncia; o sistema guarda o total da linha (sem arredondar por grama) |
| 4a | Vocês compram de **doadoras** (rabo cortado na hora), de **fornecedores** (quilo, atacado) ou dos dois? | Os dois, com a pessoa marcada como doadora ou fornecedor |
| 4b | Vocês limpam e montam (tela, fita, queratina) ou vendem como compram? | Tem as duas opções (transformação com perda em gramas) |
| 4c | Compra **sem comprovante de origem** é bloqueada ou só avisada? | Só avisada, e fica marcada para filtrar |
| 4d | Preço muda com Pix (desconto à vista, como nas lojas)? | Desconto opcional por forma de pagamento |
| 5 | Um caixa único ou um caixa por local/salão? | Um caixa por dia, com filtro por local |
| 6 | Quais formas de pagamento existem em cada moeda? (ex.: Pix só em BRL) | BRL: dinheiro, Pix, crédito, débito · PYG/USD/BOB: dinheiro, transferência |
| 7 | Comissão do profissional: % do serviço ou valor fixo? Sai do caixa na hora? | % por serviço, só registrada (paga no fechamento) |
| 8 | Empréstimo atrasado tem multa ou juros de atraso? Parcelas iguais (Price) ou juros sobre o saldo? | Juros sobre o saldo; multa/atraso opcionais e configuráveis |
| 9 | Como digitar a cotação: "1 USD = X BRL" e "1 BRL = X PYG"? Buscar cotação automática? | Sim nesse sentido; automática opcional quando houver internet |
| 10 | Uma pessoa usa o aparelho ou várias (escolher "quem está usando")? | Uma pessoa no demo; o campo `usuarioId` já existe para depois |
| 11 | Existe diária automática (como os 150 do Dia a Dia)? | Não por padrão; pode ser ligada nas configurações |
| 12 | Nome do app e textos em espanhol já agora? | Nome provisório "Tudo"; só português, já preparado para espanhol |
| 13 | O repositório `logdrive023/dia-dia-tudo` é público? (o site e os dados de exemplo ficam públicos) | Dados de exemplo **fictícios** |
| 14 | Cabelo usado num serviço do salão é cobrado à parte ou entra no preço do serviço? | Linha separada (gramas × preço/g), podendo zerar |

---

## 9. Pesquisa: como o cabelo é comprado e vendido

> Pesquisa online de 01/11/2026. Fontes no fim. Os preços são **anúncios de varejo** (não de atacado nem de compra
> de doadora) e servem só como ordem de grandeza para os **dados de exemplo** da demonstração.

### 9.1 Como é vendido
- **Por peso + comprimento**: o anúncio padrão é "100 g · 65 cm · liso". Pacotes comuns de 50, 100, 150, 200 e 300 g;
  comprimentos de 40 a 80 cm, em passos de 5 cm.
- **O preço depende de quatro coisas juntas**: comprimento, **origem** (brasileiro/brasileiro do Sul é o mais caro;
  indiano no meio; chinês mais barato), **cor** (loiro e mesclado custam mais) e **textura** (cacheado costuma custar mais).
  Não é uma conta linear: por isso o sistema usa **tabela de preço sugerido** (origem × faixa de comprimento × textura × cor),
  e não fórmula.
- **Ordem de grandeza (varejo online, 100 g)**: indiano 65 cm ≈ R$ 370; liso 65–70 cm ≈ R$ 390–405;
  cacheado 65 cm ≈ R$ 470; vietnamita loiro 50–75 cm ≈ R$ 700–760; brasileiro 55–59 cm ≈ R$ 880; até ≈ R$ 1.340 (50 cm castanho).
- **Desconto no Pix** é comum (8% a 14%). Parcelamento no cartão também.
- **Formatos**: solto/mecha, **tela** (costurado), fita adesiva, queratina, tic-tac, microlink. A forma de aplicar muda o
  preço do serviço no salão.
- **Termos de qualidade**:
  - **Virgem** = sem química. **Remy** = cutícula alinhada da raiz à ponta (embaraça menos). Um não garante o outro.
  - **Bruto / semi limpo / limpo** = quanto dos fios curtos foi tirado. "Semi limpo" ainda tem fios de tamanhos variados.
- **Reclamações frequentes** (Reclame Aqui): cabelo diferente do anunciado e falta de orientação sobre o tipo.
  → O sistema guarda **fotos + ficha do lote** e manda a ficha junto no recibo do WhatsApp.

### 9.2 Como é comprado
- **De doadoras/vendedoras**: o cabelo é preso em rabo de cavalo e cortado acima do elástico. Avalia-se **comprimento**,
  **peso**, **química** (tingido/descolorido vale menos ou é recusado) e estado (limpo e seco). Não achei tabela pública
  de quanto se paga. Esse é o preço que **vocês** conhecem, e a tabela de compra fica configurável.
- **De fornecedores/atacado**: por quilo. Estimativas oficiais em apreensões dão R$ 2.300 a R$ 7.300/kg de cabelo bruto
  (valor estimado pela polícia/Receita, não preço de mercado).
- **Fronteira (Paraguai/Bolívia)**: há muito fluxo de cabelo por MS. Cabelo **sem comprovação de origem** e sem
  importação regular é apreendido. A Receita pede comprovação de origem no comércio. → O sistema registra o
  **comprovante de origem** em cada compra e avisa quando falta. Ele não dá orientação fiscal; confirmem com um contador.

### 9.3 O que muda no sistema
| Achado | No sistema |
|---|---|
| Venda em pacotes por peso + comprimento | lote em **gramas**, venda em pacotes ou gramas livres, preço exibido **por 100 g** |
| Preço depende de origem, comprimento, cor e textura | **tabela de preço sugerido** configurável (compra e venda separadas) |
| Bruto → limpo → tela perde peso | **transformação** (genérica no núcleo): consome um lote, gera outro e registra a perda |
| Remy ≠ virgem; limpeza; formato | campos próprios no lote, com "ⓘ" explicando cada termo |
| Fio mais longo × mais curto | dois comprimentos na triagem (maior e menor fio) |
| Reclamação "diferente do anunciado" | fotos obrigatórias na triagem e ficha do lote no recibo |
| Exigência de origem | anexo **comprovante de origem** + aviso + filtro "sem comprovante" |
| Desconto no Pix | desconto opcional por forma de pagamento |
| Mega hair dura 2–6 meses | no Salão: **lembrete de manutenção** e histórico do cabelo de cada cliente |

### 9.4 Fontes
- [Magazine Luiza: cabelos humanos para mega](https://m.magazineluiza.com.br/busca/cabelos+humanos+para+mega/) · [busca 65 cm](https://m.magazineluiza.com.br/busca/cabelo+65cm/) · [busca 100 g](https://www.magazineluiza.com.br/busca/cabelo+100gr)
- [Mercado Livre: cabelo cacheado 300 g 60 cm](https://lista.mercadolivre.com.br/cabelo-natural-cacheado-300g-60-cm) · [Haohan Hair](https://www.mercadolivre.com.br/pagina/haohanhair) · [Guia mega hair × aplique](https://www.mercadolivre.com.br/blog/diferenca-entre-mega-hair-e-aplique)
- [Luxy Hair Brasil: 100 g 55 cm indiano semi limpo](https://loja.infinitepay.io/llms/luxyhairbrasil/yxf0460-100-gramas-55-cm-liso-ondulado-indiano-cas.md)
- [Reclame Aqui: semi limpo / diferente do anunciado](https://www.reclameaqui.com.br/paris-cabelos/cabelo-mega-hair-diferente-do-anunciado-e-com-defeito_Si_Y4TrTmC4TyPPy/) · [falta de orientação sobre tipo](https://www.reclameaqui.com.br/gaby-hair/insatisfacao-com-colocacao-de-mega-hair-e-falta-de-orientacao-sobre-tipo-de-cabelo_z9I-e4Xn5WoM5FQN/)
- [Luxy Hair: o que é Remy](https://luxyhair.com/blogs/support/what-does-remy-mean) · [Bellami: Remy × não Remy](https://www.bellamihair.com/a/blog/hair-sourcing/remy-v-non-remy)
- [Idealist: doação de cabelo (corte e comprimento)](https://www.idealist.org/pt/recipes-for-action/como-doar-cabelo-para-pacientes-com-cancer) · [TCE-SP: campanha de doação](https://tce.sp.gov.br/eventos/campanha-doacao-cabelo)
- [A Crítica: 60 kg de Pedro Juan Caballero](https://acritica.net/policia/159-mechas-cabelo-apreendidas-campo-grande/) · [38 kg em Corumbá](https://acritica.net/policia/pm-apreende-38-kg-cabelo-humano-corumba/) · [Campo Grande News: 428 kg e exigência de origem](https://www.campograndenews.com.br/cidades/interior/mais-doze-sacos-de-cabelos-humanos-sao-apreendidos-na-br-419) · [Correio do Estado](https://correiodoestado.com.br/cidades/policiais-civil-e-militar-sao-presos-suspeitos-de-roubo-de-cabelo-na/417658/)
- [GetNinjas: preço de mega hair (serviço)](https://www.getninjas.com.br/moda-e-beleza/cabeleireiros/preco/mega-hair)

---

## 10. Painel (dashboard): resumo geral e visão específica

Três níveis, sempre com os **mesmos filtros** e o mesmo jeito de ler:
**Geral** (tudo do negócio) → **Por área** (Cabelo, Salão, Empréstimos, Caixa) → **Específico** (uma pessoa, um lote,
um profissional, um local, um dia). **Todo número tem "ⓘ" com exemplo e é clicável**: o toque abre a lista que forma
aquele número, e a soma da lista é igual ao número (regra testada).

### 10.1 Filtros (valem para os três níveis)
| Filtro | Opções |
|---|---|
| Período | Hoje · 7 dias · Este mês · Mês passado · Ano · Escolher datas |
| Comparar com | período anterior igual · nada |
| Moeda | **Total convertido** (moeda principal) · por moeda separada (BRL · PYG · USD · BOB) |
| Área | Todas · Cabelo · Salão · Empréstimos · (módulos novos aparecem sozinhos) |
| Local · Profissional | um ou todos |

O último filtro usado é lembrado no aparelho.

### 10.2 Nível 1 · Painel geral
| Cartão | Conta |
|---|---|
| Faturamento | soma das vendas concluídas no período (convertido) |
| Compras | soma das compras concluídas |
| Lucro bruto | vendas − custo do que saiu (cabelo pelo custo do lote; serviço − comissão) |
| Margem | lucro bruto ÷ faturamento |
| Caixa agora | total por moeda, **na mão** × **no banco** |
| A receber · A pagar | parcelas de empréstimos dados/tomados em aberto |
| Vendas · Ticket médio | quantidade e valor médio por venda |
| Atendimentos | concluídos · agendados |

Gráficos: faturamento × lucro por dia (com a comparação), faturamento **por área**, **por forma de pagamento** e **por moeda**.

**Atenção agora**: compras paradas na triagem · sem comprovante de origem · parcelas vencendo e atrasadas · estoque
abaixo do ideal · lotes parados · manutenções de mega hair atrasadas · cotação antiga · dia anterior não encerrado.

### 10.3 Nível 2 · Por área
- **Cabelo**: gramas em estoque por origem × comprimento (mapa de calor), textura, cor; valor do estoque a custo e a preço
  sugerido; comprado × vendido em gramas; custo e preço médio **por 100 g**; lucro por 100 g; % de perda; giro (dias
  parados); **funil da triagem** (quantos em cada etapa, % recusado); ranking de fornecedores/doadoras; sem comprovante.
- **Salão**: atendimentos e faturamento por serviço, local e dia da semana; ranking de profissionais com **comissão a
  pagar**; clientes novos × que voltaram; manutenções a vencer/atrasadas; gramas de cabelo usadas.
- **Empréstimos**: carteira dada × tomada, saldo em aberto, recebido no período (principal × juros), a vencer 7/30 dias,
  **atraso por faixa** (1–15 · 16–30 · 31–60 · 60+), % em atraso, ranking por pessoa com botão de cobrança.
- **Caixa e moedas**: saldo por moeda (mão × banco), entradas × saídas por tipo, despesas, cotações usadas.

### 10.4 Nível 3 · Específico (fichas)
| Ficha | O que mostra |
|---|---|
| **Pessoa** (360°) | compras, vendas, atendimentos, cabelo que colocou, empréstimos e parcelas, anexos, total, última visita |
| **Lote de cabelo** | de quem veio, triagem e fotos, transformações e perdas, para quem foi cada grama, lucro do lote |
| **Profissional** | atendimentos, faturamento, comissão por período, clientes |
| **Local** | faturamento, atendimentos e caixa daquele local |
| **Dia** | a conta do caixa, vendas, compras e movimentos |

Cada ficha tem **linha do tempo** e **Enviar resumo no WhatsApp / Exportar CSV**.

### 10.5 Telas
Celular: filtros numa janela, 2 cartões por linha, gráficos um por vez. Desktop: barra de filtros fixa, 4–6 cartões
por linha, gráficos em grade, fichas em painel lateral. Todo gráfico tem "ver como tabela".

### 10.6 Como fica genérico
Cada módulo registra seus **indicadores** no contrato (`id`, `nome`, `formato`, `ajuda` com exemplo, `calcular(filtros,
consultas)`, `detalhe` = para onde o toque leva). Um módulo novo aparece no painel sem mudar o painel. Os indicadores
gerais vêm do núcleo e já incluem qualquer módulo.

### 10.7 Pronto para a API
O painel **não lê tabelas**: ele usa a porta `ConsultasPainel` (somas, contagens, séries por dia). No local é calculada
no aparelho; com a API vira `GET /v1/painel/indicadores` e o servidor calcula. Telas e indicadores não mudam.

### 10.8 Testes
Cada indicador bate com um modelo independente; **clicar = somar** (a lista do detalhe soma o número do cartão);
comparação de períodos e moedas com relógio fixo; telas em 320 px e 1440 px.

## 11. Regras permanentes de tela (valem para toda tela nova)

### 11.1 Cabeçalho de tela (PageHeader = `Titulo` em `src/shared/ui/base.tsx`)

Um só componente; a estrutura nunca muda entre telas, só o conteúdo (título, descrição, ações).

- **Toda tela de módulo, lista ou formulário usa `Titulo`.** Nada de `<h1>` montado à mão. `Pagina` (formulários) já usa `Titulo` por dentro.
- **Título**: só texto, sem emoji, 24 px negrito. **Descrição**: uma linha curta do para que serve a tela (opcional; sem ela o bloco mantém a mesma altura mínima).
- **Ações**: todas com 44 px de altura. A principal é `Botao` cheio (ou `MenuAcoes principal="+ Nova …"` quando abre caminhos); as secundárias são `AcaoIcone` (ícone + nome + dica no hover/foco) ou `Botao` secundário.
- **Posição das ações**: celular = sempre na linha de baixo do título; tablet/computador = sempre à direita. Nunca depende do tamanho do texto.
- **Espaço**: 16 px abaixo do cabeçalho. A trilha (`Trilha`: ← Origem › Tela) fica acima, fora do cabeçalho.
- **Ficha de UMA coisa** (pacote, pedido, viagem): `CabecalhoFicha` (nome · código + situação · detalhes · valor · ações), também único.

### 11.2 Logo abaixo do cabeçalho

- **Números grandes**: `GrupoNumeros` + `NumeroGrande` (com `carregando`; tocar filtra a lista quando há filtro correspondente).
- **Pesquisa e filtros**: `FiltroLista` (busca · ⚙ Filtros → painel em grupos · resultado "N de M" + chips ✕ · "Limpar filtros"); listas longas com `Paginacao`; vazio de filtro com `VazioFiltro`.
- **Situação e período** (props do `FiltroLista`, nunca feitos à mão): `situacao={{ opcoes: [{ id, nome, n, tom? }], valor, onChange }}` → `AbasSituacao` (trilho com a escolhida branca e o número num selo; `tom: 'alerta'` pinta o número de quem pede atenção) e `periodo={{ de, ate, onChange }}` → `BotaoPeriodo` ("📅 Tudo ▾" ao lado da busca; no celular, sem filtro, só o ícone). Outra escolha de um toque ao lado da busca: `BotaoEscolha`. Tela com duas vistas (lista em tabela × cartões): `EscolhaVista` ("☰ Lista · ▦ Cartões", só os ícones no celular; a escolha fica lembrada com `useLembrado`) — usada em Preços e Viagens. Usados em Comprar, Vender, Triagem (triagens) e Livro do cabelo.

### 11.3 Listagens (`TabelaDados` em `src/shared/ui/tabelaDados.tsx` + `usePaginacao`/`Paginacao`/`Paginada` em `src/shared/ui/paginacao.tsx`)

Uma listagem nova é CONFIGURAÇÃO, não uma tabela nova:

- **Colunas** (`{ id, titulo, celula, direita?, ordenar?, classe? }`), **linhas** e `chave`; **onAbrir** (tocar na linha / Enter abre o registro); **acoes** (o ⋯, sempre na última coluna) e `acaoRapida` (um botão antes do ⋯); **ordem/onOrdenar**; **selecao** (caixas + "todos os filtrados"); `realce` (linha apagada: cancelada, esgotado); `detalhe` (linha extra embaixo); `compacta` (linhas baixas, com foto).
- **Celular — a LINHA PADRÃO**: `celular={{ titulo, valor, valorSub, codigo, situacao: {texto, tom}, alerta: {texto, tom}, progresso, fatos: [...], aberto }}`. Fechada: título · valor / [CÓDIGO] ● situação · selo do alerta / o detalhe do valor (3 kg). Aberta: progresso, os fatos em selos (📅 · 📦 · ⏱), o extra da tela e "Abrir →" + ⋯. Os mesmos selos (`SeloCodigo`, `SeloSituacao`, `SeloAlerta`) nas colunas da tabela do computador. Sem `celular`, a tabela rola de lado.
- **Selo começa com maiúscula** (`Pilula`, `SeloSituacao`, `SeloAlerta`, em PT e ES): é automático na peça (`inicialMaiuscula` em `base.tsx`) — "parado" vira "Parado", "❓ para depois" vira "❓ Para depois". Código ("v2") e número na frente ("3 kg") ficam como estão. A chave de tradução pode continuar em minúscula.
- **Foto na linha**: `celular.midia` (a miniatura do pacote, fora do botão da linha — ela é um botão próprio). Usado no Estoque.
- **Ver como (tabela × cartões)**: `cartoes={vis.cartoes}` com `const vis = useVisaoLista('tela')` (`src/shared/ui/visaoLista.tsx`). Os cartões são a MESMA linha padrão do celular em grade — nenhuma tela desenha cartão próprio. A escolha fica no ⚙ Filtros, no grupo `<GrupoVisao>` ("Como mostrar"; a tela pode juntar ali o que for de exibição, ex.: as colunas do Estoque). Lembrada por tela, no aparelho. No celular é sempre a linha padrão. Usado em Comprar, Triagem, Estoque e Vender.
- **Situação em abas**: toda lista com situações usa `FiltroLista situacao={{ opcoes: [{ id, nome, n, tom? }] }}` (o trilho do Vender), nunca um select de status no painel (seria a mesma coisa duas vezes). Estoque: Com saldo · Disponível · Parcial · Para separar · Esgotado · Todos. Triagem (fila): Todos · Parados · Juntados · Sem juntar.
- **O que é normal não aparece** na linha: nada de "✓ Completa" em toda compra nem "Sem etiqueta" em cabelo bruto (que ainda não tem etiqueta).
- **Estados**: `carregando` (linhas piscando), `erro`, `vazio` (`Vazio` = ainda não há nada; `VazioFiltro` = o filtro não achou, com "Limpar filtros").
- **Paginação**: `const pag = usePaginacao(listaFiltradaEOrdenada, { padrao: 20, reiniciar: JSON.stringify(filtros) })` → `linhas={pag.itens}` e `<Paginacao {...pag} unidade="venda(s)" />`. Página e tamanho (10/20/50/100) ficam no endereço; busca/filtros/ordem novos voltam para a página 1; página fora do fim cai na última. Lista de cartões própria (fila da Triagem, Etiquetas): `<Paginada itens=… unidade=…>{(pagina, inicio) => …}</Paginada>`.
- **Fica no módulo**: a consulta, as regras, os filtros (`FiltroLista`) e o que cada coluna mostra. Os dados são locais (paginação na tela); com a API, a mesma `usePaginacao` passa `pagina/porPagina` para a consulta.
- **Não são listagens de registros** (ficam como estão): tabelas de relatório, grade de preços, comparativos e tabelas de detalhe dentro de uma ficha.

### 11.4 Seleção em lista (`PainelSelecao` em `src/shared/ui/painelSelecao.tsx`)

Toda tela que deixa marcar itens usa o mesmo painel (Triagem, Estoque, Etiquetas…):

- Começa **minimizado**: barra fina no rodapé com o número em destaque, o peso e UM botão "Escolher o que fazer ▴" (✕ limpa).
- Aberto: linha 1 = número + "N selecionados" + ▾ minimizar + ✕; linha 2 = selos (`fatos`: ⚖ peso, 🛒 compras, 💵 custo…); linha 3 = barra das partes + "Ver os N"; chips numa faixa que rola de lado.
- **Opções** em cartões (ícone, nome, uma linha do que faz, ⓘ com exemplo; a principal em destaque; as que não valem ficam apagadas dizendo por quê). **Outras ações** à vista, cada uma com a explicação embaixo, e um ⓘ do grupo.
- Fica preso ao rodapé, na largura da coluna de conteúdo, e reserva o mesmo espaço no fim da página (nunca cobre a lista).

### 11.5 Caminho do cabelo (`CaminhoDoCabelo` em `src/shared/ui/caminhoCabelo.tsx`) — o ÚNICO histórico

Pedido, Pacote, Venda e Triagem feita usam só este (nada de "histórico" + "linha do tempo" repetidos):

- **Agora:** uma frase com a situação ("3 kg no estoque · 2 sem etiqueta · 1 venda").
- **5 etapas em lista, na ordem do negócio**: 🛒 Compra → 📦 Estoque (entra bruto) → ✂️ Triagem → 🏷 Etiqueta (cada pacote: impressa quando/por quem, ou imprimir) → 💰 Venda; ✓ já passou · "você está aqui" · tracejado = ainda vai passar. Cada etapa lista seus registros (código · o que é · quanto ›), todos à vista, o desta tela marcado; um clique abre. Triagem sem registro mostra a referência ("separado pela tabela na compra P-0002").
- **Filtro por etapa** (Tudo · Compra · Triagem · Estoque · Etiqueta · Venda) e, embaixo, o **detalhe** de cada etapa num cartão: o registro do pedido, a conta da triagem, o pacote grama a grama, as etiquetas (imprimir as que faltam) e o registro da venda.
- Vale para todos os perfis (a consulta só traz gramas, códigos e nomes). `compacto` = só as etapas (no Resumo da venda e nos cartões de lista).
- **Arquivos**: toda ficha (pedido, pacote, venda) usa a mesma aba `AbaAnexos` (cartão com contagem, "Anexar" e filtro por tipo).

### 11.6 Regras que o dono muda sem código

Regra de operação que pode ser diferente de um negócio para outro vira configuração com um ⚙ ao lado de onde ela aparece (ex.: "⚙ Mudar regras" na Triagem: juntar só da mesma etapa — ligado/desligado — e o limite da sobra pequena). A tela mostra a regra como está e o servidor respeita a mesma configuração.

### 11.7 Responsividade: o mesmo padrão em toda tela (de 240 px a tela grande)

**Larguras padrão** (`tailwind.config.js` → `screens`): sem prefixo = celular pequeno (240–359 px) · `xs` 360 (celular comum) · `sm` 640 · `md` 768 (tablet, menu ao lado) · `lg` 1024 · `xl` 1280 · `2xl` 1536. Toda tela é feita primeiro para 240 px e vai ganhando espaço — nunca o contrário.

**Duas regras que nunca quebram:**
1. **Nada sai da tela.** Só rola de lado o que foi feito para rolar (faixa de abas, chips, tabela larga), sem barra aparente.
2. **Palavra nunca parte no meio** ("Toda / s as viage / ns"). Se não cabe, a PEÇA muda (desce de linha, some o ícone, vira faixa que rola) — o texto não é espremido.

**Como (peças prontas — use em vez de inventar):**
- Texto que cresce + peça ao lado (botão, número, "passo 2 de 4"): linha `flex flex-wrap` e o texto com a classe **`linha-texto`** (`src/index.css`): nunca menos que ~12rem; sem espaço, a peça desce.
- Grade de cartões/opções: **`grid-cols-[repeat(auto-fit,minmax(min(8.5rem,100%),1fr))]`** — as colunas se acertam sozinhas pelo espaço, não pela largura da tela (funciona dentro de janela, painel lateral e tela cheia).
- Botões de escolha lado a lado (`Escolha`, idioma, Sim/Não): `flex flex-wrap` + botão **`min-w-max flex-1`** (se não cabem, descem).
- `Botao` já não fica mais estreito que a maior palavra (`min-w-min`); `Abas` sublinhadas viram faixa que rola; `NumeroGrande` tira o ícone abaixo de 360; `Titulo` tira o ícone e desce a letra abaixo de 360; `Cartao`, `Passo`, a página e o cabeçalho apertam o espaço interno abaixo de 360.
- Detalhe que só ajuda com espaço ("passo 2 de 4", ícone decorativo, contagem): `hidden sm:inline` / `hidden xs:flex` — a informação principal nunca some.
- **Proibido:** `[overflow-wrap:anywhere]` (deixa a caixa encolher até uma letra e parte as palavras); use `break-words` (só parte o que não cabe sozinho numa linha, ex.: um link enorme).
- Lista que abre dentro de cartão (ex.: `CampoCidade`): abre **no lugar** (empurra o resto), não flutuando — senão o cartão corta.

**Conferir (antes de entregar tela nova ou mexida):** `npm run dev` → **http://localhost:5174/varredura.html** abre cada tela em todas as larguras (240, 320, 360, 390, 414, 768, 1024, 1280, 1440) e lista 🔴 o que sai da tela e 🟠 palavra partida. `?rotas=viagens/novo,estoque` escolhe as telas, `?larguras=240,360` as larguras, `?so=problemas` mostra só o que tem problema. Só abre e lê (não salva nada).

### 11.8 Orientação curta da tela (`NotaTela` em `src/shared/ui/notaTela.tsx`)

Como usar a lista ou o que aquele número quer dizer: sempre `NotaTela`, logo abaixo do bloco, com o texto curto e à vista. Explicação longa continua no `Info`; dica de um campo só continua no próprio campo.
