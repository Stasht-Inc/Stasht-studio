import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authAPI } from '../utils/authUtils';
import StashtLogo from '../components/StashtLogo';
import { useAuth } from '../contexts/AuthContext';
import SessionValidator from '../utils/sessionValidator';
import { AccountChoiceModal, getAdminCollaborator, AdminCollaborator } from '../components/AccountChoiceModal';


interface AccountActivationPageProps {
  token: string;
  onActivationComplete: (redirectUrl?: string) => void;
}

interface ActivationState {
  isLoading: boolean;
  success: boolean;
  error: string | null;
  redirectUrl?: string;
}

export default function AccountActivationPage({ token, onActivationComplete }: AccountActivationPageProps) {
  const { updateUser, login, isAuthenticated } = useAuth();
  const hasActivated = useRef(false); // Prevent double API calls
  const [state, setState] = useState<ActivationState>({
    isLoading: true,
    success: false,
    error: null
  });

  // Account choice modal state (for admin collaborators)
  const [showAccountChoice, setShowAccountChoice] = useState(false);
  const [adminCollaborators, setAdminCollaborators] = useState<AdminCollaborator[]>([]);  // Changed to array
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [pendingToken, setPendingToken] = useState<string>('');

  useEffect(() => {
    const activateAccount = async () => {
      if (!token || hasActivated.current) {
        if (!token) {
          setState({
            isLoading: false,
            success: false,
            error: 'Invalid activation link'
          });
        }
        return;
      }

      hasActivated.current = true; // Mark as activating to prevent duplicate calls

      // Check for property parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const propertyId = urlParams.get('property');
      console.log('🏠 AccountActivationPage: Property parameter from URL:', propertyId);

      // Store property ID for post-activation redirect
      if (propertyId) {
        localStorage.setItem('pending_property_switch', propertyId);
        console.log('🏠 AccountActivationPage: Stored property ID for post-activation redirect');
      }

      // Debug: Check what's in localStorage at activation time
      console.log('🔍 AccountActivationPage: Checking localStorage at activation start');
      console.log('🔍 pending_admin_collaborators:', localStorage.getItem('pending_admin_collaborators'));

      try {
        console.log('🔄 Activating account with token:', token);
        console.log('🔄 Token length:', token.length);
        console.log('🔄 Calling authAPI.activateAccount...');
        
        const response = await authAPI.activateAccount(token);
        
        console.log('📡 Activation API response:', response);
        console.log('📡 Response success:', response.success);
        console.log('📡 Response error:', response.error);
        console.log('📡 Response data:', response.data);

        console.log('🔍 Checking response.success:', response.success);
        
        if (response.success) {
          console.log('✅ Success case - setting state to success: true');

          // Log the full response structure for debugging
          console.log('📦 Full response structure:', JSON.stringify(response, null, 2));

          // Store user data and token from activation response
          // Check if user and token are directly in response or nested in data
          const userData = response.user || response.data?.user;
          const tokenData = response.token || response.data?.token;

          console.log('👤 Extracted userData:', userData);
          console.log('🔑 Extracted tokenData:', tokenData ? 'Present' : 'Missing');

          if (userData && tokenData) {
            console.log('💾 Activation successful, checking for admin collaborators first...');

            // 1. Check for admin collaborators FIRST - from activation response, then from localStorage (stored during signup)
            const responseCollaborators = response.collaborators || [];
            const storedCollaborators = localStorage.getItem('pending_admin_collaborators');
            console.log('🔍 AccountActivationPage: Collaborators from activation response:', responseCollaborators);
            console.log('🔍 AccountActivationPage: Stored collaborators from signup:', storedCollaborators);

            // Use response collaborators first, fall back to stored ones
            let collaborators: any[] = responseCollaborators;
            if (collaborators.length === 0 && storedCollaborators) {
              try {
                collaborators = JSON.parse(storedCollaborators);
              } catch (e) {
                console.error('Error parsing stored collaborators:', e);
              }
            }

            // Clear stored collaborators regardless
            localStorage.removeItem('pending_admin_collaborators');

            console.log('🔍 AccountActivationPage: Final collaborators to check:', collaborators);
            console.log('🔍 AccountActivationPage: collaborators.length:', collaborators.length);
            const adminCollabs = getAdminCollaborator(collaborators);  // Returns array now
            console.log('🔍 AccountActivationPage: adminCollab(s) result:', adminCollabs.length, 'admin(s)');

            // 1b. Check for partial admin access — same as LoginPage does on login
            const partialAdminRaw: any[] =
              response.partial_admin_access ||
              response.data?.partial_admin_access ||
              response.data?.data?.partial_admin_access ||
              [];
            const partialAdminCollabs: AdminCollaborator[] = partialAdminRaw.map((entry: any) => ({
              owner_id: String(entry.owner_id),
              memory_id: null,
              role: 'partial_admin',
              user_id: String(entry.owner?.id || entry.owner_id),
              owner_name: entry.owner?.name || '',
              owner_email: entry.owner?.email || '',
              owner: entry.owner,
              isPartialAdmin: true,
            }));
            console.log('🔍 AccountActivationPage: Partial admin entries:', partialAdminCollabs.length);

            const allAdminCollabs = [...adminCollabs, ...partialAdminCollabs];

            if (allAdminCollabs.length > 0) {
              console.log('🔐 AccountActivationPage: Admin/partial-admin collaborator(s) found:', allAdminCollabs);
              console.log('🔐 Setting showAccountChoice to true...');

              // DON'T store auth data - wait for user to choose account
              // Set state to show account choice modal
              setPendingUser(userData);
              setPendingToken(tokenData);
              setAdminCollaborators(allAdminCollabs);
              setShowAccountChoice(true);

              // Set success state but don't redirect yet
              setState({
                isLoading: false,
                success: true,
                error: null,
                redirectUrl: '/stories'
              });

              console.log('🔐 AccountActivationPage: States set, returning to show modal');
              return; // Don't redirect, wait for user choice
            }

            // 2. No admin collaborator - Store authentication data
            console.log('💾 No admin collaborator, storing authentication data...');
            localStorage.setItem('stasht_user', JSON.stringify(userData));
            console.log('✅ stasht_user saved:', JSON.stringify(userData, null, 2));

            localStorage.setItem('stasht_token', tokenData);
            console.log('✅ stasht_token saved:', tokenData);

            localStorage.setItem('is_new_user', 'true');

            // 3. Initialize session validation (required for AuthContext)
            const userIdentifier = userData.email || userData.phone_number;
            if (userData.id && userIdentifier) {
              SessionValidator.initSession(userData.id, userIdentifier, tokenData);
              console.log('✅ Session validator initialized with identifier:', userIdentifier);
            } else {
              console.log('⚠️ Cannot initialize SessionValidator - missing userId or identifier');
            }

            // 4. Store session change event (for cross-tab detection)
            const sessionChangeData = {
              userId: userData.id,
              email: userData.email,
              timestamp: Date.now()
            };
            localStorage.setItem('stasht_session_change', JSON.stringify(sessionChangeData));
            console.log('✅ stasht_session_change saved:', sessionChangeData);

            // 5. No admin collaborator - Redirect to /stories using proper React navigation
            // The AuthContext will read localStorage on initialization and authenticate the user
            console.log('✅ All auth data saved, redirecting to campaigns page...');

            // Set success state first to show success message
            setState({
              isLoading: false,
              success: true,
              error: null,
              redirectUrl: '/stories'
            });

            // Reload the page to properly authenticate and redirect
            setTimeout(() => {
              console.log('🔄 Reloading page to authenticate user...');
              window.location.href = '/'; // Reload to home, AuthContext will pick up auth and redirect
            }, 1500); // Short delay to show success message
          } else {
            console.log('⚠️ Missing user data or token in response');
            console.log('- userData:', userData);
            console.log('- tokenData:', tokenData);

            // Fallback: If activation succeeded but no user/token returned,
            // redirect to login page so user can login with their activated account
            console.log('✅ Activation succeeded but no auth data returned - redirecting to login');

            // Keep property parameter stored for post-login redirect
            const urlParams = new URLSearchParams(window.location.search);
            const propertyId = urlParams.get('property');
            if (propertyId) {
              console.log('🏠 Keeping property parameter for post-login redirect:', propertyId);
              console.log('🏠 After login, you will be redirected to property ID:', propertyId);
              // Property already stored above at the start of activation
            }

            setState({
              isLoading: false,
              success: true,
              error: null,
              redirectUrl: propertyId ? `/property/${propertyId}` : '/login'
            });
            setTimeout(() => {
              // Redirect to login - after login, MemoriesPage will pick up pending_property_switch
              onActivationComplete('/login');
            }, 2000); // Slightly longer delay to show message
          }
        } else {
          console.log('❌ Failure case - setting state to success: false');
          console.log('❌ Error message:', response.error || response.message);
          setState({
            isLoading: false,
            success: false,
            error: response.error || response.message || 'Account activation failed'
          });
        }
      } catch (error) {
        console.error('Account activation error:', error);
        setState({
          isLoading: false,
          success: false,
          error: 'An error occurred during activation'
        });
      }
    };

    activateAccount();
  }, [token, onActivationComplete, updateUser]);

  const handleManualRedirect = () => {
    onActivationComplete(state.redirectUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex justify-center">
            <StashtLogo className="h-16 w-auto" fill="#6C60FF" />
          </div>
          {/* Desktop: Show "All your memories, connected in one place." */}
  
          {/* Mobile: Show "Account Activation" */}
          <div className="block md:hidden">
            <h2 className="text-2xl font-semibold text-gray-900">Account Activation</h2>
            <p className="text-[#4A5565] mt-2">Activating your Stasht account</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          {/* Desktop only - Mobile shows this in logo section */}
          <h1 className="hidden md:block text-2xl font-semibold text-gray-900 mb-2">
            Account Activation
          </h1>

        {state.isLoading ? (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="w-12 h-12 text-[#6C60FF] animate-spin" />
            </div>
            <p className="text-gray-600 mb-6">
              Activating your account...
            </p>
          </>
        ) : state.success ? (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-green-600 font-medium mb-2">
              Account Activated Successfully!
            </p>
            <p className="text-gray-600 mb-6">
              {state.redirectUrl === '/login'
                ? 'Please login to continue. You will be redirected to your property after login.'
                : 'Welcome to Stasht Studio! You will be redirected to your campaigns shortly.'}
            </p>
            <div className="text-sm text-gray-500 mb-4">
              {state.redirectUrl === '/login'
                ? 'Redirecting to login...'
                : 'Redirecting in 3 seconds...'}
            </div>
            <button
              onClick={handleManualRedirect}
              className="w-full bg-[#6C60FF] text-white py-3 px-6 rounded-lg hover:bg-[#5A52E6] transition-colors font-medium"
            >
              {state.redirectUrl === '/login' ? 'Continue to Login' : 'Continue to Campaigns'}
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <p className="text-red-600 font-medium mb-2">
              Activation Failed
            </p>
            <p className="text-gray-600 mb-6">
              {state.error || 'Unable to activate your account. The link may be invalid or expired.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-[#6C60FF] text-white py-3 px-6 rounded-lg hover:bg-[#5A52E6] transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => onActivationComplete()}
                className="w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Back to Login
              </button>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Account Choice Modal (for admin collaborators) */}
      {adminCollaborators.length > 0 && pendingUser && (
        <AccountChoiceModal
          isOpen={showAccountChoice}
          onClose={() => {
            // User closed modal without choosing - reset state, don't log in
            setShowAccountChoice(false);
            setPendingUser(null);
            setPendingToken('');
            setAdminCollaborators([]);  // Clear array
            // Redirect to login page - user needs to login again to make a choice
            onActivationComplete('/login');
          }}
          adminCollaborators={adminCollaborators}  // Pass array
          personalUser={pendingUser}
          personalToken={pendingToken}
          onComplete={() => {
            setShowAccountChoice(false);
            // Reload page to authenticate with selected account
            window.location.href = '/';
          }}
        />
      )}
    </div>
  );
}