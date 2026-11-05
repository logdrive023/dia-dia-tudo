# Contabilidade e impostos — a base dos relatórios

**O padrão BOLIVIANO é o motor.** O brasileiro existe e a pessoa escolhe (Configurações › Fiscal e relatórios). Os valores e as taxas ficam em `src/core/dados/impostos.ts`; o motor está em `src/core/services/contabilidade.ts`; a tela em `src/screens/Relatorios.tsx` e a impressão em `src/screens/relatorio/`.

> Não sou contador: este é o modelo que o sistema segue. Antes de entregar algo ao SIN ou à Receita, o contador da empresa deve conferir uma vez.

---

## 🇧🇴 Bolívia (padrão)

**Base:** Normas de Contabilidad (CTNAC / Colegio de Auditores de Bolivia; NIIF só onde as normas não cobrem) · **Código de Comercio art. 37:** livros obrigatórios **Diario, Mayor e Inventarios y Balances** (feitos por sistema, saem dele no fim da gestão — art. 40) · **Ley 843** (impostos).

### Impostos usados
| Imposto | Quanto | Sobre o quê | Onde aparece |
|---|---|---|---|
| **IVA** (Impuesto al Valor Agregado) | **13%** "por dentro" | preço faturado (já inclui o imposto) | débito fiscal (vendas faturadas) − crédito fiscal (compras com fatura) = IVA a pagar. **Fica fora da venda**: Ventas netas = faturado − IVA |
| **IT** (Impuesto a las Transacciones) | **3%** | ingresso bruto, **sem** descontar custo | **gasto** no Estado de Resultados |
| **IUE** (Impuesto sobre las Utilidades de las Empresas) | **25%** | utilidade do exercício | depois da utilidade antes de impostos. Anual; o IUE pago **compensa o IT** dos períodos seguintes |
| **RTS** (Régimen Tributario Simplificado) | cuota fija bimestral | comerciante minorista, artesano, vivandero | uma linha de gasto; **sem** IVA/IT/IUE e sem fatura com crédito fiscal |

**Ajuste por inflação (UFV):** o CTNAC suspendeu a reexpressão (Res. CTNAC 03/2020, desde 11/12/2020); o SIN continua usando UFV para o IUE. O sistema apresenta em valores do período (sem reexpressão) e diz isso na nota.

### Estado de Resultados (a ordem do relatório)
```
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
Activo (caja por moneda, cuentas por cobrar, préstamos por cobrar, inventario a costo) · Pasivo (cuentas por pagar, préstamos por pagar, **IVA e IT por pagar do período**) · Patrimonio = Activo − Pasivo.

---

## 🇧🇷 Brasil (opcional — só o que muda)

**Base:** Lei 6.404/76 art. 187 e CPC 26 (R1). **Simples Nacional:** Livro Caixa obrigatório.

**A diferença que existe:** a DRE começa na **receita bruta** e os impostos sobre a venda são **dedução da receita** (não gasto); o imposto sobre o lucro é IRPJ + CSLL.

```
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

---

## O relatório do sistema: "simples por fora, completo por dentro"
1. **Resumo (1 página):** Estado de Resultados (ou DRE) e Balance, no padrão escolhido.
2. **Impostos:** a conta de cada imposto (base × taxa), com o débito/crédito do IVA.
3. **Conferência:** cada total do resumo confere com o anexo dele (✓ ou ⚠ com a diferença).
4. **Anexos (cada centavo):** Libro Diario / Caixa por moeda (cada entrada e saída, com saldo), ventas línea por línea, compras línea por línea, inventario valorizado, cuentas por cobrar / por pagar, gastos por categoría.
5. **Impressão:** prévia em A4, cabeçalho com razão social, NIT e período, páginas numeradas e as firmas (Contador · Representante legal).

**Premissas que o sistema ainda não registra por venda** (ficam na configuração e aparecem na nota): se as vendas saem com fatura e se as compras vêm com fatura (o cabelo comprado de pessoa física normalmente vem **sem** fatura → sem crédito fiscal).

## Fontes
- HLB Bolivia — marco normativo dos estados financeiros: https://www.hlbbolivia.com/marco-normativo-para-la-preparacion-de-estados-financieros-de-proposito-general-en-bolivia/
- Bolivia Impuestos — compensação IUE-IT: https://boliviaimpuestos.com/la-compensacion-iue-it-2025/
- Bolivia Impuestos — utilidade contábil e tributária: https://boliviaimpuestos.com/utilidad-contable-tributaria-iue/
- Estados financeiros do BNB (exemplo real de ordem das linhas): https://www.bnb.com.bo/PortalBNB/Documentos/EEFF_BNB_Publicacio%CC%81n_2024.pdf
- Resolução CTNAC 03/2020 (suspensão do AITB): https://ciencialatina.org/index.php/cienciala/article/download/3464/5250
- UFV e a posição do SIN: https://boliviaimpuestos.com/b/5t0
- Código de Comercio art. 37: https://boliviaimpuestos.com/b/1UT · SIN RA 05-0406-92 (art. 40): https://www.impuestos.gob.bo/wp-content/uploads/2025/10/RA05-0406-92.pdf
- Libro de Compras y Ventas IVA: https://boliviaimpuestos.com/formato-libro-de-compras-y-ventas-iva/
- IT 3%: https://yo-facturo.com/blog/impuesto-a-las-transacciones-it-bolivia/ · RTS: https://yo-facturo.com/blog/categorias-regimen-simplificado-bolivia/
- DRE (Lei 6.404 / CPC 26): https://www.estrategiaconcursos.com.br/blog/demonstracao-do-resultado-do-exercicio-dre/amp/ · https://blog.grancursosonline.com.br/demonstracao-do-resultado-do-exercicio-estrutura-objetivo-e-importancia-contabil/
- Livro Caixa no Simples: https://jornalcontabil.com.br/noticia/simples-nacional-entenda-a-obrigatoriedade-do-livro-caixa/amp/
