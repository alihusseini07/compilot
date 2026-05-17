import { Navigate, Route, Routes, useOutletContext } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useCompetitors } from "./hooks/useCompetitors";
import { AnalysisProvider } from "./hooks/useAnalysis";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import PastReports from "./pages/PastReports";
import GenerateReport from "./pages/GenerateReport";
import Compare from "./pages/Compare";

function ProtectedLayout() {
  const { isAuthenticated, user, token, logout } = useAuth();
  const { competitors, addCompetitor, removeCompetitor } = useCompetitors(
    isAuthenticated ? token : null
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AnalysisProvider>
      <Layout
        user={user}
        token={token}
        competitors={competitors}
        onAddCompetitor={addCompetitor}
        onRemoveCompetitor={removeCompetitor}
        onLogout={logout}
        outletContext={{ competitors, token }}
      />
    </AnalysisProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/reports" element={<PastReportsPage />} />
        <Route path="/reports/:company" element={<PastReportsPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/generate/:company" element={<GeneratePage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function DashboardPage() {
  const { competitors, token } = useOutletContext();
  return <Dashboard competitors={competitors} token={token} />;
}

function PastReportsPage() {
  const { competitors } = useOutletContext();
  return <PastReports competitors={competitors} />;
}

function GeneratePage() {
  const { competitors } = useOutletContext();
  return <GenerateReport competitors={competitors} />;
}

function ComparePage() {
  const { competitors } = useOutletContext();
  return <Compare competitors={competitors} />;
}
