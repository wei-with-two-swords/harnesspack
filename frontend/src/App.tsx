import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Rankings from './pages/Rankings';
import PluginDetail from './pages/PluginDetail';
import About from './pages/About';
import DataMethods from './pages/DataMethods';
import Categories from './pages/Categories';
import CategoryBoard from './pages/CategoryBoard';
import Plugins from './pages/Plugins';
import Changelog from './pages/Changelog';
import Compare from './pages/Compare';
import ApiDocs from './pages/ApiDocs';
import Community from './pages/Community';
import Status from './pages/Status';
import Terms from './pages/Terms';
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
        <Route path="/rankings" element={<Navigate to="/rankings/velocity" replace />} />
        <Route path="/rankings/category/:category" element={<CategoryBoard />} />
        <Route path="/rankings/:board" element={<Rankings />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/plugins" element={<Plugins />} />
        <Route path="/plugins/:slug" element={<PluginDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/about/data" element={<DataMethods />} />
        <Route path="/about/rules" element={<Navigate to="/about#rules" replace />} />
        <Route path="/about/changelog" element={<Changelog />} />
        <Route path="/about/api" element={<ApiDocs />} />
        <Route path="/about/terms" element={<Terms />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/submit" element={<Navigate to="/about#submit" replace />} />
        <Route path="/status" element={<Status />} />
        <Route path="/sponsors" element={<Navigate to="/about#sponsors" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
