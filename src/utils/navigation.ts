import { useEffect, useState } from 'react'
import { progressionSystems, type ProgressionObjective } from './progressionPlanner'

export type NavigationTab = 'home'|'tamer'|'codex'|'dunit'|'goal'|'equipment'|'buffDecks'|'mine'|'progress'|'compare'|'learn'|'about'|'updates'
export type EquipmentView = 'dungeons'|'models'|'calculator'|'progress'
export interface NavigationRoute { tab: NavigationTab; section?: string; objective?: ProgressionObjective; goalId?: string }
const tabs = new Set(['home','tamer','codex','dunit','goal','equipment','buffDecks','mine','progress','compare','learn','about','updates'])
const sections: Record<string, readonly string[]> = { equipment:['dungeons','models','calculator','progress'], mine:['seals','dunit'], progress:['seals','dunit'], goal:['seals','dunit'] }
const defaults: Record<string, string> = { equipment:'dungeons', mine:'seals', progress:'seals' }
function normalize(route: NavigationRoute): NavigationRoute {
  if (!tabs.has(route.tab) || (route.section !== undefined && !sections[route.tab]?.includes(route.section))) return { tab:'home' }
  const section = route.section ?? defaults[route.tab]
  const objective = route.tab === 'goal' && route.objective && progressionSystems(route.objective).length ? route.objective : undefined
  const goalId = route.tab === 'goal' && route.goalId &&
    /^[A-Za-z0-9_-]{1,100}$/.test(route.goalId)
      ? route.goalId : undefined
  return { tab:route.tab, ...(section ? {section} : {}), ...(objective ? {objective} : {}), ...(goalId ? {goalId} : {}) }
}
const hashFor = (route: NavigationRoute) => route.tab === 'home' ? '' : `#${route.tab}${route.section ? `/${route.section}` : ''}${route.goalId ? `?goal=${encodeURIComponent(route.goalId)}` : ''}`
type Browser = Pick<Window, 'history'|'location'|'addEventListener'|'removeEventListener'>
/** Navigation only: never reads or writes player storage. The pathname and query are preserved. */
export function createNavigation(browser: Browser) {
  const read = (): NavigationRoute => {
    const fragment = browser.location.hash.slice(1)
    const separator = fragment.indexOf('?')
    const path = separator < 0 ? fragment : fragment.slice(0, separator)
    const query = separator < 0 ? '' : fragment.slice(separator + 1)
    const parts = path.split('/')
    if (parts.length > 2) return {tab:'home'}
    const parsed = normalize({tab:(parts[0] || 'home') as NavigationTab, section:parts[1] || undefined, goalId:new URLSearchParams(query).get('goal') ?? undefined})
    const saved = browser.history.state?.ladmoNavigation as NavigationRoute | undefined
    return normalize({...parsed, ...(saved?.tab === parsed.tab && saved?.section === parsed.section && saved?.goalId === parsed.goalId ? {objective:saved.objective} : {})})
  }
  let current = read()
  const listeners = new Set<(route: NavigationRoute) => void>()
  const write = (route: NavigationRoute, replace: boolean) => {
    const url = `${browser.location.pathname}${browser.location.search}${hashFor(route)}`
    const state = {...browser.history.state, ladmoNavigation:route}
    if (replace) browser.history.replaceState(state, '', url)
    else browser.history.pushState(state, '', url)
  }
  write(current, true)
  const notify = () => listeners.forEach(listener => listener(current))
  const restore = () => {
    const next = read()
    if (browser.location.hash !== hashFor(next)) write(next, true)
    if (JSON.stringify(next) === JSON.stringify(current)) return
    current = next; notify()
  }
  return {
    get: () => current,
    go: (destination: NavigationRoute, replace = false) => {
      const next = normalize(destination)
      if (JSON.stringify(next) === JSON.stringify(current)) return
      write(next, replace); current = next; notify()
    },
    subscribe: (listener: (route: NavigationRoute) => void) => {
      if (!listeners.size) { browser.addEventListener('popstate', restore); browser.addEventListener('hashchange', restore) }
      listeners.add(listener)
      return () => { listeners.delete(listener); if (!listeners.size) { browser.removeEventListener('popstate', restore); browser.removeEventListener('hashchange', restore) } }
    },
  }
}
export function useNavigation() {
  const [controller] = useState(() => createNavigation(window))
  const [route, setRoute] = useState(controller.get)
  useEffect(() => controller.subscribe(setRoute), [controller])
  return [route, controller.go] as const
}
