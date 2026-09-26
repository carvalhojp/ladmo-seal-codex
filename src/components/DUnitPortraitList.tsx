import { portraitsForDUnitSet } from '../data/dUnitPortraits'

type DUnitPortraitListProps = {
  setId: string
  label?: string
  altPrefix?: string
  decorative?: boolean
  className?: string
}

/** Renders the ordered portrait composition registered for one stable D-Unit set id. */
export function DUnitPortraitList({
  setId,
  label,
  altPrefix = 'D-Unit portrait',
  decorative = false,
  className = '',
}: DUnitPortraitListProps) {
  const portraits = portraitsForDUnitSet(setId)
  if (!portraits.length) return null

  return <div className={className} data-dunit-set-id={setId}>
    {label && <span className="dunit-portrait-label">{label}</span>}
    <div className="dunit-portraits" aria-label={label}>
      {portraits.map((src, index) => <img key={src} src={src} alt={decorative ? '' : `${altPrefix} ${index + 1}`} aria-hidden={decorative || undefined} loading="lazy" />)}
    </div>
  </div>
}
