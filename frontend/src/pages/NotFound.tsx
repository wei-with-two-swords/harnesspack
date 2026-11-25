import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-5 text-center">
      <div className="num fs-6xl fw-semibold fg-secondary opacity-25">404</div>
      <h1 className="mt-4 fs-2xl fw-semibold">页面不存在</h1>
      <p className="mt-2 fs-sm fg-secondary">链接可能已失效，或者插件已移出名单。</p>
      <Link to="/" className="btn btn-solid mt-4">
        回到首页
      </Link>
    </div>
  );
}
