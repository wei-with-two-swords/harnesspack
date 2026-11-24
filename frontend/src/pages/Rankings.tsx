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
import { formatNumber } from '../lib/format';

const BOARD_IDS = new Set<string>(BOARD_TABS.map((tab) => tab.id));
function emptyReason(reason: string | null | undefined) {
  if (!reason) return '首次快照已入库，等下一次快照后榜单开始生长。';
  const missing = reason.match(/missing snapshot for (\d{4}-\d{2}-\d{2})/);
  if (missing) {
    return `需要 ${missing[1]} 的基准快照；本站从 2026-11-19 起记录，等窗口滚动到有基准日时榜单会自动出现。`;
  }
  return reason;
}

const PAGE_SIZE = 20;

const BOARD_TEXT: Record<string, string> = {
  velocity: '按今日新增 star 排序。只有相邻两个快照都存在时才计算增量。',
  growth: '按区间涨幅排序，基准日 star 需 ≥ 50。区间内缺任一快照则不参与计算。',
  total: '按当前 star 总量排序。并列时按名称升序。',
  darkhorse: '按区间内总榜名次跃升排序，正数为上升。',
  rookie: '收录名单内、仓库创建时间在最近 30 天的项目。',
  quality: '先剔除被标记为异常的单日涨幅，再按剩余天数的日均新增排序；至少 3 天数据才入榜。',
  npm: '按 npm registry 近 7 / 30 天的包下载量排序，star 仅作对照；下载量含 CI 与依赖，不等于用户安装数。',
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
  const windowed = board === 'growth' || board === 'darkhorse' || board === 'quality' || board === 'npm';

  return (
    <section>
      <header className="mb-3 d-flex flex-column sm:flex-row sm:align-items-end justify-content-between gap-3">
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
                近 {option} 天{board === 'npm' ? '下载' : ''}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <BoardTabs active={board} />

      {board === 'npm' && data && !data.reason ? (
        <div className="alert alert-secondary py-2 px-3 fs-xs mb-3" role="note">
          数据来自 npm registry 的 tarball 下载量（近 {data.window ?? 7} 天），
          包含 CI、镜像与依赖拉取，<strong>不等于真实用户安装数</strong>，也不与 star 相加。
          覆盖 {formatNumber(data.covered_packages)} 个可映射包；无 npm 包的插件不在本榜。
          截至 {data.as_of}。
        </div>
      ) : null}

      <div className="card overflow-hidden">
        {error ? (
          <div className="p-3">
            <ErrorState error={error} />
          </div>
        ) : null}
        {loading ? (
          <div className="p-3">
            <Loading />
          </div>
        ) : null}
        {!loading && !error && data ? (
          data.items.length > 0 ? (
            <>
              <RankTable items={data.items} board={board} />
              <div className="px-4 pb-3">
                <Pager
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={data.total ?? data.items.length}
                  onChange={setPage}
                />
              </div>
            </>
          ) : (
            <EmptyState bare title={`${title}暂无数据`}>
              {emptyReason(data.reason)}
            </EmptyState>
          )
        ) : null}
      </div>
    </section>
  );
}
