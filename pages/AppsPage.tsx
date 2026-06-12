import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import CreateAPIKeyModal from '../components/CreateAPIKeyModal';
import { apiRequest } from '../utils/authUtils';

interface APIKey {
  id: string;
  name: string;
  key: string;
  client_id: string;
  client_secret: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastUsed: string;
}

const AppsPage: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; keyId: string; keyName: string }>({
    show: false,
    keyId: '',
    keyName: ''
  });

  const activeKeysCount = apiKeys.filter(key => key.status === 'active').length;
  const lastCreatedKey = apiKeys.length > 0 ? apiKeys[0].createdAt : 'N/A';

  // Fetch API keys on component mount
  useEffect(() => {
    console.log('🔑 AppsPage mounted - fetching API keys...');
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    try {
      console.log('🔑 Fetching API keys from /user/api-keys...');
      setIsLoading(true);
      const data = await apiRequest('/user/api-keys', {
        method: 'GET'
      });

      console.log('🔑 API keys response:', data);

      // Handle nested data structure from API wrapper
      const appsData = data.data?.data?.apps || data.data?.apps || [];

      if (data.success && appsData.length >= 0) {
        console.log('🔑 Mapping API keys data:', appsData);
        // Map the API response to the APIKey interface
        const mappedKeys: APIKey[] = appsData.map((item: any) => ({
          id: item.id?.toString() || '',
          name: item.name || '',
          key: item.client_secret || item.client_id || '', // Keep for backwards compatibility
          client_id: item.client_id || '',
          client_secret: item.client_secret || '',
          status: item.status === 1 ? 'active' : 'inactive',
          createdAt: item.created_at
            ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'N/A',
          lastUsed: item.last_used || 'Never'
        }));

        console.log('🔑 Mapped keys:', mappedKeys);
        setApiKeys(mappedKeys);
      } else {
        console.log('🔑 API response not successful or no data:', data);
      }
    } catch (error) {
      console.error('🔑 Error fetching API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setRevealedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskKey = (key: string): string => {
    if (!key) return '••••••••••••••••••••••••••••••••';
    const prefix = key.substring(0, 8);
    const suffix = key.substring(key.length - 4);
    return `${prefix}••••••••••••••••••••••${suffix}`;
  };

  const deleteKey = (keyId: string, keyName: string) => {
    setDeleteConfirmation({
      show: true,
      keyId,
      keyName
    });
  };

  const confirmDeleteKey = async () => {
    const { keyId } = deleteConfirmation;

    try {
      console.log('🗑️ Deleting API key:', keyId);
      const data = await apiRequest(`/user/api-key/${keyId}`, {
        method: 'DELETE'
      });

      console.log('🗑️ Delete API key response:', data);

      if (data.success || data.status === 1) {
        // Remove from local state
        setApiKeys(prev => prev.filter(key => key.id !== keyId));
        console.log('✅ API key deleted successfully');

        // Show success toast
        toast.success('API key deleted successfully');
      } else {
        console.error('❌ Failed to delete API key:', data.error || data.message);
        toast.error('Failed to delete API key: ' + (data.error || data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error deleting API key:', error);
      toast.error('Error deleting API key. Please try again.');
    } finally {
      setDeleteConfirmation({ show: false, keyId: '', keyName: '' });
    }
  };

  const handleCreateKey = async (name: string, description: string) => {
    try {
      const data = await apiRequest('/user/my-app-create-key', {
        method: 'POST',
        body: JSON.stringify({
          name: name,
          description: description,
          status: true
        })
      });

      if (data.success) {
        // Refresh the API keys list
        await fetchAPIKeys();
      } else {
        alert(data.error || 'Failed to create API key. Please try again.');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('Failed to create API key. Please try again.');
    }
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="w-full">
        {/* Header Section */}
        <div className="mb-4 px-0 md:px-4 pt-4">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">API Keys</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage your API keys for accessing Stasht services</p>
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => window.open('https://stasht.com/stasht-doc/', '_blank', 'noopener,noreferrer')}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <FileText className="w-4 h-4" />
              <span className="sm:hidden">View Docs</span>
              <span className="hidden sm:inline">View Documentation</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#6C60FF] text-white rounded-lg font-medium hover:bg-[#5a4fd8] transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4" />
              Create API Key
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
          {/* Total Keys Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-[#6C60FF]" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{apiKeys.length}</h3>
            <p className="text-sm text-gray-600 mb-1">Total Keys</p>
            <p className="text-xs text-gray-500">{activeKeysCount} active</p>
          </div>

          {/* Active Keys Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{activeKeysCount}</h3>
            <p className="text-sm text-gray-600 mb-1">Active Keys</p>
            <p className="text-xs text-gray-500">Currently in use</p>
          </div>

          {/* Last Created Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{lastCreatedKey}</h3>
            <p className="text-sm text-gray-600 mb-1">Last Created</p>
            <p className="text-xs text-gray-500">Most recent key</p>
          </div>
        </div>
      </div>

      {/* API Keys List Section */}
      <div className="bg-white border border-gray-200 rounded-lg mx-0 sm:mx-4">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">Your API Keys</h2>
          <p className="text-xs sm:text-sm text-gray-600">
            Keep your API keys secure and never share them publicly. If you suspect a key has been compromised, delete it immediately and create a new one.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-pulse">
                <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-32 mx-auto mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-48 mx-auto"></div>
              </div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="p-8 text-center">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first API key</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#6C60FF] text-white rounded-lg font-medium hover:bg-[#5a4fd8] transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create API Key
              </button>
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{apiKey.name}</h3>
                      <span
                        className={`px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                          apiKey.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {apiKey.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Client ID */}
                    <div className="mb-2 sm:mb-3">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Client ID</label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs sm:text-sm font-mono bg-gray-100 px-2 sm:px-3 py-1.5 rounded text-gray-700 flex-1 min-w-0 overflow-hidden text-ellipsis">
                          {revealedKeys.has(apiKey.id) ? apiKey.client_id : maskKey(apiKey.client_id)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(apiKey.client_id, `${apiKey.id}-client-id`)}
                          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                          title="Copy Client ID"
                        >
                          {copiedKey === `${apiKey.id}-client-id` ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Client Secret */}
                    <div className="mb-2 sm:mb-3">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Client Secret</label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs sm:text-sm font-mono bg-gray-100 px-2 sm:px-3 py-1.5 rounded text-gray-700 flex-1 min-w-0 overflow-hidden text-ellipsis">
                          {revealedKeys.has(apiKey.id) ? apiKey.client_secret : maskKey(apiKey.client_secret)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(apiKey.client_secret, `${apiKey.id}-client-secret`)}
                          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                          title="Copy Client Secret"
                        >
                          {copiedKey === `${apiKey.id}-client-secret` ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Created {apiKey.createdAt}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Last used {apiKey.lastUsed}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteKey(apiKey.id, apiKey.name)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Delete key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete API Key</h3>
                  <p className="text-sm text-gray-600 mt-0.5">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-1">
                Are you sure you want to delete the API key:
              </p>
              <p className="text-sm font-semibold text-gray-900 mb-4">
                "{deleteConfirmation.keyName}"
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmation({ show: false, keyId: '', keyName: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteKey}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      <CreateAPIKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateKey={handleCreateKey}
      />
    </div>
  </>
  );
};

export default AppsPage;
