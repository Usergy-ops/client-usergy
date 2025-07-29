
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClientAuthProvider } from "@/contexts/ClientAuthContext";
import { ClientProtectedRoute } from "@/components/client/ClientProtectedRoute";
import { useSessionBroadcast } from "@/hooks/useSessionBroadcast";
import Welcome from "./pages/Welcome";
import ProfileSetup from "./pages/ProfileSetup";
import ClientDashboard from "./pages/ClientDashboard";
import AuthCallback from "./pages/AuthCallback";
import Diagnostics from "./pages/Diagnostics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Inner app component that can use the auth context
const AppContent = () => {
  // Initialize session broadcasting for multi-tab support
  useSessionBroadcast();

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
        <Route 
          path="/profile" 
          element={
            <ClientProtectedRoute>
              <ProfileSetup />
            </ClientProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ClientProtectedRoute>
              <ClientDashboard />
            </ClientProtectedRoute>
          } 
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ClientAuthProvider>
        <AppContent />
      </ClientAuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
