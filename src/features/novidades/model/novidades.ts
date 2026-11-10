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
    data: '2026-11-09',
    titulo: { pt: 'Vitrine com lista de compras, etiquetas por folha e um sistema mais rápido', es: 'Vitrina con lista de compras, etiquetas por hoja y un sistema más rápido' },
    resumo: {
      pt: 'O comprador monta uma lista na vitrine e manda pelo WhatsApp em espanhol; as etiquetas saem várias por folha; Painel, Caixa e Agenda ficaram mais simples; e as telas abrem mais rápido no celular.',
      es: 'El comprador arma una lista en la vitrina y la manda por WhatsApp en español; las etiquetas salen varias por hoja; Panel, Caja y Agenda quedaron más simples; y las pantallas abren más rápido en el celular.',
    },
    itens: [
      { area: 'Estoque', tipo: 'novo', tela: 'vitrine', texto: {
        pt: 'Você escolhe o que vai para a vitrine: o pacote disponível e com etiqueta espera em “Prontos para a vitrine” até você pôr (um a um ou “Pôr todos”). Quem quiser o jeito antigo escolhe “Tudo que estiver pronto”. A vitrine e o Estoque explicam o que pode entrar e quantos faltam etiquetar.',
        es: 'Usted elige lo que va a la vitrina: el paquete disponible y con etiqueta espera en “Listos para la vitrina” hasta que usted lo ponga (uno a uno o “Poner todos”). Quien quiera la forma anterior elige “Todo lo que esté listo”. La vitrina y el Inventario explican lo que puede entrar y cuántos faltan etiquetar.' } },
      { area: 'Estoque', tipo: 'novo', tela: 'vitrine', texto: {
        pt: 'Vitrine: o comprador marca vários pacotes e manda uma lista só pelo WhatsApp (“Hola, ¿tienen disponible…? 1, 2, 3”), além do pedido de um pacote.',
        es: 'Vitrina: el comprador marca varios paquetes y manda una sola lista por WhatsApp (“Hola, ¿tienen disponible…? 1, 2, 3”), además del pedido de un paquete.' } },
      { area: 'Estoque', tipo: 'novo', tela: 'vitrine', texto: {
        pt: 'Mensagens do WhatsApp da vitrine em espanhol (ou português), já prontas e totalmente editáveis, com a prévia de como chegam. Preço na vitrine: entrar em contato, preço da tabela ou preço por pacote.',
        es: 'Mensajes de WhatsApp de la vitrina en español (o portugués), ya listos y totalmente editables, con la vista previa de cómo llegan. Precio en la vitrina: contactar, precio de la tabla o precio por paquete.' } },
      { area: 'Etiquetas', tipo: 'novo', tela: 'etiquetas', texto: {
        pt: 'Etiquetas por folha (você escolhe quantas) e a data e hora da impressão no topo, no rodapé ou escondida. Imprimir só imprime; quem confirma que saiu certa é o administrador. Botões “Imprimir só as sem etiqueta” e “Imprimir todas”.',
        es: 'Etiquetas por hoja (usted elige cuántas) y la fecha y hora de impresión arriba, abajo u oculta. Imprimir solo imprime; quien confirma que salió bien es el administrador. Botones “Imprimir solo las sin etiqueta” e “Imprimir todas”.' } },
      { area: 'Venda', tipo: 'melhoria', tela: 'vender', texto: {
        pt: 'Vendas em aberto mostram há quanto tempo estão paradas; vender um pacote que está em outra venda aberta avisa e deixa vender só uma parte.',
        es: 'Las ventas pendientes muestran hace cuánto están paradas; vender un paquete que está en otra venta pendiente avisa y deja vender solo una parte.' } },
      { area: 'Venda', tipo: 'melhoria', texto: {
        pt: 'Divisão interna da venda redesenhada, com atalho direto para onde se define a comissão.',
        es: 'División interna de la venta rediseñada, con acceso directo a donde se define la comisión.' } },
      { area: 'Relatórios', tipo: 'melhoria', tela: 'painel', texto: {
        pt: 'Painel e Caixa redesenhados: menos coisa na tela, o que precisa de você primeiro e o resto em “Ver mais detalhes”.',
        es: 'Panel y Caja rediseñados: menos cosas en pantalla, lo que necesita de usted primero y el resto en “Ver más detalles”.' } },
      { area: 'Agenda', tipo: 'melhoria', tela: 'agenda', texto: {
        pt: 'Calendário e legenda mais limpos: viagem de vários dias vira uma barra contínua com o nome uma vez só.',
        es: 'Calendario y leyenda más limpios: un viaje de varios días se vuelve una barra continua con el nombre una sola vez.' } },
      { area: 'Sistema', tipo: 'melhoria', texto: {
        pt: 'Mais rápido no celular: cada tela carrega só quando abre, o espanhol vem à parte e as listas grandes desenham só o que está perto da tela.',
        es: 'Más rápido en el celular: cada pantalla carga solo cuando se abre, el español viene aparte y las listas grandes dibujan solo lo que está cerca de la pantalla.' } },
      { area: 'Sistema', tipo: 'melhoria', texto: {
        pt: 'No celular: botões, abas e escolhas com 44 px para o dedo, o ⓘ e os links pequenos com área de toque maior, e telas que não pulam enquanto carregam (Estoque, Viagens, Preços, Modo caixa, Agenda).',
        es: 'En el celular: botones, pestañas y opciones con 44 px para el dedo, el ⓘ y los enlaces pequeños con área de toque más grande, y pantallas que no saltan mientras cargan (Inventario, Viajes, Precios, Modo caja, Agenda).' } },
      { area: 'Sistema', tipo: 'melhoria', texto: {
        pt: 'Paginação nova: ao trocar de página a tela sobe de leve e mostra que está carregando.',
        es: 'Paginación nueva: al cambiar de página la pantalla sube suave y muestra que está cargando.' } },
      { area: 'Venda', tipo: 'melhoria', texto: {
        pt: 'Conversor de moedas novo: toque na moeda e digite (o cursor já vem no campo); vazio, mostra quanto vale 1; com valor, quanto dá recebendo e pagando. Embaixo, o câmbio do dia (“1 US$ = Bs 11,90”) com Dinâmico ou Fixo.',
        es: 'Convertidor de monedas nuevo: toque la moneda y escriba (el cursor ya viene en el campo); vacío, muestra cuánto vale 1; con valor, cuánto da recibiendo y pagando. Abajo, el tipo de cambio del día (“1 US$ = Bs 11,90”) con Dinámico o Fijo.' } },
      { area: 'Venda', tipo: 'correcao', tela: 'config', params: { aba: 'moedas' }, texto: {
        pt: 'Nos dados de exemplo, o real agora vem com câmbio Dinâmico, igual ao dólar; Fixo continua sendo uma escolha em Configurações › Moedas e câmbio.',
        es: 'En los datos de ejemplo, el real ahora viene con tipo de cambio Dinámico, igual que el dólar; Fijo sigue siendo una opción en Configuración › Monedas y tipo de cambio.' } },
      { area: 'Estoque', tipo: 'correcao', texto: {
        pt: 'Ler código: a câmera não trava mais nem abre o teclado sozinha, e zoom e flash mostram “ajustando” enquanto respondem.',
        es: 'Leer código: la cámara ya no se traba ni abre el teclado sola, y el zoom y el flash muestran “ajustando” mientras responden.' } },
      { area: 'Sistema', tipo: 'correcao', texto: {
        pt: 'Dicas (ⓘ) do topo não ficam mais cortadas, e frases começam com letra maiúscula em português e espanhol.',
        es: 'Las ayudas (ⓘ) de arriba ya no quedan cortadas, y las frases empiezan con mayúscula en portugués y español.' } },
    ],
  },
  {
    data: '2026-11-08',
    titulo: { pt: 'Turno, triagem, preços e viagens mais fáceis; feriados na agenda', es: 'Turno, revisión, precios y viajes más fáciles; feriados en la agenda' },
    resumo: {
      pt: 'De 6 a 8/11: abrir e fechar o turno, vendas guardadas para retomar, juntar pacotes, de qual compra veio cada grama, preços com rascunho, a vitrine com cores e prévia, feriados na agenda e cenários prontos para testar.',
      es: 'Del 6 al 8/11: abrir y cerrar el turno, ventas guardadas para retomar, juntar paquetes, de qué compra vino cada gramo, precios con borrador, la vitrina con colores y vista previa, feriados en la agenda y escenarios listos para probar.',
    },
    itens: [
      { area: 'Venda', tipo: 'novo', tela: 'vender', texto: {
        pt: 'Abrir meu turno com o troco inicial (a hora fica registrada) antes de fechar com a conferência cega.',
        es: 'Abrir mi turno con el cambio inicial (la hora queda registrada) antes de cerrar con el arqueo ciego.' } },
      { area: 'Venda', tipo: 'novo', tela: 'vendaRapida', texto: {
        pt: 'Modo caixa: a venda começada e deixada de lado fica guardada (até 3) com o botão “Retomar”; nada se perde ao sair da tela.',
        es: 'Modo caja: la venta empezada y dejada a un lado queda guardada (hasta 3) con el botón “Retomar”; nada se pierde al salir de la pantalla.' } },
      { area: 'Triagem', tipo: 'novo', tela: 'triagem', texto: {
        pt: 'Juntar pacotes brutos numa janela só (“Juntar em 1 pacote de 4,5 kg”), que já mostra o próximo passo: separar. Misturas são avisadas antes de juntar.',
        es: 'Juntar paquetes brutos en una sola ventana (“Juntar en 1 paquete de 4,5 kg”), que ya muestra el siguiente paso: separar. Las mezclas se avisan antes de juntar.' } },
      { area: 'Triagem', tipo: 'melhoria', tela: 'triagem', texto: {
        pt: 'O próximo pacote a separar com os critérios à vista (mais tempo parado, mais pesado, mais leve, chegou por último) e as dicas ⓘ desenhadas, com exemplo.',
        es: 'El siguiente paquete a separar con los criterios a la vista (más tiempo parado, más pesado, más liviano, llegó último) y las ayudas ⓘ dibujadas, con ejemplo.' } },
      { area: 'Livro do cabelo', tipo: 'novo', texto: {
        pt: 'De qual compra veio cada grama de um pacote ou de uma venda, mesmo depois de juntar e separar de novo.',
        es: 'De qué compra vino cada gramo de un paquete o de una venta, incluso después de juntar y separar de nuevo.' } },
      { area: 'Venda', tipo: 'melhoria', tela: 'precos', texto: {
        pt: 'Preços: as mudanças ficam num rascunho (“● 3 mudanças · Desfazer · Publicar”) até você publicar, e o ⓘ “Como calcula o preço” mostra a conta desenhada: gramas × fator = valor.',
        es: 'Precios: los cambios quedan en un borrador (“● 3 cambios · Deshacer · Publicar”) hasta que usted publique, y el ⓘ “Cómo calcula el precio” muestra la cuenta dibujada: gramos × factor = valor.' } },
      { area: 'Estoque', tipo: 'novo', tela: 'vitrine', texto: {
        pt: 'Vitrine com a sua cara: cores, banner, fundo e frase do topo, com a prévia ao vivo ao lado (no celular: Ajustar | Prévia). Nada muda até “Salvar e publicar”.',
        es: 'Vitrina con su estilo: colores, banner, fondo y frase de arriba, con la vista previa en vivo al lado (en el celular: Ajustar | Vista previa). Nada cambia hasta “Guardar y publicar”.' } },
      { area: 'Viagens', tipo: 'melhoria', tela: 'viagens', texto: {
        pt: 'Primeira viagem com o caminho em 4 passos e exemplo; o “⛽ Gasto” fica direto na linha da viagem aberta, sem abrir a ficha.',
        es: 'Primer viaje con el camino en 4 pasos y ejemplo; el “⛽ Gasto” queda directo en la línea del viaje abierto, sin abrir la ficha.' } },
      { area: 'Agenda', tipo: 'novo', tela: 'agenda', texto: {
        pt: 'Feriados da Bolívia (nacionais e dos 9 departamentos) e do Brasil na agenda, só para informar: não bloqueiam nada.',
        es: 'Feriados de Bolivia (nacionales y de los 9 departamentos) y de Brasil en la agenda, solo para informar: no bloquean nada.' } },
      { area: 'Sistema', tipo: 'novo', tela: 'config', params: { aba: 'teste' }, texto: {
        pt: 'Configurações › Modo teste: cenários prontos (Loja cheia, Começar do zero…) e “Zerar tudo”, com cópia de segurança antes. Só neste aparelho.',
        es: 'Configuración › Modo prueba: escenarios listos (Tienda llena, Empezar de cero…) y “Borrar todo”, con copia de seguridad antes. Solo en este dispositivo.' } },
      { area: 'Viagens', tipo: 'melhoria', tela: 'viagens', texto: {
        pt: 'Viagens no computador com atalhos de teclado: “/” busca e “Alt+N” cria uma viagem nova.',
        es: 'Viajes en la computadora con atajos de teclado: “/” busca y “Alt+N” crea un viaje nuevo.' } },
    ],
  },
  {
    data: '2026-11-05',
    titulo: { pt: 'Minha vitrine: a loja do cabelo para os compradores', es: 'Mi vitrina: la tienda de cabello para los compradores' },
    resumo: {
      pt: 'Os pacotes já separados e com etiqueta aparecem numa página de loja, com filtros por medida e cor, preço por grama e o botão “Quero este” no WhatsApp.',
      es: 'Los paquetes ya separados y con etiqueta aparecen en una página de tienda, con filtros por medida y color, precio por gramo y el botón “Lo quiero” en WhatsApp.',
    },
    itens: [
      { area: 'Estoque', tipo: 'novo', tela: 'vitrine', texto: {
        pt: 'Minha vitrine (menu Cabelo): liga/desliga a loja, nome, texto, WhatsApp, mostrar o preço (de qual coluna da tabela) e esconder pacotes. “Ver como o cliente vê” abre a página da loja.',
        es: 'Mi vitrina (menú Cabello): enciende/apaga la tienda, nombre, texto, WhatsApp, mostrar el precio (de qué columna de la tabla) y ocultar paquetes. “Ver como lo ve el cliente” abre la página de la tienda.' } },
      { area: 'Venda', tipo: 'novo', texto: {
        pt: 'A página do comprador mostra só o que é público (medida, cor, gramas, foto, preço): nunca custo, fornecedor ou compra. Hoje abre neste aparelho; com a API vira o link público.',
        es: 'La página del comprador muestra solo lo público (medida, color, gramos, foto, precio): nunca costo, proveedor ni compra. Hoy abre en este dispositivo; con la API se vuelve el enlace público.' } },
      { area: 'Sistema', tipo: 'melhoria', texto: {
        pt: 'Telas entram suaves e o carregamento aparece por meio segundo (Configurações › Dados › Simular internet), como vai ser com o servidor.',
        es: 'Las pantallas entran suaves y la carga aparece medio segundo (Configuración › Datos › Simular internet), como será con el servidor.' } },
    ],
  },
  {
    data: '2026-11-05',
    titulo: { pt: 'Turno com conferência cega, alerta de custo, reposição e metas', es: 'Turno con arqueo ciego, alerta de costo, reposición y metas' },
    resumo: {
      pt: 'O dinheiro da mão de cada pessoa é conferido às cegas, o caixa avisa quando o preço está abaixo do custo, a reposição diz quando cada medida acaba e as metas do mês aparecem com a barra.',
      es: 'El dinero en mano de cada persona se revisa a ciegas, la caja avisa cuando el precio está por debajo del costo, la reposición dice cuándo se acaba cada medida y las metas del mes aparecen con la barra.',
    },
    itens: [
      { area: 'Venda', tipo: 'novo', tela: 'vender', texto: {
        pt: 'Fechar meu turno: cada pessoa conta o efectivo sem ver quanto deveria ter; a diferença fica no nome dela e o administrador vê em Caixa › Turnos. Sair com dinheiro sem contar pede para fechar o turno.',
        es: 'Cerrar mi turno: cada persona cuenta el efectivo sin ver cuánto debería tener; la diferencia queda a su nombre y el administrador la ve en Caja › Turnos. Salir con dinero sin contar pide cerrar el turno.' } },
      { area: 'Venda', tipo: 'novo', texto: {
        pt: 'Alerta de venda abaixo do custo no Modo caixa e em Vender: avisa antes de cobrar, pede confirmação e registra na auditoria. A funcionária vê o aviso, não o custo.',
        es: 'Alerta de venta por debajo del costo en el Modo caja y en Vender: avisa antes de cobrar, pide confirmación y lo registra en la auditoría. La funcionaria ve el aviso, no el costo.' } },
      { area: 'Estoque', tipo: 'novo', tela: 'relatorios', params: { relatorio: 'reposicao' }, texto: {
        pt: 'Relatórios › Reposição: por medida, quanto tem, quanto vende por dia, quando acaba, quanto comprar e quanto custou o último kg (e de qual viagem).',
        es: 'Informes › Reposición: por medida, cuánto hay, cuánto se vende por día, cuándo se acaba, cuánto comprar y cuánto costó el último kg (y de qué viaje).' } },
      { area: 'Equipe', tipo: 'novo', tela: 'config', params: { aba: 'metas' }, texto: {
        pt: 'Metas do mês (empresa, unidade ou pessoa; faturamento, vendas ou atendimentos), totalmente configuráveis: no Painel, com ou sem valor, e a funcionária vê as dela se o admin ligar.',
        es: 'Metas del mes (empresa, sucursal o persona; facturación, ventas o atenciones), totalmente configurables: en el Panel, con o sin valor, y la funcionaria ve las suyas si el admin lo activa.' } },
    ],
  },
  {
    data: '2026-11-05',
    titulo: { pt: 'O admin decide o que a funcionária faz', es: 'El admin decide lo que hace la funcionaria' },
    resumo: {
      pt: 'Funcionária entra em espanhol e vê o básico (Vender, Agenda, Equipe, Configurações); o resto o admin liga em Configurações › O que a funcionária faz.',
      es: 'La funcionaria entra en español y ve lo básico (Vender, Agenda, Equipo, Configuración); el resto lo enciende el admin en Configuración › Lo que hace la funcionaria.',
    },
    itens: [
      { area: 'Acesso', tipo: 'novo', tela: 'config', params: { aba: 'funcionaria' }, texto: {
        pt: 'Interruptores para o que ela pode vender, o que vê na agenda (viagem e empréstimo desligados no padrão), Pessoas, Viagens, Adiantamentos, Conversor e as seções de Configurações.',
        es: 'Interruptores para lo que puede vender, lo que ve en la agenda (viaje y préstamo apagados por defecto), Personas, Viajes, Anticipos, Conversor y las secciones de Configuración.' } },
      { area: 'Sistema', tipo: 'melhoria', texto: {
        pt: 'Tema e idioma num seletor só no cabeçalho de Configurações, para todos; a funcionária troca só no aparelho dela.',
        es: 'Tema e idioma en un solo selector en el encabezado de Configuración, para todos; la funcionaria cambia solo en su dispositivo.' } },
      { area: 'Etiquetas', tipo: 'correcao', texto: {
        pt: 'Uma etiqueta não sai mais em 3 páginas: só a janela em que tocou Imprimir vai para o papel.',
        es: 'Una etiqueta ya no sale en 3 páginas: solo la ventana donde tocó Imprimir va al papel.' } },
      { area: 'Sistema', tipo: 'novo', tela: 'config', params: { aba: 'dados' }, texto: {
        pt: 'Carregamento animado padrão e “Simular internet” para ver as telas como vão ser com o servidor.',
        es: 'Carga animada estándar y “Simular internet” para ver las pantallas como serán con el servidor.' } },
    ],
  },
  {
    data: '2026-11-05',
    titulo: { pt: 'Configurações mais simples e uma tela de entrar nova', es: 'Configuración más simple y una nueva pantalla para entrar' },
    resumo: {
      pt: 'Formas de pagamento que ligam e desligam, senha com regra e olho, cadastros no mesmo formato e o relatório que compara as viagens.',
      es: 'Formas de pago que se encienden y apagan, contraseña con regla y ojo, registros con el mismo formato y el informe que compara los viajes.',
    },
    itens: [
      { area: 'Sistema', tipo: 'novo', tela: 'config', params: { aba: 'pagamentos' }, texto: {
        pt: 'Formas de pagamento: desligue a que o negócio não usa (ex.: Pix) e ela some da venda, da compra, do caixa e das comissões. O que já foi pago continua nos relatórios.',
        es: 'Formas de pago: apague la que el negocio no usa (ej.: Pix) y desaparece de la venta, la compra, la caja y las comisiones. Lo ya pagado sigue en los informes.' } },
      { area: 'Acesso', tipo: 'novo', texto: {
        pt: 'Senha nova com pelo menos 8 caracteres, uma letra e um número ou caractere especial; o olho mostra o que foi digitado e o administrador pode gerar uma senha para passar à pessoa.',
        es: 'Contraseña nueva con al menos 8 caracteres, una letra y un número o carácter especial; el ojo muestra lo escrito y el administrador puede generar una contraseña para pasar a la persona.' } },
      { area: 'Acesso', tipo: 'melhoria', texto: {
        pt: 'Tela de entrar renovada, com “Esqueceu a senha?” e o modo de teste separado (usuários de teste para entrar com um toque).',
        es: 'Pantalla para entrar renovada, con “¿Olvidó la contraseña?” y el modo de prueba aparte (usuarios de prueba para entrar con un toque).' } },
      { area: 'Sistema', tipo: 'melhoria', texto: {
        pt: 'Unidades, usuários, catálogo e modalidades usam o mesmo cadastro (Nova/Editar, campos em grupos, Cancelar e Salvar). Moedas e câmbio ficaram numa tela só, com uma linha por moeda.',
        es: 'Unidades, usuarios, catálogo y modalidades usan el mismo registro (Nuevo/Editar, campos en grupos, Cancelar y Guardar). Monedas y tipo de cambio quedaron en una sola pantalla, con una línea por moneda.' } },
      { area: 'Impostos', tipo: 'melhoria', tela: 'config', params: { aba: 'fiscal', parte: 'relatorio' }, texto: {
        pt: 'Cabeçalho do relatório impresso arrumado sozinho: NIT só com números e nomes com maiúscula, no preenchimento e no relatório.',
        es: 'Encabezado del informe impreso ordenado solo: NIT solo con números y nombres con mayúscula, al llenar y en el informe.' } },
      { area: 'Viagens', tipo: 'novo', tela: 'relatorios', params: { relatorio: 'viagens' }, texto: {
        pt: 'Relatórios › Viagens: quanto custou cada kg em cada viagem (cabelo + gastos) e uma viagem contra a outra, com o ✓ em quem foi melhor.',
        es: 'Informes › Viajes: cuánto costó cada kg en cada viaje (cabello + gastos) y un viaje contra otro, con el ✓ en el mejor.' } },
    ],
  },
  {
    data: '2026-11-05',
    titulo: { pt: 'Imposto de Renda: o exercício fiscal inteiro', es: 'Impuesto a las Utilidades: la gestión fiscal completa' },
    resumo: {
      pt: 'Em Relatórios, a aba Imposto de Renda junta IVA, IT, IUE e as retenções do ano, mês a mês, com o que falta revisar e o documento anual para o contador.',
      es: 'En Informes, la pestaña Impuesto a las Utilidades junta IVA, IT, IUE y las retenciones del año, mes a mes, con lo que falta revisar y el documento anual para el contador.',
    },
    itens: [
      { area: 'Impostos', tipo: 'novo', tela: 'relatorios', params: { relatorio: 'ir' }, texto: {
        pt: 'Escolha o exercício e veja receita, compras, custo, gastos, lucro contábil e tributável, impostos apurados, pagos e pendentes — cada número diz se é calculado, estimado ou confirmado.',
        es: 'Elija la gestión y vea ingresos, compras, costo, gastos, utilidad contable e imponible, impuestos determinados, pagados y pendientes — cada número dice si es calculado, estimado o confirmado.' } },
      { area: 'Impostos', tipo: 'novo', texto: {
        pt: 'Compra de cabelo sem factura: o sistema calcula a retenção de 8% (IUE 5% + IT 3%, F-570 e F-410) e avisa os meses sem retenção registrada.',
        es: 'Compra de cabello sin factura: el sistema calcula la retención del 8% (IUE 5% + IT 3%, F-570 y F-410) y avisa los meses sin retención registrada.' } },
      { area: 'Impostos', tipo: 'novo', texto: {
        pt: 'Documento anual para imprimir ou salvar em PDF, com as regras da época (versionadas) e o fechamento do exercício que congela os números.',
        es: 'Documento anual para imprimir o guardar en PDF, con las reglas de la época (versionadas) y el cierre de la gestión que congela los números.' } },
    ],
  },
  {
    data: '2026-11-05',
    titulo: { pt: 'A venda vira um documento: a Nota de venta', es: 'La venta se vuelve un documento: la Nota de venta' },
    resumo: {
      pt: 'O Resumo da venda agora é a nota, no jeito da factura boliviana, pronta para imprimir ou salvar em PDF. O caminho do cabelo fica só no Histórico.',
      es: 'El Resumen de la venta ahora es la nota, al estilo de la factura boliviana, lista para imprimir o guardar en PDF. El camino del cabello queda solo en el Historial.',
    },
    itens: [
      { area: 'Venda', tipo: 'novo', texto: {
        pt: 'Nota de venta: empresa e NIT, nº e data, cliente com NIT/CI, itens (quantidade, unidade, preço, desconto), total por extenso e pagamentos. Em folha (carta/A4) ou rolo de 80 mm. É documento comercial, sem validade fiscal (não é factura).',
        es: 'Nota de venta: empresa y NIT, nº y fecha, cliente con NIT/CI, ítems (cantidad, unidad, precio, descuento), total literal y pagos. En hoja (carta/A4) o rollo de 80 mm. Es un documento comercial, sin validez fiscal (no es factura).' } },
      { area: 'Venda', tipo: 'novo', tela: 'configSecao', params: { id: 'geral' }, texto: {
        pt: 'Impostos na nota: liga ou desliga o detalhe dos impostos estimados na nota impressa (o total não muda). O padrão fica em Configurações › Geral; na venda dá para trocar só naquela impressão.',
        es: 'Impuestos en la nota: activa o desactiva el detalle de los impuestos estimados en la nota impresa (el total no cambia). El estándar está en Configuración › General; en la venta se puede cambiar solo para esa impresión.' } },
      { area: 'Venda', tipo: 'melhoria', texto: {
        pt: 'Caminho do cabelo mais fácil de ler: cada etapa que aconteceu é um cartão próprio, a que ainda vai passar é uma linha apagada e o detalhe fica num cartão separado.',
        es: 'Camino del cabello más fácil de leer: cada etapa que ocurrió es una tarjeta propia, la que falta es una línea tenue y el detalle queda en una tarjeta aparte.' } },
    ],
  },
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
      { area: 'Venda', tipo: 'novo', tela: 'vendaRapida', texto: {
        pt: 'Preço da tabela na venda: embaixo de "Nesta venda", a linha "Preço da tabela" mostra cada comprador com o total; tocar troca o valor de todos os pacotes na hora (opcional — sem mexer vale o padrão). A venda guarda a coluna, o fator e a versão usados.',
        es: 'Precio de la tabla en la venta: debajo de "En esta venta", la línea "Precio de la tabla" muestra cada comprador con el total; tocar cambia el valor de todos los paquetes al momento (opcional — sin tocar vale el estándar). La venta guarda la columna, el factor y la versión usados.' } },
      { area: 'Venda', tipo: 'novo', tela: 'precos', texto: {
        pt: 'Tabelas de preço refeitas: lista limpa com filtro padrão e situação (vigente, agendada, substituída); "Onde foi usada" sempre por versão (nunca mistura); o histórico mostra quantos usos cada versão teve; nova aba "Entenda os valores".',
        es: 'Tablas de precios rehechas: lista limpia con filtro estándar y situación (vigente, programada, reemplazada); "Dónde se usó" siempre por versión (nunca mezcla); el historial muestra cuántos usos tuvo cada versión; nueva pestaña "Entienda los valores".' } },
      { area: 'Venda', tipo: 'correcao', tela: 'vendaRapida', texto: {
        pt: 'Corrigido: no modo caixa, depois de digitar na busca e retomar uma venda em aberto, a lista de pacotes ficava aberta por cima da venda.',
        es: 'Corregido: en el modo caja, después de escribir en la búsqueda y retomar una venta abierta, la lista de paquetes quedaba abierta encima de la venta.' } },
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
      { area: 'Acesso', tipo: 'novo', tela: 'auditoria', texto: {
        pt: 'Auditoria: tela própria (Gestão, só administrador) com o log bruto de toda ação — quando com segundos, quem, a ação, as referências (compra, venda, pacote, pessoa…) e as tentativas recusadas; filtros padrão e o detalhe de cada registro ao tocar. Saiu da aba de Relatórios.',
        es: 'Auditoría: pantalla propia (Gestión, solo administrador) con el registro bruto de cada acción — cuándo con segundos, quién, la acción, las referencias (compra, venta, paquete, persona…) y los intentos rechazados; filtros estándar y el detalle de cada registro al tocar. Salió de la pestaña de Informes.' } },
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
