// Registro dos módulos. Módulo novo = um arquivo nesta pasta + uma linha aqui. O núcleo não muda.

import { RegistroModulos } from '../modulos'
import { moduloCabelo } from './cabelo'
import { moduloEmprestimos } from './emprestimos'
import { moduloProdutos } from './produtos'
import { moduloSalao } from './salao'

export const TODOS_MODULOS = [moduloCabelo, moduloSalao, moduloEmprestimos, moduloProdutos]

export function criarRegistro() {
  return new RegistroModulos(TODOS_MODULOS)
}
