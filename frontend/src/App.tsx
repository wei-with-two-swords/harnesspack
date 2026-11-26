import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import { Loading } from './components/States';

// Route-level code splitting: the landing page stays in the main bundle,
// everything else loads on demand.
const PluginDetail = lazy(() => import('./pages/PluginDetail'));
const About = lazy(() => import('./pages/About'));
const Changelog = lazy(() => import('./pages/Changelog'));
const Compare = lazy(() => import('./pages/Compare'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Community = lazy(() => import('./pages/Community'));
const CommunityPost = lazy(() => import('./pages/CommunityPost'));
const CommunityUser = lazy(() => import('./pages/CommunityUser'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Subscribe = lazy(() => import('./pages/Subscribe'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

/** hm.js only reports the initial page; SPA navigations need an explicit PV. */
function BaiduPageView() {
  const { pathname, search } = useLocation();
  const current = `${pathname}${search}`;
  const previous = useRef(current);

  useEffect(() => {
    if (previous.current === current) return;
    previous.current = current;
    const hmt = (window as Window & { _hmt?: { push: (...args: unknown[]) => void } })._hmt;
    hmt?.push(['_trackPageview', current]);
  }, [current]);

  return null;
}

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <BaiduPageView />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="*"
          element={
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/api" element={<ApiDocs />} />
                <Route path="/community" element={<Community />} />
                <Route path="/community/notifications" element={<Notifications />} />
                <Route path="/community/p/:id" element={<CommunityPost />} />
                <Route path="/community/u/:login" element={<CommunityUser />} />
                <Route path="/plugins/:slug" element={<PluginDetail />} />
                <Route path="/subscribe" element={<Subscribe />} />
                <Route path="/about" element={<About />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/about/api" element={<Navigate to="/api" replace />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          }
        />
      </Routes>
    </Layout>
  );
}
