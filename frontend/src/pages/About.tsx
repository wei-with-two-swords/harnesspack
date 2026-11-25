import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DataSection from '../components/about/DataSection';
import StatusSection from '../components/about/StatusSection';
import ChangelogSection from '../components/about/ChangelogSection';
import TermsSection from '../components/about/TermsSection';
import RulesSection from '../components/about/RulesSection';
import SponsorsSection from '../components/about/SponsorsSection';
import SubmitSection from '../components/about/SubmitSection';
import { useTitle } from '../lib/useTitle';

const ANCHORS = [
  { id: 'intro', label: '站点简介' },
  { id: 'rules', label: '收录规则' },
  { id: 'submit', label: '插件提交' },
  { id: 'data', label: '数据口径' },
  { id: 'status', label: '数据状态' },
  { id: 'changelog', label: '名单变更' },
  { id: 'terms', label: '使用条款' },
  { id: 'sponsors', label: '推荐位' },
];

export default function About() {
  useTitle('关于', 'HarnessPack 的站点简介、收录规则、数据口径、数据状态、名单变更与使用条款。');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <article className="fs-sm" style={{ maxWidth: 'var(--measure-wide)' }}>
      <header id="intro" className="mb-4 hp-anchor">
        <h1 className="fs-3xl fw-semibold mb-2">关于 HarnessPack</h1>
        <p className="mb-3 fg-secondary">
          HarnessPack 只做一件事：把 DeepSeek Harness 插件的 STAR 变化如实记录下来，并让增速可比。
          名单与分类来自上游精选清单，我们不重复做人工评审。
        </p>
        <nav className="d-flex flex-wrap gap-3" aria-label="关于页目录">
          {ANCHORS.map((item) => (
            <Link key={item.id} to={`/about#${item.id}`} className="text-decoration-none">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <RulesSection />
      <SubmitSection />
      <DataSection />
      <StatusSection />
      <ChangelogSection />
      <TermsSection />
      <SponsorsSection />
    </article>
  );
}
