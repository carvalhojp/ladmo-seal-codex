export function PageHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <section className="page-head"><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></section>
}
