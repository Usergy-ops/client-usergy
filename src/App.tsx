import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClientAuthProvider } from "@/contexts/ClientAuthContext";
import { ClientProtectedRoute } from "@/components/client/ClientProtectedRoute";
import Welcome from "./pages/Welcome";
import ProfileSetup from "./pages/ProfileSetup";
import ClientDashboard from "./pages/ClientDashboard";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ClientAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
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
        </BrowserRouter>
      </TooltipProvider>
    </ClientAuthProvider>
  </QueryClientProvider>
);

export default App;
