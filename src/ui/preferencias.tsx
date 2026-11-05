// PREFERÊNCIAS NO CABEÇALHO: tema (claro · escuro · automático) e idioma (Português · Español) numa peça só,
// com o mesmo desenho: botões em pílula dentro de uma faixa, ícone desenhado (sol, lua, tela) e bandeira de verdade
// (emoji de bandeira vira "BR"/"BO" no Windows). No celular só o ícone/bandeira; com espaço, o nome também.
// Tema vale para este aparelho; idioma vale para todo o sistema.
import { useState, type ReactNode } from 'react'
import { Bandeira } from './bandeira'
import { cx } from './base'
import { useApp, useComando, useConsulta } from './contexto'
import { salvarIdiomaAparelho, useIdiomaAparelho } from './idiomaAparelho'
import { useT } from './i18n'
import { type Tema, TEMAS, lerTema, salvarTema } from './tema'

const ICONE_TEMA: Record<Tema, ReactNode> = {
  claro: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  escuro: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  auto: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
}

function Faixa({ rotulo, titulo, children }: { rotulo: string; titulo?: string; children: ReactNode }) {
  const t = useT()
  return <div role="radiogroup" aria-label={t(rotulo)} title={titulo ? t(titulo) : undefined} className="inline-flex gap-0.5 rounded-full border border-[var(--borda)] bg-[var(--fundo)] p-1">{children}</div>
}

function Opcao({ ativa, onClick, rotulo, children }: { ativa: boolean; onClick(): void; rotulo: string; children: ReactNode }) {
  const t = useT()
  return (
    <button type="button" role="radio" aria-checked={ativa} aria-label={t(rotulo)} title={t(rotulo)} onClick={onClick}
      className={cx('inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition',
        ativa ? 'bg-[var(--cartao)] text-[var(--marca)] shadow-sm ring-1 ring-[var(--borda)]' : 'text-[var(--suave)] hover:text-[var(--texto)]')}>
      {children}
      <span className="hidden md:inline">{t(rotulo)}</span>
    </button>
  )
}

export function PreferenciasCabecalho() {
  const t = useT()
  const [tema, setTema] = useState<Tema>(lerTema)
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { dados } = useConsulta('configuracoes', {})
  const { executar } = useComando()
  const doAparelho = useIdiomaAparelho()
  const idioma = doAparelho ?? (admin ? dados?.config.idioma : dados?.config.funcionariaIdioma) ?? 'pt'
  // admin muda o idioma do SISTEMA (e tira a escolha só deste aparelho); funcionária muda só o dela, neste aparelho
  const mudarIdioma = (i: 'pt' | 'es') => {
    if (!admin) return salvarIdiomaAparelho(i === dados?.config.funcionariaIdioma ? undefined : i)
    salvarIdiomaAparelho(undefined)
    if (dados?.config.idioma !== i) void executar('salvarConfig', { idioma: i })
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Faixa rotulo="Tema" titulo="Vale para este aparelho">
        {TEMAS.map((x) => (
          <Opcao key={x.id} ativa={tema === x.id} rotulo={x.nome} onClick={() => (salvarTema(x.id), setTema(x.id))}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{ICONE_TEMA[x.id]}</svg>
          </Opcao>
        ))}
      </Faixa>
      <Faixa rotulo="Idioma" titulo={admin ? 'Vale para todo o sistema' : 'Vale para este aparelho'}>
        {(['pt', 'es'] as const).map((i) => (
          <Opcao key={i} ativa={idioma === i} rotulo={i === 'pt' ? 'Português' : 'Español'} onClick={() => idioma !== i && mudarIdioma(i)}>
            <Bandeira pais={i === 'pt' ? 'BR' : 'BO'} className="rounded-[3px]" />
          </Opcao>
        ))}
      </Faixa>
      <span className="sr-only">{t('Tema vale para este aparelho; idioma vale para todo o sistema.')}</span>
    </div>
  )
}
