// O TOPO DA LOJA: com banner, a imagem escurecida por baixo do texto; sem banner, o gradiente das duas cores com as
// mechas desenhadas. O texto é sempre branco: por isso a imagem e as cores claras ganham uma camada escura.
import type { AparenciaVitrine } from '../../../core/services/vitrine'
import { bannerValido } from '../../../core/services/vitrine'
import { useT } from '../../../shared/ui/i18n'
import { capaPrecisaEscurecer, gradienteCapa } from '../model/aparencia'

export function CapaLoja({ aparencia, nome, descricao, resumo, zap }: { aparencia: AparenciaVitrine; nome: string; descricao?: string; resumo?: string; zap?: string }) {
  const t = useT()
  const banner = bannerValido(aparencia.banner) ? aparencia.banner : undefined
  return (
    <header className="relative overflow-hidden px-4 pb-10 pt-10 text-white sm:pt-14" style={{ background: gradienteCapa(aparencia) }}>
      {banner ? (
        <>
          <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25" />
        </>
      ) : (
        <>
          {capaPrecisaEscurecer(aparencia) && <span aria-hidden className="absolute inset-0 bg-black/35" />}
          <svg aria-hidden viewBox="0 0 400 200" className="pointer-events-none absolute -right-10 -top-6 h-64 w-[28rem] opacity-20" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round">
            {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${40 + k * 60} -10 C ${80 + k * 60} 60, ${k * 60} 120, ${60 + k * 60} 220`} />)}
          </svg>
        </>
      )}
      <div className="relative mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{aparencia.slogan || t('Vitrine de cabelo')}</p>
        <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-4xl">{nome}</h1>
        {descricao && <p className="mt-2 max-w-xl text-white/85">{descricao}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {resumo && <span className="rounded-full bg-white/15 px-3 py-1 font-semibold sm:backdrop-blur">{resumo}</span>}
          {zap && <a href={zap} target="_blank" rel="noreferrer" className="rounded-full bg-[#25d366] px-4 py-1.5 font-bold text-white shadow">{t('Falar no WhatsApp')}</a>}
        </div>
      </div>
    </header>
  )
}
