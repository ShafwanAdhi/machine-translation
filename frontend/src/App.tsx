import Playground from './Playground';
import Benchmark from './Benchmark';
import { Icon } from './components';

export default function App() {
  const benchmark = location.pathname === '/benchmark';
  return <div className="app-shell"><a className="skip-link" href="#main">Langsung ke konten</a><header className="site-header"><div className="header-inner"><a className="brand" href="/" aria-label="MT Lab beranda"><span className="brand-mark">m<span>t</span><i/></span><span>mt<span className="brand-slash">/</span>lab</span></a><nav aria-label="Navigasi utama"><a href="/" aria-current={!benchmark?'page':undefined}>Coba model</a><a href="/benchmark" aria-current={benchmark?'page':undefined}>Benchmark</a></nav><span className="header-caption">INDONESIA <Icon name="arrow" size={12}/> ENGLISH</span></div></header><main id="main" className="main-content">{benchmark?<Benchmark/>:<Playground/>}</main><footer className="site-footer"><div><span className="footer-brand">mt/lab</span><span>GRU Seq2Seq · Bahdanau Attention</span></div><span>OPUS-100 <span className="footer-divider">/</span> ID → EN</span></footer></div>;
}
