import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDate } from '../../lib/format';
import { EmptyState, ErrorState, Loading } from '../States';
import type { ChangelogEntry, ChangelogResponse } from '../../types';

const LINK = 'text-decoration-none';

function Chip({ name }: { name: string }) {
  return <span className="badge theme-secondary badge-subtle fs-xs">{name}</span>;
}

function totals(entries: ChangelogEntry[]) {
  return {
    added: entries.reduce((sum, entry) => sum + entry.added, 0),
    removed: entries.reduce((sum, entry) => sum + entry.removed, 0),
    changed: entries.reduce((sum, entry) => sum + entry.changed, 0),
  };
}

function DayNode({
  day,
  entries,
  defaultOpen,
}: {
  day: string;
  entries: ChangelogEntry[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sum = totals(entries);
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(day);

  return (
    <li className="hp-timeline-item">
      <span className="hp-timeline-dot" aria-hidden="true" />
      <div className="card overflow-hidden">
        <button
          type="button"
          className="hp-timeline-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ChevronDown className={`icon-leading hp-timeline-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
          <span className="fw-semibold fs-md">{isDate ? formatDate(day) : day}</span>
          <span className="ms-auto d-flex flex-wrap gap-3 fs-xs">
            {sum.added > 0 ? <span className="fg-success">+{sum.added} 新增</span> : null}
            {sum.removed > 0 ? <span className="fg-danger">-{sum.removed} 移除</span> : null}
            {sum.changed > 0 ? <span className="fg-warning">~{sum.changed} 变更</span> : null}
            {sum.added === 0 && sum.removed === 0 && sum.changed === 0 ? (
              <span className="fg-secondary">无变化</span>
            ) : null}
          </span>
        </button>
        {open ? (
          <div className="hp-timeline-body border-top">
            {entries.map((entry, index) => (
              <div className="hp-timeline-entry" key={`${entry.at ?? 'unknown'}-${index}`}>
                <div className="d-flex flex-wrap align-items-center gap-3 fs-xs fg-secondary">
                  <span className="num">{entry.at ? entry.at.slice(11, 16) : '未知时间'}</span>
                  <span className="fg-success">新增 {entry.added}</span>
                  <span className="fg-danger">移除 {entry.removed}</span>
                  <span className="fg-warning">变更 {entry.changed}</span>
                </div>
                {entry.added_sample.length > 0 ? (
                  <div className="mt-2 d-flex flex-wrap gap-2 align-items-center">
                    {entry.added_sample.map((name) => (
                      <Chip key={name} name={name} />
                    ))}
                    {entry.added > entry.added_sample.length ? (
                      <span className="fs-xs fg-secondary">等 {entry.added} 个</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function ChangelogSection() {
  const { data, error, loading } = useApi<ChangelogResponse>(() => api.changelog(50), []);

  const groups = useMemo(() => {
    const byDay = new Map<string, ChangelogEntry[]>();
    for (const entry of data?.items ?? []) {
      const day = entry.at ? entry.at.slice(0, 10) : '未知日期';
      const list = byDay.get(day) ?? [];
      list.push(entry);
      byDay.set(day, list);
    }
    return Array.from(byDay, ([day, entries]) => ({ day, entries }));
  }, [data]);

  return (
    <section id="changelog" className="hp-anchor mb-4">
      <h2 className="fs-xl fw-semibold mb-2">名单变更</h2>
      <p className="fs-sm fg-secondary mb-3" style={{ maxWidth: 'var(--measure)' }}>
        每次同步上游清单后记录新增、移除与变更的仓库，按天折叠。完整规则见{' '}
        <Link to="/about#rules" className={LINK}>
          收录规则
        </Link>
        ，名单源文件与变更日志都在公开仓库里可审计。
      </p>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error && data ? (
        groups.length > 0 ? (
          <ul className="hp-timeline">
            {groups.map((group, index) => (
              <DayNode key={group.day} day={group.day} entries={group.entries} defaultOpen={index === 0} />
            ))}
          </ul>
        ) : (
          <EmptyState title="还没有变更记录">下次同步上游清单后会在这里展示。</EmptyState>
        )
      ) : null}

      {data?.as_of ? (
        <p className="mt-3 mb-0 fs-xs fg-secondary">
          数据截至 {formatDate(data.as_of)} · 来自 awesome-dsh-plugin 清单同步
        </p>
      ) : null}
    </section>
  );
}
