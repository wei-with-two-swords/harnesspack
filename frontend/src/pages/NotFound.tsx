import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <div className="num text-6xl font-semibold text-line">404</div>
      <h1 className="mt-4 text-xl font-semibold text-white">页面不存在</h1>
      <p className="mt-2 text-sm text-muted">链接可能已失效，或者插件已移出名单。</p>
      <Link to="/" className="btn mt-6">
        回到首页
      </Link>
    </div>
  );
}
