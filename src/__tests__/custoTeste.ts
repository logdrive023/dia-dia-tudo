// Testes de tela do caixa: se o preço ficou abaixo do custo, o caixa pergunta "Vender abaixo do custo?" antes de abrir o
// pagamento (o comportamento certo — ver custoVenda.test.ts). Nos testes que só querem chegar ao pagamento, a pessoa
// responde "Vender assim mesmo".
import { fireEvent, screen } from '@testing-library/react'

export async function passarAlertaDeCusto() {
  const b = await screen.findByRole('button', { name: 'Vender assim mesmo' }, { timeout: 600 }).catch(() => null)
  if (b) fireEvent.click(b)
}
