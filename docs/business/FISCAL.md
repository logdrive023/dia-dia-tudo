# Fiscal — contabilidade, impostos e Imposto de Renda

**Atualizado:** 07/11/2026 · **Situação:** vigente

Junta o antigo `CONTABILIDADE.md` (a base dos relatórios contábeis) e o antigo `IMPOSTO-RENDA.md` (diagnóstico do
módulo **Relatórios › Imposto de Renda**). Pesquisa de 11/2026; alíquotas conferidas em 04/11/2026.

**O padrão BOLIVIANO é o motor.** O brasileiro existe e a pessoa escolhe (Configurações › Fiscal e relatórios).

| O quê | Onde no código |
|---|---|
| alíquotas e impostos vigentes (configuráveis) | `src/core/dados/impostos.ts` |
| regras tributárias versionadas (IR, retenções, prazos) | `src/core/dados/tributosBO.ts` |
| motor contábil | `src/core/services/contabilidade.ts` |
| motor do Imposto de Renda | `src/core/services/impostoRenda.ts` |
| telas | `src/features/relatorio/pages/Relatorios.tsx`, `src/features/relatorio/components/ImpostoRenda.tsx`, `src/features/config/pages/ConfigFiscal.tsx` |

> Não sou contador: este é o modelo que o sistema segue. Antes de entregar algo ao SIN ou à Receita, o contador da
> empresa deve conferir uma vez. O módulo de IR é um **demonstrativo interno de apoio**: não é declaração ao SIN, não
> substitui o contador e mostra estimativa como estimativa.

**Grau de certeza** das regras do IR (cada regra no sistema guarda a FONTE e o grau): **[O]** texto oficial (espelho) ·
**[S]** fonte secundária · **[N]** não confirmado — precisa do contador. O site do SIN (impuestos.gob.bo) recusou
conexões durante a pesquisa; os textos legais foram lidos em espelhos (lexivox, infoleyes) e em fontes secundárias
(boliviaimpuestos.com).

---

## 1. Bolívia — base legal e enquadramento

**Base contábil:** Normas de Contabilidad (CTNAC / Colegio de Auditores de Bolivia; NIIF só onde as normas não cobrem) ·
**Código de Comercio art. 37:** livros obrigatórios **Diario, Mayor e Inventarios y Balances** (feitos por sistema, saem
dele no fim da gestão — art. 40) · **Ley 843** (impostos).

**Ajuste por inflação (UFV):** o CTNAC suspendeu a reexpressão (Res. CTNAC 03/2020, desde 11/12/2020); o SIN continua
usando UFV para o IUE. O sistema apresenta em valores do período (sem reexpressão) e diz isso na nota.

### Enquadramento da atividade

| Atividade real | CAEB-SIN (RND 102500000018/2025) | Certeza |
|---|---|---|
| Venda por atacado de cabelo (extensões) | **4649400** Venta al por mayor de productos de perfumería, belleza, cosméticos y limpieza | média-baixa — não existe código que diga "cabelo humano" |
| Venda a varejo | **4772200** Venta al por menor de artículos de perfumería y cosméticos (internet: 4791100) | média-baixa |
| Salão | **9602100** Servicio de Peluquería · 9602200 tratamientos de belleza | alta |
| Fabricar perucas/apliques (só se houver transformação) | 3290200 Fabricación de … pelucas, barbas y cejas postizas | só se fabricar |

- Só **classificar, lavar e revender** o cabelo é atividade **comercial** (opinião; nenhuma norma trata disso) [N].
- **Cierre de gestión** (DS 24051 art. 39) [O]: comerciais e de serviços **31/12**; industriais 31/03; agro 30/06;
  mineração 30/09. Este negócio: **31/12** (se o NIT estiver registrado como industrial: 31/03). Em atividade mista,
  vale a atividade principal do NIT [S].
- **O contador precisa confirmar:** o código CAEB registrado no NIT, o tipo de atividade (data de cierre), a natureza
  jurídica e se a empresa é agente de retenção (pessoa jurídica ou unipersonal: sim).

## 2. Bolívia — impostos e obrigações

| Imposto | Alíquota | Base | Período · formulário | No relatório do sistema | Fonte |
|---|---|---|---|---|---|
| **IVA** (Impuesto al Valor Agregado) | **13%** "por dentro" | preço faturado (já inclui o imposto) | mensal · **F-200** v5 (SIAT) | débito fiscal (vendas faturadas) − crédito fiscal (compras com fatura) = IVA a pagar. **Fica fora da venda**: Ventas netas = faturado − IVA | Ley 843 arts. 1–15 [O] |
| **IT** (Impuesto a las Transacciones) | **3%** | ingresso bruto do mês, **sem** descontar custo, dê lucro ou não | mensal · **F-400** v5 | **gasto** no Estado de Resultados (entra na base do IUE) | Ley 843 arts. 72–77 [O] |
| **IUE** (Impuesto sobre las Utilidades de las Empresas) | **25%** | lucro − gastos necessários com respaldo | anual · **F-500** | depois da utilidade antes de impostos (provisão) | Ley 843 arts. 36–50; DS 24051 [O] |
| **RTS** (Régimen Tributario Simplificado) | cuota fija bimestral | comerciante minorista, artesano, vivandero | bimestral | uma linha de gasto; **sem** IVA/IT/IUE e sem fatura com crédito fiscal | — |
| **Retenções em compras sem factura** (bens) | **IUE 5% + IT 3% = 8%** | valor pago (o comprador retém de quem não emite factura) | mensal · **F-570** (IUE) + **F-410** (IT) | módulo de IR | DS 24051 art. 3; DS 4850 (desde 01/01/2023) [O] |
| Retenções em serviços sem factura | RC-IVA 13% + IT 3% = 16% | valor pago | mensal · F-604 + F-410 | módulo de IR | DS 4850 [O] |
| **RC-IVA** dependentes | 13% sobre salários acima de 2 SMN | salário líquido de aportes | mensal · **F-608** (empregador) | módulo de IR | DS 21531 [O, texto desatualizado] |
| Registro de Compras y Ventas | — | todas as compras e vendas com factura | mensal (até sem movimento) · livro digital no SIAT | — | RND 102100000011 [S] |
| Estados financeiros | — | balanço, resultados, notas | anual, com o IUE · digital (F-605); com parecer de auditoria acima de Bs 1.200.000 de vendas | — | RND 101800000004 [S] |

**Relações:**
- **Crédito fiscal IVA** só com **factura** (art. 8): cabelo comprado de pessoa sem factura **não dá crédito**.
- **IUE pago compensa o IT** dos meses seguintes até se esgotar ou até o próximo vencimento do IUE (art. 77) [O]. O que
  sobrar fica com o Estado. DS 5327/2025 exigiu IUE pago em dia; DS 5563/2026 tirou a exigência [S].
- **Compra sem factura é dedutível no IUE** só com: registro contábil, cópia do CI do vendedor assinada e os
  **comprovantes das retenções pagas** (DS 24051 art. 15) [O]. A retenção que a empresa absorve (grossing-up) não é
  dedutível [S].

**Diferenças que o sistema NUNCA mistura:** faturamento (total faturado) · receita bruta (base do IT) · vendas líquidas
(sem IVA) · CMV (custo do que FOI VENDIDO, por identificação específica do lote — não as compras do período) ·
despesas dedutíveis × não dedutíveis · lucro contábil × lucro tributável.

### Prazos

- **Mensais** (F-200, F-400, F-570, F-410, F-608): pelo **último dígito do NIT**, no mês seguinte — 0→13, 1→14, …,
  9→22 (DS 25619 art. 1) [O]; dia não útil passa para o próximo útil (art. 3). O SIN muda por RND de vez em quando.
- **IUE e estados financeiros:** **120 dias** depois do cierre (DS 24051 art. 39) → 30/04 para cierre em 31/12.
- **Multas** (Ley 2492): dívida em UFV + juros (art. 47); deveres formais pela RND 10-0033-16 (atualizada 2024).

## 3. Bolívia — relatórios contábeis

### Estado de Resultados (a ordem do relatório)
```text
Ventas brutas (facturado)
(−) IVA débito fiscal (13%)                ← só Régimen General com fatura
= Ventas netas
(−) Costo de ventas                         ← custo do cabelo/produto vendido (sem o crédito fiscal, se a compra teve fatura)
(−) Insumos y comisiones de servicios
= Utilidad bruta
(−) Gastos de operación (por categoria)
(−) Impuesto a las Transacciones (IT 3%)   ← ou (−) Cuota RTS
= Utilidad antes del IUE
(−) IUE estimado (25%)                      ← provisão (o pago de verdade é anual)
= Utilidad neta del período
```

### Balance General
Activo (caja por moneda, cuentas por cobrar, préstamos por cobrar, inventario a costo) · Pasivo (cuentas por pagar,
préstamos por pagar, **IVA e IT por pagar do período**) · Patrimonio = Activo − Pasivo.

## 4. Brasil (opcional — só o que muda)

**Base:** Lei 6.404/76 art. 187 e CPC 26 (R1). **Simples Nacional:** Livro Caixa obrigatório.

**A diferença que existe:** a DRE começa na **receita bruta** e os impostos sobre a venda são **dedução da receita**
(não gasto); o imposto sobre o lucro é IRPJ + CSLL.

```text
Receita bruta
(−) Deduções: impostos sobre vendas (DAS no Simples · PIS 0,65% + COFINS 3% + ICMS/ISS no Presumido), descontos
= Receita líquida
(−) CMV (custo das mercadorias vendidas)
= Lucro bruto
(−) Despesas operacionais (por categoria)
= Resultado antes do IR (LAIR)
(−) IRPJ e CSLL                              ← no Simples já estão no DAS · no Presumido ≈ 2,28% da receita (comércio)
= Lucro líquido do período
```

## 5. O relatório do sistema: "simples por fora, completo por dentro"

1. **Resumo (1 página):** Estado de Resultados (ou DRE) e Balance, no padrão escolhido.
2. **Impostos:** a conta de cada imposto (base × taxa), com o débito/crédito do IVA.
3. **Conferência:** cada total do resumo confere com o anexo dele (✓ ou ⚠ com a diferença).
4. **Anexos (cada centavo):** Libro Diario / Caixa por moeda (cada entrada e saída, com saldo), ventas línea por línea,
   compras línea por línea, inventario valorizado, cuentas por cobrar / por pagar, gastos por categoría.
5. **Impressão:** prévia em A4, cabeçalho com razão social, NIT e período, páginas numeradas e as firmas (Contador ·
   Representante legal).

**Premissas que o sistema ainda não registra por venda** (ficam na configuração e aparecem na nota): se as vendas saem
com fatura e se as compras vêm com fatura (o cabelo comprado de pessoa física normalmente vem **sem** fatura → sem
crédito fiscal).

### Imposto de Renda: o que o sistema já tem × o que falta

| Já tem (calculado) | Falta (precisa ser informado) |
|---|---|
| vendas (data, valor, desconto, custo do lote), compras (data, fornecedor, valor), estoque e perdas, gastos do caixa por categoria, salários pagos | o **documento** de cada compra e gasto (factura · recibo com retenção · sem) e se o gasto é dedutível |
| impostos estimados de cada venda | as **declarações e pagamentos** feitos no SIAT (nº de ordem, data, valor) |
| NIT, razão social, regime | CAEB, tipo de atividade (cierre), natureza jurídica, perdas de anos anteriores |

Sem integração com o SIN, **nada é marcado como declarado ou pago sem que a pessoa registre**.

## 6. Impostos nas compras e vendas (o que a pessoa vê na hora)

**Configurações › Fiscal e relatórios › Impostos nas compras e vendas** — tudo configurável:
- **Mostrar ou não** (interruptor geral): desligado, nenhum imposto aparece em compra, venda, caixa, atendimento nem no
  Painel.
- **Como mostrar** (SÓ INFORMATIVO — o preço cobrado nunca muda):
  - **Embutido no preço** (padrão, Bolívia/IVA "por dentro"): "dos Bs 60 cobrados, Bs 9,60 é imposto".
  - **Somado ao preço**: "custo final com impostos: Bs 60 + Bs 9,60 = Bs 69,60".
- **A lista de impostos vigentes** (adicionar, tirar, ligar/desligar): sigla, nome, alíquota, alíquota diferente para
  **serviço**, onde vale (venda de produto · venda de serviço · compra como crédito ou custo), **fonte legal**,
  **vigente desde**, **conferido em** e a frase que explica a conta. IVA e IT do relatório contábil saem desta lista
  (uma só fonte).
- **Onde aparece:** caixa (modo rápido), assistente de venda, atendimento na agenda, nova compra e o Painel (resultado
  antes/depois dos impostos, com filtro). Um toque abre o **detalhe** (`DetalheImpostos`): cada imposto com a alíquota
  vigente, a fonte, a conta (13% × Bs 4.100 = Bs 533) e a soma.

### Alíquotas vigentes salvas no sistema (conferidas em 04/11/2026)

| Imposto | Alíquota | Fonte | Vigente desde |
|---|---|---|---|
| 🇧🇴 IVA | 13% (por dentro) | Ley 843, arts. 1 y 15 (texto ordenado vigente) | 20/05/1986 |
| 🇧🇴 IT | 3% | Ley 843, arts. 72–77 (3% pela Ley 1606) | 01/01/1995 |
| 🇧🇴 IUE | 25% (sobre a utilidade, no relatório) | Ley 843, art. 50 (Ley 1606) | 01/01/1995 |
| 🇧🇷 DAS (Simples) | alíquota efetiva configurada (padrão 6%) | Lei Complementar 123/2006, Anexos I e III | 01/01/2018 (tabelas atuais) |

> As datas de vigência são as da lei que fixou a alíquota atual; o contador deve conferir uma vez. Mudou a lei? Troque a
> alíquota, a fonte e o "vigente desde" na lista e ponha a data de hoje em "conferido em".

## 7. Vigência e versões

- **Alíquotas da tela** (`fiscal.impostos`, em `src/core/dados/impostos.ts`): ficam salvas na configuração, com fonte,
  vigente desde e conferido em (§6).
- **Regras do IR** (`src/core/dados/tributosBO.ts`): ficam como **versões** com data de início e fim (ex.: `BO-2016` até
  31/12/2022 com a retenção de serviços 12,5% IUE; `BO-2023` desde 01/01/2023 com DS 4850). Cada mês usa a versão
  vigente no último dia do mês; o IUE usa a do cierre. **Ao fechar o exercício, o sistema congela o resultado e a
  versão usada** — um relatório de 2025 continua com as regras de 2025, mesmo que a lei mude. Mudou a lei: entra uma
  versão nova (com a fonte), não se edita a antiga.

### Sincronização futura das alíquotas (a fazer com a API)

1. **Uma tabela de alíquotas no servidor** (por país): `{ id, sigla, taxaBp, taxaServicoBp?, fonte, vigenteDesde, publicadoEm, url }`,
   mantida pela equipe a partir das fontes oficiais (SIN — impuestos.gob.bo; Receita Federal / Portal do Simples).
2. **O app consulta essa tabela** ao abrir (ou 1×/dia), como já faz com o câmbio: compara `vigenteDesde`/`taxaBp` com o
   que está salvo.
3. **Nunca troca sozinho em silêncio:** mostra um aviso "O IT mudou de 3% para X% desde dd/mm (fonte) — atualizar?";
   aceitando, grava com `conferidoEm` = hoje e fica no histórico (auditoria `salvarConfig`).
4. **O que a pessoa mudou à mão é dela:** se a alíquota local foi editada (difere do padrão e do servidor), o aviso
   mostra as duas e ela escolhe.
5. **Vendas antigas não mudam:** a estimativa é sempre pela alíquota vigente na data da operação (guardar
   `vigenteDesde` permite recalcular períodos antigos com a alíquota da época).

## 8. Não confirmado (para o contador)

Texto consolidado atual da Ley 843 e decretos (as alíquotas batem com fontes secundárias atuais) · se o DS 25619 segue
vigente (o calendário por dígito continua em uso) · versão atual do F-500 e o que é o F-510 · se compra de vendedor do
RTS tem retenção · texto do DS 5563 sobre dedutibilidade · valor do SMN 2026 (mínimo do RC-IVA).

## Fontes

**Leis e decretos (Bolívia)**
- Ley 843 (texto ordenado): https://bolivia.infoleyes.com/norma/367/ley-843-de-reforma-tributaria-27947
- DS 24051 (IUE): https://www.lexivox.org/norms/BO-DS-24051.html · DS 25619 (vencimentos): https://www.lexivox.org/norms/BO-DS-25619.html
- DS 4850 (retenções desde 2023): https://www.lexivox.org/norms/BO-DS-N4850.html · Ley 2492: https://www.lexivox.org/norms/BO-L-2492.html
- Código de Comercio art. 37: https://boliviaimpuestos.com/b/1UT · SIN RA 05-0406-92 (art. 40): https://www.impuestos.gob.bo/wp-content/uploads/2025/10/RA05-0406-92.pdf
- Resolução CTNAC 03/2020 (suspensão do AITB): https://ciencialatina.org/index.php/cienciala/article/download/3464/5250

**Contabilidade e relatórios (Bolívia)**
- HLB Bolivia — marco normativo dos estados financeiros: https://www.hlbbolivia.com/marco-normativo-para-la-preparacion-de-estados-financieros-de-proposito-general-en-bolivia/
- Estados financeiros do BNB (exemplo real de ordem das linhas): https://www.bnb.com.bo/PortalBNB/Documentos/EEFF_BNB_Publicacio%CC%81n_2024.pdf
- Utilidade contábil e tributária: https://boliviaimpuestos.com/utilidad-contable-tributaria-iue/ · UFV e a posição do SIN: https://boliviaimpuestos.com/b/5t0
- Libro de Compras y Ventas IVA: https://boliviaimpuestos.com/formato-libro-de-compras-y-ventas-iva/ · RCV: https://boliviaimpuestos.com/registro-de-compras-y-ventas-faq/
- Estados financeiros (obrigação): https://boliviaimpuestos.com/b/8PG

**Impostos, retenções e prazos (Bolívia)**
- Compensação IUE-IT: https://boliviaimpuestos.com/la-compensacion-iue-it-2025/ · DS 5563: https://boliviaimpuestos.com/ds-5563-compensacion-iue-it-eliminacion-restriccion/
- IT 3%: https://yo-facturo.com/blog/impuesto-a-las-transacciones-it-bolivia/ · RTS: https://yo-facturo.com/blog/categorias-regimen-simplificado-bolivia/
- Retenções: https://boliviaimpuestos.com/retenciones-tributarias-compras-sin-factura/
- F-200/400 v5: https://boliviaimpuestos.com/formulario-200-y-400-version-5/ · Cierre de gestión: https://boliviaimpuestos.com/fecha-de-cierre-de-empresas-en-bolivia/
- CAEB-SIN (RND 102500000018): https://boliviaimpuestos.com/descarga-el-clasificador-de-actividades-economicas-en-excel/

**Brasil**
- DRE (Lei 6.404 / CPC 26): https://www.estrategiaconcursos.com.br/blog/demonstracao-do-resultado-do-exercicio-dre/amp/ · https://blog.grancursosonline.com.br/demonstracao-do-resultado-do-exercicio-estrutura-objetivo-e-importancia-contabil/
- Livro Caixa no Simples: https://jornalcontabil.com.br/noticia/simples-nacional-entenda-a-obrigatoriedade-do-livro-caixa/amp/
