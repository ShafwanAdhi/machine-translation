import { useEffect, useState } from 'react';
import { getJSON } from './api';
import { Download, fmt, Icon } from './components';
import type { PredictionPage } from './types';

export default function Predictions() {
  const [query,setQuery] = useState('');
  const [length,setLength] = useState('all');
  const [exact,setExact] = useState('all');
  const [review,setReview] = useState(false);
  const [page,setPage] = useState(1);
  const [data,setData] = useState<PredictionPage | null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);setError('');
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({q:query,length,exact,review_only:String(review),page:String(page),page_size:'25'});
        const response = await getJSON<PredictionPage>(`/api/predictions?${params}`,{signal:controller.signal});
        setData(response);
      } catch(err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Gagal memuat prediksi.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    },200);
    return () => {clearTimeout(timer);controller.abort();};
  },[query,length,exact,review,page]);
  return <section>
    <div className="section-heading"><div><span className="eyebrow">TEST SET</span><h2>Prediksi berdampingan</h2></div><Download asset="semua_prediksi"/></div>
    <div className="filters"><label className="search-field"><span className="sr-only">Cari prediksi</span><input type="search" placeholder="Cari sumber, referensi, atau terjemahan…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} maxLength={200}/></label><select aria-label="Panjang kalimat" value={length} onChange={e=>{setLength(e.target.value);setPage(1);}}><option value="all">Semua panjang</option><option value="short">Pendek ≤12</option><option value="medium">Sedang 13–24</option><option value="long">Panjang ≥25</option></select><select aria-label="Exact match" value={exact} onChange={e=>{setExact(e.target.value);setPage(1);}}><option value="all">Semua exact match</option><option value="either">Exact: salah satu</option><option value="neither">Tanpa exact match</option><option value="no_attention">Exact: tanpa attention</option><option value="attention">Exact: Bahdanau</option></select></div>
    <div className="filter-bottom"><label className="checkbox-label"><input type="checkbox" checked={review} onChange={e=>{setReview(e.target.checked);setPage(1);}}/>Sampel review kualitatif</label><span className="tiny muted" role="status">{loading ? 'Memuat…' : `${fmt(data?.total ?? 0)} hasil`}</span></div>
    {error && <div className="error-message" role="alert">{error}</div>}
    <div className="table-scroll prediction-table" aria-busy={loading}><table><thead><tr><th>ID / panjang</th><th>Sumber & referensi</th><th>Tanpa attention</th><th>Bahdanau attention</th>{review && <th>Review manual</th>}</tr></thead><tbody>{data?.items.map(row=><tr key={row.id}><td><span className="numeric">{String(row.id).padStart(4,'0')}</span><span className="tiny muted block">{row.source_length} kata</span></td><td><p lang="id">{row.source}</p><p className="reference-text" lang="en">{row.reference}</p></td><td><p lang="en">{row.translations.no_attention}</p>{row.exact_matches.no_attention && <span className="match-label">Exact match</span>}</td><td><p lang="en">{row.translations.attention}</p>{row.exact_matches.attention && <span className="match-label">Exact match</span>}</td>{review && <td><span className="tiny">{row.review && Object.values(row.review).some(v=>v!==null) ? Object.entries(row.review).filter(([,v])=>v!==null).map(([k,v])=><span className="block" key={k}>{k}: {v}</span>) : 'Belum dinilai'}</span></td>}</tr>)}</tbody></table>{!loading && data?.total === 0 && <div className="empty-state">Tidak ada prediksi yang cocok.</div>}</div>
    <div className="pagination"><span className="tiny muted">Halaman {data?.pages ? page : 0} dari {data?.pages ?? 0}</span><div><button className="secondary-button" onClick={()=>setPage(p=>p-1)} disabled={page===1 || loading}><span className="reverse"><Icon name="chevron" size={14}/></span>Sebelumnya</button><button className="secondary-button" onClick={()=>setPage(p=>p+1)} disabled={!data || page>=data.pages || loading}>Berikutnya<Icon name="chevron" size={14}/></button></div></div>
    <div className="method-note">Exact match membandingkan kesamaan token, bukan kesetaraan makna. Review manual: adequacy dan fluency 0–2.</div>
    <Download asset="review_kualitatif">Unduh sampel review</Download>
  </section>;
}
