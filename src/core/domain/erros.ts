/** Recusa com mensagem amigável (não é erro técnico): a tela mostra a mensagem como está. */
export class ErroNegocio extends Error {
  constructor(
    mensagem: string,
    public campo?: string,
  ) {
    super(mensagem)
    this.name = 'ErroNegocio'
  }
}

export function exigir(condicao: unknown, mensagem: string, campo?: string): asserts condicao {
  if (!condicao) throw new ErroNegocio(mensagem, campo)
}
