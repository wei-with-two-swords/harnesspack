import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChangelogSection from '../components/about/ChangelogSection';
import StatusSection from '../components/about/StatusSection';
import { useTitle } from '../lib/useTitle';

const LINK = 'text-decoration-none';

export default function Changelog() {
  useTitle(
    '名单变更与数据状态',
    '上游清单每次同步的新增、移除与变更记录，以及快照覆盖率、最近抓取时间、失败清单与数据库计数。',
  );
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <article className="fs-sm">
      <header className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-2">名单变更与数据状态</h1>
        <p className="fg-secondary mb-0" style={{ maxWidth: 'var(--measure)' }}>
          这里记录上游清单每次同步的增减，以及快照抓取的成功率、最近一次抓取与失败清单。
          统计口径见 <Link to="/about#data" className={LINK}>数据口径</Link>，
          收录与退出规则见 <Link to="/about#rules" className={LINK}>收录规则</Link>。
        </p>
      </header>

      <StatusSection />
      <ChangelogSection />
    </article>
  );
}
