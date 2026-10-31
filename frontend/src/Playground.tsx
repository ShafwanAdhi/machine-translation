import { useState } from 'react';
import { copyText, getJSON, tokenCount } from './api';
import { fmt, Icon, modelNames } from './components';
import type { ModelId, TranslationResponse, TranslationResult } from './types';

const examples = ['kau lihat ?', 'beban kasus harus ringan .', 'lebih dingin ketimbang alasan menyedihkan untuk pancuran .'];

function Output({id, result, loading}: {id: ModelId; result?: TranslationResult; loading: boolean}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  async function copy() {
    if (!result) return;
    try { await copyText(result.translation); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopyError('Pilih dan salin teks secara manual.'); }
  }
  return <section className={`output-pane ${id === 'attention' ? 'attention-pane' : ''}`} aria-label={modelNames[id]}>
    <div className="output-heading"><div><span className="eyebrow">MODEL {id === 'attention' ? '02' : '01'}</span><h2>{modelNames[id]}</h2></div><button className="icon-button" aria-label={copied ? `Tersalin: ${modelNames[id]}` : `Salin hasil ${modelNames[id]}`} onClick={copy} disabled={!result || loading}><Icon name={copied ? 'check' : 'copy'}/></button></div>
    <div className={`translation ${result ? 'has-result' : ''}`} aria-live="polite">{loading ? <div className="skeleton" aria-label="Menerjemahkan"><i/><i/><i/></div> : result ? result.translation || <span className="muted">Tidak ada token sebelum EOS.</span> : <span className="empty-result">Terjemahan akan muncul di sini.</span>}</div>
    {copyError && <p className="tiny" role="status">{copyError}</p>}
    <div className="output-meta"><span>{id === 'attention' ? 'BiGRU → GRU + Bahdanau' : 'BiGRU → GRU'}</span>{result && <span className="numeric">{fmt(result.latency_ms, 1)} ms <span className="meta-separator">/</span> OOV {result.oov_count}</span>}</div>
    {result?.bleu && <div className="sentence-scores"><div><span className="eyebrow">BLEU per input</span><span className="tiny muted">Tanpa smoothing · 0–1</span></div><div className="score-grid">{Object.entries(result.bleu).map(([key,value]) => <div key={key}><span>{key}</span><strong className="numeric">{fmt(value,4)}</strong></div>)}</div></div>}
  </section>;
}

export default function Playground() {
  const [text, setText] = useState('');
  const [reference, setReference] = useState('');
  const [selection, setSelection] = useState('both');
  const [data, setData] = useState<TranslationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tokens = tokenCount(text);
  const selected: ModelId[] = selection === 'both' ? ['no_attention','attention'] : [selection as ModelId];
  async function translate(event: React.FormEvent) {
    event.preventDefault(); if (!text.trim() || loading || tokens > 60) return;
    setError(''); setLoading(true); setData(null);
    try {
      setData(await getJSON<TranslationResponse>('/api/translate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, models:selected, reference:reference.trim() || null})}));
    } catch (err) { setError(err instanceof Error ? err.message : 'Koneksi gagal.'); }
    finally { setLoading(false); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">TRANSLATION WORKSPACE</span><h1>Indonesia <span className="heading-arrow">→</span> Inggris<span className="title-dot">.</span></h1><p>GRU Seq2Seq · OPUS-100 · Greedy decoding</p></div><span className="status-badge"><i/>CPU inference</span></div>
    <form onSubmit={translate} className="translation-form">
      <div className="input-top"><label htmlFor="source">Teks Indonesia</label><span className="language-label">ID <Icon name="arrow" size={13}/> EN</span></div>
      <textarea id="source" value={text} onChange={event => {setText(event.target.value);setData(null);}} placeholder="Tulis kalimat yang ingin kamu terjemahkan…" maxLength={1000} rows={4} spellCheck={false} disabled={loading}/>
      <div className="input-bottom"><div className="examples"><span>Contoh</span>{examples.map((example,i) => <button type="button" onClick={() => {setText(example);setData(null);}} key={example} disabled={loading}>{i === 0 ? 'Percakapan' : i === 1 ? 'Kalimat pendek' : 'Perbandingan'}<Icon name="arrow" size={12}/></button>)}</div><span className={`tiny numeric ${tokens > 60 ? 'invalid' : 'muted'}`}>{text.length}/1.000 · {tokens}/60 token</span></div>
      <details className="reference"><summary>Referensi Inggris <span>opsional</span></summary><label className="sr-only" htmlFor="reference">Referensi terjemahan Inggris</label><textarea id="reference" value={reference} onChange={event => {setReference(event.target.value);setData(null);}} placeholder="Referensi untuk menghitung BLEU per input" maxLength={1000} rows={2} disabled={loading}/></details>
      <div className="form-actions"><div className="model-select"><label htmlFor="model">Model</label><select id="model" value={selection} onChange={event => {setSelection(event.target.value);setData(null);}} disabled={loading}><option value="both">Bandingkan keduanya</option><option value="no_attention">Tanpa attention</option><option value="attention">Bahdanau attention</option></select></div><button className="primary-button" disabled={loading || !text.trim() || tokens>60} type="submit">{loading ? <><span className="spinner"/>Menerjemahkan</> : <>Terjemahkan<Icon name="arrow"/></>}</button></div>
    </form>
    {error && <div className="error-message" role="alert">{error}</div>}
    <div className={`outputs ${selected.length === 1 ? 'single' : ''}`}>{selected.map(id => <Output id={id} key={id} result={data?.results.find(r => r.model===id)} loading={loading}/>)}</div>
    <div className="workspace-note"><span className="note-mark">i</span><p>Model eksperimen berbasis kata. BLEU per input dihitung terhadap referensi, terpisah dari benchmark test set.</p><a href="/benchmark">Lihat benchmark<Icon name="arrow" size={15}/></a></div>
  </>;
}
