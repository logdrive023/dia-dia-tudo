// NOVIDADES nas duas línguas: toda rodada nova já nasce com o espanhol (o tipo exige `es`; aqui confere que não está
// vazio nem é cópia do português) e as áreas e rótulos da tela têm tradução.
import { describe, expect, it } from 'vitest'
import { NOVIDADES, type Texto2 } from '../app/novidades'
import { ES } from '../ui/es'

const confere = (x: Texto2 | undefined, onde: string) => {
  if (!x) return
  expect(x.pt.trim(), `${onde}: português vazio`).not.toBe('')
  expect(x.es.trim(), `${onde}: falta o espanhol`).not.toBe('')
  expect(x.es, `${onde}: o espanhol é cópia do português`).not.toBe(x.pt)
}

describe('novidades em português e espanhol', () => {
  it('título, resumo e cada item têm o par em espanhol', () => {
    for (const n of NOVIDADES) {
      confere(n.titulo, `${n.data} título`)
      confere(n.resumo, `${n.data} resumo`)
      n.itens.forEach((i, k) => confere(i.texto, `${n.data} item ${k + 1}`))
    }
  })

  it('a mais nova fica em cima e as áreas têm nome em espanhol', () => {
    const datas = NOVIDADES.map((n) => n.data)
    expect([...datas].sort().reverse()).toEqual(datas)
    const areas = new Set(NOVIDADES.flatMap((n) => n.itens.map((i) => i.area)))
    for (const a of areas) expect(ES[a], `área "${a}" sem espanhol`).toBeTruthy()
  })
})
