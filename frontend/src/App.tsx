import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Shell } from "./Shell";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { VerifyEmail } from "./pages/VerifyEmail";
import { Summary } from "./pages/Summary";
import { List } from "./pages/List";
import { Board } from "./pages/Board";
import { TaskDetail } from "./pages/TaskDetail";
import { Chat } from "./pages/Chat";
import { People } from "./pages/People";
import { Notifications } from "./pages/Notifications";
import { Admin } from "./pages/Admin";

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading session…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={user.role === "admin" ? <Admin /> : <Summary />} />
        {user.role !== "admin" ? (
          <>
            <Route path="/list" element={<List />} />
            <Route path="/board" element={<Board />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/cases/:id" element={<TaskDetail />} />
            <Route path="/cases" element={<Navigate to="/list" replace />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/people" element={<People />} />
            <Route path="/notifications" element={<Notifications />} />
          </>
        ) : (
          <>
            <Route path="/chat" element={<Chat />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin" element={<Admin />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
