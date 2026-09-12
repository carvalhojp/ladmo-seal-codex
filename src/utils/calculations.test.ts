import { describe, expect, it } from 'vitest'
import { openersFor, ticketsForSeals, valueFor } from './calculations'
import type { Seal } from '../types'
const seal: Seal = { id:'x', name:'X', attribute:'CT', masterValue:250, ticketCost:1, sealsReceived:10, maxSeals:3000 }
describe('Seal Master calculations', () => { it('calculates openers by blocks of 50', () => { expect(openersFor(1)).toBe(1); expect(openersFor(50)).toBe(1); expect(openersFor(51)).toBe(2); expect(openersFor(3000)).toBe(60) }); it('derives progression from Master', () => { expect(valueFor(seal, 'silver')).toBe(100); expect(valueFor(seal, 'master')).toBe(250) }); it('rounds ticket exchanges up', () => expect(ticketsForSeals(seal, 11)).toBe(2)) })
