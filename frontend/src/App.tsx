import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Rankings from './pages/Rankings';
import PluginDetail from './pages/PluginDetail';
import About from './pages/About';
import Sponsors from './pages/Sponsors';
import Categories from './pages/Categories';
import CategoryBoard from './pages/CategoryBoard';
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
        <Route path="/rankings" element={<Navigate to="/rankings/velocity" replace />} />
        <Route path="/rankings/category/:category" element={<CategoryBoard />} />
        <Route path="/rankings/:board" element={<Rankings />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/plugins/:slug" element={<PluginDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/sponsors" element={<Sponsors />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
