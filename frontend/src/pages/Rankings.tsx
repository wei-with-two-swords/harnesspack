import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { BoardResponse } from '../types';
import { BoardTabs, BOARD_TABS } from '../components/BoardTabs';
import { RankTable } from '../components/RankTable';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';

const BOARD_IDS = new Set<string>(BOARD_TABS.map((tab) => tab.id));
const PAGE_SIZE = 100;

const BOARD_TEXT: Record<string, string> = {
  velocity: '按今日新增 star 排序。只有相邻两个快照都存在时才计算增量。',
  growth: '按区间涨幅排序，基准日 star 需 ≥ 50。区间内缺任一快照则不参与计算。',
  total: '按当前 star 总量排序。并列时按名称升序。',
  darkhorse: '按区间内总榜名次跃升排序，正数为上升。',
  rookie: '收录名单内、仓库创建时间在最近 30 天的项目。',
  quality: '先剔除被标记为异常的单日涨幅，再按剩余天数的日均新增排序；至少 3 天数据才入榜。',
};

export default function Rankings() {
  const { board = 'velocity' } = useParams<{ board: string }>();
  const [window, setWindow] = useState(7);
  const [page, setPage] = useState(0);
  const valid = BOARD_IDS.has(board);

  useEffect(() => {
    setWindow(7);
    setPage(0);
  }, [board]);

  useEffect(() => {
    setPage(0);
  }, [window]);

  const { data, error, loading } = useApi<BoardResponse>(
    () =>
      valid
        ? api.board(board, window, undefined, PAGE_SIZE, page * PAGE_SIZE)
        : Promise.reject(new Error(`未知榜单：${board}`)),
    [board, window, valid, page],
  );

  const label = BOARD_TABS.find((tab) => tab.id === board)?.label ?? board;
  const title = label.endsWith('榜') ? label : `${label}榜`;
  useTitle(title, `${title}：${BOARD_TEXT[board] ?? ''}`.trim());
  const windowed = board === 'growth' || board === 'darkhorse' || board === 'quality';

  return (
    <section>
      <div className="mb-4 d-flex flex-column sm:flex-row sm:align-items-end justify-content-between gap-3">
        <div>
          <h1 className="fs-3xl fw-semibold mb-1">{title}</h1>
          <p className="fs-sm fg-secondary mb-0" style={{ maxWidth: '42rem' }}>
            {BOARD_TEXT[board] ?? '未知榜单'}
            {data?.as_of ? ` 截至 ${data.as_of}。` : ''}
          </p>
        </div>
        {windowed ? (
          <div className="btn-group btn-group-sm flex-shrink-0" role="group" aria-label="统计窗口">
            {[7, 30].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setWindow(option)}
                aria-pressed={window === option}
                className={`btn ${window === option ? 'btn-solid theme-secondary active' : 'btn-outline'}`}
              >
                近 {option} 天
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <BoardTabs active={board} />

      <div className="mt-4">
        {error ? <ErrorState error={error} /> : null}
        {loading ? <Loading /> : null}
        {!loading && !error && data ? (
          data.items.length > 0 ? (
            <>
              <RankTable items={data.items} board={board} />
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                total={data.total ?? data.items.length}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState title={`${title}暂无数据`}>
              {data.reason ?? '首次快照已入库，等下一次快照后榜单开始生长。'}
            </EmptyState>
          )
        ) : null}
      </div>
    </section>
  );
}
