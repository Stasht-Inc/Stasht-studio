import { useState, useEffect } from 'react';
import { CreditCard, Download, Plus, Info, Check, Crown, TrendingUp, Calendar, DollarSign, Loader2, AlertTriangle, Clock, X, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import UpgradePlanModal, { plans as allPlans } from '../components/UpgradePlanModal';
import AddPaymentMethodModal from '../components/AddPaymentMethodModal';
import { PurchaseCreditsModal } from '../components/PurchaseCreditsModal';
import { stripeApi, BillingHistoryItem, PaymentMethod, SubscriptionItem, ScheduledChange } from '../utils/stripeApi';
import { authAPI, dashboardAPI } from '../utils/authUtils';
import { aiCreditsAPI, UsageHistoryResponse, CreditPackage, CreditBalance } from '../services/aiCreditsAPI';
import { useMemoryLimit } from '../hooks/useMemoryLimit';
import { toast } from 'sonner';

interface StorageOverview {
  memories_count: number;
  categories_count: number;
  labels_count: number;
  plan_id: number;
  plan_name: string;
  created_on: string;
  is_unlimited: boolean;
  memories_storage_gb: number;
  memories_storage_mb: number;
  memory_images_storage_gb: number;
  memory_images_storage_mb: number;
  plan_storage_size_gb: number;
  remaining_storage_gb: number;
  storage_limit_exceeded: boolean;
  total_storage_used_gb: number;
  total_storage_used_mb: number;
  usage_percentage: number;
  user_id: number;
  total_payment: number;
  ai_connects?: number;
  used_token?: number;
}

interface BillingPageProps {
  onNavigateToMemory?: (memoryId: string) => void;
}

export default function BillingPage({ onNavigateToMemory }: BillingPageProps = {}) {
  const { limitData, isAICreditsExceeded, checkLimit } = useMemoryLimit();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<string | null>(null);
  const [showPurchaseCreditsModal, setShowPurchaseCreditsModal] = useState(false);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);

  // Subscription data
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionItem | null>(null);
  const [scheduledChanges, setScheduledChanges] = useState<ScheduledChange[]>([]);
  const [upcomingSubscriptions, setUpcomingSubscriptions] = useState<SubscriptionItem[]>([]);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [cancelingScheduleId, setCancelingScheduleId] = useState<number | null>(null);

  // Storage overview data
  const [storageData, setStorageData] = useState<StorageOverview | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  // AI Credit History data
  const [usageHistory, setUsageHistory] = useState<UsageHistoryResponse | null>(null);
  const [isLoadingUsageHistory, setIsLoadingUsageHistory] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOperationType, setFilterOperationType] = useState<'ai_captions' | 'ai_memory_wizard' | undefined>(undefined);

  // AI Credit Balance data
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [isLoadingCreditBalance, setIsLoadingCreditBalance] = useState(true);

  // Fetch all data on component mount
  useEffect(() => {
    fetchSubscription();
    fetchBillingHistory();
    fetchPaymentMethods();
    fetchStorageOverview();
    fetchUsageHistory();
    fetchCreditBalance();

    // Auto-open upgrade modal if redirected from upgrade prompt
    if (sessionStorage.getItem('billing_open_upgrade') === 'true') {
      sessionStorage.removeItem('billing_open_upgrade');
      setShowUpgradeModal(true);
    }
  }, []);

  // Fetch usage history when page or filter changes
  useEffect(() => {
    fetchUsageHistory();
  }, [currentPage, filterOperationType]);

  // Check for auto-open purchase modal flag
  useEffect(() => {
    const shouldOpenModal = sessionStorage.getItem('openPurchaseCreditsModal');
    if (shouldOpenModal === 'true') {
      sessionStorage.removeItem('openPurchaseCreditsModal');
      handlePurchaseCredits();
    }
  }, []);


  const fetchSubscription = async () => {
    setIsLoadingSubscription(true);
    try {
      const response = await stripeApi.getCurrentSubscription();

      if (response.success) {
        const today = new Date();

        // Set scheduled changes first
        const scheduledChangeIds = new Set<string>();
        if (response.scheduled_changes && response.scheduled_changes.length > 0) {
          setScheduledChanges(response.scheduled_changes);
          // Track scheduled change IDs to avoid duplicates
          response.scheduled_changes.forEach(change => {
            scheduledChangeIds.add(change.stripe_schedule_id);
          });
        } else {
          setScheduledChanges([]);
        }

        if (response.active_subscriptions && response.active_subscriptions.length > 0) {
          // Filter to only CURRENTLY ACTIVE subscriptions (today is between start and end)
          const currentlyActiveSubscriptions = response.active_subscriptions.filter(sub => {
            const startDate = new Date(sub.current_period_start);
            const endDate = new Date(sub.current_period_end);
            // Subscription is active if today is between start and end dates
            return startDate <= today && endDate > today;
          });

          if (currentlyActiveSubscriptions.length > 0) {
            // Sort by start date (oldest first) and take the first one as current
            const sortedActive = currentlyActiveSubscriptions.sort((a, b) => {
              const dateA = new Date(a.current_period_start);
              const dateB = new Date(b.current_period_start);
              return dateA.getTime() - dateB.getTime();
            });

            setCurrentSubscription(sortedActive[0]);
          } else {
            setCurrentSubscription(null);
          }
        } else {
          setCurrentSubscription(null);
        }

        // Handle upcoming subscriptions (only if not already in scheduled changes)
        const upcomingList: SubscriptionItem[] = [];

        if (response.upcoming_subscriptions && response.upcoming_subscriptions.length > 0) {
          // Only add upcoming subscriptions that are NOT in scheduled changes
          response.upcoming_subscriptions.forEach(sub => {
            // Check if this subscription is not part of a scheduled change
            if (!scheduledChangeIds.has(sub.id)) {
              upcomingList.push(sub);
            }
          });
        }

        setUpcomingSubscriptions(upcomingList);
      } else {
        toast.error(response.error || 'Failed to load subscription data');
      }
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const fetchBillingHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await stripeApi.getBillingHistory();

      if (response.success && response.billing_history) {
        setBillingHistory(response.billing_history);
      } else {
        toast.error(response.error || 'Failed to load billing history');
      }
    } catch (error: any) {
      console.error('Error fetching billing history:', error);
      toast.error('Failed to load billing history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchPaymentMethods = async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const response = await stripeApi.getPaymentMethods();

      if (response.success && response.payment_methods) {
        setPaymentMethods(response.payment_methods);
      } else {
        toast.error(response.error || 'Failed to load payment methods');
      }
    } catch (error: any) {
      console.error('Error fetching payment methods:', error);
      toast.error('Failed to load payment methods');
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  };

  const fetchStorageOverview = async () => {
    setIsLoadingStorage(true);
    try {
      console.log('🔍 Fetching storage overview...');
      const response = await dashboardAPI.getStorageOverview();
      console.log('📊 Full response:', response);

      if (response && response.success && response.data) {
        // Backend returns double-nested data: response.data.data.storage_overview
        const storageOverview = response.data.data?.storage_overview || response.data.storage_overview;
        console.log('✅ Storage overview extracted:', storageOverview);

        if (storageOverview) {
          console.log('✅ Setting storage data with:', storageOverview);
          setStorageData(storageOverview);
          console.log('✅ Storage data state updated!');
        } else {
          console.error('❌ storage_overview not found in response');
          setStorageData(null);
        }
      } else {
        console.warn('⚠️ Storage API returned unsuccessful response or no data');
        setStorageData(null);
      }
    } catch (error: any) {
      console.error('❌ Error fetching storage overview:', error);
      setStorageData(null);
    } finally {
      setIsLoadingStorage(false);
    }
  };

  const fetchUsageHistory = async () => {
    setIsLoadingUsageHistory(true);
    try {
      const response = await aiCreditsAPI.getUsageHistory({
        page: currentPage,
        per_page: 10,
        operation_type: filterOperationType,
      });

      if (response) {
        setUsageHistory(response);
      } else {
        setUsageHistory(null);
      }
    } catch (error: any) {
      console.error('Error fetching usage history:', error);
      setUsageHistory(null);
      toast.error('Failed to load AI credit usage history');
    } finally {
      setIsLoadingUsageHistory(false);
    }
  };

  const fetchCreditBalance = async () => {
    setIsLoadingCreditBalance(true);
    try {
      console.log('🔍 Fetching AI credit balance...');
      const response = await aiCreditsAPI.getBalance();
      console.log('✅ Credit balance fetched:', response);

      if (response) {
        setCreditBalance(response);
      } else {
        setCreditBalance(null);
      }
    } catch (error: any) {
      console.error('❌ Error fetching credit balance:', error);
      setCreditBalance(null);
    } finally {
      setIsLoadingCreditBalance(false);
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: string, currency: string) => {
    const numAmount = parseFloat(amount);
    const symbol = currency === 'USD' ? '$' : currency;
    return `${symbol}${numAmount.toFixed(2)}`;
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Helper function to format plan display name for billing history
  const formatPlanDisplay = (planName: string, paymentDate: string) => {
    // Capitalize first letter of plan name
    const formattedPlan = planName.charAt(0).toUpperCase() + planName.slice(1);

    // Get month and year from payment date
    const date = new Date(paymentDate);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();

    return `${formattedPlan} Plan - ${month} ${year}`;
  };

  // Helper function to capitalize plan name
  const capitalizePlan = (planName: string) => {
    return planName.charAt(0).toUpperCase() + planName.slice(1);
  };

  // Helper function to format member since date (Month Year)
  const formatMemberSince = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  // Helper function to format date and time
  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper function to get invoice number
  const getInvoiceNumber = (invoice: BillingHistoryItem) => {
    // Extract last part of stripe_invoice_id or use id
    const invoiceId = invoice.stripe_invoice_id?.split('_').pop() || invoice.id;
    return `INV-${invoiceId}`;
  };

  // Helper function to format operation type
  const formatOperationType = (type: 'ai_captions' | 'ai_memory_wizard') => {
    const typeMap = {
      'ai_captions': 'AI Captions',
      'ai_memory_wizard': 'Campaign Wizard'
    };
    return typeMap[type] || type;
  };

  // Helper function to format usage date/time
  const formatUsageDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper function to map status
  const getStatusDisplay = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      'succeeded': { label: 'Paid', color: 'bg-green-100 text-green-700' },
      'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
      'failed': { label: 'Failed', color: 'bg-red-100 text-red-700' },
      'processing': { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  };

  // Handle delete payment method - show confirmation modal
  const handleDeletePaymentMethod = (paymentMethodId: string) => {
    setPaymentMethodToDelete(paymentMethodId);
    setShowDeleteConfirmModal(true);
  };

  // Confirm and execute delete
  const confirmDeletePaymentMethod = async () => {
    if (!paymentMethodToDelete) return;

    setShowDeleteConfirmModal(false);
    const toastId = toast.loading('Removing payment method...');

    try {
      const response = await stripeApi.deletePaymentMethod(paymentMethodToDelete);

      if (response.success) {
        toast.success(response.message || 'Payment method removed successfully', { id: toastId });
        // Refresh payment methods list
        fetchPaymentMethods();
      } else {
        toast.error(response.error || 'Failed to remove payment method', { id: toastId });
      }
    } catch (error: any) {
      toast.error('Failed to remove payment method', { id: toastId });
    } finally {
      setPaymentMethodToDelete(null);
    }
  };

  // Handle purchase credits button click
  const handlePurchaseCredits = async () => {
    const toastId = toast.loading('Loading purchase options...');

    try {
      const purchaseOptions = await aiCreditsAPI.getPurchaseOptions();
      const halvedPackages = (purchaseOptions.packages || []).map((pkg: any) => {
        const newCredits = Math.floor(pkg.credits);
        return {
          ...pkg,
          credits: newCredits,
          price_per_credit: newCredits > 0 ? pkg.price / newCredits : pkg.price_per_credit,
        };
      });
      setCreditPackages(halvedPackages);
      setShowPurchaseCreditsModal(true);
      toast.dismiss(toastId);
    } catch (error) {
      console.error('Error fetching purchase options:', error);
      toast.error('Failed to load purchase options', { id: toastId });
    }
  };

  // Handle successful credit purchase
  const handlePurchaseSuccess = () => {
    setShowPurchaseCreditsModal(false);
    // Refresh usage history and credit balance to reflect new credits
    fetchUsageHistory();
    fetchCreditBalance();
    toast.success('Credits purchased successfully!');
  };

  // Handle cancel scheduled change
  const handleCancelScheduledChange = async (scheduledChangeId: number) => {
    if (!confirm('Are you sure you want to cancel this scheduled plan change? You will not be refunded for the payment already made.')) {
      return;
    }

    setCancelingScheduleId(scheduledChangeId);
    const toastId = toast.loading('Canceling scheduled change...');

    try {
      const response = await stripeApi.cancelScheduledChange(scheduledChangeId);

      if (response.success) {
        toast.success(response.message || 'Scheduled change cancelled successfully', { id: toastId });
        // Refresh subscription data
        fetchSubscription();
      } else {
        toast.error(response.error || 'Failed to cancel scheduled change', { id: toastId });
      }
    } catch (error: any) {
      toast.error('Failed to cancel scheduled change', { id: toastId });
    } finally {
      setCancelingScheduleId(null);
    }
  };

// Handle refresh after subscription purchase (success or error)
  const handleSubscriptionUpdate = async () => {
    // Refresh all billing data
    fetchSubscription();
    fetchPaymentMethods();
    fetchStorageOverview();
    fetchCreditBalance();
    checkLimit();

    // Fetch billing history twice with delay (backend takes time to process payment)
    await fetchBillingHistory();

    // Wait 3 seconds then fetch again to get the latest payment record
    setTimeout(() => {
      fetchBillingHistory();
    }, 3000);
  };

  return (
    <>
      <div className="w-full px-4 md:px-6 lg:px-8 overflow-x-hidden">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Billing & Payments</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage and subscription, payment methods, and billing history</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={handlePurchaseCredits}
              className="bg-[#9333EA] hover:bg-[#7E22CE] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Buy more Credits
            </button>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-[#f6339A] hover:bg-[#d42982] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              Upgrade Plan
            </button>
          </div>
        </div>

      {/* Main Content - All Sections Visible */}
      <div className="space-y-6">
            {/* Current Plan Section */}
            <div id="current-plan" className="scroll-mt-24">
              <div className="space-y-6">
                {/* Current Plan Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  {isLoadingSubscription ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#6C60FF]" />
                        <p className="text-sm text-gray-600">Loading subscription...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Current Plan</h2>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                          storageData?.plan_name?.toLowerCase() === 'professional'
                            ? 'bg-purple-100 text-purple-700'
                            : storageData?.plan_name?.toLowerCase() === 'intermediate'
                            ? 'bg-pink-100 text-pink-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {storageData?.plan_name ? capitalizePlan(storageData.plan_name) : 'Starter'}
                        </span>
                      </div>

                      {/* Subscription Period Info */}
                      {currentSubscription && (
                        <div className="mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Billing Period</p>
                              <p className="text-xs sm:text-sm font-medium text-gray-900 capitalize">
                                {currentSubscription.billing_period} - ${currentSubscription.amount}/{currentSubscription.billing_period === 'yearly' ? 'year' : 'month'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Current Period</p>
                              <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">
                                <span className="block sm:inline">{formatDateTime(currentSubscription.current_period_start)}</span>
                                <span className="hidden sm:inline"> - </span>
                                <span className="block sm:hidden my-1">to</span>
                                <span className="block sm:inline">{formatDateTime(currentSubscription.current_period_end)}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                  {/* Storage */}
                  <div className="mb-6">
                    {isLoadingStorage ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-[#6C60FF]" />
                      </div>
                    ) : storageData ? (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                          <span className="text-sm sm:text-base font-medium text-gray-700">Storage</span>
                          <span className="text-xs sm:text-base text-gray-600">
                            {storageData.total_storage_used_mb.toFixed(2)} MB / {storageData.plan_storage_size_gb} GB
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#6C60FF] h-2 rounded-full transition-all"
                            style={{ width: `${storageData.plan_storage_size_gb > 0 ? Math.min((storageData.total_storage_used_mb / (storageData.plan_storage_size_gb * 1024)) * 100, 100) : 0}%` }}
                          />
                        </div>
                        {storageData.storage_limit_exceeded && (
                          <p className="text-xs text-red-600 mt-1">Storage limit exceeded!</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Unable to load storage data</p>
                    )}
                  </div>

                  {/* AI Tokens */}
                  <div className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                      <span className="text-sm sm:text-base font-medium text-gray-700">AI Credits</span>
                      <span className="text-xs sm:text-base text-gray-600">
                        {storageData?.used_token || 0} / {storageData?.ai_connects || 0} Credits
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${storageData?.ai_connects ? ((storageData?.used_token || 0) / storageData.ai_connects) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Addon AI Credits (only show if addon credits total_purchased > 0) */}
                  {!isLoadingCreditBalance && creditBalance && creditBalance.addon_credits.total_purchased > 0 && (() => {
                    // Calculate total remaining credits from breakdown (sum of credits_remaining)
                    const totalRemaining = creditBalance.addon_credits.breakdown?.reduce(
                      (sum, addon) => sum + addon.credits_remaining,
                      0
                    ) || 0;

                    // Calculate used credits = total_purchased - total_remaining
                    const usedCredits = creditBalance.addon_credits.total_purchased - totalRemaining;

                    return (
                      <div className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                          <span className="text-sm sm:text-base font-medium text-gray-700 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-purple-600" />
                            Addon AI Credits
                          </span>
                          <span className="text-xs sm:text-base text-gray-600">
                            {usedCredits.toLocaleString()} / {creditBalance.addon_credits.total_purchased.toLocaleString()} credits
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${creditBalance.addon_credits.total_purchased > 0
                                ? (usedCredits / creditBalance.addon_credits.total_purchased) * 100
                                : 0}%`
                            }}
                          />
                        </div>
                        {/* Addon credits breakdown */}
                        {creditBalance.addon_credits.breakdown && creditBalance.addon_credits.breakdown.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {creditBalance.addon_credits.breakdown.map((addon, index) => {
                              // Use description if available, otherwise construct from credits_purchased or credits_remaining
                              let displayText = '';

                              if (addon.description) {
                                // Use description from backend (e.g., "AI Credits Purchase - 100 credit")
                                displayText = addon.description;
                              } else {
                                // Fallback: use credits_purchased if available, otherwise credits_remaining
                                const amount = addon.credits_purchased || addon.credits_remaining;
                                displayText = `${amount.toLocaleString()} credits`;
                              }

                              return (
                                <div
                                  key={`${addon.purchase_id}-${index}`}
                                  className="flex items-center justify-between text-xs py-1 px-2"
                                >
                                  <span className="text-purple-700">
                                    {displayText}{' '}
                                    <span className="text-gray-500">
                                      (Purchased {new Date(addon.purchased_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                                    </span>
                                  </span>
                                  <span className={`font-medium ${addon.days_until_expiration <= 7 ? 'text-red-600' : 'text-gray-600'}`}>
                                    {addon.days_until_expiration > 0
                                      ? `${addon.days_until_expiration} days left`
                                      : 'Expired'
                                    }
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Plan Includes - dynamic from plans data */}
                  {(() => {
                    const activePlanName = (currentSubscription?.plan_name || storageData?.plan_name || 'starter').toLowerCase();
                    const currentPlanData = allPlans.find(p => p.id === activePlanName) || allPlans[0];
                    const currentPlanIndex = allPlans.findIndex(p => p.id === activePlanName);
                    const nextPlanData = currentPlanIndex < allPlans.length - 1 ? allPlans[currentPlanIndex + 1] : null;
                    const storageLabel = storageData
                      ? (storageData.is_unlimited ? 'Unlimited storage' : `${currentPlanData.storage}`)
                      : currentPlanData.storage;
                    const includesFeatures = [storageLabel, ...currentPlanData.features];
                    const upgradeFeatures = nextPlanData
                      ? [nextPlanData.storage, ...nextPlanData.features.filter(f => !f.startsWith('Everything in'))]
                      : [];
                    return (
                      <>
                        <div className="border-t border-gray-200 pt-6">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Plan Includes:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {includesFeatures.map((feature, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Check className="w-4 h-4 text-green-600" />
                                </div>
                                <span className="text-base text-gray-700 whitespace-pre-line">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {nextPlanData && upgradeFeatures.length > 0 && (
                          <div className="border-t border-gray-200 mt-6 pt-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Upgrade to Unlock:</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {upgradeFeatures.map((feature, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Check className="w-4 h-4 text-purple-600" />
                                  </div>
                                  <span className="text-base text-gray-700 whitespace-pre-line">{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming Changes Section */}
            {!isLoadingSubscription && (scheduledChanges.length > 0 || currentSubscription?.cancel_at_period_end) && (
              <div id="upcoming-changes" className="scroll-mt-24">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Upcoming Changes</h2>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">Scheduled subscription updates</p>
                    </div>
                  </div>

                  {/* Cancellation Notice */}
                  {currentSubscription?.cancel_at_period_end && (
                    <div className="mb-4 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium text-yellow-900 text-sm sm:text-base">Subscription Ending</p>
                          <p className="text-xs sm:text-sm text-yellow-700 mt-1 break-words">
                            Your {capitalizePlan(currentSubscription.plan_name)} subscription will end on{' '}
                            {formatDateTime(currentSubscription.current_period_end)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scheduled Changes (Paid, Starting After Current Plan Ends) */}
                  {scheduledChanges.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-600" />
                        Scheduled Plan Changes (Paid)
                      </h3>
                      <div className="space-y-3">
                        {scheduledChanges.map((change) => {
                          const startDate = new Date(change.scheduled_start_date);
                          const chargedDate = change.charged_at ? new Date(change.charged_at) : null;

                          return (
                            <div key={change.id} className="p-3 sm:p-4 border border-gray-200 rounded-lg bg-blue-50">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                                      change.new_plan_name === 'professional'
                                        ? 'bg-purple-100 text-purple-700'
                                        : change.new_plan_name === 'intermediate'
                                        ? 'bg-pink-100 text-pink-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {capitalizePlan(change.new_plan_name)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-3">
                                  <div className="text-left sm:text-right">
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900">
                                      ${typeof change.amount === 'number' ? change.amount.toFixed(2) : parseFloat(change.amount).toFixed(2)}/{change.new_billing_period === 'yearly' ? 'year' : 'month'}
                                    </p>
                                    <p className="text-xs text-gray-500 capitalize">{change.new_billing_period}</p>
                                  </div>
                                  <button
                                    onClick={() => handleCancelScheduledChange(change.id)}
                                    disabled={cancelingScheduleId === change.id}
                                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Cancel scheduled change"
                                  >
                                    {cancelingScheduleId === change.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <X className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div className="pt-3 border-t border-gray-200 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                                  <span className="text-xs text-gray-600">Starts on:</span>
                                  <span className="font-medium text-gray-900 text-xs sm:text-sm">
                                    {formatDateTime(startDate.toISOString())}
                                  </span>
                                </div>
                                {chargedDate && (
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                                    <span className="text-xs text-gray-600">Paid on:</span>
                                    <span className="font-medium text-blue-700 text-xs sm:text-sm">
                                      {formatDateTime(chargedDate.toISOString())}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="mt-3 p-2 sm:p-3 bg-blue-100 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-800 break-words">
                                  ✓ Payment received. This plan will automatically activate when your current subscription ends.
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Payment Methods Section */}
            <div id="payment-methods" className="scroll-mt-24">
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Payment Methods</h2>
                      <p className="text-sm text-gray-600 mt-1">Manage your payment methods</p>
                    </div>
                    <button
                      onClick={() => setShowAddPaymentModal(true)}
                      className="bg-[#6C60FF] hover:bg-[#5A4FFF] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add New
                    </button>
                  </div>

                  {/* Payment Methods List */}
                  <div className="space-y-4">
                    {isLoadingPaymentMethods ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-[#6C60FF]" />
                          <p className="text-sm text-gray-600">Loading payment methods...</p>
                        </div>
                      </div>
                    ) : paymentMethods.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CreditCard className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">No payment methods yet</p>
                        <p className="text-sm text-gray-500 mt-1">Add a payment method to get started</p>
                      </div>
                    ) : (
                      paymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-gray-900 capitalize text-sm sm:text-base">
                                  {method.brand} **** {method.last4}
                                </p>
                                {method.is_default && (
                                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-gray-600">
                                Expires: {method.exp_month}/{method.exp_year}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePaymentMethod(method.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium self-end sm:self-auto"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Secure Payment Info */}
                  <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 flex gap-2 sm:gap-3">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h4 className="font-medium text-blue-900 mb-1 text-sm sm:text-base">Secure Payments</h4>
                      <p className="text-xs sm:text-sm text-blue-700">
                        All payment information is encrypted and securely stored. We never store your full card details.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing History Section */}
            <div id="billing-history" className="scroll-mt-24">
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Billing History</h2>
                      <p className="text-sm text-gray-600 mt-1">View and download your invoices</p>
                    </div>
                    <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
                      <Download className="w-4 h-4" />
                      Download All
                    </button>
                  </div>

                  {/* Invoices List */}
                  <div className="space-y-3">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-[#6C60FF]" />
                          <p className="text-sm text-gray-600">Loading billing history...</p>
                        </div>
                      </div>
                    ) : billingHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-600 font-medium">No billing history yet</p>
                        <p className="text-sm text-gray-500 mt-1">Your payment history will appear here</p>
                      </div>
                    ) : (
                      billingHistory.map((invoice) => {
                        const statusDisplay = getStatusDisplay(invoice.status);
                        // Use description for AI credit purchases (when plan_name is "N/A" or description contains "AI Credits")
                        const isAddonPurchase = invoice.plan_name === 'N/A' || invoice.description?.includes('AI Credits');
                        const displayText = isAddonPurchase
                          ? invoice.description
                          : formatPlanDisplay(invoice.plan_name, invoice.payment_date);

                        return (
                          <div
                            key={invoice.id}
                            className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isAddonPurchase ? 'bg-purple-100' : 'bg-gray-100'
                              }`}>
                                {isAddonPurchase ? (
                                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                                ) : (
                                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 text-sm sm:text-base break-words">
                                  {displayText}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusDisplay.color}`}>
                                    {statusDisplay.label}
                                  </span>
                                  <span className="text-xs sm:text-sm text-gray-600">
                                    {formatDate(invoice.payment_date)} - {getInvoiceNumber(invoice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4 sm:flex-shrink-0">
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(invoice.amount, invoice.currency)}
                              </span>
                              {invoice.invoice_pdf && (
                                <a
                                  href={invoice.invoice_pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#6C60FF] hover:text-[#5A4FFF] p-2 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Download Invoice PDF"
                                >
                                  <Download className="w-5 h-5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Credit History Section */}
            <div id="ai-credit-history" className="scroll-mt-24">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                      {/* <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                      </div> */}
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">AI Credit History</h2>
                      <p className="text-sm text-gray-600 mt-1">View your AI feature usage</p>
                    </div>
                  </div>
                </div>

                {isLoadingUsageHistory ? (
                 <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-[#6C60FF]" />
                      <p className="text-sm text-gray-600">Loading usage history...</p>
                    </div>
                  </div>
                ) : usageHistory ? (
                  <>
                    {/* AI Credits Exhausted Warning */}
                    {/* {isAICreditsExceeded && (
                      <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-amber-800 mb-1">
                            AI Credits Exhausted
                          </h3>
                          <p className="text-sm text-amber-700">
                            You have 0 AI credits remaining. Purchase additional credits to continue using AI features.
                          </p>
                        </div>
                      </div>
                    )} */}

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm text-purple-600 font-medium mb-1">Total Credits Used</p>
                        <p className="text-2xl font-bold text-purple-900">
                          {usageHistory.summary.total_credits_used.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-600 font-medium mb-1">AI Captions</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {usageHistory.summary.by_service.ai_captions.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                        <p className="text-sm text-pink-600 font-medium mb-1">Campaign Wizard</p>
                        <p className="text-2xl font-bold text-pink-900">
                          {usageHistory.summary.by_service.ai_memory_wizard.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Filter */}
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Type</label>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setFilterOperationType(undefined)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filterOperationType === undefined
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setFilterOperationType('ai_captions')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filterOperationType === 'ai_captions'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          AI Captions
                        </button>
                        <button
                          onClick={() => setFilterOperationType('ai_memory_wizard')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filterOperationType === 'ai_memory_wizard'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Campaign Wizard
                        </button>
                      </div>
                    </div>

                    {/* Usage History Table */}
                    {usageHistory.usage.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Zap className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">No usage history yet</p>
                        <p className="text-sm text-gray-500 mt-1">Start using AI features to see your history here</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Date & Time
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Feature
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Credits Used
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Campaign
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {usageHistory.usage.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="py-3 px-4 text-sm text-gray-900">
                                    {formatUsageDateTime(item.created_at)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      item.operation_type === 'ai_captions'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-pink-100 text-pink-700'
                                    }`}>
                                      {formatOperationType(item.operation_type)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                    {item.credits_consumed}
                                  </td>
                                  <td className="py-3 px-4 text-sm">
                                    {item.memory_id && item.memory_name ? (
                                      <button
                                        onClick={() => onNavigateToMemory?.(item.memory_id!.toString())}
                                        className="text-purple-600 hover:text-purple-800 hover:underline font-medium transition-colors"
                                      >
                                        {item.memory_name}
                                      </button>
                                    ) : item.memory_id ? (
                                      <span className="text-gray-600">{`Campaign #${item.memory_id}`}</span>
                                    ) : item.image_id ? (
                                      <span className="text-gray-600">{`Image #${item.image_id}`}</span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {usageHistory.pagination.total_pages > 1 && (
                          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                            <p className="text-sm text-gray-600">
                              Showing {((usageHistory.pagination.current_page - 1) * usageHistory.pagination.per_page) + 1} to{' '}
                              {Math.min(usageHistory.pagination.current_page * usageHistory.pagination.per_page, usageHistory.pagination.total_records)} of{' '}
                              {usageHistory.pagination.total_records} results
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                              </button>
                              <button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === usageHistory.pagination.total_pages}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                Next
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-gray-600 font-medium">Failed to load usage history</p>
                    <p className="text-sm text-gray-500 mt-1">Please try again later</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats Section */}
            <div id="quick-stats" className="scroll-mt-24">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">Quick Stats</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Your account overview</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                  {/* Member since */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">Member since</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-900">
                        {storageData && storageData.created_on ? formatMemberSince(storageData.created_on) : 'Jan 2024'}
                      </p>
                    </div>
                  </div>

                  {/* Total spent */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">Total spent</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-900">
                        ${storageData && storageData.total_payment !== undefined ? Number(storageData.total_payment).toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Memories created */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">Campaigns created</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-900">
                        {storageData && storageData.memories_count !== undefined ? storageData.memories_count : '0'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={storageData?.plan_name}
        onSuccess={handleSubscriptionUpdate}
      />

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        onSuccess={() => fetchPaymentMethods()}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            {/* Icon */}
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
              Remove Payment Method?
            </h3>

            {/* Message */}
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to remove this payment method? This action cannot be undone.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setPaymentMethodToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePaymentMethod}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Credits Modal */}
      <PurchaseCreditsModal
        isOpen={showPurchaseCreditsModal}
        onClose={() => setShowPurchaseCreditsModal(false)}
        packages={creditPackages}
        onPurchaseSuccess={handlePurchaseSuccess}
      />
    </>
  );
}
