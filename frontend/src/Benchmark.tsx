import { useEffect, useState } from 'react';
import { getJSON } from './api';
import { Bars, LineChart } from './Charts';
import { Download, fmt, Icon, SectionHeading, tabKeys } from './components';
import Predictions from './Predictions';
import type { Benchmark as BenchmarkData } from './types';

const tabs = [{id:'scores',label:'Skor'},{id:'training',label:'Training'},{id:'errors',label:'Error'},{id:'predictions',label:'Prediksi'},{id:'attention',label:'Attention'}];
const colors = ['#596864','#0d8176'];

function Scores({data}:{data:BenchmarkData}) {
  return <>
    <SectionHeading eyebrow="CORPUS-LEVEL · TANPA SMOOTHING" title="Kualitas terjemahan"><Download asset="bleu"/></SectionHeading>
    <div className="score-overview">{data.models.map((model,i)=><div className="score-overview-model" key={model.id}><span className="eyebrow">MODEL 0{i+1} <span> / {model.label}</span></span><div><strong className={`big-score numeric ${i===1?'accent':''}`}>{fmt(model.bleu['BLEU-4'],4)}</strong><span className="muted">BLEU-4</span></div><p>Checkpoint epoch {model.selected_epoch} · {fmt(model.parameters)} parameter</p></div>)}</div>
    <div className="benchmark-columns"><div><h3>BLEU-1 hingga BLEU-4</h3><Bars title="Perbandingan skor BLEU test set" rows={[1,2,3,4].map(n=>({label:`BLEU-${n}`,values:data.models.map(m=>m.bleu[`BLEU-${n}`])}))}/></div><div><h3>Konfigurasi eksperimen</h3><dl className="facts"><div><dt>Dataset</dt><dd>OPUS-100 · en-id</dd></div><div><dt>Train / validasi / test</dt><dd className="numeric">{data.models.slice(0,1).map(m=>`${fmt(m.train_pairs)} / ${fmt(m.validation_pairs)} / ${fmt(m.test_pairs)}`)}</dd></div><div><dt>Arsitektur</dt><dd>BiGRU → GRU</dd></div><div><dt>Embedding / hidden / attention</dt><dd className="numeric">64 / 128 / 64</dd></div><div><dt>Batch / epoch / seed</dt><dd className="numeric">16 / 10 / 42</dd></div><div><dt>Optimizer</dt><dd>Adam · lr 0,002</dd></div><div><dt>Teacher forcing / clipping</dt><dd className="numeric">0,5 / 1,0</dd></div><div><dt>Vocabulary ID / EN</dt><dd className="numeric">{fmt(data.models[0].source_vocab_size)} / {fmt(data.models[0].target_vocab_size)}</dd></div><div><dt>Training</dt><dd>CUDA · AMP FP16</dd></div></dl></div></div>
    <section className="subsection"><SectionHeading title="BLEU menurut panjang sumber"><Download asset="jumlah_kalimat_per_panjang"/></SectionHeading><Bars title="BLEU-4 menurut panjang kalimat sumber" rows={data.length_groups.map(g=>({label:g.id==='short'?'Pendek ≤12':g.id==='medium'?'Sedang 13–24':'Panjang ≥25',values:data.models.map(m=>m.bleu_by_length[g.id])}))}/><div className="length-counts">{data.length_groups.map(g=><div key={g.id}><span>{g.id==='short'?'Pendek':g.id==='medium'?'Sedang':'Panjang'}</span><strong className="numeric">{fmt(g.count)}<small> sampel</small></strong><span className="tiny muted">Rata-rata {fmt(g.mean_source_words,1)} kata</span></div>)}</div></section>
    <div className="method-note">BLEU skala 0–1. Split internal 80/10/10 dari official train; bukan official test OPUS-100.</div>
  </>;
}
function Training({data}:{data:BenchmarkData}) {
  const series = data.models.flatMap((m,i)=>[{name:`${m.label} · train`,values:data.history[m.id].map(e=>e.train_loss),color:colors[i],dashed:true},{name:`${m.label} · validasi`,values:data.history[m.id].map(e=>e.validation_loss),color:colors[i]}]);
  return <><SectionHeading eyebrow="10 EPOCH · CROSS-ENTROPY LOSS" title="Riwayat training"/>
    <LineChart title="Kurva training dan validasi kedua model" series={series} best={data.models.map((m,i)=>({epoch:m.selected_epoch,value:m.validation_loss,color:colors[i]}))}/><div className="method-note">Titik menandai checkpoint terbaik berdasarkan loss validasi. Garis putus-putus menunjukkan train loss.</div>
    <div className="table-scroll"><table><thead><tr><th>Model</th><th>Checkpoint</th><th>Loss validasi terbaik</th><th>Training CUDA</th><th>Parameter</th></tr></thead><tbody>{data.models.map(m=><tr key={m.id}><th>{m.label}</th><td>Epoch {m.selected_epoch}</td><td className="numeric">{fmt(m.validation_loss,4)}</td><td className="numeric">{fmt(m.training_seconds,2)} detik</td><td className="numeric">{fmt(m.parameters)}</td></tr>)}</tbody></table></div>
    <SectionHeading title="Loss per epoch"><Download asset="summary">Unduh ringkasan</Download></SectionHeading><div className="table-scroll"><table><thead><tr><th rowSpan={2}>Epoch</th><th colSpan={2}>Tanpa attention</th><th colSpan={2}>Bahdanau attention</th></tr><tr><th>Train</th><th>Validasi</th><th>Train</th><th>Validasi</th></tr></thead><tbody>{data.history.no_attention.map((epoch,i)=><tr key={epoch.epoch}><th className="numeric">{epoch.epoch}</th><td className="numeric">{fmt(epoch.train_loss,4)}</td><td className={`numeric ${epoch.epoch===data.models[0].selected_epoch?'best-cell':''}`}>{fmt(epoch.validation_loss,4)}</td><td className="numeric">{fmt(data.history.attention[i].train_loss,4)}</td><td className={`numeric ${epoch.epoch===data.models[1].selected_epoch?'best-cell':''}`}>{fmt(data.history.attention[i].validation_loss,4)}</td></tr>)}</tbody></table></div>
  </>;
}
function Errors({data}:{data:BenchmarkData}) {
  return <><SectionHeading eyebrow="TOKEN ALIGNMENT · SEQUENCEMATCHER" title="Jenis error"><Download asset="analisis_error"/></SectionHeading><Bars title="Jumlah error kedua model" digits={0} rows={data.errors.map(e=>({label:e.type,values:[e.no_attention,e.attention]}))}/><section className="subsection"><SectionHeading title="Error menurut posisi kata"><Download asset="error_by_position"/></SectionHeading><LineChart title="Persentase error per posisi kata" percent series={data.models.map((m,i)=>({name:m.label,color:colors[i],values:data.position_errors.map(p=>p[m.id])}))}/><div className="table-scroll"><table><thead><tr><th>Posisi</th><th>Tanpa attention</th><th>Bahdanau attention</th></tr></thead><tbody>{data.position_errors.map(p=><tr key={p.position}><th>{p.position}</th><td className="numeric">{fmt(p.no_attention,2)}%</td><td className="numeric">{fmt(p.attention,2)}%</td></tr>)}</tbody></table></div></section><div className="method-note">Error token dihitung terhadap referensi: substitusi, penghapusan, dan penyisipan.</div></>;
}
function Attention({data}:{data:BenchmarkData}) {
  return <><SectionHeading eyebrow="MODEL 02 · BAHDANAU" title="Alignment sumber dan terjemahan"/><div className="method-note">Sumbu horizontal: token sumber. Sumbu vertikal: token hasil. Warna terang menunjukkan bobot attention lebih besar.</div><div className="attention-gallery">{data.attention_images.map(image=><figure key={image.key}><div className="section-heading"><h3>{image.title}</h3><Download asset={image.artifact_key}>Unduh PNG</Download></div><div className="heatmap-frame"><img loading="lazy" src={`/api/artifacts/${image.artifact_key}?download=false`} alt={`Heatmap Bahdanau attention: ${image.title.toLowerCase()}`}/></div></figure>)}</div></>;
}
export default function Benchmark() {
  const initial = new URLSearchParams(location.search).get('tab') ?? 'scores';
  const [tab,setTab] = useState(tabs.some(t=>t.id===initial)?initial:'scores');
  const [data,setData] = useState<BenchmarkData|null>(null);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  useEffect(()=>{const controller=new AbortController();getJSON<BenchmarkData>('/api/benchmark',{signal:controller.signal}).then(setData).catch(err=>{if(!controller.signal.aborted)setError(err.message);});return ()=>controller.abort();},[attempt]);
  function select(id:string) {setTab(id);history.replaceState(null,'',`/benchmark?tab=${id}`);}
  return <><div className="page-heading"><div><span className="eyebrow">EXPERIMENT RESULTS</span><h1>Benchmark<span className="title-dot">.</span></h1><p>Perbandingan model pada split data dan konfigurasi yang sama.</p></div><span className="status-badge neutral"><Icon name="chart" size={14}/>{data?fmt(data.test_count):'—'} kalimat test</span></div>
    <div role="tablist" aria-label="Bagian benchmark" className="tabs">{tabs.map((t,i)=><button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={tab===t.id} tabIndex={tab===t.id?0:-1} onKeyDown={tabKeys} onClick={()=>select(t.id)}><span className="tab-number">0{i+1}</span>{t.label}</button>)}</div>
    {error?<div className="error-message" role="alert">{error}<button className="text-link" onClick={()=>{setError('');setAttempt(x=>x+1);}}><Icon name="refresh" size={14}/>Coba lagi</button></div>:!data?<div className="loading-state" role="status"><span className="spinner"/>Memuat benchmark…</div>:<div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="benchmark-panel" key={tab}>{tab==='scores'?<Scores data={data}/>:tab==='training'?<Training data={data}/>:tab==='errors'?<Errors data={data}/>:tab==='predictions'?<Predictions/>:<Attention data={data}/>}</div>}
  </>;
}
