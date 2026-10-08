import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EquipmentProgress } from './EquipmentProgress'
import { MyTamer } from './MyTamer'
import { About } from './About'
import { equipmentProgressCopy } from '../data/equipmentProgressCopy'
import { myTamerCopy } from '../data/myTamerCopy'
import { emptyEquipmentProgress, updateEquipmentProgress, type EquipmentProgressState } from '../utils/equipmentState'
import { createLadmoSave } from '../utils/saveBackup'

const hooks = vi.hoisted(() => ({ slots: [] as any[], cursor: 0 }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useState: (initial: any) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === 'function' ? initial() : initial; return [hooks.slots[i], (next: any) => { hooks.slots[i] = typeof next === 'function' ? next(hooks.slots[i]) : next }] },
  useMemo: (fn: () => any) => fn(), useRef: (initial: any) => { const i = hooks.cursor++; return hooks.slots[i] ?? (hooks.slots[i] = { current: initial }) },
}))
const render = (component: any, props: any) => { hooks.cursor = 0; return component(props) }
function nodes(node: any, match: (n: any) => boolean): any[] {
  if (Array.isArray(node)) return node.flatMap(n => nodes(n, match))
  if (!node?.props) return []
  return [...(match(node) ? [node] : []), ...nodes(node.props.children, match)]
}
const text = (node: any): string => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'object' ? '' : String(node ?? '')
const t = { ...equipmentProgressCopy.pt, ...myTamerCopy.pt, equipmentTitle: 'Equipamentos', cancel: 'Cancelar', importBackup: 'Importar' }
beforeEach(() => { hooks.slots = []; hooks.cursor = 0 })

describe('equipment progress interface', () => {
  it('registers/removes possession and selects a single current Loader stage', () => {
    const p = { state: emptyEquipmentProgress(), blocked: false, t, lang: 'pt', save: (state: EquipmentProgressState) => { p.state = state } }
    let tree = render(EquipmentProgress, p)
    const card = (id: string) => nodes(tree, n => n.key === id)[0]
    const check = (id: string, checked: boolean) => nodes(card(id), n => n.type === 'input')[0].props.onChange({ target: { checked } })
    check('susanoomon-loader', true); tree = render(EquipmentProgress, p)
    expect(p.state.items['susanoomon-loader']).toEqual({ owned: true })
    nodes(card('susanoomon-loader'), n => n.type === 'select')[0].props.onChange({ target: { value: 'loader-lv-0' } })
    tree = render(EquipmentProgress, p); expect(p.state.items['susanoomon-loader'].stageId).toBe('loader-lv-0')
    check('mdg-tk-boots', true); tree = render(EquipmentProgress, p)
    expect(p.state.items['mdg-tk-boots']).toEqual({ owned: true })
    check('susanoomon-loader', false); tree = render(EquipmentProgress, p)
    expect(p.state.items['susanoomon-loader']).toBeUndefined()
    expect(nodes(tree, n => n.type === 'select')).toHaveLength(0)
  })
  it('reports a write failure without changing the state or claiming success', () => {
    const p = { state: emptyEquipmentProgress(), blocked: false, t, lang: 'pt', save: () => { throw new Error('full') } }
    let tree = render(EquipmentProgress, p)
    nodes(tree, n => n.type === 'input')[0].props.onChange({ target: { checked: true } }); tree = render(EquipmentProgress, p)
    expect(text(tree)).toContain(t.epError); expect(text(tree)).not.toContain(t.epSaved); expect(p.state.items).toEqual({})
  })
  it('disables editing when loading failed and leaves the data untouched', () => {
    const save = vi.fn(), tree = render(EquipmentProgress, { state: emptyEquipmentProgress(), blocked: true, t, lang: 'pt', save })
    expect(nodes(tree, n => n.type === 'input').every(n => n.props.disabled)).toBe(true)
    expect(text(tree)).toContain(t.epBlocked); expect(save).not.toHaveBeenCalled()
  })
  it('derives the Meu Tamer summary and navigates without inferring bonuses', () => {
    const state = updateEquipmentProgress(updateEquipmentProgress(emptyEquipmentProgress(), 'susanoomon-loader', true, 'loader-lv-2'), 'mdg-yolei-helmet', true)
    const navigate = vi.fn(), tree = render(MyTamer, { t, lang: 'pt', sealStates: {}, progress: {}, equipment: state, navigate })
    expect(text(tree)).toContain(`${t.epItems}1`); expect(text(tree)).toContain(`${t.epPieces}1`)
    expect(text(tree)).toContain(`${t.epLevel} 2`)
    nodes(tree, n => n.type === 'button' && text(n) === t.tamerViewEquipmentProgress)[0].props.onClick()
    expect(navigate).toHaveBeenCalledWith('equipmentProgress'); expect(state.items).toHaveProperty('susanoomon-loader')
  })
  it.each([1, 2, 3])('previews Save V%s and cancels without importing or changing player data', async version => {
    const save = createLadmoSave({ data: { seals: {}, dUnitProgress: {}, dUnitInventory: {} }, preferences: { language: 'pt' } })
    const p = { t, reset: vi.fn(), exportSave: () => save, importSave: vi.fn() }
    let tree = render(About, p)
    nodes(tree, n => n.type === 'input' && n.props.type === 'file')[0].props.onChange({ target: { files: [{ text: async () => JSON.stringify({ ...save, version }) }] } })
    await Promise.resolve(); await Promise.resolve(); tree = render(About, p)
    expect(text(tree)).toContain(version === 3 ? t.epRestore : t.epOldSave)
    nodes(tree, n => n.type === 'button' && text(n) === t.cancel)[0].props.onClick()
    tree = render(About, p); expect(p.importSave).not.toHaveBeenCalled()
    expect(nodes(tree, n => n.props.role === 'dialog')).toHaveLength(0)
  })
})
