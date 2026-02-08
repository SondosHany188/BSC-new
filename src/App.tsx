import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { DepartmentsProvider } from "@/contexts/DepartmentsContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import StrategicMap from "./pages/StrategicMap";
import Indicators from "./pages/Indicators";
import AddIndicator from "./pages/AddIndicator";
import KPIEvaluation from "./pages/KPIEvaluation";
import NotFound from "./pages/NotFound";
import EmptyPage from "./pages/EmptyPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DepartmentsProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />

            {/* Main layout with right panel */}
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Strategy routes */}
              <Route path="/strategy/vision" element={<EmptyPage />} />
              <Route path="/strategy/strategic-map" element={<StrategicMap />} />
              <Route path="/strategy/indicators" element={<Indicators />} />
              <Route path="/strategy/initiatives" element={<EmptyPage />} />

              {/* Execution routes */}
              <Route path="/execution/vision" element={<EmptyPage />} />
              <Route path="/execution/strategic-map" element={<StrategicMap />} />
              <Route path="/execution/indicators" element={<Indicators />} />
              <Route path="/execution/initiatives" element={<EmptyPage />} />

              {/* Financial routes */}
              <Route path="/financial/vision" element={<EmptyPage />} />
              <Route path="/financial/strategic-map" element={<StrategicMap />} />
              <Route path="/financial/indicators" element={<Indicators />} />
              <Route path="/financial/initiatives" element={<EmptyPage />} />

              {/* Open routes */}
              <Route path="/open/vision" element={<EmptyPage />} />
              <Route path="/open/strategic-map" element={<StrategicMap />} />
              <Route path="/open/indicators" element={<Indicators />} />
              <Route path="/open/initiatives" element={<EmptyPage />} />

              {/* HR routes */}
              <Route path="/hr/vision" element={<EmptyPage />} />
              <Route path="/hr/strategic-map" element={<StrategicMap />} />
              <Route path="/hr/indicators" element={<Indicators />} />
              <Route path="/hr/initiatives" element={<EmptyPage />} />

              {/* Dynamic department routes - catch all for new departments */}
              <Route path="/:department/vision" element={<EmptyPage />} />
              <Route path="/:department/indicators" element={<Indicators />} />
              <Route path="/:department/initiatives" element={<EmptyPage />} />
              <Route path="/indicators/add" element={<AddIndicator />} />
              <Route path="/indicators/edit/:id" element={<AddIndicator />} />
              <Route path="/notifications/kpi-evaluation" element={<KPIEvaluation />} />
            </Route>

            {/* Reports pages without right panel */}
            <Route path="/strategy/reports" element={<MainLayout hideRightPanel><Reports /></MainLayout>} />
            <Route path="/execution/reports" element={<MainLayout hideRightPanel><Reports /></MainLayout>} />
            <Route path="/financial/reports" element={<MainLayout hideRightPanel><Reports /></MainLayout>} />
            <Route path="/open/reports" element={<MainLayout hideRightPanel><Reports /></MainLayout>} />
            <Route path="/hr/reports" element={<MainLayout hideRightPanel><Reports /></MainLayout>} />
            <Route path="/:department/reports" element={<MainLayout hideRightPanel><Reports /></MainLayout>} />
            <Route path="/:department/strategic-map" element={<MainLayout hideRightPanel><StrategicMap /></MainLayout>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DepartmentsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
