// SEÇÕES DAS CONFIGURAÇÕES (cada uma com endereço próprio, ver configSecoes.ts): geral e idioma, sócias, formas de
// pagamento, moedas e câmbio automático, módulos (ligar/desligar e CRIAR modalidade sem programar), etapas da compra,
// atributos, unidades, catálogo, usuários, dados (demonstração, backup) e onde os dados ficam (local × API).

// Cada seção fica no seu arquivo em ./config/ (manutenção e, depois, a ligação com a API por seção).

export { Geral } from './config/Geral'
export { Socias } from './config/Socias'
export { FormasPagamento } from './config/FormasPagamento'
export { Moedas } from './config/Moedas'
export { Modulos } from './config/Modulos'
export { Atributos } from './config/Atributos'
export { EtapasCompra } from './config/EtapasCompra'
export { Unidades } from './config/Unidades'
export { Catalogo } from './config/Catalogo'
export { Dados } from './config/Dados'
export { Usuarios } from './config/Usuarios'
