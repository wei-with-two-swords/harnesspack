import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PluginDetail from './pages/PluginDetail';
import About from './pages/About';
import Changelog from './pages/Changelog';
import Compare from './pages/Compare';
import ApiDocs from './pages/ApiDocs';
import Community from './pages/Community';
import CommunityPost from './pages/CommunityPost';
import CommunityUser from './pages/CommunityUser';
import NotFound from './pages/NotFound';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/api" element={<ApiDocs />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/p/:id" element={<CommunityPost />} />
        <Route path="/community/u/:login" element={<CommunityUser />} />
        <Route path="/plugins/:slug" element={<PluginDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/about/api" element={<Navigate to="/api" replace />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
