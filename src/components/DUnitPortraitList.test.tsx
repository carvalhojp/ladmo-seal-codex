import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { dUnitPortraits } from '../data/dUnitPortraits'
import { DUnitPortraitList } from './DUnitPortraitList'

const imageSources = (markup: string) => [...markup.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1])

describe('D-Unit portrait lists', () => {
  it('renders every portrait for the EXP +100% recommendation in its registered order', () => {
    const markup = renderToStaticMarkup(<DUnitPortraitList setId="dunit-267" label="Digimons do conjunto" altPrefix="Retrato D-Unit" />)

    expect(markup).toContain('data-dunit-set-id="dunit-267"')
    expect(markup).toContain('Digimons do conjunto')
    expect(imageSources(markup)).toEqual(dUnitPortraits['dunit-267'])
    expect(markup).toContain('loading="lazy"')
    expect(markup).toContain('alt="Retrato D-Unit 1"')
  })

  it('does not render portraits from another set and safely omits an unknown set', () => {
    const markup = renderToStaticMarkup(<DUnitPortraitList setId="dunit-267" />)

    expect(imageSources(markup)).not.toContain(dUnitPortraits['dunit-1'][0])
    expect(renderToStaticMarkup(<DUnitPortraitList setId="dunit-missing" />)).toBe('')
  })

  it('keeps multiple recommended sets isolated by their stable set ids', () => {
    const markup = renderToStaticMarkup(<><DUnitPortraitList setId="dunit-267" /><DUnitPortraitList setId="dunit-1" /></>)

    expect(imageSources(markup)).toEqual([...dUnitPortraits['dunit-267'], ...dUnitPortraits['dunit-1']])
  })
})
