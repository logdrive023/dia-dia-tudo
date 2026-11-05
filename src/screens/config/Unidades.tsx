// CONFIGURAÇÕES › Unidades: salões, pontos e depósitos (com apelido e endereço).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { limparEspacos, nomeProprio } from '../../core/domain/textoFormatado'
import { novoId } from '../../core/domain/ids'
import { Botao, Campo, Carregando, Entrada, Pilula, Selecao, Vazio } from '../../ui/base'
import { useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { GrupoCampos, JanelaCadastro } from '../../ui/janelaCadastro'

type Ed = { id: string; nome: string; apelido?: string; tipo: 'salao' | 'ponto' | 'outro'; rua?: string; numero?: string; bairro?: string; cidade?: string; pais?: string; referencia?: string; novo: boolean }

export function Unidades() {
  const t = useT()
  const { dados } = useConsulta('locais', {})
  const { executar, ocupado } = useComando()
  const [ed, setEd] = useState<Ed>()
  const salvar = async () => {
    if (!ed) return
    const { novo: _novo, ...d } = ed
    if (await executar('salvarLocal', d, t('Salvo.'))) setEd(undefined)
  }
  // ao sair do campo: nomes com a primeira letra maiúscula, sem espaço sobrando
  const arrumar = (k: keyof Ed, f: (s: string) => string) => ed && typeof ed[k] === 'string' && setEd({ ...ed, [k]: f(ed[k] as string) })
  return (
    <div>
      <Botao className="mb-3" onClick={() => setEd({ id: novoId(), nome: '', tipo: 'salao', novo: true })}>+ {t('Unidade / endereço')}</Botao>
      {!dados ? <Carregando /> : !dados.length ? <Vazio texto="Nenhuma unidade." /> : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{dados.map((l) => <li key={l.id}><button type="button" className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left" onClick={() => setEd({ ...l, novo: false })}><b>{l.nome}</b>{l.apelido && <span className="text-[var(--suave)]"> · {l.apelido}</span>} <Pilula>{t(l.tipo === 'salao' ? 'salão' : l.tipo)}</Pilula><div className="text-sm text-[var(--suave)]">{[l.rua, l.numero, l.bairro, l.cidade, l.pais].filter(Boolean).join(', ')}</div></button></li>)}</ul>
      )}
      {ed && (
        <JanelaCadastro titulo={ed.novo ? 'Nova unidade' : 'Editar unidade'} onFechar={() => setEd(undefined)} onSalvar={salvar} ocupado={ocupado} podeSalvar={!!ed.nome.trim()}>
          <GrupoCampos titulo="Unidade">
            <Campo rotulo="Nome"><Entrada value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} onBlur={() => arrumar('nome', limparEspacos)} /></Campo>
            <Campo rotulo="Apelido (opcional)" ajuda="Como a equipe chama. Ex.: Centro, a do shopping. Aparece no lugar do nome nos filtros."><Entrada value={ed.apelido ?? ''} onChange={(e) => setEd({ ...ed, apelido: e.target.value })} onBlur={() => arrumar('apelido', limparEspacos)} /></Campo>
            <Campo rotulo="Tipo"><Selecao valor={ed.tipo} onChange={(v) => setEd({ ...ed, tipo: v as 'salao' })} opcoes={[{ id: 'salao', nome: t('Salão') }, { id: 'ponto', nome: t('Ponto / depósito') }, { id: 'outro', nome: t('Outro') }]} /></Campo>
          </GrupoCampos>
          <GrupoCampos titulo="Endereço">
            {(['rua', 'numero', 'bairro', 'cidade', 'pais', 'referencia'] as const).map((k) => (
              <Campo key={k} rotulo={ROTULO_LOCAL[k]}>
                <Entrada value={ed[k] ?? ''} inputMode={k === 'numero' ? 'numeric' : undefined} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} onBlur={() => arrumar(k, k === 'referencia' ? limparEspacos : nomeProprio)} />
              </Campo>
            ))}
          </GrupoCampos>
        </JanelaCadastro>
      )}
    </div>
  )
}

/** os nomes dos campos do endereço da unidade */
const ROTULO_LOCAL = { rua: 'Rua', numero: 'Número', bairro: 'Bairro', cidade: 'Cidade', pais: 'País', referencia: 'Referência' } as const
