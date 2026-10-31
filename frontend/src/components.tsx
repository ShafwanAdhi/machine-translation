import type { KeyboardEvent, ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  chevron: <path d="m8 5 7 7-7 7"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 7a7 7 0 0 1 11.6-2L20 8M4 16l2.9 3A7 7 0 0 0 18.5 17"/></>,
  chart: <><path d="M4 4v16h16M8 15l4-6 4 3 4-7"/></>,
};
export function Icon({name, size = 18}: {name: string; size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.arrow}</svg>;
}
export const modelNames = { no_attention: 'Tanpa attention', attention: 'Bahdanau attention' };
export const fmt = (v: number, digits = 0) => v.toLocaleString('id-ID', {minimumFractionDigits: digits, maximumFractionDigits: digits});
export function Legend() {
  return <div className="legend"><span><i className="dot gray"/>Tanpa attention</span><span><i className="dot teal"/>Bahdanau attention</span></div>;
}
export function Download({asset, children}: {asset: string; children?: ReactNode}) {
  return <a className="text-link" href={`/api/artifacts/${asset}`} download><Icon name="download" size={15}/>{children ?? 'Unduh CSV'}</a>;
}
export function SectionHeading({eyebrow, title, children}: {eyebrow?: string; title: string; children?: ReactNode}) {
  return <div className="section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{children}</div>;
}
export function tabKeys(event: KeyboardEvent<HTMLButtonElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const current = buttons.indexOf(event.currentTarget);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault(); buttons[index].focus(); buttons[index].click();
}
