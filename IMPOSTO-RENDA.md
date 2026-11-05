# Imposto de Renda e obrigações tributárias — Bolívia (Régimen General)

Diagnóstico que orienta o módulo **Relatórios › Imposto de Renda**. Pesquisa feita em 11/2026. O site do SIN
(impuestos.gob.bo) recusou conexões durante a pesquisa; os textos legais foram lidos em espelhos (lexivox, infoleyes) e
em fontes secundárias (boliviaimpuestos.com). Cada regra no sistema guarda a FONTE e o GRAU DE CERTEZA:
**[O]** texto oficial (espelho) · **[S]** fonte secundária · **[N]** não confirmado — precisa do contador.

> O módulo é um **demonstrativo interno de apoio**. Não é declaração ao SIN, não substitui o contador e mostra
> estimativa como estimativa.

## 1. Enquadramento da atividade

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

## 2. Impostos que se aplicam

| Imposto | O que é | Base | Alíquota | Período | Formulário | Fonte |
|---|---|---|---|---|---|---|
| **IVA** | sobre a venda de bens e serviços | preço líquido da factura | **13%** "por dentro" | mensal | **F-200** v5 (SIAT) | Ley 843 arts. 1–15 [O] |
| **IT** | sobre o ingresso bruto, dê lucro ou não | ingresso bruto do mês | **3%** | mensal | **F-400** v5 | Ley 843 arts. 72–77 [O] |
| **IUE** | sobre o lucro do ano | lucro − gastos necessários com respaldo | **25%** | anual | **F-500** | Ley 843 arts. 36–50; DS 24051 [O] |
| **Retenções em compras sem factura** (bens) | o comprador retém de quem não emite factura | valor pago | **IUE 5% + IT 3% = 8%** | mensal | **F-570** (IUE) + **F-410** (IT) | DS 24051 art. 3; DS 4850 (desde 01/01/2023) [O] |
| Retenções em serviços sem factura | — | valor pago | RC-IVA 13% + IT 3% = 16% | mensal | F-604 + F-410 | DS 4850 [O] |
| **RC-IVA** dependentes | 13% sobre salários acima de 2 SMN | salário líquido de aportes | 13% | mensal | **F-608** (empregador) | DS 21531 [O, texto desatualizado] |
| Registro de Compras y Ventas | livro digital no SIAT | todas as compras e vendas com factura | — | mensal (até sem movimento) | SIAT | RND 102100000011 [S] |
| Estados financeiros | com o IUE | balanço, resultados, notas | — | anual | digital (F-605); com parecer de auditoria acima de Bs 1.200.000 de vendas | RND 101800000004 [S] |

**Relações:**
- **Crédito fiscal IVA** só com **factura** (art. 8): cabelo comprado de pessoa sem factura **não dá crédito**.
- **IUE pago compensa o IT** dos meses seguintes até se esgotar ou até o próximo vencimento do IUE (art. 77) [O]. O que
  sobrar fica com o Estado. DS 5327/2025 exigiu IUE pago em dia; DS 5563/2026 tirou a exigência [S].
- **IT é gasto** no estado de resultados e entra na base do IUE.
- **Compra sem factura é dedutível no IUE** só com: registro contábil, cópia do CI do vendedor assinada e os
  **comprovantes das retenções pagas** (DS 24051 art. 15) [O]. A retenção que a empresa absorve (grossing-up) não é
  dedutível [S].

**Diferenças que o módulo NUNCA mistura:** faturamento (total faturado) · receita bruta (base do IT) · vendas líquidas
(sem IVA) · CMV (custo do que FOI VENDIDO, por identificação específica do lote — não as compras do período) ·
despesas dedutíveis × não dedutíveis · lucro contábil × lucro tributável.

## 3. Prazos

- **Mensais** (F-200, F-400, F-570, F-410, F-608): pelo **último dígito do NIT**, no mês seguinte — 0→13, 1→14, …,
  9→22 (DS 25619 art. 1) [O]; dia não útil passa para o próximo útil (art. 3). O SIN muda por RND de vez em quando.
- **IUE e estados financeiros:** **120 dias** depois do cierre (DS 24051 art. 39) → 30/04 para cierre em 31/12.
- **Multas** (Ley 2492): dívida em UFV + juros (art. 47); deveres formais pela RND 10-0033-16 (atualizada 2024).

## 4. Vigência e versões

As regras ficam em `src/core/dados/tributosBO.ts` como **versões** com data de início e fim (ex.: `BO-2016` até
31/12/2022 com a retenção de serviços 12,5% IUE; `BO-2023` desde 01/01/2023 com DS 4850). Cada mês usa a versão
vigente no último dia do mês; o IUE usa a do cierre. **Ao fechar o exercício, o sistema congela o resultado e a versão
usada** — um relatório de 2025 continua com as regras de 2025, mesmo que a lei mude. Mudou a lei: entra uma versão
nova (com a fonte), não se edita a antiga.

## 5. O que o sistema já tem × o que falta

| Já tem (calculado) | Falta (precisa ser informado) |
|---|---|
| vendas (data, valor, desconto, custo do lote), compras (data, fornecedor, valor), estoque e perdas, gastos do caixa por categoria, salários pagos | o **documento** de cada compra e gasto (factura · recibo com retenção · sem) e se o gasto é dedutível |
| impostos estimados de cada venda | as **declarações e pagamentos** feitos no SIAT (nº de ordem, data, valor) |
| NIT, razão social, regime | CAEB, tipo de atividade (cierre), natureza jurídica, perdas de anos anteriores |

Sem integração com o SIN, **nada é marcado como declarado ou pago sem que a pessoa registre**.

## 6. Não confirmado (para o contador)

Texto consolidado atual da Ley 843 e decretos (as alíquotas batem com fontes secundárias atuais) · se o DS 25619 segue
vigente (o calendário por dígito continua em uso) · versão atual do F-500 e o que é o F-510 · se compra de vendedor do
RTS tem retenção · texto do DS 5563 sobre dedutibilidade · valor do SMN 2026 (mínimo do RC-IVA).

## Fontes

- Ley 843 (texto ordenado): https://bolivia.infoleyes.com/norma/367/ley-843-de-reforma-tributaria-27947
- DS 24051 (IUE): https://www.lexivox.org/norms/BO-DS-24051.html · DS 25619 (vencimentos): https://www.lexivox.org/norms/BO-DS-25619.html
- DS 4850 (retenções desde 2023): https://www.lexivox.org/norms/BO-DS-N4850.html · Ley 2492: https://www.lexivox.org/norms/BO-L-2492.html
- CAEB-SIN (RND 102500000018): https://boliviaimpuestos.com/descarga-el-clasificador-de-actividades-economicas-en-excel/
- Cierre de gestión: https://boliviaimpuestos.com/fecha-de-cierre-de-empresas-en-bolivia/ · F-200/400 v5: https://boliviaimpuestos.com/formulario-200-y-400-version-5/
- Retenções: https://boliviaimpuestos.com/retenciones-tributarias-compras-sin-factura/ · DS 5563: https://boliviaimpuestos.com/ds-5563-compensacion-iue-it-eliminacion-restriccion/
- Estados financeiros: https://boliviaimpuestos.com/b/8PG · RCV: https://boliviaimpuestos.com/registro-de-compras-y-ventas-faq/
