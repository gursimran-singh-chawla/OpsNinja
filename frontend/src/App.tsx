import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Shell } from "./Shell";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Cases } from "./pages/Cases";
import { CaseDetail } from "./pages/CaseDetail";
import { Chat } from "./pages/Chat";
import { People } from "./pages/People";
import { Notifications } from "./pages/Notifications";
import { Admin } from "./pages/Admin";

export function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-zinc-500">Loading session…</div>;
  }
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/people" element={<People />} />
        <Route path="/notifications" element={<Notifications />} />
        {user.role === "admin" ? <Route path="/admin" element={<Admin />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
