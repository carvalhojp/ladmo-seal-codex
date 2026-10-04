import { useMemo, useState } from 'react'
import type { EquipmentDungeon, EquipmentRecipe } from '../data/equipment'
import { calculateLoaderProgression, calculateProgression, formatTera, parseTera, type MaterialAmounts } from '../utils/equipmentProgression'

const hasQuestReward = (dungeon: EquipmentDungeon) => Boolean(dungeon.prerequisite?.materials?.some(material => dungeon.weekly?.materials?.some(weekly => weekly.name === material.name)))

function routeLabel(recipe: EquipmentRecipe, t: Record<string, string>) {
  return recipe.label === 'Sem food' ? t.noBaseEquipment : (recipe.label ?? t.noBaseEquipment)
}

export function EquipmentProgressionCalculator({ dungeons, t }: { dungeons: EquipmentDungeon[]; t: Record<string, string> }) {
  const calculable = useMemo(() => dungeons.filter(dungeon => dungeon.recipes || dungeon.perPartCraft || dungeon.progression), [dungeons])
  const [dungeonId, setDungeonId] = useState(calculable[0]?.id ?? '')
  const [recipeIndex, setRecipeIndex] = useState(0)
  const [pieceCount, setPieceCount] = useState(1)
  const [collection, setCollection] = useState('')
  const [currentLevel, setCurrentLevel] = useState(0)
  const [targetLevel, setTargetLevel] = useState<string>('complete')
  const [materials, setMaterials] = useState<Record<string, string>>({})
  const [tera, setTera] = useState('0')
  const [questCompleted, setQuestCompleted] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const dungeon = calculable.find(item => item.id === dungeonId) ?? calculable[0]
  const recipe = dungeon?.recipes?.[recipeIndex] ?? dungeon?.recipes?.[0]
  const loaderTarget = targetLevel === 'complete' ? 'complete' : Number(targetLevel)
  const loaderSteps = dungeon?.progression ? calculateLoaderProgression(dungeon.progression, currentLevel, loaderTarget) : null
  const recipes = dungeon?.perPartCraft ? [dungeon.perPartCraft.recipe] : (dungeon?.progression ? (loaderSteps ?? []) : (recipe ? [recipe] : []))
  const multiplier = dungeon?.perPartCraft ? pieceCount : 1
  const ownedMaterials: MaterialAmounts = Object.fromEntries(Object.entries(materials).map(([name, amount]) => [name, Math.max(0, Number.parseInt(amount, 10) || 0)]))
  const canUseQuest = dungeon ? hasQuestReward(dungeon) : false
  const calculation = recipes.length ? calculateProgression({
    recipes,
    multiplier,
    ownedMaterials,
    ownedMoney: parseTera(tera),
    weekly: dungeon?.weekly,
    prerequisite: dungeon?.prerequisite,
    questCompleted: canUseQuest ? questCompleted : true,
  }) : null

  const selectDungeon = (id: string) => {
    setDungeonId(id); setRecipeIndex(0); setPieceCount(1); setCollection(''); setCurrentLevel(0); setTargetLevel('complete'); setMaterials({}); setQuestCompleted(false); setSubmitted(false)
  }
  const setOwned = (name: string, value: string) => setMaterials(previous => ({ ...previous, [name]: value }))
  const title = dungeon?.progression ? t.loader : dungeon?.perPartCraft ? `${collection || dungeon.perPartCraft.collections[0]} — ${t.perPart}` : (dungeon?.equipment?.[dungeon.recipes && dungeon.recipes.length > 1 && dungeon.equipment.length > 1 ? recipeIndex : 0] ?? dungeon?.name)

  return <section className="equipment-calculator" aria-label={t.progressionCalculator}>
    <div className="equipment-calculator-intro"><span className="eyebrow">{t.progression}</span><h2>{t.progressionCalculator}</h2><p>{t.progressionCalculatorText}</p></div>
    <div className="equipment-calculator-grid">
      <form className="equipment-calculator-form" onSubmit={event => { event.preventDefault(); setSubmitted(true) }}>
        <label>{t.desiredEquipment}<select value={dungeonId} onChange={event => selectDungeon(event.target.value)}>{calculable.map(item => <option key={item.id} value={item.id}>{item.equipment?.join(' / ') ?? item.name}</option>)}</select></label>

        {dungeon?.recipes && <label>{t.baseEquipment}<select value={recipeIndex} onChange={event => { setRecipeIndex(Number(event.target.value)); setMaterials({}); setSubmitted(false) }}>{dungeon.recipes.map((item, index) => <option key={`${item.label}-${index}`} value={index}>{routeLabel(item, t)}</option>)}</select></label>}
        {dungeon?.perPartCraft && <><label>{t.set}<select value={collection || dungeon.perPartCraft.collections[0]} onChange={event => setCollection(event.target.value)}>{dungeon.perPartCraft.collections.map(item => <option key={item}>{item}</option>)}</select></label><label>{t.pieceQuantity}<input type="number" min="1" max="6" value={pieceCount} onChange={event => setPieceCount(Math.min(6, Math.max(1, Number(event.target.value) || 1)))} /></label><small>{t.perPart}: {dungeon.perPartCraft.parts.join(' · ')}</small></>}
        {dungeon?.progression && <div className="equipment-level-fields"><label>{t.currentLevel}<select value={currentLevel} onChange={event => { setCurrentLevel(Number(event.target.value)); setSubmitted(false) }}>{Array.from({ length:11 }, (_, level) => <option key={level} value={level}>Lv {level}</option>)}</select></label><label>{t.desiredLevel}<select value={targetLevel} onChange={event => { setTargetLevel(event.target.value); setSubmitted(false) }}>{Array.from({ length:10 - currentLevel }, (_, index) => currentLevel + index + 1).map(level => <option key={level} value={level}>Lv {level}</option>)}<option value="complete">{t.loaderComplete}</option></select></label></div>}

        {calculation?.materials.map(material => <label key={material.name}>{t.materialsOwned}: {material.name}<input type="number" min="0" step="1" value={materials[material.name] ?? ''} onChange={event => setOwned(material.name, event.target.value)} placeholder="0" /></label>)}
        <label>{t.teraAvailable}<input type="text" inputMode="decimal" value={tera} onChange={event => setTera(event.target.value)} placeholder="80" /></label>
        {canUseQuest && <label className="equipment-quest-check"><input type="checkbox" checked={questCompleted} onChange={event => { setQuestCompleted(event.target.checked); setSubmitted(false) }} />{t.questCompleted}</label>}
        <button className="primary" type="submit">{t.calculateProgression}</button>
      </form>

      <div className="equipment-calculator-result" aria-live="polite">
        {!submitted && <p className="equipment-calculator-empty">{t.calculateHint}</p>}
        {submitted && !calculation && <p className="equipment-calculator-warning">{t.invalidLoaderLevel}</p>}
        {submitted && calculation && <>
          <span className="eyebrow">{t.progression}</span><h2>{title}</h2>{dungeon?.perPartCraft && <p>{t.set}: {collection || dungeon.perPartCraft.collections[0]} · {pieceCount} {t.pieces}</p>}
          {dungeon?.progression && <p>Lv {currentLevel} → {targetLevel === 'complete' ? t.loaderComplete : `Lv ${targetLevel}`}</p>}
          {dungeon?.recipes && <p>{t.route}: {routeLabel(recipe!, t)}</p>}
          <section><h3>{t.resources}</h3>{calculation.materials.map(material => <div className="equipment-calculator-material" key={material.name}><b>{material.name}</b><span>{t.required}: <strong>{material.required}</strong></span><span>{t.owned}: <strong>{material.owned}</strong></span><span>{t.missing}: <strong>{material.missing}</strong></span></div>)}</section>
          <section><h3>{t.tera}</h3><div className="equipment-calculator-money"><span>{t.totalCost}: <strong>{formatTera(calculation.money.required)}</strong></span><span>{t.owned}: <strong>{formatTera(calculation.money.owned)}</strong></span><span>{t.missing}: <strong>{formatTera(calculation.money.missing)}</strong></span></div></section>
          <section><h3>{t.estimatedTime}</h3>{calculation.weeks.weeks === null ? <p className="equipment-calculator-warning">{t.timeUnavailable}: {calculation.weeks.unknownMaterials.join(', ')}.</p> : <><b className="equipment-week-count">{calculation.weeks.weeks} {calculation.weeks.weeks === 1 ? t.week : t.weeks}</b>{calculation.weeks.weeks > 0 && <p>{calculation.includesQuest ? `${t.firstWeek}: ${Object.entries(calculation.weeks.firstWeek).map(([name, amount]) => `+${amount} ${name}`).join(' · ')}. ` : ''}{t.followingWeeks}: {Object.entries(calculation.weeks.weekly).map(([name, amount]) => `+${amount} ${name}`).join(' · ')}.</p>}</>}</section>
          {dungeon?.notes?.length ? <p className="equipment-calculator-warning">{t.rngWarning}</p> : null}
        </>}
      </div>
    </div>
  </section>
}
