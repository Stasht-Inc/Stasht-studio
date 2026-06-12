import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface CreateAPIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateKey: (name: string, description: string) => void;
}

const CreateAPIKeyModal: React.FC<CreateAPIKeyModalProps> = ({ isOpen, onClose, onCreateKey }) => {
  const [keyName, setKeyName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyName.trim()) {
      onCreateKey(keyName.trim(), description.trim());
      setKeyName('');
      setDescription('');
      onClose();
    }
  };

  const handleClose = () => {
    setKeyName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New API Key</h2>
            <p className="text-sm text-gray-600 mt-1">
              Give your API key a descriptive name to help you identify it later.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Key Name Field */}
            <div>
              <label htmlFor="keyName" className="block text-sm font-medium text-gray-700 mb-2">
                Key Name
              </label>
              <input
                type="text"
                id="keyName"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Production API, Mobile App"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent"
                required
              />
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for this API key..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent resize-none"
              />
            </div>

            {/* Warning Message */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">
                Make sure to copy your API key after creating it. For security reasons, you won't be able to see it again.
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#6C60FF] text-white rounded-lg font-medium hover:bg-[#5a4fd8] transition-colors"
            >
              Create Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAPIKeyModal;
