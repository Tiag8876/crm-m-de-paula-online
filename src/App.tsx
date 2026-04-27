import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Navigate, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthGate, AdminGate, AccessGate } from "./components/AuthGate";
import { StateSyncProvider } from "./components/StateSyncProvider";
import { Dashboard } from "./pages/Dashboard";
import { Leads } from "./pages/Leads";
import { LeadDetails } from "./pages/LeadDetails";
import { Campaigns } from "./pages/Campaigns";
import { CalendarPage } from "./pages/CalendarPage";
import { Settings } from "./pages/Settings";
import { TrafficAnalytics } from "./pages/TrafficAnalytics";
import { SalesReports } from "./pages/SalesReports";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { OfflineSnapshotPage } from "./pages/OfflineSnapshotPage";
import { UsersAdminPage } from "./pages/UsersAdminPage";
import { ProspectingLeadDetails } from "./pages/ProspectingLeadDetails";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const Router = typeof window !== "undefined" && window.location.protocol === "file:" ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <Routes>
          <Route path="/offline" element={<OfflineSnapshotPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGate />}>
            <Route element={<AccessGate />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route element={<StateSyncProvider />}>
                  <Route path="leads" element={<Leads />} />
                  <Route path="leads/:id" element={<LeadDetails />} />
                  <Route path="campaigns" element={<Navigate to="/traffic?view=campaigns" replace />} />
                  <Route path="traffic" element={<TrafficAnalytics />} />
                  <Route path="reports" element={<SalesReports />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="prospecting" element={<Navigate to="/?operation=prospecting" replace />} />
                  <Route path="prospecting/leads" element={<Navigate to="/leads?operation=prospecting" replace />} />
                  <Route path="prospecting/leads/:id" element={<ProspectingLeadDetails />} />
                  <Route path="prospecting/reports" element={<Navigate to="/reports?operation=prospecting" replace />} />
                  <Route path="prospecting/settings" element={<Navigate to="/settings?tab=operations&section=funnels" replace />} />
                  <Route element={<AdminGate />}>
                    <Route path="admin/users" element={<UsersAdminPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

