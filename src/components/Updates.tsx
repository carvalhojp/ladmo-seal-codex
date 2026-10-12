import { updates } from '../data/updates'
import { PageHead } from './PageHead'

export function Updates({t}:{t:any}) {
  return <><PageHead eyebrow={t.updatesEyebrow} title={t.updatesTitle} text={t.updatesText}/><section className="updates-list">{updates.map((update,index) => <article className="update-card" key={`${update.date}:${update.titleKey??update.changes[0]}`}><div><span className="eyebrow">{update.date}</span>{index===0&&<small>{t.new}</small>}</div><h2>{update.titleKey?t[update.titleKey]:t.updateTitle}</h2><ul>{update.changes.map(key => <li key={key}>{t[key]}</li>)}</ul></article>)}</section></>
}
