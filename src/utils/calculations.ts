import type { Attribute, Level, Seal } from '../types'
import { levels } from '../types'
export const isPercent = (attribute: Attribute) => ['CT', 'BL', 'EV'].includes(attribute)
export const valueFor = (seal: Seal, level: Level) => seal.masterValue * (levels.find(x => x.id === level)?.multiplier ?? 0)
export const formatValue = (value: number, attribute: Attribute, locale = 'pt-BR') => isPercent(attribute) ? `+${(value / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : `+${value.toLocaleString(locale, { maximumFractionDigits: 1 })}`
export const openersFor = (seals: number) => Math.ceil(Math.max(0, seals) / 50)
export const levelFor = (quantity: number) => [...levels].reverse().find(x => quantity >= x.threshold) ?? null
export const nextLevel = (quantity: number) => levels.find(x => x.threshold > quantity) ?? null
export const ticketsForSeals = (seal: Seal, quantity: number) => Math.ceil(Math.max(0, quantity) / seal.sealsReceived) * seal.ticketCost
export const costPerSeal = (seal: Seal) => seal.ticketCost / seal.sealsReceived
export const efficiency = (seal: Seal) => seal.masterValue * seal.sealsReceived / seal.ticketCost
