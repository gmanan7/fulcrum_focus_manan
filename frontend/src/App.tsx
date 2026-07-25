/* App root – routing & providers */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { NavBadgeCountsProvider } from "@/hooks/useNavBadgeCounts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import AdminUsers from "@/pages/AdminUsers";
import AdminDepartments from "@/pages/AdminDepartments";
import AdminAudit from "@/pages/AdminAudit";
import AdminAnalytics from "@/pages/AdminAnalytics";
import AdminTaskOverview from "@/pages/AdminTaskOverview";
import KpiMaster from "@/pages/KpiMaster";
import KpiEntry from "@/pages/KpiEntry";
import KpiTrends from "@/pages/KpiTrends";
import Meetings from "@/pages/Meetings";
import MeetingWorkspace from "@/pages/MeetingWorkspace";
import MeetingTemplates from "@/pages/MeetingTemplates";
import DecisionLog from "@/pages/DecisionLog";
import TaskBoard from "@/pages/TaskBoard";
import Compliance from "@/pages/Compliance";
import Planner from "@/pages/Planner";
import MyView from "@/pages/MyView";
import PmSchedule from "@/pages/PmSchedule";
import PDCycle from "@/pages/PDCycle";
import AdminCharts from "@/pages/AdminCharts";
import Index from "@/pages/Index";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <NavBadgeCountsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/my-view" element={<MyView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/kpi/entry" element={<KpiEntry />} />
              <Route path="/pm-schedule" element={<PmSchedule />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/kpi/master" element={<KpiMaster />} />
              <Route path="/kpi/trends" element={<KpiTrends />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/meetings/:id/workspace" element={<MeetingWorkspace />} />
              <Route path="/meetings/templates" element={<MeetingTemplates />} />
              <Route path="/meetings/decisions" element={<DecisionLog />} />
              <Route path="/tasks" element={<TaskBoard />} />
              <Route path="/pd-cycle" element={<PDCycle />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/departments" element={<AdminDepartments />} />
              <Route path="/admin/audit" element={<AdminAudit />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/tasks" element={<AdminTaskOverview />} />
              <Route path="/admin/charts" element={<AdminCharts />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </NavBadgeCountsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
