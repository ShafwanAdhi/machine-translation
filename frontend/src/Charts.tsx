import { fmt, Legend } from './components';

export function Bars({rows, digits = 4, title}: {rows: {label: string; values: number[]}[]; digits?: number; title: string}) {
  const max = Math.max(...rows.flatMap(r => r.values), 0.001);
  return <div className="bar-chart" role="img" aria-label={`${title}. ${rows.map(r => `${r.label}: tanpa attention ${r.values[0]}, Bahdanau ${r.values[1]}`).join("; ")}`}>
    <Legend/>
    {rows.map(row => <div className="bar-group" key={row.label}><span className="bar-label">{row.label}</span><div className="bar-pair">{row.values.map((value, index) => <div className="bar-row" key={index}><div className="bar-track"><div className={`bar-fill ${index === 1 ? 'teal' : 'gray'}`} style={{width: `${100 * value / max}%`}}/></div><span className="numeric">{fmt(value, digits)}</span></div>)}</div></div>)}
  </div>;
}

export function LineChart({series, title, percent = false, best = []}: {
  series: {name: string; values: number[]; color: string; dashed?: boolean}[];
  title: string; percent?: boolean; best?: {epoch: number; value: number; color: string}[];
}) {
  const width = 720, height = 270, left = 44, right = 18, top = 18, bottom = 34;
  const max = Math.ceil(Math.max(...series.flatMap(s => s.values), 1) * 1.05);
  const count = Math.max(...series.map(s => s.values.length));
  const x = (i: number) => left + i * (width - left - right) / Math.max(count - 1, 1);
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  return <div className="line-chart"><svg role="img" aria-label={title} viewBox={`0 0 ${width} ${height}`}>
    <title>{title}</title>
    {Array.from({length: 5}, (_, i) => max * i / 4).map(value => <g key={value}><line x1={left} y1={y(value)} x2={width-right} y2={y(value)} stroke="#e5ebe8"/><text x={left-10} y={y(value)+4} textAnchor="end">{fmt(value, percent ? 0 : 1)}{percent ? '%' : ''}</text></g>)}
    {Array.from({length: count}, (_, i) => <text key={i} x={x(i)} y={height-9} textAnchor="middle">{percent ? `${i*20}–${(i+1)*20}` : i+1}</text>)}
    {series.map(s => <polyline key={s.name} points={s.values.map((v,i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '5 5' : undefined}><title>{s.name}: {s.values.join(', ')}</title></polyline>)}
    {best.map(point => <g key={point.color}><circle cx={x(point.epoch-1)} cy={y(point.value)} r="6" fill="white" stroke={point.color} strokeWidth="2.5"/><title>Checkpoint epoch {point.epoch}: {point.value}</title></g>)}
  </svg><div className="legend">{series.map(s => <span key={s.name}><i className={`line-key ${s.dashed ? 'dashed' : ''}`} style={{borderColor:s.color}}/>{s.name}</span>)}</div></div>;
}
