import ocrEvidence from './dUnitOcrEvidence.json'

/**
 * The screenshots are the primary source. OCR text is deliberately kept as
 * evidence only: it is never promoted to a calculated value without a visual
 * confirmation. This lets the catalogue be completed safely over time.
 */
export type DUnitUnit = 'absolute' | 'percent'
export interface DUnitBonus {
  rawLabel: string
  attribute?: string
  qualifier?: string
  value: number | null
  unit: DUnitUnit | null
  confirmed: boolean
}
export interface DUnitCondition {
  id: string
  position: 1 | 2 | 3 | 4
  requirement: string
  digimonNames: string[]
  bonus: DUnitBonus
  confirmed: boolean
  /** Unedited OCR fragment, retained only to make a later visual review fast. */
  evidence: string
}
export interface DUnitSet {
  id: string
  name: string
  nameConfirmed: boolean
  sourceFiles: string[]
  conditions: [DUnitCondition, DUnitCondition, DUnitCondition, DUnitCondition]
}

type EvidenceRow = { file: string; text: string }
const evidenceByFile = new Map((ocrEvidence as EvidenceRow[]).map(row => [row.file, row.text]))

const complementFiles: Record<number, string[]> = {
  1:['1.1.png'], 8:['8.1.png'], 12:['12.1.png'], 49:['49.1.png'], 62:['62.1.png'], 83:['83.1.png'],
  106:['106.1.png'], 119:['119.1.png'], 125:['125.1.png'], 128:['128.1.png'], 130:['130.1.png'],
  195:['195.1.png'], 209:['209.1.png'], 210:['210.1.png'], 211:['211.1.png'], 222:['222.1.png'],
  225:['225.1.png'], 228:['228.1.png'], 230:['230.1.png'], 249:['249.1.png'], 253:['253.1.png'],
  255:['255.1.png'], 262:['262.1.png','262.2.png'], 265:['265.1.png'], 269:['269.1.png'],
}

const normalized = (text: string) => text.replace(/Digimonst/g, 'Digimons').replace(/\bl%/g, '1%').replace(/Escuridã0/g, 'Escuridão').trim()
const candidates = (text: string) => {
  const matches = [...normalized(text).matchAll(/((?:Obtido\s+\d+\s+Digimons(?:\s+Transcendidos)?|Nível\s+Total\s+dos\s+Digimons\s+\d+)[^]*?)(?=(?:Obtido\s+\d+\s+Digimons|Nível\s+Total\s+dos\s+Digimons)|$)/g)]
  return matches.slice(0, 4).map(match => match[1].replace(/\s+(?:LV\.|Lv\.).*$/i, '').trim())
}
const candidateName = (text: string, fallback: string) => {
  const value = normalized(text).split(/(?:\b(?:LV|Lv)\.|Efeito|Obtido\s+\d+\s+Digimons)/)[0].replace(/^[^A-Za-zÀ-ÿ]+/, '').trim()
  return value && value.length < 90 ? value : fallback
}
const emptyCondition = (setId: string, position: 1 | 2 | 3 | 4, evidence: string): DUnitCondition => ({
  id: `${setId}-condition-${position}`, position, requirement: '', digimonNames: [],
  bonus: { rawLabel: '', value: null, unit: null, confirmed: false }, confirmed: false, evidence,
})
const fromEvidence = (setId: string, position: 1 | 2 | 3 | 4, evidence: string): DUnitCondition => {
  const value = normalized(evidence)
  const comma = value.indexOf(',')
  if (comma < 0) return emptyCondition(setId, position, value)
  return { ...emptyCondition(setId, position, value), requirement: value.slice(0, comma).trim(), bonus: { rawLabel: value.slice(comma + 1).trim(), value: null, unit: null, confirmed: false } }
}
const setFromSource = (id: string, primaryFile: string, sourceFiles: string[], fallback: string): DUnitSet => {
  const evidence = evidenceByFile.get(primaryFile) ?? ''
  const lines = candidates(evidence)
  return {
    id, name: candidateName(evidence, fallback), nameConfirmed: false, sourceFiles,
    conditions: ([1,2,3,4] as const).map(position => fromEvidence(id, position, lines[position - 1] ?? '')) as DUnitSet['conditions'],
  }
}

type Confirmed = Omit<DUnitCondition, 'id' | 'position' | 'evidence'>
const confirmed = (requirement: string, rawLabel: string, attribute: string, value: number, unit: DUnitUnit, qualifier?: string): Confirmed => ({ requirement, digimonNames: [], bonus: { rawLabel, attribute, qualifier, value, unit, confirmed: true }, confirmed: true })
const applyConfirmed = (set: DUnitSet, name: string, conditions: [Confirmed, Confirmed, Confirmed, Confirmed]) => ({
  ...set, name, nameConfirmed: true,
  conditions: conditions.map((condition, index) => ({ ...condition, id: `${set.id}-condition-${index + 1}`, position: (index + 1) as 1|2|3|4, evidence: set.conditions[index].evidence })) as DUnitSet['conditions'],
})

const ordinary = Array.from({ length: 276 }, (_, index) => index + 1)
  .filter(number => number !== 185 && number !== 213)
  .map(number => setFromSource(`dunit-${number}`, `${number}.png`, [`${number}.png`, ...(complementFiles[number] ?? [])], `D-Unit ${number}`))
const special185 = setFromSource('dunit-185-source-backtick', '`185.png', ['`185.png'], 'D-Unit 185')
const special213 = setFromSource('dunit-213-source-backtick', '`213.png', ['`213.png','213.1.png','213.2.png'], 'D-Unit 213')
const special275 = setFromSource('dunit-275-source-backtick', '`275.png', ['`275.png'], 'D-Unit 275')
const special276 = setFromSource('dunit-276-source-backtick', '`276.png', ['`276.png'], 'D-Unit 276')

export const dUnitSets: DUnitSet[] = [...ordinary, special185, special213, special275, special276]

const replace = (id: string, name: string, rows: [Confirmed, Confirmed, Confirmed, Confirmed]) => {
  const index = dUnitSets.findIndex(set => set.id === id)
  dUnitSets[index] = applyConfirmed(dUnitSets[index], name, rows)
}
replace('dunit-1', 'Corrida', [
  confirmed('Obtido 9 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 990', 'CT +30', 'CT', 30, 'absolute'), confirmed('Obtido 9 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 1260', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-100', 'Dracomon[Tipo: Verde]', [
  confirmed('Obtido 5 Digimons', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 550', 'BL +50', 'BL', 50, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-185-source-backtick', 'Kotemon[Gladimon]', [
  confirmed('Obtido 4 Digimons', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'BL +50', 'BL', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Ataque habilidade Unknown +1%', 'Ataque habilidade', 1, 'percent', 'Unknown'),
])
replace('dunit-213-source-backtick', 'Transcendendo o Tempo, lenda começa!', [
  confirmed('Obtido 21 Digimons', 'EXP +50%', 'EXP', 50, 'percent'), confirmed('Nível Total dos Digimons 2330', 'CT +50', 'CT', 50, 'absolute'), confirmed('Obtido 21 Digimons Transcendidos', 'Dano habilidade Básico +1%', 'Dano habilidade', 1, 'percent', 'Básico'), confirmed('Nível Total dos Digimons 2960', 'Ataque habilidade Vaccine +2%', 'Ataque habilidade', 2, 'percent', 'Vaccine'),
])
replace('dunit-262', 'Dez Guerreiro', [
  confirmed('Obtido 21 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 2330', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'), confirmed('Obtido 21 Digimons Transcendidos', 'EXP +50%', 'EXP', 50, 'percent'), confirmed('Nível Total dos Digimons 2960', 'SCD +2%', 'SCD', 2, 'percent'),
])
replace('dunit-269', 'Destruição do Mundo Digital', [
  confirmed('Obtido 9 Digimons', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Nível Total dos Digimons 1030', 'BL +50', 'BL', 50, 'absolute'), confirmed('Obtido 9 Digimons Transcendidos', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'), confirmed('Nível Total dos Digimons 1300', 'Dano habilidade Básico +1%', 'Dano habilidade', 1, 'percent', 'Básico'),
])
replace('dunit-275', 'Aquele que Desceu com o Brilho', [
  confirmed('Obtido 3 Digimons', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 350', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 3 Digimons Transcendidos', 'HT +50', 'HT', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'SCD +1%', 'SCD', 1, 'percent'),
])
replace('dunit-275-source-backtick', 'Dungeon Masters', [
  confirmed('Obtido 2 Digimons', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 390', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Obtido 3 Digimons Transcendidos', 'HT +50', 'HT', 50, 'absolute'), confirmed('Nível Total dos Digimons 480', 'SCD +1%', 'SCD', 1, 'percent'),
])
replace('dunit-276', 'O Último Reino, Sol Brilhante', [
  confirmed('Obtido 3 Digimons', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 380', 'Dano habilidade Básico +1%', 'Dano habilidade', 1, 'percent', 'Básico'), confirmed('Obtido 3 Digimons Transcendidos', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Nível Total dos Digimons 470', 'Dano habilidade Fogo +2%', 'Dano habilidade', 2, 'percent', 'Fogo'),
])
replace('dunit-276-source-backtick', 'Net Ocean', [
  confirmed('Obtido 5 Digimons', 'HT +50', 'HT', 50, 'absolute'), confirmed('Nível Total dos Digimons 590', 'Dano habilidade Madeira +1%', 'Dano habilidade', 1, 'percent', 'Madeira'), confirmed('Obtido 5 Digimons Transcendidos', 'Dano habilidade Básico +1%', 'Dano habilidade', 1, 'percent', 'Básico'), confirmed('Nível Total dos Digimons 740', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-2', 'Gabumon [CresGarurumon]', [
  confirmed('Obtido 5 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 550', 'BL +20', 'BL', 20, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-3', 'Sefirotmon', [
  confirmed('Obtido 1 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 110', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 1 Digimons Transcendidos', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-4', 'OMEGA : VA', [
  confirmed('Obtido 3 Digimons', 'BL +30', 'BL', 30, 'absolute'), confirmed('Nível Total dos Digimons 330', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Obtido 3 Digimons Transcendidos', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'), confirmed('Nível Total dos Digimons 420', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-5', 'Gabumon [CresGarurumon]', [
  confirmed('Obtido 5 Digimons', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 600', 'AT +20', 'AT', 20, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Nível Total dos Digimons 750', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-6', 'Baihumon', [
  confirmed('Obtido 4 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 480', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 600', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-7', 'Gizumon', [
  confirmed('Obtido 2 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 220', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 2 Digimons Transcendidos', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 280', 'Ataque habilidade Unknown +1%', 'Ataque habilidade', 1, 'percent', 'Unknown'),
])
replace('dunit-8', 'Digimon Tamers', [
  confirmed('Obtido 9 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 990', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 9 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 1260', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-9', 'Agumon (Black)', [
  confirmed('Obtido 5 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 550', 'DS +120', 'DS', 120, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-10', 'ToyAgumon', [
  confirmed('Obtido 2 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 220', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 2 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 280', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-11', 'Xuanwumon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 480', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 600', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-12', 'Guilmon', [
  confirmed('Obtido 10 Digimons', 'AT +20', 'AT', 20, 'absolute'), confirmed('Nível Total dos Digimons 1200', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'), confirmed('Obtido 10 Digimons Transcendidos', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Nível Total dos Digimons 1500', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'),
])
replace('dunit-13', 'Agumon', [
  confirmed('Obtido 8 Digimons', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 960', 'DE +150', 'DE', 150, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 1200', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'),
])
replace('dunit-14', 'Agumon (Black) [Millenniummon]', [
  confirmed('Obtido 7 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 840', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 7 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 1050', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-15', 'Evolução do Espírito Antigo', [
  confirmed('Obtido 3 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 340', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 430', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-16', 'ToyAgumon', [
  confirmed('Obtido 3 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 330', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 420', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-17', 'Gabumon', [
  confirmed('Obtido 7 Digimons', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 840', 'DE +150', 'DE', 150, 'absolute'), confirmed('Obtido 7 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 1050', 'Dano habilidade Luz +2%', 'Dano habilidade', 2, 'percent', 'Luz'),
])
replace('dunit-18', 'Gabumon (Black)', [
  confirmed('Obtido 5 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 550', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-19', 'Salamon [Gatomon]', [
  confirmed('Obtido 8 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 960', 'AT +30', 'AT', 30, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 1200', 'Ataque habilidade Unknown +1%', 'Ataque habilidade', 1, 'percent', 'Unknown'),
])
replace('dunit-20', 'Dokunemon', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'),
])
replace('dunit-21', 'Fúria do Arcanjo Caído', [
  confirmed('Obtido 2 Digimons', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 240', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 2 Digimons Transcendidos', 'EXP +50%', 'EXP', 50, 'percent'), confirmed('Nível Total dos Digimons 300', 'Ataque habilidade Unknown +1%', 'Ataque habilidade', 1, 'percent', 'Unknown'),
])
replace('dunit-22', 'MagnaGarurumon', [
  confirmed('Obtido 1 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 110', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 1 Digimons Transcendidos', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-23', 'Salamon [Lilithmon]', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-24', 'Salamon [Gatomon]', [
  confirmed('Obtido 8 Digimons', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 960', 'AT +50', 'AT', 50, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 1200', 'Ataque habilidade Unknown +2%', 'Ataque habilidade', 2, 'percent', 'Unknown'),
])
replace('dunit-25', 'Os Três Arcanjos', [
  confirmed('Obtido 3 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 330', 'DE +100', 'DE', 100, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'), confirmed('Nível Total dos Digimons 420', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'),
])
replace('dunit-26', 'Palmon [Togemon]', [
  confirmed('Obtido 4 Digimons', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 440', 'BL +30', 'BL', 30, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-27', 'Patamon', [
  confirmed('Obtido 6 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 660', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-28', 'Salamon [Silphymon]', [
  confirmed('Obtido 8 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 880', 'DS +120', 'DS', 120, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Gelo +1%', 'Dano habilidade', 1, 'percent', 'Gelo'),
])
replace('dunit-29', 'Zhuqiaomon', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 480', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 600', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-30', 'Hagurumon [Mechanorimon]', [
  confirmed('Obtido 7 Digimons', 'DE +50', 'DE', 50, 'absolute'), confirmed('Nível Total dos Digimons 770', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 7 Digimons Transcendidos', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'), confirmed('Nível Total dos Digimons 980', 'HP +150', 'HP', 150, 'absolute'),
])
replace('dunit-31', 'Agumon', [
  confirmed('Obtido 8 Digimons', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 1040', 'HT +50', 'HT', 50, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Nível Total dos Digimons 1280', 'Ataque habilidade Vaccine +2%', 'Ataque habilidade', 2, 'percent', 'Vaccine'),
])
replace('dunit-32', 'Dobermon', [
  confirmed('Obtido 3 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 330', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 420', 'EV +100', 'EV', 100, 'absolute'),
])
replace('dunit-33', 'Piyomon', [
  confirmed('Obtido 5 Digimons', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 550', 'BL +30', 'BL', 30, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-34', 'Tentomon', [
  confirmed('Obtido 5 Digimons', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Nível Total dos Digimons 550', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 5 Digimons Transcendidos', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-35', 'Bearmon', [
  confirmed('Obtido 7 Digimons', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Nível Total dos Digimons 770', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 7 Digimons Transcendidos', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'), confirmed('Nível Total dos Digimons 980', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-36', 'V-mon [ExV-mon]', [
  confirmed('Obtido 8 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 880', 'CT +30', 'CT', 30, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Madeira +1%', 'Dano habilidade', 1, 'percent', 'Madeira'),
])
replace('dunit-37', 'Kunemon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'EV +30', 'EV', 30, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'EXP +20%', 'EXP', 20, 'percent'),
])
replace('dunit-38', 'Deputymon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'EV +70', 'EV', 70, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-39', 'Palmon [Woodmon]', [
  confirmed('Obtido 6 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 660', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Madeira +1%', 'Dano habilidade', 1, 'percent', 'Madeira'),
])
replace('dunit-40', 'Hawkmon', [
  confirmed('Obtido 8 Digimons', 'DS +120', 'DS', 120, 'absolute'), confirmed('Nível Total dos Digimons 880', 'DS +150', 'DS', 150, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'DE +100', 'DE', 100, 'absolute'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-41', 'Guilmon [ChaosGallantmon]', [
  confirmed('Obtido 5 Digimons', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Nível Total dos Digimons 550', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 5 Digimons Transcendidos', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-42', 'Gomamon [Jijimon]', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-43', 'V-mon [Veedramon]', [
  confirmed('Obtido 7 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 770', 'DE +100', 'DE', 100, 'absolute'), confirmed('Obtido 7 Digimons Transcendidos', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'), confirmed('Nível Total dos Digimons 980', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-44', 'Dorumon [Dorugamon]', [
  confirmed('Obtido 4 Digimons', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Nível Total dos Digimons 440', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Obtido 4 Digimons Transcendidos', 'EXP +50%', 'EXP', 50, 'percent'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-45', 'Guilmon', [
  confirmed('Obtido 8 Digimons', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 1040', 'HT +30', 'HT', 30, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Nível Total dos Digimons 1280', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-46', 'Tsukaimon [Barbamon]', [
  confirmed('Obtido 5 Digimons', 'DE +50', 'DE', 50, 'absolute'), confirmed('Nível Total dos Digimons 600', 'HP +50', 'HP', 50, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Nível Total dos Digimons 750', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-47', 'Guilmon', [
  confirmed('Obtido 7 Digimons', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 910', 'HT +50', 'HT', 50, 'absolute'), confirmed('Obtido 7 Digimons Transcendidos', 'Ataque habilidade Virus +2%', 'Ataque habilidade', 2, 'percent', 'Virus'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Luz +2%', 'Dano habilidade', 2, 'percent', 'Luz'),
])
replace('dunit-48', 'PicoDevimon [Myotismon]', [
  confirmed('Obtido 5 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 550', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'),
])
replace('dunit-49', 'Dark and Darker', [
  confirmed('Obtido 9 Digimons', 'DS +150', 'DS', 150, 'absolute'), confirmed('Nível Total dos Digimons 990', 'DS +150', 'DS', 150, 'absolute'), confirmed('Obtido 9 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 1260', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-50', 'PicoDevimon', [
  confirmed('Obtido 4 Digimons', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 440', 'BL +30', 'BL', 30, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-51', 'Guardião dos Quatro Ventos', [
  confirmed('Obtido 5 Digimons', 'HP +500', 'HP', 500, 'absolute'), confirmed('Nível Total dos Digimons 560', 'HP +200', 'HP', 200, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'Ataque habilidade Data +2%', 'Ataque habilidade', 2, 'percent', 'Data'), confirmed('Nível Total dos Digimons 710', 'Dano habilidade Terra +2%', 'Dano habilidade', 2, 'percent', 'Terra'),
])
replace('dunit-52', 'PicoDevimon [Soulmon]', [
  confirmed('Obtido 6 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 660', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-53', 'Bearmon', [
  confirmed('Obtido 6 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 660', 'CT +30', 'CT', 30, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'),
])
replace('dunit-54', 'Cavaleiro da Vacina', [
  confirmed('Obtido 3 Digimons', 'BL +30', 'BL', 30, 'absolute'), confirmed('Nível Total dos Digimons 320', 'EV +100', 'EV', 100, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'), confirmed('Nível Total dos Digimons 430', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'),
])
replace('dunit-55', 'Wormmon', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-56', 'Agunimon', [
  confirmed('Obtido 1 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 110', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 1 Digimons Transcendidos', 'AT +20', 'AT', 20, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-57', 'Qinglongmon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 480', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 600', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'),
])
replace('dunit-58', 'Finding For Tomorrow', [
  confirmed('Obtido 3 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 330', 'EV +130', 'EV', 130, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'), confirmed('Nível Total dos Digimons 420', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'),
])
replace('dunit-59', 'Gotsumon', [
  confirmed('Obtido 5 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 550', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'),
])
replace('dunit-60', 'Betamon', [
  confirmed('Obtido 6 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 660', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-61', 'Dorumon [DexDorugamon]', [
  confirmed('Obtido 5 Digimons', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 550', 'BL +30', 'BL', 30, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'HT +50', 'HT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-62', 'Dorumon[X-Dorugamon]', [
  confirmed('Obtido 10 Digimons', 'DE +50', 'DE', 50, 'absolute'), confirmed('Nível Total dos Digimons 1100', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 10 Digimons Transcendidos', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 1400', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-63', 'Dorumon[Dorugamon]', [
  confirmed('Obtido 8 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 880', 'CT +30', 'CT', 30, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-64', 'Elecmon [Duftmon]', [
  confirmed('Obtido 4 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DS +120', 'DS', 120, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-65', 'Drimogemon', [
  confirmed('Obtido 5 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 550', 'DS +120', 'DS', 120, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-66', 'Dorumon [Raptordramon]', [
  confirmed('Obtido 6 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 720', 'EV +100', 'EV', 100, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'), confirmed('Nível Total dos Digimons 900', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'),
])
replace('dunit-67', 'Ranamon', [
  confirmed('Obtido 1 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 110', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 1 Digimons Transcendidos', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-68', 'Hagurumon [Guardromon]', [
  confirmed('Obtido 5 Digimons', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 550', 'BL +30', 'BL', 30, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'HT +50', 'HT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'),
])
replace('dunit-69', 'Hagurumon [Mechanorimon]', [
  confirmed('Obtido 6 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 660', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-70', 'Monodramon', [
  confirmed('Obtido 5 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 550', 'DS +120', 'DS', 120, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-71', 'Kiwimon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'EV +70', 'EV', 70, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-72', 'Vritramon', [
  confirmed('Obtido 1 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 110', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 1 Digimons Transcendidos', 'AT +20', 'AT', 20, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-73', 'Agumon (Black) [BlitzGreymon]', [
  confirmed('Obtido 5 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 550', 'BL +20', 'BL', 20, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-74', 'Candlemon', [
  confirmed('Obtido 5 Digimons', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 550', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'), confirmed('Obtido 5 Digimons Transcendidos', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-75', 'Era Pré-histórica', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Ataque habilidade Unknown +1%', 'Ataque habilidade', 1, 'percent', 'Unknown'),
])
replace('dunit-76', 'Homens de Black', [
  confirmed('Obtido 3 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 330', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'CT +30', 'CT', 30, 'absolute'), confirmed('Nível Total dos Digimons 420', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])

replace('dunit-77', 'Starmon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'EV +70', 'EV', 70, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-78', 'Tsukaimon', [
  confirmed('Obtido 6 Digimons', 'BL +30', 'BL', 30, 'absolute'), confirmed('Nível Total dos Digimons 720', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Obtido 6 Digimons Transcendidos', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Nível Total dos Digimons 900', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-79', 'Hagurumon[Guardromon]', [
  confirmed('Obtido 6 Digimons', 'EV +70', 'EV', 70, 'absolute'), confirmed('Nível Total dos Digimons 720', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'), confirmed('Obtido 6 Digimons Transcendidos', 'CT +70', 'CT', 70, 'absolute'), confirmed('Nível Total dos Digimons 900', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'),
])
replace('dunit-80', 'Evolução das Trevas', [
  confirmed('Obtido 6 Digimons', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Nível Total dos Digimons 660', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Obtido 6 Digimons Transcendidos', 'EXP +50%', 'EXP', 50, 'percent'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-81', 'PawnChessmonWhite', [
  confirmed('Obtido 4 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-82', 'Doggymon', [
  confirmed('Obtido 3 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 330', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 420', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-83', 'V-mon [Veedramon]', [
  confirmed('Obtido 9 Digimons', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 990', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'), confirmed('Obtido 9 Digimons Transcendidos', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'), confirmed('Nível Total dos Digimons 1260', 'AT +50', 'AT', 50, 'absolute'),
])
replace('dunit-84', 'Os Sete Grandes Lordes Demônio', [
  confirmed('Obtido 7 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 770', 'DE +100', 'DE', 100, 'absolute'), confirmed('Obtido 7 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 980', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-85', 'Gazimon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'),
])
replace('dunit-86', 'Lucemon', [
  confirmed('Obtido 5 Digimons', 'DS +120', 'DS', 120, 'absolute'), confirmed('Nível Total dos Digimons 600', 'DS +150', 'DS', 150, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'), confirmed('Nível Total dos Digimons 750', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-87', 'Dracomon[Tipo: Azul]', [
  confirmed('Obtido 5 Digimons', 'HP +500', 'HP', 500, 'absolute'), confirmed('Nível Total dos Digimons 550', 'HP +200', 'HP', 200, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'),
])
replace('dunit-88', 'Tanemon', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Madeira +1%', 'Dano habilidade', 1, 'percent', 'Madeira'),
])
replace('dunit-89', 'Kamemon', [
  confirmed('Obtido 4 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-90', 'Terriermon', [
  confirmed('Obtido 6 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 720', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 900', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-91', 'Betamon [Apocalymon]', [
  confirmed('Obtido 4 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'EV +70', 'EV', 70, 'absolute'), confirmed('Nível Total dos Digimons 500', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-92', 'Candlemon', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-93', 'Kudamon', [
  confirmed('Obtido 4 Digimons', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 440', 'BL +30', 'BL', 30, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Gelo +1%', 'Dano habilidade', 1, 'percent', 'Gelo'),
])
replace('dunit-94', 'Mushroomon', [
  confirmed('Obtido 4 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-95', 'Impmon', [
  confirmed('Obtido 6 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 720', 'CT +30', 'CT', 30, 'absolute'), confirmed('Obtido 6 Digimons Transcendidos', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 900', 'Dano habilidade Gelo +1%', 'Dano habilidade', 1, 'percent', 'Gelo'),
])
replace('dunit-96', 'Lopmon', [
  confirmed('Obtido 7 Digimons', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Nível Total dos Digimons 770', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 7 Digimons Transcendidos', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Nível Total dos Digimons 980', 'Dano habilidade Gelo +1%', 'Dano habilidade', 1, 'percent', 'Gelo'),
])
replace('dunit-97', 'Keramon', [
  confirmed('Obtido 5 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 550', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Unknown +1%', 'Ataque habilidade', 1, 'percent', 'Unknown'),
])
replace('dunit-98', 'Tsukaimon', [
  confirmed('Obtido 5 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 550', 'DS +120', 'DS', 120, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-99', 'Kotemon', [
  confirmed('Obtido 4 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'AT +50', 'AT', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-101', 'Dracomon', [
  confirmed('Obtido 4 Digimons', 'DS +120', 'DS', 120, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DS +150', 'DS', 150, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-102', 'Dracomon [Tipo: Azul]', [
  confirmed('Obtido 6 Digimons', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 720', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Obtido 6 Digimons Transcendidos', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'), confirmed('Nível Total dos Digimons 900', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'),
])

replace('dunit-103', 'Dracomon [Tipo: Verde]', [
  confirmed('Obtido 6 Digimons', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 720', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Obtido 6 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 900', 'CT +70', 'CT', 70, 'absolute'),
])
replace('dunit-104', 'Dracomon', [
  confirmed('Obtido 8 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 880', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Obtido 8 Digimons Transcendidos', 'DE +100', 'DE', 100, 'absolute'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-105', 'Butterfly', [
  confirmed('Obtido 8 Digimons', 'EXP +50%', 'EXP', 50, 'percent'), confirmed('Nível Total dos Digimons 880', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Obtido 8 Digimons Transcendidos', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-106', 'Híbrido H', [
  confirmed('Obtido 12 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 1320', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 12 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 1680', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-107', 'Kotemon [Gladimon]', [
  confirmed('Obtido 5 Digimons', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 550', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 5 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'),
])
replace('dunit-108', 'Digimon Adventure', [
  confirmed('Obtido 8 Digimons', 'HP +500', 'HP', 500, 'absolute'), confirmed('Nível Total dos Digimons 880', 'HP +200', 'HP', 200, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'Ataque habilidade Vaccine +1%', 'Ataque habilidade', 1, 'percent', 'Vaccine'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Luz +1%', 'Dano habilidade', 1, 'percent', 'Luz'),
])
replace('dunit-109', 'Floramon', [
  confirmed('Obtido 5 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 550', 'DS +120', 'DS', 120, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Madeira +1%', 'Dano habilidade', 1, 'percent', 'Madeira'),
])
replace('dunit-110', 'Tsukaimon[Barbamon]', [
  confirmed('Obtido 4 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'EV +70', 'EV', 70, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'),
])
replace('dunit-111', 'Hackmon', [
  confirmed('Obtido 4 Digimons', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Nível Total dos Digimons 440', 'EXP +30%', 'EXP', 30, 'percent'), confirmed('Obtido 4 Digimons Transcendidos', 'EXP +50%', 'EXP', 50, 'percent'), confirmed('Nível Total dos Digimons 560', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-112', 'Crack Team', [
  confirmed('Obtido 5 Digimons', 'BL +30', 'BL', 30, 'absolute'), confirmed('Nível Total dos Digimons 550', 'BL +70', 'BL', 70, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
replace('dunit-113', 'Linhagem: Garurumon', [
  confirmed('Obtido 3 Digimons', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 330', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'AT +30', 'AT', 30, 'absolute'), confirmed('Nível Total dos Digimons 420', 'Dano habilidade Gelo +1%', 'Dano habilidade', 1, 'percent', 'Gelo'),
])
replace('dunit-114', 'Blitzmon', [
  confirmed('Obtido 1 Digimon', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 110', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 1 Digimon Transcendido', 'EV +70', 'EV', 70, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
replace('dunit-115', 'Wormmon', [
  confirmed('Obtido 5 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 550', 'EXP +20%', 'EXP', 20, 'percent'), confirmed('Obtido 5 Digimons Transcendidos', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Nível Total dos Digimons 700', 'Dano habilidade Gelo +1%', 'Dano habilidade', 1, 'percent', 'Gelo'),
])
replace('dunit-116', 'Salamon [Lilithmon]', [
  confirmed('Obtido 5 Digimons', 'HP +100', 'HP', 100, 'absolute'), confirmed('Nível Total dos Digimons 600', 'AT +30', 'AT', 30, 'absolute'), confirmed('Obtido 5 Digimons Transcendidos', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Nível Total dos Digimons 750', 'Dano habilidade Escuridão +1%', 'Dano habilidade', 1, 'percent', 'Escuridão'),
])
replace('dunit-117', 'Blizzardmon', [
  confirmed('Obtido 1 Digimon', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 110', 'BL +50', 'BL', 50, 'absolute'), confirmed('Obtido 1 Digimon Transcendido', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Dano habilidade Gelo +1%', 'Dano habilidade', 1, 'percent', 'Gelo'),
])
replace('dunit-118', 'Asas Supremas', [
  confirmed('Obtido 8 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 880', 'EV +100', 'EV', 100, 'absolute'), confirmed('Obtido 8 Digimons Transcendidos', 'Ataque habilidade Unknown +1%', 'Ataque habilidade', 1, 'percent', 'Unknown'), confirmed('Nível Total dos Digimons 1120', 'Dano habilidade Vento +1%', 'Dano habilidade', 1, 'percent', 'Vento'),
])
replace('dunit-119', 'Gabumon', [
  confirmed('Obtido 11 Digimons', 'CT +50', 'CT', 50, 'absolute'), confirmed('Nível Total dos Digimons 1320', 'HT +50', 'HT', 50, 'absolute'), confirmed('Obtido 11 Digimons Transcendidos', 'SCD +1%', 'SCD', 1, 'percent'), confirmed('Nível Total dos Digimons 1650', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-120', 'Garmmon', [
  confirmed('Obtido 1 Digimon', 'DS +50', 'DS', 50, 'absolute'), confirmed('Nível Total dos Digimons 110', 'DS +80', 'DS', 80, 'absolute'), confirmed('Obtido 1 Digimon Transcendido', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 140', 'Dano habilidade Madeira +1%', 'Dano habilidade', 1, 'percent', 'Madeira'),
])
replace('dunit-121', 'Swimmon', [
  confirmed('Obtido 4 Digimons', 'DE +30', 'DE', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'DE +50', 'DE', 50, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-122', "It's high noon", [
  confirmed('Obtido 3 Digimons', 'BL +20', 'BL', 20, 'absolute'), confirmed('Nível Total dos Digimons 330', 'BL +30', 'BL', 30, 'absolute'), confirmed('Obtido 3 Digimons Transcendidos', 'HT +30', 'HT', 30, 'absolute'), confirmed('Nível Total dos Digimons 420', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])
replace('dunit-123', 'Número', [
  confirmed('Obtido 4 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 440', 'HP +100', 'HP', 100, 'absolute'), confirmed('Obtido 4 Digimons Transcendidos', 'HP +200', 'HP', 200, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Água +1%', 'Dano habilidade', 1, 'percent', 'Água'),
])
replace('dunit-124', 'Guilmon [ChaosGallantmon]', [
  confirmed('Obtido 6 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 660', 'Ataque habilidade Virus +1%', 'Ataque habilidade', 1, 'percent', 'Virus'), confirmed('Obtido 6 Digimons Transcendidos', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'), confirmed('Nível Total dos Digimons 840', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-125', 'Híbrido B', [
  confirmed('Obtido 10 Digimons', 'DS +150', 'DS', 150, 'absolute'), confirmed('Nível Total dos Digimons 1100', 'DS +150', 'DS', 150, 'absolute'), confirmed('Obtido 10 Digimons Transcendidos', 'AT +70', 'AT', 70, 'absolute'), confirmed('Nível Total dos Digimons 1400', 'Dano habilidade Fogo +1%', 'Dano habilidade', 1, 'percent', 'Fogo'),
])
replace('dunit-126', 'Debi & Loide', [
  confirmed('Obtido 2 Digimons', 'HP +50', 'HP', 50, 'absolute'), confirmed('Nível Total dos Digimons 220', 'HP +200', 'HP', 200, 'absolute'), confirmed('Obtido 2 Digimons Transcendidos', 'CT +20', 'CT', 20, 'absolute'), confirmed('Nível Total dos Digimons 280', 'DS +150', 'DS', 150, 'absolute'),
])
replace('dunit-127', 'Elecmon [Dufmon]', [
  confirmed('Obtido 5 Digimons', 'DS +80', 'DS', 80, 'absolute'), confirmed('Nível Total dos Digimons 550', 'Dano habilidade Terra +1%', 'Dano habilidade', 1, 'percent', 'Terra'), confirmed('Obtido 5 Digimons Transcendidos', 'DE +70', 'DE', 70, 'absolute'), confirmed('Nível Total dos Digimons 700', 'Ataque habilidade Data +1%', 'Ataque habilidade', 1, 'percent', 'Data'),
])

type BatchBonus = [string, number, string?]
const batch6 = (id: string, name: string, count: number, level2: number, level4: number, bonuses: BatchBonus[]) => replace(id, name, bonuses.map(([attribute, value, qualifier], index) => {
  const requirement = index === 0 ? `Obtido ${count} Digimons` : index === 1 ? `Nível Total dos Digimons ${level2}` : index === 2 ? `Obtido ${count} Digimons Transcendidos` : `Nível Total dos Digimons ${level4}`
  const unit: DUnitUnit = qualifier || attribute === 'EXP' || attribute === 'SCD' ? 'percent' : 'absolute'
  const rawLabel = qualifier ? `${attribute} ${qualifier} +${value}%` : `${attribute} +${value}${unit === 'percent' ? '%' : ''}`
  return confirmed(requirement, rawLabel, attribute, value, unit, qualifier)
}) as [Confirmed, Confirmed, Confirmed, Confirmed])

batch6('dunit-128', 'Dorumon[RaptorDramon]', 11, 1320, 1650, [['AT', 50], ['HT', 50], ['Dano habilidade', 1, 'Aço'], ['Ataque habilidade', 1, 'Vaccine']])
batch6('dunit-129', 'Resistência', 3, 330, 420, [['EXP', 20], ['EXP', 20], ['EXP', 30], ['Dano habilidade', 1, 'Vento']])
batch6('dunit-130', 'Ryudamon', 11, 1320, 1650, [['AT', 50], ['HT', 50], ['Ataque habilidade', 1, 'Vaccine'], ['Dano habilidade', 1, 'Luz']])
batch6('dunit-131', 'Kudamon', 5, 550, 700, [['HT', 30], ['Dano habilidade', 1, 'Gelo'], ['HP', 50], ['AT', 70]])
batch6('dunit-132', 'Arkadimon', 4, 440, 560, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Terra']])
batch6('dunit-133', 'Agumon', 12, 1440, 1800, [['AT', 50], ['EV', 30], ['SCD', 1], ['Ataque habilidade', 1, 'Vaccine']])
batch6('dunit-134', 'Agumon', 12, 1440, 1800, [['AT', 50], ['EV', 30], ['SCD', 1], ['Ataque habilidade', 1, 'Vaccine']])
batch6('dunit-135', 'Skrrr', 3, 330, 420, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Terra']])
batch6('dunit-136', 'Impmon', 6, 660, 840, [['AT', 30], ['Dano habilidade', 1, 'Escuridão'], ['CT', 30], ['HT', 50]])
batch6('dunit-137', 'Mercuremon', 1, 110, 140, [['DS', 50], ['DS', 80], ['CT', 20], ['Dano habilidade', 1, 'Aço']])
batch6('dunit-138', 'Grotmon', 1, 110, 140, [['BL', 20], ['BL', 50], ['DS', 50], ['Dano habilidade', 1, 'Terra']])
batch6('dunit-139', 'Fairimon', 1, 110, 140, [['BL', 20], ['BL', 50], ['AT', 20], ['Dano habilidade', 1, 'Vento']])
batch6('dunit-140', 'Asas Supremas II', 3, 330, 420, [['EXP', 20], ['EXP', 20], ['EXP', 30], ['Ataque habilidade', 1, 'Vaccine']])
batch6('dunit-141', 'Reppamon', 1, 110, 140, [['BL', 20], ['BL', 50], ['CT', 20], ['Dano habilidade', 1, 'Terra']])
batch6('dunit-142', 'Hackmon', 5, 600, 750, [['AT', 50], ['HT', 30], ['Ataque habilidade', 1, 'Data'], ['Dano habilidade', 1, 'Aço']])
batch6('dunit-143', 'Bolgmon', 1, 110, 140, [['DS', 50], ['DS', 80], ['EV', 70], ['Dano habilidade', 1, 'Elétrico']])
batch6('dunit-144', 'Betamon', 7, 770, 980, [['DS', 50], ['Dano habilidade', 1, 'Gelo'], ['Ataque habilidade', 1, 'Data'], ['HT', 50]])
batch6('dunit-145', 'Goedam', 3, 330, 420, [['DS', 50], ['DS', 80], ['AT', 30], ['Ataque habilidade', 1, 'Data']])
batch6('dunit-146', 'Nosso Vínculo', 2, 240, 300, [['BL', 30], ['AT', 70], ['Dano habilidade', 1, 'Básico'], ['Dano habilidade', 1, 'Fogo']])
batch6('dunit-147', 'Eu Sou o Único sem Cachorro', 4, 440, 560, [['DE', 30], ['DE', 50], ['CT', 20], ['Ataque habilidade', 1, 'Unknown']])
batch6('dunit-148', 'Ghost Game', 3, 330, 420, [['EXP', 20], ['EXP', 30], ['EXP', 50], ['Dano habilidade', 1, 'Vento']])
batch6('dunit-149', 'Checkmate', 8, 880, 1120, [['DE', 30], ['DE', 50], ['CT', 50], ['Dano habilidade', 1, 'Aço']])
batch6('dunit-150', 'Império Bagra', 4, 450, 570, [['BL', 30], ['AT', 30], ['CT', 20], ['Dano habilidade', 1, 'Escuridão']])
batch6('dunit-151', 'KaiserLeomon', 1, 110, 140, [['HP', 50], ['HP', 100], ['DS', 50], ['CT', 20]])
batch6('dunit-152', 'Os Três Anjos Caídos', 3, 330, 420, [['EV', 70], ['EV', 130], ['Ataque habilidade', 1, 'Unknown'], ['Dano habilidade', 1, 'Escuridão']])
batch6('dunit-153', 'Chackmon', 1, 110, 140, [['EV', 30], ['EV', 70], ['AT', 20], ['Dano habilidade', 1, 'Gelo']])
batch6('dunit-154', 'Angoramon', 4, 440, 560, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Vento']])
batch6('dunit-155', 'Jellymon', 4, 440, 560, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Vento']])
batch6('dunit-156', 'Calmaramon', 1, 110, 140, [['EV', 30], ['EV', 70], ['CT', 20], ['Dano habilidade', 1, 'Água']])
batch6('dunit-157', 'Meicoomon', 4, 480, 600, [['EXP', 20], ['HP', 100], ['BL', 70], ['Ataque habilidade', 1, 'Unknown']])
batch6('dunit-158', 'Meicoomon', 4, 480, 600, [['CT', 20], ['EV', 70], ['EXP', 50], ['Ataque habilidade', 2, 'Unknown']])
batch6('dunit-159', 'Goblimon', 5, 550, 700, [['EXP', 20], ['EXP', 30], ['EXP', 50], ['Ataque habilidade', 1, 'Virus']])
batch6('dunit-160', 'O Primeiro Vilão', 8, 880, 1120, [['BL', 20], ['BL', 30], ['HT', 50], ['Dano habilidade', 1, 'Escuridão']])
batch6('dunit-161', 'Fase Final', 4, 460, 550, [['EXP', 50], ['Dano habilidade', 1, 'Escuridão'], ['BL', 40], ['Dano habilidade', 1, 'Básico']])
batch6('dunit-162', 'Raremon', 2, 220, 280, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Madeira']])
batch6('dunit-163', 'Gammamon', 4, 440, 560, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Elétrico']])
batch6('dunit-164', 'Eu Sou o Único sem Gato', 3, 330, 420, [['EXP', 20], ['EXP', 30], ['EXP', 50], ['Ataque habilidade', 1, 'Unknown']])
batch6('dunit-165', 'Duke', 6, 690, 870, [['HT', 30], ['BL', 50], ['HT', 50], ['Dano habilidade', 1, 'Luz']])
batch6('dunit-166', 'Entidade das Trevas', 4, 440, 560, [['EXP', 20], ['EXP', 20], ['EXP', 30], ['Ataque habilidade', 1, 'Unknown']])
batch6('dunit-167', 'Gigasmon', 1, 110, 140, [['HP', 50], ['HP', 100], ['DS', 50], ['Dano habilidade', 1, 'Terra']])
batch6('dunit-168', 'Zephyrmon', 1, 110, 140, [['DE', 30], ['DE', 50], ['DS', 50], ['Dano habilidade', 1, 'Vento']])
batch6('dunit-169', 'Wolfmon', 1, 110, 140, [['HP', 50], ['HP', 100], ['DS', 50], ['Dano habilidade', 1, 'Madeira']])
batch6('dunit-170', 'Psychemon', 5, 600, 750, [['DS', 80], ['DS', 120], ['AT', 50], ['Ataque habilidade', 1, 'Virus']])
batch6('dunit-171', 'Arbormon', 1, 110, 140, [['DE', 30], ['DE', 50], ['AT', 20], ['Dano habilidade', 1, 'Madeira']])
batch6('dunit-172', 'Kokuwamon', 5, 550, 700, [['BL', 20], ['BL', 30], ['HT', 30], ['Dano habilidade', 1, 'Gelo']])
batch6('dunit-173', 'FanBeemon', 8, 880, 1120, [['EXP', 20], ['Dano habilidade', 1, 'Vento'], ['EXP', 30], ['EXP', 50]])
batch6('dunit-174', 'Power Villain', 4, 440, 560, [['BL', 20], ['BL', 30], ['HT', 30], ['Dano habilidade', 1, 'Escuridão']])
batch6('dunit-175', 'SkullKnightmon', 3, 360, 450, [['EXP', 20], ['EXP', 30], ['EXP', 50], ['Ataque habilidade', 1, 'Virus']])
batch6('dunit-176', 'Ryudamon', 6, 720, 900, [['HT', 30], ['BL', 50], ['HT', 50], ['Ataque habilidade', 1, 'Vaccine']])
batch6('dunit-177', 'KaiserGreymon', 1, 110, 140, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Fogo']])

const batch7 = (id: string, name: string, count: number, level2: number, level4: number, bonuses: BatchBonus[]) => replace(id, name, bonuses.map(([attribute, value, qualifier], index) => {
  const requirement = index === 0 ? `Obtido ${count} Digimons` : index === 1 ? `Nível Total dos Digimons ${level2}` : index === 2 ? `Obtido ${count} Digimons Transcendidos` : `Nível Total dos Digimons ${level4}`
  const unit: DUnitUnit = qualifier || attribute === 'EXP' || attribute === 'SCD' ? 'percent' : 'absolute'
  const rawLabel = qualifier ? `${attribute} ${qualifier} +${value}%` : `${attribute} +${value}${unit === 'percent' ? '%' : ''}`
  return confirmed(requirement, rawLabel, attribute, value, unit, qualifier)
}) as [Confirmed, Confirmed, Confirmed, Confirmed])

batch7('dunit-178', 'Baguramon', 3, 360, 450, [['BL', 20], ['BL', 30], ['HT', 30], ['SCD', 1]])
batch7('dunit-179', 'Petaldramon', 1, 110, 140, [['EV', 30], ['EV', 70], ['DS', 50], ['Dano habilidade', 1, 'Madeira']])
batch7('dunit-180', 'Vilanizando', 7, 770, 980, [['BL', 20], ['BL', 30], ['HT', 50], ['Ataque habilidade', 1, 'Virus']])
batch7('dunit-181', 'Under the Sea', 7, 770, 980, [['EXP', 20], ['EXP', 30], ['EXP', 50], ['Dano habilidade', 1, 'Água']])
batch7('dunit-182', 'Que o milagre aconteça', 4, 460, 580, [['EXP', 30], ['HT', 30], ['Ataque habilidade', 1, 'Data'], ['Ataque habilidade', 1, 'Vaccine']])
batch7('dunit-183', 'Otamamon', 4, 440, 560, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Água']])
batch7('dunit-184', 'PawnChessmonBlack', 4, 440, 560, [['BL', 20], ['BL', 30], ['HT', 30], ['Dano habilidade', 1, 'Aço']])
batch7('dunit-186', 'FanBeemon', 4, 440, 560, [['DE', 30], ['CT', 30], ['CT', 50], ['Dano habilidade', 1, 'Vento']])
batch7('dunit-187', 'Sharmamon', 4, 440, 560, [['EXP', 20], ['EXP', 20], ['EXP', 30], ['Dano habilidade', 1, 'Gelo']])
batch7('dunit-188', 'Commandramon', 5, 550, 700, [['DS', 80], ['DS', 120], ['AT', 50], ['Dano habilidade', 1, 'Água']])
batch7('dunit-189', 'Syakomon', 4, 440, 560, [['HP', 50], ['HP', 100], ['HP', 200], ['Dano habilidade', 1, 'Água']])
batch7('dunit-190', 'Tsukaimon[Murmukusmon]', 4, 440, 560, [['DS', 50], ['DS', 80], ['AT', 30], ['Dano habilidade', 1, 'Madeira']])
batch7('dunit-191', 'Leomon do Destino', 4, 440, 560, [['HP', 50], ['HP', 100], ['HP', 200], ['Dano habilidade', 1, 'Gelo']])
batch7('dunit-192', 'Morreu de novo?', 7, 770, 980, [['HP', 50], ['HP', 100], ['HP', 200], ['Ataque habilidade', 1, 'Vaccine']])
batch7('dunit-193', 'Armadimon', 5, 550, 700, [['HP', 50], ['HP', 100], ['HP', 200], ['Dano habilidade', 1, 'Água']])
batch7('dunit-194', 'Palmon [Original]', 5, 550, 700, [['BL', 20], ['BL', 30], ['HT', 50], ['Dano habilidade', 1, 'Madeira']])
batch7('dunit-195', 'Palmon [Original]', 9, 990, 1260, [['EXP', 20], ['Dano habilidade', 1, 'Madeira'], ['Ataque habilidade', 1, 'Data'], ['HP', 100]])
batch7('dunit-196', 'Salamon [BlackGatomon]', 7, 840, 1050, [['DE', 30], ['CT', 30], ['AT', 50], ['Ataque habilidade', 1, 'Virus']])
batch7('dunit-197', 'Dia da Árvore', 6, 660, 840, [['HP', 50], ['HP', 100], ['HP', 200], ['Dano habilidade', 1, 'Madeira']])
batch7('dunit-198', 'Dorulumon', 5, 550, 700, [['EV', 30], ['EV', 70], ['HT', 30], ['Ataque habilidade', 1, 'Unknown']])
batch7('dunit-199', 'Ballistamon', 6, 660, 840, [['DE', 30], ['DE', 50], ['EV', 100], ['Ataque habilidade', 1, 'Unknown']])
batch7('dunit-200', 'Agumon (Black)', 5, 600, 750, [['EXP', 20], ['HT', 30], ['Ataque habilidade', 1, 'Vaccine'], ['Ataque habilidade', 1, 'Virus']])
batch7('dunit-201', 'OMEGA : VI', 2, 240, 300, [['BL', 30], ['EXP', 50], ['Ataque habilidade', 1, 'Vaccine'], ['Ataque habilidade', 2, 'Virus']])
batch7('dunit-202', 'DeadlyAxemon', 3, 360, 450, [['DE', 30], ['DE', 50], ['CT', 20], ['Dano habilidade', 1, 'Escuridão']])
batch7('dunit-203', 'Gabumon (Black)', 5, 600, 750, [['EXP', 20], ['HT', 30], ['Ataque habilidade', 2, 'Vaccine'], ['Ataque habilidade', 1, 'Virus']])
replace('dunit-204', 'PicoDevimon [Apocalymon]', [
  confirmed('Obtido 4 Digimons', 'EV +30', 'EV', 30, 'absolute'), confirmed('Nível Total dos Digimons 440', 'BL +50', 'BL', 50, 'absolute'), confirmed('Nível Total dos Digimons 500', 'AT +50', 'AT', 50, 'absolute'), confirmed('Nível Total dos Digimons 560', 'Dano habilidade Elétrico +1%', 'Dano habilidade', 1, 'percent', 'Elétrico'),
])
batch7('dunit-205', 'V-mon [Imperialdramon]', 7, 840, 1050, [['EV', 30], ['DE', 100], ['AT', 70], ['Ataque habilidade', 1, 'Vaccine']])
batch7('dunit-206', 'Wormmon [Imperialdramon]', 7, 840, 1050, [['DE', 30], ['CT', 30], ['AT', 70], ['Dano habilidade', 1, 'Luz']])
batch7('dunit-207', 'SBP', 6, 660, 840, [['DE', 30], ['DE', 50], ['CT', 50], ['Dano habilidade', 1, 'Madeira']])
batch7('dunit-208', 'DemiMeramon', 5, 550, 700, [['DS', 80], ['DS', 120], ['AT', 50], ['Dano habilidade', 1, 'Fogo']])
batch7('dunit-209', 'Cavaleiros Reais', 13, 1300, 1820, [['BL', 30], ['EV', 100], ['Ataque habilidade', 1, 'Vaccine'], ['Dano habilidade', 1, 'Luz']])
batch7('dunit-210', 'Somente os Verdadeiros Restaram', 11, 1330, 1660, [['AT', 100], ['Dano habilidade', 1, 'Escuridão'], ['SCD', 2], ['Dano habilidade', 1, 'Básico']])
batch7('dunit-211', 'Royal Knight X', 13, 1490, 1880, [['SCD', 1], ['Ataque habilidade', 1, 'Vaccine'], ['Ataque habilidade', 1, 'Virus'], ['Dano habilidade', 1, 'Básico']])
batch7('dunit-212', 'DemiMeramon', 6, 720, 900, [['HP', 100], ['HT', 50], ['Ataque habilidade', 1, 'Data'], ['Dano habilidade', 1, 'Aço']])
batch7('dunit-214', 'Starmons', 4, 440, 560, [['EV', 30], ['EV', 70], ['CT', 30], ['Dano habilidade', 1, 'Elétrico']])
batch7('dunit-215', 'Digimon Xros Wars', 8, 880, 1120, [['BL', 30], ['DE', 100], ['AT', 70], ['Ataque habilidade', 1, 'Unknown']])
batch7('dunit-216', 'Sparrowmon', 4, 440, 560, [['EV', 30], ['EV', 70], ['CT', 30], ['Dano habilidade', 1, 'Elétrico']])
batch7('dunit-217', 'Soldado', 2, 220, 280, [['HP', 50], ['HP', 100], ['HP', 200], ['Ataque habilidade', 1, 'Unknown']])
batch7('dunit-218', 'Linhagem: Greymon', 5, 550, 700, [['HP', 50], ['HP', 100], ['HP', 200], ['Dano habilidade', 1, 'Fogo']])
batch7('dunit-219', 'Patamon [Shakkoumon]', 7, 770, 980, [['EV', 30], ['EV', 70], ['HT', 30], ['Dano habilidade', 1, 'Vento']])
batch7('dunit-220', 'Legião dos Anjos', 4, 440, 560, [['DE', 50], ['DE', 100], ['Ataque habilidade', 1, 'Vaccine'], ['Dano habilidade', 1, 'Luz']])
batch7('dunit-221', 'Agumon (Black) [BlitzGreymon]', 5, 600, 750, [['CT', 20], ['AT', 20], ['EXP', 30], ['Ataque habilidade', 1, 'Virus']])
batch7('dunit-222', 'Hawkmon [Silphymon]', 9, 990, 1260, [['EV', 30], ['EV', 70], ['HT', 30], ['Dano habilidade', 1, 'Vento']])
batch7('dunit-223', 'Batalha Suprema!', 3, 370, 460, [['DE', 50], ['HT', 30], ['Dano habilidade', 2, 'Gelo'], ['Ataque habilidade', 1, 'Virus']])
batch7('dunit-224', 'Gizamon', 4, 440, 560, [['DS', 80], ['DS', 120], ['AT', 50], ['Dano habilidade', 1, 'Elétrico']])
batch7('dunit-225', 'Shoutmon', 10, 1300, 1600, [['DE', 150], ['CT', 30], ['Ataque habilidade', 1, 'Data'], ['Dano habilidade', 1, 'Aço']])
batch7('dunit-226', 'Renamon', 7, 910, 1120, [['Ataque habilidade', 2, 'Data'], ['EV', 150], ['AT', 100], ['Dano habilidade', 2, 'Escuridão']])
batch7('dunit-227', 'Vênus', 7, 790, 1000, [['BL', 30], ['Ataque habilidade', 1, 'Vaccine'], ['SCD', 1], ['Ataque habilidade', 1, 'Data']])
batch7('dunit-228', 'Modo', 11, 1270, 1600, [['BL', 30], ['EV', 100], ['SCD', 3], ['Dano habilidade', 2, 'Básico']])
batch7('dunit-229', 'Impmon [Baalmon]', 5, 600, 750, [['DS', 120], ['DS', 150], ['Dano habilidade', 1, 'Gelo'], ['Dano habilidade', 1, 'Aço']])

const batch8 = batch7
batch8('dunit-230', 'Apolo', 9, 1000, 1270, [['EV', 30], ['EV', 70], ['CT', 30], ['Ataque habilidade', 1, 'Unknown']])
replace('dunit-231', 'Digimon Masters', [
  confirmed('Obtido 5 Digimons', 'SCD +5%', 'SCD', 5, 'percent'),
  confirmed('Nível Total dos Digimons 650', 'Dano de atributo básico +5%', 'Dano de atributo básico', 5, 'percent'),
  confirmed('Obtido 5 Digimons Transcendidos', 'Dano habilidade Luz +2%', 'Dano habilidade', 2, 'percent', 'Luz'),
  confirmed('Nível Total dos Digimons 800', 'Dano habilidade Escuridão +2%', 'Dano habilidade', 2, 'percent', 'Escuridão'),
])
batch8('dunit-232', 'Gabumon', 7, 910, 1120, [['CT', 30], ['HT', 50], ['SCD', 1], ['Ataque habilidade', 2, 'Vaccine']])
batch8('dunit-233', 'Salamon [Gatomon]', 8, 880, 1120, [['DE', 30], ['CT', 20], ['Dano habilidade', 1, 'Luz'], ['Dano habilidade', 1, 'Escuridão']])
batch8('dunit-234', 'Salamon [BlackGatomon]', 8, 960, 1200, [['DE', 50], ['EXP', 20], ['BL', 20], ['EXP', 30]])
replace('dunit-235', 'Palmon [Apocalymon]', [
  confirmed('Obtido 4 Digimons', 'DS +50', 'DS', 50, 'absolute'),
  confirmed('Nível Total dos Digimons 440', 'DS +80', 'DS', 80, 'absolute'),
  confirmed('Nível Total dos Digimons 500', 'AT +30', 'AT', 30, 'absolute'),
  confirmed('Nível Total dos Digimons 560', 'Dano habilidade Madeira +1%', 'Dano habilidade', 1, 'percent', 'Madeira'),
])
batch8('dunit-236', 'Gomamon', 6, 660, 840, [['DE', 30], ['DS', 50], ['EXP', 20], ['Dano habilidade', 1, 'Água']])
batch8('dunit-237', 'Gomamon', 6, 660, 840, [['BL', 20], ['EV', 30], ['HP', 50], ['Dano habilidade', 1, 'Aço']])
batch8('dunit-238', 'Armadimon [Shakkoumon]', 7, 770, 980, [['EV', 30], ['DS', 150], ['AT', 50], ['Dano habilidade', 1, 'Terra']])
batch8('dunit-239', 'MailBirdramon', 7, 910, 1120, [['HT', 50], ['EV', 150], ['Ataque habilidade', 1, 'Data'], ['Dano habilidade', 1, 'Aço']])
batch8('dunit-240', 'Greymon (C)', 7, 910, 1120, [['AT', 50], ['DS', 500], ['Ataque habilidade', 1, 'Data'], ['Dano habilidade', 1, 'Aço']])
batch8('dunit-241', 'PicoDevimon [Soulmon]', 7, 770, 980, [['EV', 30], ['BL', 20], ['DE', 100], ['Ataque habilidade', 1, 'Virus']])
batch8('dunit-242', 'PicoDevimon [Myotismon]', 6, 660, 840, [['EV', 30], ['BL', 20], ['DE', 100], ['Ataque habilidade', 1, 'Virus']])
replace('dunit-243', 'Hagurumon [Apocalymon]', [
  confirmed('Obtido 4 Digimons', 'BL +20', 'BL', 20, 'absolute'),
  confirmed('Nível Total dos Digimons 440', 'BL +30', 'BL', 30, 'absolute'),
  confirmed('Nível Total dos Digimons 500', 'HT +30', 'HT', 30, 'absolute'),
  confirmed('Nível Total dos Digimons 560', 'Dano habilidade Aço +1%', 'Dano habilidade', 1, 'percent', 'Aço'),
])
batch8('dunit-244', 'Elecmon', 6, 660, 840, [['BL', 20], ['BL', 30], ['HT', 50], ['Dano habilidade', 1, 'Fogo']])
batch8('dunit-245', 'Gazimon[Milleniumon]', 6, 720, 900, [['BL', 20], ['BL', 30], ['HT', 50], ['Ataque habilidade', 1, 'Virus']])
batch8('dunit-246', 'Gizamon', 5, 550, 700, [['DE', 30], ['DE', 50], ['Dano habilidade', 1, 'Aço'], ['Ataque habilidade', 1, 'Virus']])
batch8('dunit-247', 'Eosmon (Adulto)', 3, 390, 480, [['CT', 30], ['AT', 100], ['Dano habilidade', 1, 'Elétrico'], ['Ataque habilidade', 2, 'Unknown']])
batch8('dunit-248', 'Palmon [BloomLordmon]', 4, 520, 640, [['DE', 50], ['HP', 150], ['Dano habilidade', 1, 'Madeira'], ['Dano habilidade', 2, 'Luz']])
batch8('dunit-249', 'Salamon [BlackGatomon]', 9, 1080, 1350, [['BL', 30], ['HP', 50], ['EXP', 20], ['Dano habilidade', 1, 'Aço']])
batch8('dunit-250', 'Negamon', 3, 390, 480, [['EXP', 50], ['CT', 30], ['Dano habilidade', 1, 'Escuridão'], ['Ataque habilidade', 1, 'Unknown']])
batch8('dunit-251', 'Quantumon', 1, 130, 160, [['DE', 30], ['Ataque habilidade', 1, 'Data'], ['HP', 50], ['Dano habilidade', 1, 'Água']])
batch8('dunit-252', 'Digimon Adventure 02', 8, 880, 1120, [['EXP', 20], ['EXP', 30], ['EXP', 50], ['Dano habilidade', 1, 'Madeira']])
batch8('dunit-253', 'Evolução em Cápsula', 15, 1650, 2100, [['EV', 30], ['EV', 70], ['CT', 30], ['Ataque habilidade', 1, 'Vaccine']])
batch8('dunit-254', 'Asas Supremas I', 2, 220, 280, [['HP', 50], ['CT', 20], ['Dano habilidade', 1, 'Luz'], ['Dano habilidade', 1, 'Escuridão']])
batch8('dunit-255', 'Exército Bagra', 10, 1100, 1400, [['BL', 20], ['BL', 30], ['HT', 50], ['Ataque habilidade', 1, 'Vaccine']])
batch8('dunit-256', 'O Dragão Negro da Destruição', 4, 460, 580, [['BL', 30], ['DE', 100], ['Dano habilidade', 1, 'Luz'], ['Dano habilidade', 2, 'Madeira']])
batch8('dunit-257', 'Ressurreição', 3, 350, 440, [['BL', 30], ['Dano habilidade', 1, 'Vento'], ['HT', 30], ['Dano habilidade', 1, 'Escuridão']])
batch8('dunit-258', 'Aparencia! Antigo guerreiro Dragão', 2, 250, 310, [['HT', 30], ['CT', 20], ['Ataque habilidade', 1, 'Vaccine'], ['Ataque habilidade', 2, 'Vaccine']])
batch8('dunit-259', 'Contra Ataque de Diablomon', 4, 470, 590, [['AT', 30], ['DE', 100], ['EXP', 30], ['Ataque habilidade', 1, 'Unknown']])
batch8('dunit-260', 'Capítulo 1: Reencontro', 2, 240, 300, [['HP', 50], ['AT', 20], ['CT', 30], ['Dano habilidade', 1, 'Luz']])
batch8('dunit-261', 'Capítulo 5: Simbiose', 3, 360, 450, [['HP', 100], ['SCD', 1], ['CT', 20], ['HT', 50]])
batch8('dunit-263', 'Seres Mal', 5, 570, 720, [['AT', 40], ['HT', 50], ['Ataque habilidade', 1, 'Virus'], ['Dano habilidade', 2, 'Básico']])
batch8('dunit-264', 'Última Evolução', 3, 370, 460, [['Ataque habilidade', 1, 'Data'], ['AT', 30], ['Ataque habilidade', 1, 'Unknown'], ['Dano habilidade', 2, 'Gelo']])
batch8('dunit-265', 'Nosso Vínculo', 12, 1340, 1700, [['Ataque habilidade', 1, 'Vaccine'], ['EXP', 50], ['Dano habilidade', 1, 'Fogo'], ['Ataque habilidade', 2, 'Data']])
batch8('dunit-266', 'Esperança e Luz de Corações', 5, 630, 780, [['Dano habilidade', 1, 'Fogo'], ['AT', 50], ['Dano habilidade', 1, 'Luz'], ['Ataque habilidade', 2, 'Vaccine']])
batch8('dunit-267', '4 Grandes Dragões Poder Divino', 4, 480, 600, [['Dano habilidade', 1, 'Vento'], ['HT', 50], ['EXP', 100], ['Dano habilidade', 1, 'Básico']])
batch8('dunit-268', 'Asas do Pecado', 3, 370, 460, [['Dano habilidade', 1, 'Básico'], ['EXP', 50], ['Ataque habilidade', 1, 'Virus'], ['Dano habilidade', 2, 'Escuridão']])
batch8('dunit-270', 'Terror do Abismo', 2, 260, 320, [['EV', 30], ['Dano habilidade', 1, 'Escuridão'], ['AT', 50], ['Ataque habilidade', 1, 'Unknown']])
batch8('dunit-271', 'Fim da aventura', 2, 240, 300, [['AT', 50], ['Dano habilidade', 1, 'Luz'], ['EXP', 20], ['Dano habilidade', 1, 'Escuridão']])
batch8('dunit-272', 'Força desconhecida', 4, 520, 640, [['SCD', 1], ['Dano habilidade', 1, 'Luz'], ['Dano habilidade', 1, 'Escuridão'], ['Ataque habilidade', 1, 'Unknown']])
batch8('dunit-273', 'Reencontro: Supremacia', 2, 260, 320, [['HP', 150], ['EXP', 100], ['Dano habilidade', 1, 'Luz'], ['Ataque habilidade', 1, 'Vaccine']])
batch8('dunit-274', 'Execução da Justiça: Vacina', 6, 780, 960, [['HT', 100], ['Dano habilidade', 1, 'Luz'], ['SCD', 2], ['Ataque habilidade', 2, 'Vaccine']])

export const dUnitAuditSummary = () => {
  const conditions = dUnitSets.flatMap(set => set.conditions)
  return { sets: dUnitSets.length, conditions: conditions.length, confirmed: conditions.filter(condition => condition.confirmed).length, pending: conditions.filter(condition => !condition.confirmed).length }
}
