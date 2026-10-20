import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import SmartCompose from "./pages/SmartCompose";
import CreateDocument from "./pages/CreateDocument";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import Templates from "./pages/Templates";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="smart" element={<SmartCompose />} />
        <Route path="create/:typeId" element={<CreateDocument />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/:id" element={<DocumentDetail />} />
        <Route path="templates" element={<Templates />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
