import { ChevronRight } from 'lucide-react'
import { levels } from '../types'
import { openersFor } from '../utils/calculations'
import { PageHead } from './PageHead'
export function HowItWorks({t}:{t:any}){return <><PageHead eyebrow={t.learnEyebrow} title={t.learn} text={t.learnText}/><section className="learn-card"><h2>{t.whatSeal}</h2><p>{t.learnBody}</p><div className="level-flow">{levels.map((l,i)=><div key={l.id}><b>{l.label}</b><span>{l.threshold.toLocaleString()} {t.seals}</span><small>{openersFor(l.threshold)} {t.openers}</small>{i<5&&<ChevronRight/>}</div>)}</div></section><section className="learn-card"><h2>{t.bonusCalc}</h2><p>{t.bonusBody}</p></section></>}