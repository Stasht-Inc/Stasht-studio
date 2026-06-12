import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, MapPin, Tag, Building, Upload, ChevronLeft, ChevronRight, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import GooglePlacesInput from './ui/google-places-input';
import { toast } from 'sonner';
import { dashboardAPI } from '../utils/authUtils';

interface CreatePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProperty: (propertyData: PropertyFormData) => Promise<void>;
  onCheckout?: (cart: PropertyFormData[]) => Promise<void>;
  propertyToEdit?: any;
  isInternalUser?: boolean;
}

export interface PropertyFormData {
  propertyName: string;
  id: string;
  username: string;
  location: string;
  labels: string[];
  image?: File | null;
}

const EMPTY_FORM: PropertyFormData = {
  propertyName: '',
  id: '',
  username: '',
  location: '',
  labels: [],
  image: null,
};

export default function CreatePropertyModal({
  isOpen,
  onClose,
  onCreateProperty,
  onCheckout,
  propertyToEdit,
  isInternalUser,
}: CreatePropertyModalProps) {
  // Use cart flow for non-internal users when creating (not editing)
  const useCartFlow = !isInternalUser && !propertyToEdit && !!onCheckout;

  // Form fields
  const [propertyName, setPropertyName] = useState('');
  const [id, setId] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cart state (only used in cart flow)
  const [cart, setCart] = useState<PropertyFormData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // null = new property

  // Property name search suggestions
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validation errors
  const [errors, setErrors] = useState({ propertyName: '', id: '', username: '', location: '' });

  const suggestedLabels = ['Bike', 'Trail'];

  // Load form data from cart when editingIndex changes
  useEffect(() => {
    if (!useCartFlow) return;
    if (editingIndex !== null && cart[editingIndex]) {
      const item = cart[editingIndex];
      setPropertyName(item.propertyName);
      setId(item.id);
      setUsername(item.username);
      setLocation(item.location);
      setLabels(item.labels);
      setImage(item.image || null);
      setImagePreview(item.image instanceof File ? URL.createObjectURL(item.image) : null);
    } else {
      loadEmptyForm();
    }
    setErrors({ propertyName: '', id: '', username: '', location: '' });
  }, [editingIndex, useCartFlow]);

  // Reset cart when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCart([]);
      setEditingIndex(null);
      loadEmptyForm();
    }
  }, [isOpen]);

  const loadEmptyForm = () => {
    setPropertyName('');
    setId('');
    setUsername('');
    setLocation('');
    setLabels([]);
    setLabelInput('');
    setImage(null);
    setImagePreview(null);
    setSearchSuggestions([]);
    setShowSuggestions(false);
  };

  // Populate form when editing existing property (non-cart mode)
  useEffect(() => {
    if (propertyToEdit) {
      setPropertyName(propertyToEdit.name || '');
      setId(propertyToEdit.code || '');
      setUsername(propertyToEdit.username || '');
      setLocation(propertyToEdit.location || '');
      setLabels((propertyToEdit.labels || []).map((l: any) => typeof l === 'object' ? l.name : l));
      if (propertyToEdit.image) setImagePreview(propertyToEdit.image);
    } else if (!useCartFlow) {
      loadEmptyForm();
    }
  }, [propertyToEdit]);

  // Search suggestions
  const searchProperties = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearching(true);
    try {
      const response = await dashboardAPI.searchProperties(query.trim());
      if (response.success && response.data) {
        let properties: any[] = [];
        if (response.data.data?.all_properties) properties = response.data.data.all_properties;
        else if (response.data.all_properties) properties = response.data.all_properties;
        else if (Array.isArray(response.data.data)) properties = response.data.data;
        else if (Array.isArray(response.data)) properties = response.data;
        setSearchSuggestions(properties);
        setShowSuggestions(properties.length > 0);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handlePropertyNameChange = (value: string) => {
    setPropertyName(value);
    if (errors.propertyName) setErrors({ ...errors, propertyName: '' });
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchProperties(value), 300);
  };

  const handleSuggestionSelect = (property: any) => {
    setPropertyName(property.name || '');
    setShowSuggestions(false);
    setSearchSuggestions([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.property-name-container')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  const handleAddLabel = (label: string) => {
    if (label && !labels.includes(label)) setLabels([...labels, label]);
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setLabels(labels.filter(l => l !== labelToRemove));
  };

  const handleLabelKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault();
      handleAddLabel(labelInput.trim());
      setLabelInput('');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const newErrors = { propertyName: '', id: '', username: '', location: '' };
    let hasErrors = false;
    if (!propertyName.trim()) { newErrors.propertyName = 'Property name is required'; hasErrors = true; }
    if (!username.trim()) { newErrors.username = 'Username is required'; hasErrors = true; }
    setErrors(newErrors);
    return !hasErrors;
  };

  const getCurrentFormData = (): PropertyFormData => ({
    propertyName, id, username, location, labels, image,
  });

  // Cart flow: save to cart
  const handleSaveToCart = () => {
    if (!validate()) { toast.error('Please fill in all required fields'); return; }
    const data = getCurrentFormData();
    if (editingIndex !== null) {
      const newCart = [...cart];
      newCart[editingIndex] = data;
      setCart(newCart);
      toast.success(`Property "${data.propertyName}" updated`);
    } else {
      setCart(prev => [...prev, data]);
      toast.success(`Property "${data.propertyName}" added to cart`);
    }
    setEditingIndex(null);
    loadEmptyForm();
  };

  // Cart flow: remove from cart
  const handleRemoveFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    if (editingIndex === index) {
      setEditingIndex(null);
      loadEmptyForm();
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  // Cart flow: navigate to a cart item
  const handleNavigate = (index: number | null) => {
    setEditingIndex(index);
  };

  // Cart flow: checkout
  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Add at least one property to checkout'); return; }
    setIsCheckingOut(true);
    try {
      await onCheckout!(cart);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Direct create flow (internal users or edit mode)
  const handleSubmit = async () => {
    if (!validate()) { toast.error('Please fill in all required fields'); return; }
    setIsSubmitting(true);
    try {
      await onCreateProperty(getCurrentFormData());
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      loadEmptyForm();
      setErrors({ propertyName: '', id: '', username: '', location: '' });
    } catch (error: any) {
      if (error?.fieldErrors) {
        const fieldMap: Record<string, keyof typeof errors> = {
          username: 'username', name: 'propertyName', unique_id: 'id', location: 'location',
        };
        const newErrors = { propertyName: '', id: '', username: '', location: '' };
        Object.entries(error.fieldErrors).forEach(([field, messages]) => {
          const mapped = fieldMap[field];
          if (mapped) newErrors[mapped] = (messages as string[])[0] || '';
        });
        setErrors(newErrors);
      } else {
        toast.error(error?.message || 'Failed to create property. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setCart([]);
    setEditingIndex(null);
    loadEmptyForm();
    onClose();
  };

  if (!isOpen) return null;

  const totalAmount = cart.length * 2;
  const isEditingCartItem = editingIndex !== null;
  const currentLabel = isEditingCartItem
    ? `Editing Property ${editingIndex! + 1} of ${cart.length}`
    : cart.length > 0 ? 'New Property' : 'New Property';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Building className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {propertyToEdit ? 'Edit Property' : useCartFlow ? currentLabel : 'Create Property'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {propertyToEdit
                  ? 'Update property details'
                  : useCartFlow
                  ? 'Add properties to your cart, then checkout'
                  : 'Add a new property to your workspace'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {useCartFlow && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">
                $2.00
              </span>
            )}
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Cart Navigation (only in cart flow when cart has items) */}
        {useCartFlow && cart.length > 0 && (
          <div className="px-6 pt-4 pb-2 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 mr-1">Cart:</span>
              {cart.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleNavigate(index)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    editingIndex === index
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                  }`}
                >
                  <span className="truncate max-w-[80px]">{item.propertyName || `Property ${index + 1}`}</span>
                  <span className={`text-[10px] font-semibold ${editingIndex === index ? 'text-purple-200' : 'text-green-600'}`}>$2</span>
                </button>
              ))}
              <button
                onClick={() => handleNavigate(null)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  editingIndex === null
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-500 border-dashed border-gray-300 hover:border-purple-400 hover:text-purple-600'
                }`}
              >
                <Plus className="h-3 w-3" />
                New
              </button>

              {/* Prev / Next arrows */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => {
                    if (editingIndex === null) handleNavigate(cart.length - 1);
                    else if (editingIndex > 0) handleNavigate(editingIndex - 1);
                  }}
                  disabled={editingIndex === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  title="Previous property"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => {
                    if (editingIndex === null) return;
                    if (editingIndex < cart.length - 1) handleNavigate(editingIndex + 1);
                    else handleNavigate(null);
                  }}
                  disabled={editingIndex === null}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  title="Next property"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Total bar */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">{cart.length} propert{cart.length === 1 ? 'y' : 'ies'} in cart</span>
              <span className="text-sm font-bold text-gray-800">Total: ${totalAmount}.00</span>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Property Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Property Image</label>
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors aspect-square max-w-[200px] w-full"
              >
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                  <Upload className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-xs font-medium text-gray-700 mb-1 text-center">Click to upload property image</p>
                <p className="text-[10px] text-gray-500 text-center">PNG, JPG up to 10MB</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </div>
            ) : (
              <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden aspect-square max-w-[200px] w-full">
                <img src={imagePreview} alt="Property preview" className="w-full h-full object-cover" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Property Name and ID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 property-name-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  value={propertyName}
                  onChange={(e) => handlePropertyNameChange(e.target.value)}
                  placeholder="e.g., Burnley Bloomfield Park Alliance Church"
                  className={`w-full bg-gray-50 ${errors.propertyName ? 'border-red-500' : 'border-gray-200'}`}
                  autoComplete="off"
                />
                {isSearching && propertyName.length >= 2 && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                  </div>
                )}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-purple-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {searchSuggestions.map((property, index) => (
                      <button
                        key={property.id || index}
                        type="button"
                        onClick={() => handleSuggestionSelect(property)}
                        className="w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                            {property.image ? (
                              <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-purple-100">
                                <Building className="w-5 h-5 text-purple-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{property.name}</p>
                            {property.location && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{property.location}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {property.unique_id && <span className="text-xs text-gray-400">ID: {property.unique_id}</span>}
                              {property.label?.name && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">{property.label.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.propertyName && <p className="text-xs text-red-500 mt-1">{errors.propertyName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ID#</label>
              <Input
                value={id}
                onChange={(e) => { setId(e.target.value); if (errors.id) setErrors({ ...errors, id: '' }); }}
                placeholder="273275"
                className={`w-full bg-gray-50 ${errors.id ? 'border-red-500' : 'border-gray-200'}`}
              />
              {errors.id && <p className="text-xs text-red-500 mt-1">{errors.id}</p>}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username <span className="text-red-500">*</span>
            </label>
            <Input
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (errors.username) setErrors({ ...errors, username: '' }); }}
              placeholder="e.g., Brentwood"
              className={`w-full bg-gray-50 ${errors.username ? 'border-red-500' : 'border-gray-200'}`}
            />
            {errors.username
              ? <p className="text-xs text-red-500 mt-1">{errors.username}</p>
              : <p className="text-xs text-gray-500 mt-1.5">A unique identifier for this property</p>
            }
          </div>

          {/* Location */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 text-gray-600" />
              Location
            </label>
            <GooglePlacesInput
              value={location}
              onChange={setLocation}
              placeholder="e.g., 7411 10th Ave, VHI 2G2"
              className="w-full bg-gray-50 border-gray-200"
              useFallback={true}
            />
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Labels</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={handleLabelKeyPress}
                placeholder="Type a label and press Enter"
                className="w-full bg-gray-50 border-gray-200 pl-10"
              />
            </div>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {labels.map((label, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-md">
                    {label}
                    <button onClick={() => handleRemoveLabel(label)} className="hover:text-yellow-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">Suggested labels:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedLabels.map((label, index) => (
                  <button
                    key={index}
                    onClick={() => handleAddLabel(label)}
                    disabled={labels.includes(label)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          {/* Left side */}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel} className="px-4 py-2">
              Cancel
            </Button>
            {useCartFlow && isEditingCartItem && (
              <button
                onClick={() => handleRemoveFromCart(editingIndex!)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {useCartFlow ? (
              <>
                <Button
                  onClick={handleSaveToCart}
                  className="px-4 py-2 bg-[#6C60FF] hover:bg-[#5A4FE5] text-white"
                >
                  {isEditingCartItem ? 'Save Changes' : 'Add to Cart'}
                </Button>
                {cart.length > 0 && (
                  <Button
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                    className="px-4 py-2 text-white disabled:opacity-50"
                  style={{ backgroundColor: '#E60076' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#cc006a')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E60076')}
                  >
                    {isCheckingOut ? 'Processing...' : (
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Checkout — ${totalAmount}.00
                      </span>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#6C60FF] hover:bg-[#5A4FE5] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? (propertyToEdit ? 'Updating...' : 'Creating...')
                  : (propertyToEdit ? 'Update Property' : 'Create Property')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
