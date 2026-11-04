// CIDADES DA BOLÍVIA — os 340 municípios, por departamento (fonte: es.wikipedia.org, "Anexo:Municipios de Bolivia",
// revisão de 22/06/2025; contagem por departamento conferida com a página). Já vêm cadastradas no sistema; cidades
// novas (de fora ou que faltarem) entram pelo cadastro (salvarCidade) e somam a esta lista.

export const DEPARTAMENTOS_BOLIVIA = ['La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando'] as const
export type DepartamentoBolivia = (typeof DEPARTAMENTOS_BOLIVIA)[number]

/** a capital de cada departamento (aparecem primeiro na busca vazia) */
export const CAPITAIS_BOLIVIA: Record<DepartamentoBolivia, string> = {
  'La Paz': 'La Paz', Cochabamba: 'Cochabamba', 'Santa Cruz': 'Santa Cruz de la Sierra', Oruro: 'Oruro', Potosí: 'Potosí',
  Chuquisaca: 'Sucre', Tarija: 'Tarija', Beni: 'Trinidad', Pando: 'Cobija',
}

export const MUNICIPIOS_BOLIVIA: Record<DepartamentoBolivia, readonly string[]> = {
  'La Paz': ['La Paz', 'Palca', 'Mecapaca', 'Achocalla', 'El Alto', 'Achacachi', 'Ancoraimes', 'Chua Cocani', 'Huarina', 'Santiago de Huata', 'Huatajata', 'Coro Coro', 'Caquiaviri', 'Calacoto', 'Comanche', 'Charaña', 'Waldo Ballivián', 'Nazacara de Pacajes', 'Callapa', 'Puerto Acosta', 'Mocomoco', 'Puerto Carabuco', 'Humanata', 'Escoma', 'Chuma', 'Ayata', 'Aucapata', 'Sorata', 'Guanay', 'Tacacoma', 'Quiabaya', 'Combaya', 'Tipuani', 'Mapiri', 'Teoponte', 'Apolo', 'Pelechuco', 'Viacha', 'Guaqui', 'Tiahuanaco', 'Desaguadero', 'San Andrés de Machaca', 'Jesús de Machaca', 'Taraco', 'Luribay', 'Sapahaqui', 'Yaco', 'Malla', 'Cairoma', 'Inquisivi', 'Quime', 'Cajuata', 'Colquiri', 'Ichoca', 'Licoma Pampa', 'Chulumani', 'Irupana', 'Yanacachi', 'Palos Blancos', 'La Asunta', 'Pucarani', 'Laja', 'Batallas', 'Puerto Pérez', 'Sica Sica', 'Umala', 'Ayo Ayo', 'Calamarca', 'Patacamaya', 'Colquencha', 'Collana', 'Coroico', 'Coripata', 'Ixiamas', 'San Buenaventura', 'Charazani', 'Curva', 'Copacabana', 'San Pedro de Tiquina', 'Tito Yupanqui', 'San Pedro de Curahuara', 'Papel Pampa', 'Chacarilla', 'Santiago de Machaca', 'Catacora', 'Caranavi', 'Alto Beni'],
  Cochabamba: ['Cochabamba', 'Aiquile', 'Pasorapa', 'Omereque', 'Independencia', 'Morochata', 'Cocapata', 'Tarata', 'Anzaldo', 'Arbieto', 'Sacabamba', 'Arani', 'Vacas', 'Arque', 'Tacopaya', 'Capinota', 'Santiváñez', 'Sicaya', 'Cliza', 'Toco', 'Tolata', 'Quillacollo', 'Sipe Sipe', 'Tiquipaya', 'Vinto', 'Colcapirhua', 'Sacaba', 'Colomi', 'Villa Tunari', 'Tapacarí', 'Totora', 'Pojo', 'Pocona', 'Chimoré', 'Puerto Villarroel', 'Entre Ríos', 'Mizque', 'Vila Vila', 'Alalay', 'Punata', 'Villa Rivero', 'San Benito', 'Tacachi', 'Cuchumuela', 'Bolívar', 'Tiraque', 'Shinahota'],
  'Santa Cruz': ['Santa Cruz de la Sierra', 'Cotoca', 'Porongo', 'La Guardia', 'El Torno', 'Warnes', 'Okinawa Uno', 'San Ignacio de Velasco', 'San Miguel de Velasco', 'San Rafael de Velasco', 'Buena Vista', 'San Carlos', 'Villa Yapacaní', 'San Juan de Yapacaní', 'San José de Chiquitos', 'Pailón', 'Roboré', 'Portachuelo', 'Santa Rosa del Sara', 'Colpa Bélgica', 'Lagunillas', 'Charagua', 'Cabezas', 'Cuevo', 'Gutiérrez (Kereimba Iyambae)', 'Camiri', 'Boyuibe', 'Vallegrande', 'El Trigal', 'Moro Moro', 'Postrervalle', 'Pucará', 'Samaipata', 'Pampagrande', 'Mairana', 'Quirusillas', 'Montero', 'General Saavedra', 'Mineros', 'Fernández Alonso', 'San Pedro', 'Concepción', 'San Javier', 'San Ramón', 'San Julián', 'San Antonio de Lomerío', 'Cuatro Cañadas', 'San Matías', 'Comarapa', 'Saipina', 'Puerto Suárez', 'Puerto Quijarro', 'El Carmen Rivero Tórrez', 'Ascensión de Guarayos', 'Urubichá', 'El Puente'],
  Oruro: ['Oruro', 'Caracollo', 'El Choro', 'Paria', 'Challapata', 'Santuario de Quillacas', 'Corque', 'Choquecota', 'Curahuara de Carangas', 'Turco', 'Huachacalla', 'Escara', 'Cruz de Machacamarca', 'Yunguyo de Litoral', 'Esmeralda', 'Poopó', 'Pazña', 'Antequera', 'Huanuni', 'Machacamarca', 'Salinas de Garci Mendoza', 'Pampa Aullagas', 'Sabaya', 'Coipasa', 'Chipaya', 'Toledo', 'Eucaliptus', 'Santiago de Andamarca', 'Belén de Andamarca', 'Totora', 'Santiago de Huari', 'La Rivera', 'Todos Santos', 'Carangas', 'Huayllamarca'],
  Potosí: ['Potosí', 'Tinguipaya', 'Yocalla', 'Urmiri', 'Uncía', 'Chayanta', 'Llallagua', 'Chuquihuta', 'Betanzos', 'Chaquí', 'Tacobamba', 'Colquechaca', 'Ravelo', 'Pocoata', 'Ocurí', 'San Pedro de Macha', 'San Pedro de Buena Vista', 'Toro Toro', 'Santiago de Cotagaita', 'Vitichi', 'Sacaca', 'Caripuyo', 'Tupiza', 'Atocha', 'Colcha K', 'San Pedro de Quemes', 'San Pablo de Lípez', 'Mojinete', 'San Antonio de Esmoruco', 'Puna', 'Caiza D', 'Ckochas', 'Uyuni', 'Tomave', 'Porco', 'Arampampa', 'Acasio', 'Llica', 'Tahua', 'Villazón', 'San Agustín'],
  Chuquisaca: ['Sucre', 'Yotala', 'Poroma', 'Azurduy', 'Tarvita', 'Villa Zudáñez', 'Presto', 'Villa Mojocoya', 'Icla', 'Padilla', 'Tomina', 'Sopachuy', 'Villa Alcalá', 'El Villar', 'Monteagudo', 'Huacareta', 'Tarabuco', 'Yamparáez', 'Camargo', 'San Lucas', 'Incahuasi', 'Villa Charcas', 'Villa Serrano', 'Villa Abecia', 'Culpina', 'Las Carreras', 'Villa Vaca Guzmán (Muyupampa)', 'Huacaya', 'Macharetí'],
  Tarija: ['Tarija', 'Padcaya', 'Bermejo', 'Yacuiba', 'Caraparí', 'Villa Montes', 'Uriondo', 'Yunchará', 'San Lorenzo', 'El Puente', 'Entre Ríos'],
  Beni: ['Trinidad', 'San Javier', 'Riberalta', 'Guayaramerín', 'Reyes', 'San Borja', 'Santa Rosa', 'Rurrenabaque', 'Santa Ana del Yacuma', 'Exaltación', 'San Ignacio de Moxos', 'Loreto', 'San Andrés', 'San Joaquín', 'San Ramón', 'Puerto Siles', 'Magdalena', 'Baures', 'Huacaraje'],
  Pando: ['Cobija', 'Porvenir', 'Bolpebra', 'Bella Flor', 'Puerto Rico', 'San Pedro', 'Filadelfia', 'Puerto Gonzalo Moreno', 'San Lorenzo', 'Sena', 'Santa Rosa del Abuná', 'Ingavi', 'Nueva Esperanza', 'Villa Nueva', 'Santos Mercado'],
}

export interface Cidade {
  nome: string
  departamento?: string
  pais: string
  /** capital de departamento */
  capital?: boolean
  /** cadastrada pela pessoa (não veio na lista) */
  extra?: boolean
}

/** todas as cidades da Bolívia (com o departamento), capitais marcadas */
export const CIDADES_BOLIVIA: Cidade[] = DEPARTAMENTOS_BOLIVIA.flatMap((d) =>
  MUNICIPIOS_BOLIVIA[d].map((nome) => ({ nome, departamento: d, pais: 'Bolívia', ...(CAPITAIS_BOLIVIA[d] === nome ? { capital: true } : {}) })),
)

/** o texto que fica gravado no destino: o nome; com o departamento quando o nome se repete (ex.: "Totora · Oruro") */
export function textoCidade(c: Pick<Cidade, 'nome' | 'departamento'>, todas: Pick<Cidade, 'nome'>[] = CIDADES_BOLIVIA) {
  const repete = todas.filter((x) => x.nome === c.nome).length > 1
  return repete && c.departamento ? `${c.nome} · ${c.departamento}` : c.nome
}

/** busca sem acento e sem maiúscula ("potosi" acha "Potosí") */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
