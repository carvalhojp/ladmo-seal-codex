export type Attribute = 'AT' | 'HP' | 'DS' | 'DE' | 'HT' | 'CT' | 'BL' | 'EV'
export type Level = 'normal' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'master'
export type ProgressionThresholds = Record<Level, number>
export interface Seal { id: string; name: string; attribute: Attribute; masterValue: number; ticketCost: number; sealsReceived: number; maxSeals: number; progression?: ProgressionThresholds }
export interface OwnedSeal { sealId: string; quantity: number }
export const levels: { id: Level; threshold: number; multiplier: number; label: string }[] = [
  { id: 'normal', threshold: 1, multiplier: .1, label: 'Normal' }, { id: 'bronze', threshold: 50, multiplier: .2, label: 'Bronze' },
  { id: 'silver', threshold: 200, multiplier: .4, label: 'Silver' }, { id: 'gold', threshold: 500, multiplier: .6, label: 'Gold' },
  { id: 'platinum', threshold: 1000, multiplier: .8, label: 'Platinum' }, { id: 'master', threshold: 3000, multiplier: 1, label: 'Master' }
]
export const defaultProgression: ProgressionThresholds = Object.fromEntries(levels.map(level => [level.id, level.threshold])) as ProgressionThresholds
