import { updates } from '../data/updates'
import { PageHead } from './PageHead'

export function Updates({t}:{t:any}) {
  return <><PageHead eyebrow={t.updatesEyebrow} title={t.updatesTitle} text={t.updatesText}/><section className="updates-list">{updates.map(update => <article className="update-card" key={update.date}><div><span className="eyebrow">{update.date}</span><small>{t.new}</small></div><h2>{t.updateTitle}</h2><ul>{update.changes.map(key => <li key={key}>{t[key]}</li>)}</ul></article>)}</section></>
}
