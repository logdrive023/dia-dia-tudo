// NOVIDADES (changelog): o que mudou no sistema, em palavras simples, para quem usa entender. A cada rodada de mudanças,
// uma entrada nova no TOPO (mais nova primeiro). Cada item diz a área, o que mudou e, quando dá, a tela para ver.
// SEMPRE EM PORTUGUÊS E ESPANHOL: cada texto tem o par `es` (obrigatório no tipo — sem ele não compila; o teste
// novidades.test.ts confere que não está vazio nem igual ao português). Quem gera a rodada já escreve as duas.
// Só o ADMINISTRADOR vê esta tela.

export type AreaNovidade = 'Venda' | 'Comprar' | 'Triagem' | 'Estoque' | 'Etiquetas' | 'Livro do cabelo' | 'Viagens' | 'Agenda' | 'Pessoas' | 'Equipe' | 'Impostos' | 'Relatórios' | 'Acesso' | 'Sistema'

/** a cor e o ícone de cada área (os mesmos na tela, nos chips e nos blocos) */
export const AREAS_NOVIDADE: Record<AreaNovidade, { icone: string; cor: string }> = {
  Venda: { icone: '💰', cor: '#16a34a' },
  Comprar: { icone: '🛒', cor: '#ea580c' },
  Triagem: { icone: '✂️', cor: '#db2777' },
  Estoque: { icone: '📦', cor: '#9333ea' },
  Etiquetas: { icone: '🏷', cor: '#0891b2' },
  'Livro do cabelo': { icone: '📒', cor: '#ca8a04' },
  Viagens: { icone: '🧳', cor: '#0284c7' },
  Agenda: { icone: '📅', cor: '#e11d48' },
  Pessoas: { icone: '👤', cor: '#0ea5e9' },
  Equipe: { icone: '👥', cor: '#6366f1' },
  Impostos: { icone: '🧾', cor: '#d97706' },
  'Relatórios': { icone: '📊', cor: '#7c3aed' },
  Acesso: { icone: '🔒', cor: '#dc2626' },
  Sistema: { icone: '⚙️', cor: '#64748b' },
}

/** novo = não existia · melhoria = ficou melhor · correção = estava errado */
export type TipoNovidade = 'novo' | 'melhoria' | 'correcao'

/** um texto nas duas línguas (o par em espanhol é obrigatório) */
export interface Texto2 {
  pt: string
  es: string
}

export interface ItemNovidade {
  area: AreaNovidade
  texto: Texto2
  /** padrão: melhoria */
  tipo?: TipoNovidade
  /** tela para abrir e ver a mudança */
  tela?: string
  params?: Record<string, string>
}

export interface Novidade {
  data: string
  titulo: Texto2
  /** uma frase do que esta rodada trouxe */
  resumo?: Texto2
  itens: ItemNovidade[]
}

/** o texto na língua da tela */
export const naLingua = (x: Texto2, idioma: 'pt' | 'es') => (idioma === 'es' ? x.es : x.pt)

export const NOVIDADES: Novidade[] = [
  {
    data: '2026-11-04',
    titulo: { pt: 'Impostos às claras, menu por áreas e acesso por papel', es: 'Impuestos a la vista, menú por áreas y acceso por rol' },
    resumo: {
      pt: 'O padrão boliviano manda nos relatórios; os impostos aparecem na venda e na compra (só informativo) e cada pessoa vê só o que pode.',
      es: 'El estándar boliviano manda en los informes; los impuestos aparecen en la venta y en la compra (solo informativo) y cada persona ve solo lo que puede.',
    },
    itens: [
      { area: 'Impostos', tipo: 'novo', tela: 'vendaRapida', texto: {
        pt: 'Impostos na venda e na compra: IVA e IT com a alíquota vigente, a fonte legal e a conta (13% × Bs 100 = Bs 13). Só informa, nunca muda o preço cobrado.',
        es: 'Impuestos en la venta y en la compra: IVA e IT con la alícuota vigente, la fuente legal y la cuenta (13% × Bs 100 = Bs 13). Solo informa, nunca cambia el precio cobrado.' } },
      { area: 'Impostos', tipo: 'novo', tela: 'configSecao', params: { id: 'fiscal' }, texto: {
        pt: 'Configurações › Fiscal em abas: cada imposto num cartão (taxa, onde vale, liga e desliga) e "Como e onde mostrar": embaixo do total e/ou o quadro embaixo de "Nesta venda".',
        es: 'Configuración › Fiscal en pestañas: cada impuesto en una tarjeta (tasa, dónde se aplica, activar y desactivar) y "Cómo y dónde mostrar": debajo del total y/o el cuadro debajo de "En esta venta".' } },
      { area: 'Impostos', tipo: 'novo', texto: {
        pt: 'Todo imposto estimado fica registrado no histórico da venda e da compra (alíquota e fonte do dia), mesmo com a exibição desligada.',
        es: 'Todo impuesto estimado queda registrado en el historial de la venta y de la compra (alícuota y fuente del día), aunque la visualización esté desactivada.' } },
      { area: 'Relatórios', tipo: 'novo', tela: 'relatorios', texto: {
        pt: 'Estados financeiros no padrão boliviano (IVA, IT, IUE, RTS) com folha A4 para imprimir; DRE do Brasil continua como opção.',
        es: 'Estados financieros en el estándar boliviano (IVA, IT, IUE, RTS) con hoja A4 para imprimir; el DRE de Brasil sigue como opción.' } },
      { area: 'Venda', tipo: 'melhoria', tela: 'vendaRapida', texto: {
        pt: '"Cobrar em" com cartões de moeda (bandeira e nome) e a cotação do dia escrita como conta: 1 R$ = [ 1,25 ] Bs.',
        es: '"Cobrar en" con tarjetas de moneda (bandera y nombre) y la cotización del día escrita como cuenta: 1 R$ = [ 1,25 ] Bs.' } },
      { area: 'Venda', tipo: 'melhoria', tela: 'vendas', texto: {
        pt: 'Lista de vendas mais visual e "Baixar planilha" dentro da ⚙ em todas as listas.',
        es: 'Lista de ventas más visual y "Descargar planilla" dentro de la ⚙ en todas las listas.' } },
      { area: 'Sistema', tipo: 'melhoria', tela: 'config', texto: {
        pt: 'Menu em blocos por área, cada um com a sua cor; Configurações divididas em 6 áreas (Negócio, Pessoas e acesso, Dinheiro e impostos, Compras, Estoque e triagem, Sistema).',
        es: 'Menú en bloques por área, cada uno con su color; Configuración dividida en 6 áreas (Negocio, Personas y acceso, Dinero e impuestos, Compras, Inventario y selección, Sistema).' } },
      { area: 'Sistema', tipo: 'correcao', texto: {
        pt: 'Janelas (detalhe dos impostos e outras) não ficam mais cortadas atrás do menu no celular.',
        es: 'Las ventanas (detalle de impuestos y otras) ya no quedan cortadas detrás del menú en el celular.' } },
      { area: 'Sistema', tipo: 'melhoria', texto: {
        pt: 'Telas preparadas para qualquer largura (de 240 px à tela grande): nada sai da tela e palavra não parte no meio.',
        es: 'Pantallas preparadas para cualquier ancho (de 240 px a la pantalla grande): nada se sale de la pantalla y ninguna palabra se corta por la mitad.' } },
      { area: 'Acesso', tipo: 'novo', texto: {
        pt: 'Entrar com usuário de teste pede a senha de acesso (o sistema não fica aberto na internet).',
        es: 'Entrar con un usuario de prueba pide la contraseña de acceso (el sistema no queda abierto en internet).' } },
      { area: 'Acesso', tipo: 'novo', texto: {
        pt: 'Funcionária só vê o que é dela: sem custo, fornecedor, sócias, salário nem comissão das colegas; a venda e a ficha de quem não é dela são recusadas. Novidades agora é só do administrador.',
        es: 'La funcionaria solo ve lo suyo: sin costo, proveedor, socias, sueldo ni comisión de las colegas; la venta y la ficha de quien no es suya se rechazan. Novedades ahora es solo del administrador.' } },
      { area: 'Viagens', tipo: 'novo', tela: 'viagens', texto: {
        pt: 'Cidades da Bolívia (as 340) para escolher na viagem; "É viagem na Bolívia?" muda o campo.',
        es: 'Ciudades de Bolivia (las 340) para elegir en el viaje; "¿Es viaje en Bolivia?" cambia el campo.' } },
      { area: 'Viagens', tipo: 'novo', tela: 'viagens', texto: {
        pt: 'Ligar compra a viagem encerrada (avisa "encerrada há X dias"); cores: vigente, encerrada há pouco, antiga — com legenda. Dá para desfazer.',
        es: 'Vincular compra a un viaje cerrado (avisa "cerrado hace X días"); colores: vigente, cerrado hace poco, antiguo — con leyenda. Se puede deshacer.' } },
      { area: 'Viagens', tipo: 'novo', texto: {
        pt: 'Aviso de viagem parecida antes de criar uma repetida.',
        es: 'Aviso de viaje parecido antes de crear uno repetido.' } },
      { area: 'Comprar', tipo: 'melhoria', tela: 'comprar', texto: {
        pt: 'Compra refeita: aviso depois de salvar, triagem clara no Resumo, itens mais fáceis e "Para onde foi" padronizado; marcar várias compras e ligar a uma viagem.',
        es: 'Compra rehecha: aviso después de guardar, selección clara en el Resumen, ítems más fáciles y "A dónde fue" estandarizado; marcar varias compras y vincularlas a un viaje.' } },
      { area: 'Agenda', tipo: 'novo', tela: 'agenda', texto: {
        pt: 'Parcelas dos empréstimos na agenda; "+ Marcar" passo a passo; ficha do compromisso padrão com as ações certas.',
        es: 'Cuotas de los préstamos en la agenda; "+ Agendar" paso a paso; ficha del compromiso estándar con las acciones correctas.' } },
      { area: 'Agenda', tipo: 'melhoria', tela: 'agenda', texto: {
        pt: 'Cada papel vê a sua agenda: administrador vê todas; funcionária vê a dela (e a das colegas só se tiver permissão).',
        es: 'Cada rol ve su agenda: el administrador ve todas; la funcionaria ve la suya (y la de las colegas solo si tiene permiso).' } },
      { area: 'Pessoas', tipo: 'novo', tela: 'pessoas', texto: {
        pt: 'Cadastro passo a passo de Pessoas, Funcionário, Empréstimo e Adiantamento; WhatsApp com bandeira e formatação automática.',
        es: 'Registro paso a paso de Personas, Funcionario, Préstamo y Anticipo; WhatsApp con bandera y formato automático.' } },
    ],
  },
  {
    data: '2026-11-03',
    titulo: { pt: 'Celular em primeiro lugar: compra → triagem → etiqueta → venda', es: 'El celular primero: compra → selección → etiqueta → venta' },
    itens: [
      { area: 'Sistema', texto: {
        pt: 'Menu agrupado: Principal (Painel, Comprar, Triagem, Estoque, Etiquetas, Vender) sempre à vista; o resto em grupos que abrem e fecham.',
        es: 'Menú agrupado: Principal (Panel, Comprar, Selección, Inventario, Etiquetas, Vender) siempre a la vista; el resto en grupos que se abren y cierran.' } },
      { area: 'Sistema', tela: 'config', texto: {
        pt: 'Tema claro, escuro ou automático em Configurações (vale para cada aparelho).',
        es: 'Tema claro, oscuro o automático en Configuración (vale para cada dispositivo).' } },
      { area: 'Sistema', texto: {
        pt: 'Explicações (ⓘ) mais fáceis de ler: frases em linhas, exemplo em destaque e dica 💡.',
        es: 'Explicaciones (ⓘ) más fáciles de leer: frases en líneas, ejemplo destacado y consejo 💡.' } },
      { area: 'Sistema', texto: {
        pt: 'Filtros no mesmo padrão em todas as listas: busca + ⚙ Filtros, chips com ✕ e "Ver N resultados".',
        es: 'Filtros con el mismo estándar en todas las listas: búsqueda + ⚙ Filtros, chips con ✕ y "Ver N resultados".' } },
      { area: 'Comprar', tipo: 'novo', tela: 'novaCompra', texto: {
        pt: 'Compra "Sem valor": registre cabelo que já tinha (ou sem saber o preço) só com o peso; fica "Sem valor" no que falta.',
        es: 'Compra "Sin valor": registre cabello que ya tenía (o sin saber el precio) solo con el peso; queda "Sin valor" en lo que falta.' } },
      { area: 'Comprar', tela: 'comprar', texto: {
        pt: 'Pedido em abas: Resumo (itens + para onde foi), Pagamento, Conta do fornecedor, Anexos e Histórico.',
        es: 'Pedido en pestañas: Resumen (ítems + a dónde fue), Pago, Cuenta del proveedor, Adjuntos e Historial.' } },
      { area: 'Comprar', tela: 'comprar', texto: {
        pt: 'No celular, cada pedido é uma linha curta que abre no lugar; "O que falta" virou um resumo que abre.',
        es: 'En el celular, cada pedido es una línea corta que se abre en el lugar; "Lo que falta" se volvió un resumen que se abre.' } },
      { area: 'Triagem', tela: 'triagem', texto: {
        pt: 'Abas de verdade: Para separar · Prontos · Para depois · Triagens feitas.',
        es: 'Pestañas de verdad: Para separar · Listos · Para después · Selecciones hechas.' } },
      { area: 'Triagem', tela: 'triagem', params: { aba: 'prontos' }, texto: {
        pt: 'Prontos em tabela (Medida · Lotes · Peso · Valor) com total em destaque; cada lote numa linha só.',
        es: 'Listos en tabla (Medida · Lotes · Peso · Valor) con el total destacado; cada lote en una sola línea.' } },
      { area: 'Triagem', tela: 'triagem', params: { aba: 'triagens' }, texto: {
        pt: 'Triagens feitas com números (entrou, saiu, perda) e filtros (período, quem, compra, perda acima de X%).',
        es: 'Selecciones hechas con números (entró, salió, pérdida) y filtros (período, quién, compra, pérdida mayor a X%).' } },
      { area: 'Triagem', texto: {
        pt: 'Separar ficou mais curto: peso, medida, categoria e cor à vista; o resto em "+ mais". Depois de separar, volta para a Triagem.',
        es: 'Separar quedó más corto: peso, medida, categoría y color a la vista; el resto en "+ más". Después de separar, vuelve a la Selección.' } },
      { area: 'Etiquetas', tipo: 'novo', tela: 'etiquetas', texto: {
        pt: 'Impressão nova: cópias de cada pacote, folha A4 (21 por folha) com "começar na etiqueta N", rolo ou outro tamanho em mm, e limite por vez.',
        es: 'Impresión nueva: copias de cada paquete, hoja A4 (21 por hoja) con "empezar en la etiqueta N", rollo u otro tamaño en mm, y límite por vez.' } },
      { area: 'Etiquetas', tela: 'etiquetas', texto: {
        pt: 'Filtros por compra, lote, fornecedor, quem gerou, quem imprimiu, medida, cor, categoria e peso.',
        es: 'Filtros por compra, lote, proveedor, quién generó, quién imprimió, medida, color, categoría y peso.' } },
      { area: 'Estoque', texto: {
        pt: 'Pacote em abas: Resumo mostra a vida do pacote (compra → triagem → etiqueta → venda), cada passo clicável.',
        es: 'Paquete en pestañas: el Resumen muestra la vida del paquete (compra → selección → etiqueta → venta), cada paso clicable.' } },
      { area: 'Estoque', tipo: 'novo', texto: {
        pt: 'Linha da vida do pacote (aba Detalhes): de onde veio e para onde foi cada grama, na ordem.',
        es: 'Línea de vida del paquete (pestaña Detalles): de dónde vino y a dónde fue cada gramo, en orden.' } },
      { area: 'Estoque', texto: {
        pt: 'Histórico do pacote dividido por dia, com ícone por tipo e a referência de cada movimento à vista.',
        es: 'Historial del paquete dividido por día, con ícono por tipo y la referencia de cada movimiento a la vista.' } },
      { area: 'Estoque', texto: {
        pt: 'Fotos: dá para remover uma foto no próprio visor (fica no histórico).',
        es: 'Fotos: se puede quitar una foto en el mismo visor (queda en el historial).' } },
      { area: 'Venda', tela: 'vender', texto: {
        pt: '"Vender" no pacote abre o modo caixa com o pacote dentro: fecha em 2 toques.',
        es: '"Vender" en el paquete abre el modo caja con el paquete dentro: se cierra en 2 toques.' } },
      { area: 'Venda', tela: 'vendas', texto: {
        pt: 'Venda em abas (Resumo · Linha do tempo · Arquivos · Correções), total e ações no alto.',
        es: 'Venta en pestañas (Resumen · Línea de tiempo · Archivos · Correcciones), total y acciones arriba.' } },
      { area: 'Venda', tipo: 'correcao', texto: {
        pt: 'Corrigido: modo caixa aberto pelo pacote dizia "Pacote não encontrado".',
        es: 'Corregido: el modo caja abierto desde el paquete decía "Paquete no encontrado".' } },
      { area: 'Livro do cabelo', tela: 'livro', texto: {
        pt: 'Cada dia é um bloco que abre e fecha, modo Compacto e fechamento por compra recolhível.',
        es: 'Cada día es un bloque que se abre y cierra, modo Compacto y cierre por compra plegable.' } },
      { area: 'Equipe', tela: 'equipe', texto: {
        pt: 'Organograma novo: cartões limpos com os números do período; no celular vira lista em níveis.',
        es: 'Organigrama nuevo: tarjetas limpias con los números del período; en el celular se vuelve lista por niveles.' } },
    ],
  },
]
