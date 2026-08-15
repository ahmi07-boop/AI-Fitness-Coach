import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute, AdminRoute } from "./auth/RouteGuards";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Analysis from "./pages/Analysis";
import Goal from "./pages/Goal";
import Plan from "./pages/Plan";
import Dashboard from "./pages/Dashboard";
import Progress from "./pages/Progress";
import Coach from "./pages/Coach";
import Workout from "./pages/Workout";
import Nutrition from "./pages/Nutrition";
import Habits from "./pages/Habits";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Billing from "./pages/Billing";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminAI from "./pages/AdminAI";
import AdminPlans from "./pages/AdminPlans";
import AdminModeration from "./pages/AdminModeration";
import AdminLogs from "./pages/AdminLogs";
import AppErrorBoundary from "./components/AppErrorBoundary";

function App() {
  return <AuthProvider><BrowserRouter><AppErrorBoundary><Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />

    <Route element={<ProtectedRoute />}>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/goal" element={<Goal />} />
      <Route path="/plan" element={<Plan />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/coach" element={<Coach />} />
      <Route path="/workout" element={<Workout />} />
      <Route path="/nutrition" element={<Nutrition />} />
      <Route path="/habits" element={<Habits />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/billing" element={<Billing />} />
    </Route>

    <Route element={<AdminRoute />}>
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/ai" element={<AdminAI />} />
      <Route path="/admin/plans" element={<AdminPlans />} />
      <Route path="/admin/moderation" element={<AdminModeration />} />
      <Route path="/admin/logs" element={<AdminLogs />} />
    </Route>

    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></AppErrorBoundary></BrowserRouter></AuthProvider>;
}
export default App;
