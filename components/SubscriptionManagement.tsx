import React, { useEffect, useState } from 'react';
import { CreditCard, Calendar, AlertCircle, CheckCircle, Loader2, Crown, Zap, X, Clock } from 'lucide-react';
import { stripeApi, SubscriptionItem, ScheduledChange } from '../utils/stripeApi';

interface SubscriptionManagementProps {
  onUpgradeClick?: () => void;
}

export function SubscriptionManagement({ onUpgradeClick }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = useState<SubscriptionItem | null>(null);
  const [scheduledChanges, setScheduledChanges] = useState<ScheduledChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelingScheduleId, setCancelingScheduleId] = useState<number | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await stripeApi.getCurrentSubscription();
      if (response.success) {
        // Get the first active subscription
        if (response.active_subscriptions && response.active_subscriptions.length > 0) {
          setSubscription(response.active_subscriptions[0]);
        } else {
          setSubscription(null);
        }

        // Get scheduled changes
        if (response.scheduled_changes && response.scheduled_changes.length > 0) {
          setScheduledChanges(response.scheduled_changes);
        } else {
          setScheduledChanges([]);
        }
      } else {
        setError(response.error || 'Failed to load subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await stripeApi.cancelSubscription();
      if (response.success) {
        alert('Subscription cancelled successfully. You will have access until the end of your billing period.');
        loadSubscription();
      } else {
        alert(response.error || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setActionLoading(true);
    try {
      const response = await stripeApi.resumeSubscription();
      if (response.success) {
        alert('Subscription resumed successfully!');
        loadSubscription();
      } else {
        alert(response.error || 'Failed to resume subscription');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to resume subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelScheduledChange = async (scheduledChangeId: number) => {
    if (!confirm('Are you sure you want to cancel this scheduled plan change? You will not be refunded for the payment already made.')) {
      return;
    }

    setCancelingScheduleId(scheduledChangeId);
    try {
      const response = await stripeApi.cancelScheduledChange(scheduledChangeId);
      if (response.success) {
        alert('Scheduled change cancelled successfully!');
        loadSubscription();
      } else {
        alert(response.error || 'Failed to cancel scheduled change');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel scheduled change');
    } finally {
      setCancelingScheduleId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-[#6C60FF]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No subscription - Free tier
  if (!subscription) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
            Free
          </span>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            You're currently on the free plan. Upgrade to unlock premium features!
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Free Plan Includes:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>5 GB storage</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Basic analytics</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Up to 3 collaborators</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onUpgradeClick}
            className="w-full bg-[#6C60FF] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#5A4FFF] transition-colors flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  // Active subscription
  const isActive = subscription.status === 'active';
  const isCanceled = subscription.cancel_at_period_end;
  const periodEnd = new Date(subscription.current_period_end);
  const isProfessional = subscription.plan_name.includes('professional');

  return (
    <div className="space-y-4">
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
        <div className="flex items-center gap-2">
          {isProfessional ? (
            <Crown className="w-5 h-5 text-purple-500" />
          ) : (
            <Zap className="w-5 h-5 text-[#6C60FF]" />
          )}
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              isActive && !isCanceled
                ? 'bg-green-100 text-green-700'
                : isCanceled
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {isActive && !isCanceled ? 'Active' : isCanceled ? 'Canceling' : subscription.status}
          </span>
        </div>
      </div>

      {/* Plan Details */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Plan</p>
            <p className="text-sm font-semibold text-gray-900">
              {isProfessional ? 'Professional' : 'Intermediate'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <p className="text-sm font-semibold text-gray-900 capitalize">{subscription.status}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 mb-1">
              {isCanceled ? 'Access Until' : 'Next Billing Date'}
            </p>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              {periodEnd.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Cancellation Warning */}
      {isCanceled && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Subscription Canceling</p>
              <p className="text-xs text-yellow-700 mt-1">
                Your subscription will end on {periodEnd.toLocaleDateString()}. You can resume your subscription at any time before then.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isCanceled ? (
          <button
            onClick={handleResumeSubscription}
            disabled={actionLoading}
            className="flex-1 bg-[#6C60FF] text-white py-2.5 px-4 rounded-lg font-medium hover:bg-[#5A4FFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Resume Subscription
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={onUpgradeClick}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Change Plan
            </button>
            <button
              onClick={handleCancelSubscription}
              disabled={actionLoading}
              className="flex-1 bg-white border border-red-200 text-red-600 py-2.5 px-4 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Processing...' : 'Cancel Plan'}
            </button>
          </>
        )}
      </div>

      {/* Payment Method */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Payment Method</p>
              <p className="text-xs text-gray-500">Manage your payment methods</p>
            </div>
          </div>
          <button className="text-sm text-[#6C60FF] hover:text-[#5A4FFF] font-medium">
            Update
          </button>
        </div>
      </div>
    </div>

    {/* Scheduled Changes Section */}
    {scheduledChanges.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Scheduled Changes</h3>
            <p className="text-xs text-gray-500">Plan changes that will start after your current subscription ends</p>
          </div>
        </div>

        <div className="space-y-3">
          {scheduledChanges.map((change) => {
            const startDate = new Date(change.scheduled_start_date);
            const chargedDate = change.charged_at ? new Date(change.charged_at) : null;
            const isProfChange = change.new_plan_name.includes('professional');

            return (
              <div key={change.id} className="p-4 border border-gray-200 rounded-lg bg-blue-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {isProfChange ? (
                      <Crown className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Zap className="w-5 h-5 text-[#6C60FF]" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 capitalize">
                        {change.new_plan_name} Plan
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {change.new_billing_period} - ${typeof change.amount === 'number' ? change.amount.toFixed(2) : parseFloat(change.amount).toFixed(2)}/{change.new_billing_period === 'yearly' ? 'year' : 'month'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelScheduledChange(change.id)}
                    disabled={cancelingScheduleId === change.id}
                    className="text-red-600 hover:text-red-700 p-2 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Cancel scheduled change"
                  >
                    {cancelingScheduleId === change.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="bg-white rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Starts on</p>
                      <p className="font-medium text-gray-900">
                        {startDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {chargedDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-xs text-gray-500">Paid on</p>
                        <p className="font-medium text-gray-900">
                          {chargedDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 p-3 bg-blue-100 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">
                      This plan change has been paid for and will automatically activate when your current subscription ends.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
    </div>
  );
}

export default SubscriptionManagement;
