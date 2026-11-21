import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { BoardResponse } from '../types';
import { RankTable } from '../components/RankTable';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { categoryLabel } from '../lib/format';

const PAGE_SIZE = 20;

export default function CategoryBoard() {
  const { category = 'other' } = useParams<{ category: string }>();
  useTitle(`${categoryLabel(category)}榜`, '同一分类内按 star 总量排名。');
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [category]);

  const label = categoryLabel(category);
  const { data, error, loading } = useApi<BoardResponse>(
    () => api.board('total', undefined, category, PAGE_SIZE, page * PAGE_SIZE),
    [category, page],
  );

  return (
    <section>
      <header className="mb-3 d-flex flex-column sm:flex-row sm:align-items-end justify-content-between gap-3">
        <div>
          <div className="fs-xs fg-secondary">
            <Link to="/categories" className="text-decoration-none">
              分类榜
            </Link>{' '}
            / {label}
          </div>
          <h1 className="mt-1 fs-3xl fw-semibold mb-1">{label}榜</h1>
          <p className="fs-sm fg-secondary mb-0" style={{ maxWidth: '42rem' }}>
            分类内按当前 star 总量排序，并列时按名称升序。
            {data?.as_of ? ` 截至 ${data.as_of}。` : ''}
          </p>
        </div>
        <div className="border rounded-3 px-3 py-2 fs-sm fg-secondary flex-shrink-0 bg-body-tertiary">
          该分类共 <span className="num">{data?.total ?? '—'}</span> 个在册插件
        </div>
      </header>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error && data ? (
        data.items.length > 0 ? (
          <div className="card overflow-hidden">
            <RankTable items={data.items} board="total" />
            <div className="px-4 pb-3">
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                total={data.total ?? data.items.length}
                onChange={setPage}
              />
            </div>
          </div>
        ) : (
          <EmptyState title={`${label}榜暂无数据`}>该分类下还没有已入库的插件。</EmptyState>
        )
      ) : null}

      <div className="mt-4 fs-sm">
        <Link to="/rankings/total" className="text-decoration-none">
          ← 返回总榜
        </Link>
      </div>
    </section>
  );
}
