import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { LanguageProvider } from '@/hooks/use-language'
import { IntegrationProvider } from '@/hooks/use-integration'

import Layout from './components/Layout'
import DashboardLayout from './components/DashboardLayout'
import Index from './pages/Index'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import Settings from './pages/Settings'
import Chat from './pages/Chat'
import Onboarding from './pages/Onboarding'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <>{children}</>
}

const App = () => (
  <LanguageProvider>
    <BrowserRouter>
      <AuthProvider>
        <IntegrationProvider>
          <TooltipProvider>
            <Sonner position="top-right" richColors />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
              </Route>

              <Route path="/onboarding" element={<Navigate to="/app/onboarding" replace />} />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="contacts" element={<Contacts />} />
                <Route path="chat/:id" element={<Chat />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </IntegrationProvider>
      </AuthProvider>
    </BrowserRouter>
  </LanguageProvider>
)

export default App
