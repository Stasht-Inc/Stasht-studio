import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './styles/globals.css'
import App from './App'
import PublishedMemoryPage from './pages/PublishedMemoryPage'
import PublishedAuthorMemoryPage from './pages/PublishedAuthorMemoryPage'
import PropertyRegisterPage from './pages/PropertyRegisterPage'
import PersonalAccountRegisterPage from './pages/PersonalAccountRegisterPage'
import OAuthCallback from './pages/OAuthCallback'
import Sso from './pages/Sso'
import GoogleAuthCallbackWrapper from './pages/GoogleAuthCallbackWrapper'
import FacebookCallbackPage from './pages/FacebookCallbackPage'
import AppleAuthCallbackWrapper from './pages/AppleAuthCallbackWrapper'
import { AuthProvider } from './contexts/AuthContext'
import { PropertyProvider } from './contexts/PropertyContext'
import { UploadProgressProvider } from './contexts/UploadProgressContext'
import { SyncProgressProvider } from './contexts/SyncProgressContext'

// Check for magic link email parameter
// Skip storing on /signup path — SignupPage reads the email param directly from the URL.
// Storing it here causes the magic link handler in App.tsx to strip the param and reload,
// which breaks email prefilling on the signup page.
const mainUrlParams = new URLSearchParams(window.location.search);
const mainEmailParam = mainUrlParams.get('email');
const mainPath = window.location.pathname;

if (mainEmailParam && mainPath !== '/signup') {
  sessionStorage.setItem('pending_magic_link_email', mainEmailParam);
}

// Get Google OAuth Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.error('❌ VITE_GOOGLE_OAUTH_CLIENT_ID is not defined in .env file');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <PropertyProvider>
              <UploadProgressProvider>
                <SyncProgressProvider>
                  <Routes>
                  {/* Specific routes MUST come before catch-all /* route */}
                  <Route path="/published-memory/:slug" element={<PublishedMemoryPage />} />
                  <Route path="/published-author-memory/:slug" element={<PublishedAuthorMemoryPage />} />
                  <Route path="/property/register/:token" element={<PropertyRegisterPage />} />
                  <Route path="/account-register" element={<PersonalAccountRegisterPage />} />
                  <Route path="/sso" element={<Sso />} />
                  <Route path="/auth/google/callback" element={<GoogleAuthCallbackWrapper />} />
                  <Route path="/auth/callback/google" element={<GoogleAuthCallbackWrapper />} />
                  <Route path="/auth/apple/callback" element={<AppleAuthCallbackWrapper />} />
                  <Route path="/auth/callback/:service" element={<OAuthCallback />} />
                  {/* Facebook callback routes - MUST be before /* catch-all */}
                  <Route path="/facebook/callback" element={<FacebookCallbackPage />} />
                  <Route path="/auth/facebook/callback" element={<FacebookCallbackPage />} />
                  {/* Catch-all route MUST be last */}
                  <Route path="/*" element={<App />} />
                  </Routes>
                </SyncProgressProvider>
              </UploadProgressProvider>
            </PropertyProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)