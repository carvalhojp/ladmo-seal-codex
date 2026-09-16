import { ArrowDown, ArrowRight, GitBranch, Shield, Sparkles, Sword } from 'lucide-react'
import { buffDecksByStage, type BuffDeck, type BuffDeckEffect } from '../data/buffDeckProgression'
import { PageHead } from './PageHead'

function text(t: Record<string, string>, key: string) {
  return t[key] ?? key
}

function Effect({ effect, t }: { effect: BuffDeckEffect; t: Record<string, string> }) {
  return <li className={effect.permanent ? 'permanent' : 'conditional'}>
    <strong>{text(t, effect.id)}</strong>
    <span>{effect.permanent ? t.permanent : t.conditional}</span>
    {!effect.permanent && <small>{t.condition}: {text(t, effect.condition!)} · {t.duration}: {text(t, effect.duration!)}</small>}
  </li>
}

function DeckCard({ deck, t }: { deck: BuffDeck; t: Record<string, string> }) {
  const key = deck.id
  const requirements = deck.requirements?.map(requirement => text(t, requirement)).join(' · ')
  return <article className={`buff-deck-card ${deck.stage}`}>
    <div className="buff-deck-image"><img src={deck.image} alt={`${t.composition}: ${text(t, `${key}Name`)}`} /></div>
    <div className="buff-deck-heading"><div><span className="eyebrow">{deck.stage === 'rankU' ? `${t.stageRankU} · ${deck.rank}` : t[`stage${deck.stage[0].toUpperCase()}${deck.stage.slice(1)}`]}</span><h2>{text(t, `${key}Name`)}</h2></div>{deck.rank && <b className="deck-rank">{deck.rank}</b>}</div>
    <p className="buff-deck-context">{text(t, `${key}Context`)}</p>
    <p className="deck-focus"><Sparkles size={14}/><b>{t.focus}:</b> {text(t, `${key}Focus`)}</p>
    <div className="deck-effects"><b>{t.effects}</b><ul>{deck.effects.map(effect => <Effect key={effect.id} effect={effect} t={t}/>)}</ul></div>
    {deck.associatedDigimon && <p className="deck-associated"><Sword size={14}/><b>{t.associatedDigimon}:</b> {deck.associatedDigimon.join(' / ')}</p>}
    {(requirements || text(t, `${key}Requirements`) !== `${key}Requirements`) && <p className="deck-requirements"><Shield size={14}/><b>{t.requirements}:</b> {requirements || text(t, `${key}Requirements`)}</p>}
  </article>
}

export function BuffDeckProgression({ t }: { t: Record<string, string> }) {
  const starts = buffDecksByStage('start')
  const intermediate = buffDecksByStage('intermediate')
  const rankU = buffDecksByStage('rankU')
  return <>
    <PageHead eyebrow={t.buffDecksEyebrow} title={t.buffDecksTitle} text={t.buffDecksText}/>
    <section className="buff-deck-intro"><GitBranch size={23}/><p>{t.buffDeckIntro}</p></section>
    <section className="buff-deck-tree" aria-label={t.buffDecksTitle}>
      <div className="buff-stage"><h2>{t.stageStart}</h2><div className="buff-stage-grid start-grid">{starts.map(deck => <DeckCard key={deck.id} deck={deck} t={t}/>)}</div></div>
      <div className="tree-connector vertical"><ArrowDown aria-hidden="true"/></div>
      <div className="buff-stage"><h2>{t.stageIntermediate}</h2><div className="buff-stage-grid intermediate-grid">{intermediate.map(deck => <DeckCard key={deck.id} deck={deck} t={t}/>)}</div></div>
      <div className="tree-connector merge"><ArrowDown aria-hidden="true"/></div>
      <div className="buff-gateway"><GitBranch size={19}/><div><b>{t.stageGateway}</b><span>{t.stageGatewayText}</span></div></div>
      <div className="tree-connector vertical"><ArrowDown aria-hidden="true"/></div>
      <div className="buff-stage"><h2>{t.stageRankU}</h2><div className="buff-stage-grid rank-u-grid">{rankU.map(deck => <DeckCard key={deck.id} deck={deck} t={t}/>)}</div></div>
    </section>
  </>
}
