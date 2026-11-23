import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RulesSection from '../components/about/RulesSection';
import SponsorsSection from '../components/about/SponsorsSection';
import SubmitSection from '../components/about/SubmitSection';
import { useTitle } from '../lib/useTitle';

const ANCHORS = [
  { id: 'rules', label: '收录规则' },
  { id: 'sponsors', label: '推荐位' },
  { id: 'submit', label: '插件提交' },
];

export default function About() {
  useTitle('关于', 'HarnessPack 的收录规则、推荐位与插件提交说明。');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <article className="fs-sm">
      <header className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-2">关于 HarnessPack</h1>
        <p className="mb-3 fg-secondary">
          HarnessPack 只做一件事：把 DeepSeek Harness 插件的 star 变化如实记录下来，并让增速可比。
          名单与分类来自上游精选清单，我们不重复做人工评审。
        </p>
        <nav className="d-flex flex-wrap gap-3">
          {ANCHORS.map((item) => (
            <Link key={item.id} to={`/about#${item.id}`} className="text-decoration-none">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <RulesSection />
      <SponsorsSection />
      <SubmitSection />
    </article>
  );
}
