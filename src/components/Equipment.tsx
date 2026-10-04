import { useState } from 'react'
import { ChevronRight, CircleHelp, Coins, Hammer, Repeat2, ScrollText, Swords } from 'lucide-react'
import { equipmentDungeons, equipmentPerfectModels, type EquipmentInfo, type EquipmentRecipe } from '../data/equipment'
import { EquipmentProgressionCalculator } from './EquipmentProgressionCalculator'
import { PageHead } from './PageHead'

function Info({ info, requiredLabel, rewardLabel }: { info: EquipmentInfo; requiredLabel?: string; rewardLabel?: string }) {
  if (requiredLabel || rewardLabel) return <div className="equipment-info equipment-quest-flow">
    {info.label && <b>{info.label}</b>}
    <div className="equipment-quest-flow-row"><small>{requiredLabel}</small><div>{info.materials?.map(item => <span key={item.name}><strong>{item.amount}</strong> {item.name}</span>)}{info.money && <span><strong>{info.money}</strong></span>}</div></div>
    {info.text && <div className="equipment-quest-flow-row"><small>{rewardLabel}</small><p>{info.text.replace(/^Recompensa:\s*/i, '')}</p></div>}
  </div>
  return <div className="equipment-info">
    {info.label && <b>{info.label}</b>}
    {info.text && <p>{info.text}</p>}
    {info.materials?.map(item => <span key={item.name}><strong>{item.amount}</strong> {item.name}</span>)}
    {info.money && <span><strong>{info.money}</strong></span>}
  </div>
}

function Recipe({ recipe, t }: { recipe: EquipmentRecipe; t: Record<string, string> }) {
  return <li className="equipment-recipe">
    <b>{recipe.label === 'Sem food' ? t.noBaseEquipment : recipe.label}</b>
    {recipe.consumes && <span className="equipment-consumes">{recipe.consumes}</span>}
    <div>{recipe.materials.map(item => <span key={item.name}><strong>{item.amount}</strong> {item.name}</span>)}{recipe.money && <span><strong>{recipe.money}</strong></span>}</div>
    {recipe.note && <small>{recipe.note}</small>}
  </li>
}

export function Equipment({ t }: { t: Record<string, string> }) {
  const [view, setView] = useState<'dungeons'|'models'|'calculator'>('dungeons')
  const glossary = [
    ['AT', t.equipmentGlossaryAT], ['HT', t.equipmentGlossaryHT], ['CT', t.equipmentGlossaryCT], ['DC', t.equipmentGlossaryDC], ['AS', t.equipmentGlossaryAS], ['ATT', t.equipmentGlossaryATT], ['DF', t.equipmentGlossaryDF],
  ] as const
  const attributeDescriptions = Object.fromEntries(glossary)
  return <>
    <PageHead eyebrow={t.equipmentEyebrow} title={t.equipmentTitle} text={t.equipmentText}/>
    <div className="subtabs equipment-tabs" aria-label={t.equipmentTitle}>
      <button className={view==='dungeons'?'active':''} aria-pressed={view==='dungeons'} onClick={()=>setView('dungeons')}>{t.dungeons}</button>
      <button className={view==='models'?'active':''} aria-pressed={view==='models'} onClick={()=>setView('models')}>{t.perfectModels}</button>
      <button className={view==='calculator'?'active':''} aria-pressed={view==='calculator'} onClick={()=>setView('calculator')}>{t.progressionCalculator}</button>
    </div>
    {view==='dungeons' ? <section className="equipment-grid" aria-label={t.dungeons}>{equipmentDungeons.map(dungeon => <article className="equipment-card" data-dungeon={dungeon.id} key={dungeon.id}>
      <header className="equipment-heading">{dungeon.bossImage && <img src={encodeURI(`${import.meta.env.BASE_URL}${dungeon.bossImage.slice(1)}`)} alt=""/>}<div><span className="eyebrow">{t.dungeon}{dungeon.abbreviation ? ` · ${dungeon.abbreviation}` : ''}</span><h2>{dungeon.name}</h2>{dungeon.equipment?.map(item => <p key={item}>{item}</p>)}</div></header>
      {dungeon.prerequisite && <section><h3><ScrollText/> {t.prerequisite}</h3><Info info={dungeon.prerequisite} requiredLabel={dungeon.id === 'arena-hard' ? t.required : undefined} rewardLabel={dungeon.id === 'arena-hard' ? t.equipmentReward : undefined}/></section>}
      {dungeon.weekly && <section><h3><Swords/> {t.weekly}</h3><Info info={dungeon.weekly}/></section>}
      {dungeon.difficulties && <section><h3><Swords/> {t.difficulties}</h3><div className="equipment-difficulties">{dungeon.difficulties.map(item => <Info key={item.label} info={item}/>)}</div></section>}
      {dungeon.exchange && <section><h3><Repeat2/> {t.exchange}</h3><Info info={dungeon.exchange}/></section>}
      {dungeon.perPartCraft && <section><h3><Hammer/> {t.crafting}</h3><div className="equipment-part-craft"><p><b>{dungeon.perPartCraft.collections.join(' · ')}</b> — {dungeon.perPartCraft.parts.join(' · ')}</p><Recipe recipe={dungeon.perPartCraft.recipe} t={t}/></div></section>}
      {dungeon.recipes && <details className="equipment-details" open><summary><Hammer/> {t.crafting}<ChevronRight/></summary><ul>{dungeon.recipes.map((recipe, index) => <Recipe key={`${recipe.label}-${index}`} recipe={recipe} t={t}/>)}</ul></details>}
      {dungeon.progression && <details className="equipment-details"><summary><ChevronRight/> {t.progression}<ChevronRight/></summary><ol className="equipment-progression">{dungeon.progression.map(recipe => <Recipe key={recipe.label} recipe={recipe} t={t}/>)}</ol></details>}
      {dungeon.reroll && <section><h3><Repeat2/> {t.reroll}</h3><ul><Recipe recipe={dungeon.reroll} t={t}/></ul></section>}
      {dungeon.notes && <section className="equipment-notes"><h3><CircleHelp/> {t.notes}</h3>{dungeon.notes.map(note => <p key={note}>{note}</p>)}</section>}
    </article>)}</section> : view==='models' ? <section className="equipment-models" aria-label={t.perfectModels}>
      <div className="equipment-models-intro"><div><span className="eyebrow">{t.attributes}</span><h2>{t.perfectModels}</h2><p>{t.registeredModels}</p></div><div className="equipment-glossary" aria-label={t.glossary}>{glossary.map(([attribute, description])=><span key={attribute}><b>{attribute}</b> — {description}</span>)}</div></div>
      <div className="equipment-model-grid">{equipmentPerfectModels.map(equipment => <article className="equipment-model-card" key={equipment.id}>
        <header><span className="eyebrow">{equipment.type ?? t.equipmentLabel}</span><h2>{equipment.name}</h2>{equipment.relatedDungeon && <p>{t.relatedDungeon}: {equipment.relatedDungeon}</p>}</header>
        <h3>{t.perfectModels}</h3>
        <div className="equipment-perfect-models">{equipment.perfectModels.map((model, index) => <section className="equipment-perfect-model" key={`${equipment.id}-${index}`} aria-label={`${t.perfectModel} ${index + 1}`}><span>{t.perfectModel} {index + 1}</span><div>{model.map((attribute, position)=><b className="equipment-attribute-tag" data-attribute={attribute} title={attributeDescriptions[attribute]} key={`${attribute}-${position}`}>{attribute}</b>)}</div></section>)}</div>
      </article>)}</div>
    </section> : <EquipmentProgressionCalculator dungeons={equipmentDungeons} t={t}/>}
  </>
}
