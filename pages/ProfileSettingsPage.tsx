import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from 'sonner';
import { dashboardAPI, authAPI } from "../utils/authUtils";
import GooglePlacesInput from "../components/ui/google-places-input";
import CountrySelect from "../components/CountrySelect";
import { parsePhonePrefill } from "../utils/phoneUtils";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";
import { savePasswordSecurity, getPasswordSecurity } from "../utils/passwordSecurityStorage";
import UpgradePlanModal from "../components/UpgradePlanModal";
import { Switch } from "../components/ui/switch";
import { getCategoryColor } from "../constants/mediaConstants";

// Types
interface SettingsSection {
  id: string;
  name: string;
  icon: React.ReactNode;
  isActive?: boolean;
  isDangerous?: boolean;
}

// Components
function SettingsSidebar({ sections, activeSection, onSectionChange }: {
  sections: SettingsSection[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}) {
  return (
    <div className="w-72 bg-white shadow-sm border-r border-gray-100 sticky top-20 h-[calc(100dvh-5rem)] overflow-y-auto flex-shrink-0">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Profile Settings</h2>
          <p className="text-sm text-gray-600">Quick navigation</p>
        </div>
        
        <nav className="space-y-2">
          {sections
            .filter(section => !['privacy', 'preferences'].includes(section.id))
            .map((section) => (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                activeSection === section.id
                  ? 'bg-[#6C60FF]/10 text-[#6C60FF] border border-[#6C60FF]/20'
                  : section.isDangerous
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className={`w-5 h-5 ${
                activeSection === section.id ? 'text-[#6C60FF]' : section.isDangerous ? 'text-red-600' : 'text-gray-500'
              }`}>
                {section.icon}
              </div>
              <span className="font-medium">{section.name}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function PersonalInformation({ user, profileData, isLoadingProfile, sectionRef, isEditing, onEditToggle }: {
  user?: any;
  profileData?: any;
  isLoadingProfile?: boolean;
  sectionRef: React.RefObject<HTMLDivElement>;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
}) {
  const { updateUser } = useAuth();

  // Helper function to ensure we always get a string value (never undefined or null)
  const ensureString = (value: any): string => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const [formData, setFormData] = useState({
    username: ensureString(profileData?.name ?? user?.name),
    email: ensureString(profileData?.email ?? user?.email),
    phone: ensureString(profileData?.phone),
    location: ensureString(profileData?.location),
    bio: ensureString(profileData?.bio),
    linkedinUrl: ensureString(profileData?.linkedin_url),
    facebookUrl: ensureString(profileData?.facebook_url),
    tiktokUrl: ensureString(profileData?.tiktok_url),
    instagramUrl: ensureString(profileData?.instagram_url),
        website: ensureString(profileData?.website)
  });

  // Phone number is stored fully-qualified (e.g. "+14163028755"); split it into
  // a country-code selector + national number for editing, mirroring the invite
  // and signup flows.
  const [phoneCountry, setPhoneCountry] = useState('+1');
  const [phoneNational, setPhoneNational] = useState('');

  useEffect(() => {
    const { countryCode, number } = parsePhonePrefill(ensureString(profileData?.phone));
    setPhoneCountry(countryCode || '+1');
    setPhoneNational(number);
  }, [profileData?.phone]);

  // Keep formData.phone (the value that gets saved) as the fully-qualified number
  // whenever either the country code or the national part changes.
  const applyPhone = (country: string, national: string) => {
    setPhoneCountry(country);
    setPhoneNational(national);
    const digits = national.replace(/[^0-9]/g, '');
    setFormData(prev => ({ ...prev, phone: digits ? `${country}${digits}` : '' }));
  };
  const [urlErrors, setUrlErrors] = useState({
    linkedinUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    instagramUrl: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEBusinessCard, setShowEBusinessCard] = useState<boolean>(!!profileData?.is_business);

  // Update form data when profileData or user changes
  useEffect(() => {
    if (profileData || user) {
      setFormData({
        username: ensureString(profileData?.name ?? user?.name),
        email: ensureString(profileData?.email ?? user?.email),
        phone: ensureString(profileData?.phone),
        location: ensureString(profileData?.location),
        bio: ensureString(profileData?.bio),
        linkedinUrl: ensureString(profileData?.linkedin_url),
        facebookUrl: ensureString(profileData?.facebook_url),
        tiktokUrl: ensureString(profileData?.tiktok_url),
        instagramUrl: ensureString(profileData?.instagram_url),
        website: ensureString(profileData?.website)
      });
      setShowEBusinessCard(!!profileData?.is_business);

      // Clear any selected image when user data updates from context
      // This ensures we show the updated profile image from the server
      if (!isEditing) {
        setSelectedImage(null);
        setPreviewUrl(null);
      }
    }
  }, [profileData, user, isEditing]);

  // Update form data when entering edit mode to ensure latest data is used
  useEffect(() => {
    if (isEditing && (profileData || user)) {
      setFormData({
        username: ensureString(profileData?.name ?? user?.name),
        email: ensureString(profileData?.email ?? user?.email),
        phone: ensureString(profileData?.phone),
        location: ensureString(profileData?.location),
        bio: ensureString(profileData?.bio),
        linkedinUrl: ensureString(profileData?.linkedin_url),
        facebookUrl: ensureString(profileData?.facebook_url),
        tiktokUrl: ensureString(profileData?.tiktok_url),
        instagramUrl: ensureString(profileData?.instagram_url),
        website: ensureString(profileData?.website)
      });
    }
  }, [isEditing, profileData, user]);
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const profileImage = (user?.avatar || user?.profile_image) && 
                      (user?.avatar || user?.profile_image) !== 'null' ? 
                      (user?.avatar || user?.profile_image) : null;
  
  const initials = getInitials(user?.name, user?.email);
  const formatColor = (color?: string) => {
    if (!color) return null;
    return color.startsWith('#') ? color : `#${color}`;
  };
  
  const profileColor = formatColor(user?.profile_color);
  const backgroundStyle = profileColor ? { backgroundColor: profileColor } : undefined;
  const fallbackClassName = profileColor 
    ? "text-white text-2xl font-medium flex items-center justify-center w-full h-full"
    : "bg-gradient-to-br from-[#6C60FF] to-purple-600 text-white text-2xl font-medium flex items-center justify-center w-full h-full";

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // URL validation functions
  const validateLinkedInUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    try {
      const urlObj = new URL(url);
      return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
             (urlObj.hostname === 'linkedin.com' || urlObj.hostname === 'www.linkedin.com');
    } catch {
      return false;
    }
  };

  const validateFacebookUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    try {
      const urlObj = new URL(url);
      return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
             (urlObj.hostname === 'facebook.com' || urlObj.hostname === 'www.facebook.com');
    } catch {
      return false;
    }
  };

  const validateTikTokUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    try {
      const urlObj = new URL(url);
      return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
             (urlObj.hostname === 'tiktok.com' ||
              urlObj.hostname === 'www.tiktok.com' ||
              urlObj.hostname === 'm.tiktok.com' ||
              urlObj.hostname === 'vm.tiktok.com' ||
              urlObj.hostname.endsWith('.tiktok.com'));
    } catch {
      return false;
    }
  };

  const validateInstagramUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    try {
      const urlObj = new URL(url);
      return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
             (urlObj.hostname === 'instagram.com' ||
              urlObj.hostname === 'www.instagram.com' ||
              urlObj.hostname === 'm.instagram.com' ||
              urlObj.hostname.endsWith('.instagram.com'));
    } catch {
      return false;
    }
  };

  const handleUrlChange = (field: 'linkedinUrl' | 'facebookUrl' | 'tiktokUrl' | 'instagramUrl', value: string) => {
    setFormData(prev => ({...prev, [field]: value}));

    // Validate on change
    if (field === 'linkedinUrl') {
      if (value && !validateLinkedInUrl(value)) {
        setUrlErrors(prev => ({...prev, linkedinUrl: 'Please enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/username)'}));
      } else {
        setUrlErrors(prev => ({...prev, linkedinUrl: ''}));
      }
    } else if (field === 'facebookUrl') {
      if (value && !validateFacebookUrl(value)) {
        setUrlErrors(prev => ({...prev, facebookUrl: 'Please enter a valid Facebook URL (e.g., https://www.facebook.com/username)'}));
      } else {
        setUrlErrors(prev => ({...prev, facebookUrl: ''}));
      }
    } else if (field === 'tiktokUrl') {
      if (value && !validateTikTokUrl(value)) {
        setUrlErrors(prev => ({...prev, tiktokUrl: 'Please enter a valid TikTok URL (must start with https://)'}));
      } else {
        setUrlErrors(prev => ({...prev, tiktokUrl: ''}));
      }
    } else if (field === 'instagramUrl') {
      if (value && !validateInstagramUrl(value)) {
        setUrlErrors(prev => ({...prev, instagramUrl: 'Please enter a valid Instagram URL (must start with https://)'}));
      } else {
        setUrlErrors(prev => ({...prev, instagramUrl: ''}));
      }
    }
  };

  const handleSave = async () => {
    try {
      // Validate URLs before saving
      if (formData.linkedinUrl && !validateLinkedInUrl(formData.linkedinUrl)) {
        setUrlErrors(prev => ({...prev, linkedinUrl: 'Please enter a valid LinkedIn URL'}));
        setIsSubmitting(false);
        return;
      }
      if (formData.facebookUrl && !validateFacebookUrl(formData.facebookUrl)) {
        setUrlErrors(prev => ({...prev, facebookUrl: 'Please enter a valid Facebook URL'}));
        setIsSubmitting(false);
        return;
      }
      if (formData.tiktokUrl && !validateTikTokUrl(formData.tiktokUrl)) {
        setUrlErrors(prev => ({...prev, tiktokUrl: 'Please enter a valid TikTok URL'}));
        setIsSubmitting(false);
        return;
      }
      if (formData.instagramUrl && !validateInstagramUrl(formData.instagramUrl)) {
        setUrlErrors(prev => ({...prev, instagramUrl: 'Please enter a valid Instagram URL'}));
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(true);

      const formDataToSend = new FormData();

      // Debug: log what we're about to send
      console.log('Form data before sending:', {
        username: formData.username,
        email: formData.email,
        selectedImage: selectedImage,
        imageFile: selectedImage ? selectedImage.name : 'none',
        linkedinUrl: formData.linkedinUrl,
        facebookUrl: formData.facebookUrl,
        tiktokUrl: formData.tiktokUrl,
        instagramUrl: formData.instagramUrl
      });

      // Add method spoofing for Laravel (since we're sending POST but Laravel route expects PUT)
      formDataToSend.append('_method', 'PUT');

      // Always append name and email parameters (required by API)
      const nameToSend = formData.username?.trim() || user?.name || '';
      const emailToSend = formData.email?.trim() || user?.email || '';

      formDataToSend.append('name', nameToSend);
      formDataToSend.append('email', emailToSend);

      // Always send all fields so backend can clear them if empty
      formDataToSend.append('location', formData.location?.trim() ?? '');
      formDataToSend.append('phone', formData.phone?.trim() ?? '');
      formDataToSend.append('bio', formData.bio?.trim() ?? '');
      formDataToSend.append('linkedin_url', formData.linkedinUrl?.trim() ?? '');
      formDataToSend.append('facebook_url', formData.facebookUrl?.trim() ?? '');
      formDataToSend.append('tiktok_url', formData.tiktokUrl?.trim() ?? '');
      formDataToSend.append('instagram_url', formData.instagramUrl?.trim() ?? '');
      formDataToSend.append('website', formData.website?.trim() ?? '');

      console.log('Method override: PUT');
      console.log('Name parameter:', nameToSend);
      console.log('Email parameter:', emailToSend);
      console.log('Location parameter:', formData.location);
      console.log('Phone parameter:', formData.phone);
      console.log('Bio parameter:', formData.bio);
      
      if (selectedImage) {
        formDataToSend.append('image', selectedImage, selectedImage.name);
        console.log('Image file added:', selectedImage.name, 'Size:', selectedImage.size);
      }
      
      // Debug: log FormData contents
      console.log('FormData contents being sent to API:');
      for (let [key, value] of formDataToSend.entries()) {
        if (value instanceof File) {
          console.log(`${key}: File(${value.name}) - ${value.size} bytes - Type: ${value.type}`);
        } else {
          console.log(`${key}: "${value}"`);
        }
      }
      
      // Verify FormData has entries
      const formDataSize = Array.from(formDataToSend.entries()).length;
      console.log('Total FormData entries:', formDataSize);
      
      if (formDataSize === 0) {
        console.error('ERROR: FormData is empty!');
        toast.error('No data to send. Please fill in the form.');
        return;
      }
      
      const response = await dashboardAPI.updateProfile(formDataToSend);
      
      if (response.success) {
        console.log('✅ Profile updated successfully:', response);
        console.log('📍 Form location before update:', formData.location);
        console.log('📍 API response location:', response.data?.user?.location || response.data?.data?.user?.location);

        // Get current user from localStorage to merge with updates
        const currentUser = JSON.parse(localStorage.getItem('stasht_user') || '{}');
        console.log('📍 Current user before update:', currentUser);

        // CRITICAL FIX: Use the ACTUAL data from API response, not form data
        // The API response contains the saved/validated data from the server
        const apiUser = response.data?.user || response.data?.data?.user || {};
        console.log('📍 API user data:', apiUser);
        console.log('📍 API user location:', apiUser.location);

        // Update the user context with data from API response
        const updatedUserData = {
          ...currentUser,  // Start with current user data
          // Override with API response data (what was actually saved on server)
          name: apiUser.name || formData.username,
          email: apiUser.email || formData.email,
          location: apiUser.location || formData.location,  // ✅ Use API response location (server truth)
          bio: apiUser.bio || formData.bio,
          phone: apiUser.phone || formData.phone || currentUser.phone,
          // Avatar/profile image from API response
          ...(apiUser.avatar && { avatar: apiUser.avatar }),
          ...(apiUser.profile_image && { profile_image: apiUser.profile_image }),
        };

        console.log('✅ New user data to update:', updatedUserData);
        console.log('📍 New location in updatedUserData:', updatedUserData.location);

        // Update user context (this updates both state and localStorage)
        updateUser(updatedUserData);

        // Double-check localStorage was updated correctly
        const expectedLocation = apiUser.location || formData.location;
        setTimeout(() => {
          const storedUser = localStorage.getItem('stasht_user');
          const parsed = storedUser ? JSON.parse(storedUser) : null;
          console.log('✅ Verified stored user after update:', parsed);
          console.log('📍 Verified stored location:', parsed?.location);

          if (parsed?.location !== expectedLocation) {
            console.error('❌ ERROR: Location not updated in localStorage!');
            console.error('Expected:', expectedLocation);
            console.error('Got:', parsed?.location);
          } else {
            console.log('✅ Location successfully updated in localStorage!');
          }
        }, 200);

        // Update the form data to reflect the saved values from API
        setFormData(prev => ({
          ...prev,
          username: apiUser.name || formData.username,
          email: apiUser.email || formData.email,
          location: apiUser.location || formData.location,
          bio: apiUser.bio || formData.bio,
          phone: apiUser.phone || formData.phone
        }));

        // Clear selected image and preview since it's now saved
        setSelectedImage(null);
        setPreviewUrl(null);

        // Force a small delay to ensure context update, then close edit mode
        setTimeout(() => {
          onEditToggle(false);

          // Force a re-render of the entire app by triggering a state update
          window.dispatchEvent(new Event('user-updated'));
        }, 300);

        // Show success message
        toast.success('Profile updated successfully');
      } else {
        console.error('Profile update failed:', response);
        toast.error('Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('An error occurred while updating your profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onEditToggle(false);
    // Reset form data
    setFormData({
      username: user?.name || '',
      email: user?.email || '',
      phone: '',
      location: '',
      bio: ''
    });
    // Clear image selection
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isEditing) {
    return (
      <div ref={sectionRef} id="personal" className="space-y-6 scroll-mt-8">
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2}/>
            <circle cx="12" cy="8" r="3" strokeWidth={2}/>
            <path d="M6.168 18.849A6 6 0 0 1 12 16a6 6 0 0 1 5.832 2.849" strokeWidth={2} strokeLinecap="round"/>
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            <p className="text-sm text-gray-600">Update your personal details and profile information</p>
          </div>
        </div>

        {/* Profile Photo */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-20 h-20">
            {(previewUrl || profileImage) && (
              <AvatarImage 
                src={previewUrl || profileImage} 
                alt={user?.name || user?.email || 'User'} 
                className="object-cover"
              />
            )}
            <AvatarFallback 
              className={fallbackClassName}
              style={backgroundStyle}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-[#6C60FF] hover:bg-[#6C60FF]/10 px-3 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Change Photo
            </button>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
            {selectedImage && (
              <p className="text-xs text-green-600 mt-1">New image selected: {selectedImage.name}</p>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({...prev, username: e.target.value}))}
              placeholder="Enter your username"
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
              placeholder="Enter your email"
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <div className="flex gap-2">
              <CountrySelect
                value={phoneCountry}
                onChange={(c) => applyPhone(c, phoneNational)}
                className="w-28 flex-shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
              />
              <input
                type="tel"
                value={phoneNational}
                onChange={(e) => applyPhone(phoneCountry, e.target.value)}
                placeholder="e.g. 4163028755"
                className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({...prev, website: e.target.value}))}
              placeholder="https://yourwebsite.com"
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <button
                type="button"
                onClick={async () => {
                  console.log('🔘 AUTO-DETECT BUTTON CLICKED');
                  console.log('🌍 Starting location detection...');

                  if ('geolocation' in navigator) {
                    console.log('✅ Geolocation API is available');

                    navigator.geolocation.getCurrentPosition(
                      async (position) => {
                        const { latitude, longitude } = position.coords;
                        console.log('✅ Got coordinates:', { latitude, longitude });

                        try {
                          console.log('📡 Calling Nominatim API...');
                          const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
                          console.log('🔗 API URL:', apiUrl);

                          const response = await fetch(apiUrl);
                          console.log('📥 Response status:', response.status);

                          const data = await response.json();
                          console.log('📦 Response data:', data);

                          if (data && data.address) {
                            console.log('✅ Address data:', data.address);

                            // Build location string like CreateMemory does
                            const { city, town, state, country } = data.address;
                            let locationString = '';

                            if (city && state && country) {
                              locationString = `${city}, ${state}, ${country}`;
                            } else if (town && state && country) {
                              locationString = `${town}, ${state}, ${country}`;
                            } else if (city && country) {
                              locationString = `${city}, ${country}`;
                            } else if (state && country) {
                              locationString = `${state}, ${country}`;
                            } else if (city) {
                              locationString = city;
                            } else if (country) {
                              locationString = country;
                            } else {
                              locationString = data.display_name?.split(',').slice(0, 2).join(',').trim() || '';
                            }

                            console.log('🏙️ Final location string:', locationString);

                            if (locationString) {
                              console.log('💾 Setting form data with location:', locationString);
                              setFormData(prev => {
                                const newData = { ...prev, location: locationString };
                                console.log('📝 New form data:', newData);
                                return newData;
                              });
                              console.log('✅ Location set successfully!');
                              alert(`Location detected: ${locationString}`);
                            } else {
                              console.error('❌ locationString is empty');
                              alert('Unable to determine your location from coordinates.');
                            }
                          } else {
                            console.error('❌ No address data in response');
                            alert('Unable to determine your location from coordinates.');
                          }
                        } catch (error) {
                          console.error('❌ Error reverse geocoding:', error);
                          alert(`Failed to detect your location: ${error.message}`);
                        }
                      },
                      (error) => {
                        console.error('❌ Geolocation error:', error);
                        console.error('Error code:', error.code);
                        console.error('Error message:', error.message);
                        alert(`Unable to detect your location: ${error.message}`);
                      },
                      {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 0
                      }
                    );
                  } else {
                    console.error('❌ Geolocation not available');
                    alert('Geolocation is not supported by your browser.');
                  }
                }}
                className="flex items-center gap-1 text-xs text-[#6C60FF] hover:text-[#5850E5] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                Turn on auto-detect
              </button>
            </div>
            <GooglePlacesInput
              value={formData.location}
              onChange={(value) => setFormData(prev => ({...prev, location: value}))}
              placeholder="Enter your location"
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
              onPlaceSelect={(place) => {
                console.log('Selected place in ProfileSettings:', place);
                // You can add additional logic here when a place is selected
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
              TikTok URL
            </label>
            <input
              type="url"
              value={formData.tiktokUrl}
              onChange={(e) => handleUrlChange('tiktokUrl', e.target.value)}
              placeholder="https://www.tiktok.com/@username"
              className={`w-full px-3 py-2 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF] ${
                urlErrors.tiktokUrl ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {urlErrors.tiktokUrl && (
              <p className="text-xs text-red-600 mt-1">{urlErrors.tiktokUrl}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 14 14" fill="none">
                <g clipPath="url(#clip0_10446_7044)">
                  <path d="M9.91602 1.16667H4.08268C2.47185 1.16667 1.16602 2.47251 1.16602 4.08334V9.91667C1.16602 11.5275 2.47185 12.8333 4.08268 12.8333H9.91602C11.5268 12.8333 12.8327 11.5275 12.8327 9.91667V4.08334C12.8327 2.47251 11.5268 1.16667 9.91602 1.16667Z" stroke="#E4405F" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.33284 6.63249C9.40483 7.11797 9.3219 7.61379 9.09586 8.04942C8.86982 8.48505 8.51217 8.83832 8.07379 9.05897C7.6354 9.27962 7.1386 9.35642 6.65405 9.27845C6.16949 9.20048 5.72186 8.97171 5.37483 8.62467C5.02779 8.27763 4.79901 7.83 4.72104 7.34545C4.64307 6.8609 4.71988 6.3641 4.94053 5.92571C5.16118 5.48732 5.51445 5.12967 5.95008 4.90363C6.38571 4.67759 6.88153 4.59467 7.367 4.66666C7.86221 4.74009 8.32067 4.97085 8.67466 5.32484C9.02865 5.67883 9.2594 6.13729 9.33284 6.63249Z" stroke="#E4405F" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.209 3.79167H10.2148" stroke="#E4405F" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                <defs>
                  <clipPath id="clip0_10446_7044">
                    <rect width="14" height="14" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
              Instagram URL
            </label>
            <input
              type="url"
              value={formData.instagramUrl}
              onChange={(e) => handleUrlChange('instagramUrl', e.target.value)}
              placeholder="https://www.instagram.com/username"
              className={`w-full px-3 py-2 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF] ${
                urlErrors.instagramUrl ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {urlErrors.instagramUrl && (
              <p className="text-xs text-red-600 mt-1">{urlErrors.instagramUrl}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn URL
            </label>
            <input
              type="url"
              value={formData.linkedinUrl}
              onChange={(e) => handleUrlChange('linkedinUrl', e.target.value)}
              placeholder="https://www.linkedin.com/in/username"
              className={`w-full px-3 py-2 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF] ${
                urlErrors.linkedinUrl ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {urlErrors.linkedinUrl && (
              <p className="text-xs text-red-600 mt-1">{urlErrors.linkedinUrl}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook URL
            </label>
            <input
              type="url"
              value={formData.facebookUrl}
              onChange={(e) => handleUrlChange('facebookUrl', e.target.value)}
              placeholder="https://www.facebook.com/username"
              className={`w-full px-3 py-2 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF] ${
                urlErrors.facebookUrl ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {urlErrors.facebookUrl && (
              <p className="text-xs text-red-600 mt-1">{urlErrors.facebookUrl}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({...prev, bio: e.target.value}))}
            placeholder="Tell us about yourself"
            rows={4}
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF] resize-none"
          />
        </div>


        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-[#6C60FF] text-white px-6 py-2 rounded-lg hover:bg-[#5A4FFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button 
            onClick={handleCancel}
            disabled={isSubmitting}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} id="personal" className="space-y-6 scroll-mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2}/>
            <circle cx="12" cy="8" r="3" strokeWidth={2}/>
            <path d="M6.168 18.849A6 6 0 0 1 12 16a6 6 0 0 1 5.832 2.849" strokeWidth={2} strokeLinecap="round"/>
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            <p className="text-sm text-gray-600">Update your personal details and profile information</p>
          </div>
        </div>
        <button 
          onClick={() => onEditToggle(true)}
          className="px-4 py-2 text-[#6C60FF] hover:bg-[#6C60FF]/10 rounded-lg transition-colors"
        >
          Edit
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600">Loading profile data...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-20 h-20">
                {profileImage && (
                  <AvatarImage 
                    src={profileImage} 
                    alt={profileData?.name || user?.name || user?.email || 'User'} 
                    className="object-cover"
                  />
                )}
                <AvatarFallback 
                  className={fallbackClassName}
                  style={backgroundStyle}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {profileData?.name || user?.name || 'User'}
                  </h3>
                  {(() => {
                    const planName = (profileData?.plan_name || user?.plan_name || '').toLowerCase();

                    if (planName === 'professional') {
                      return (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                          Professional
                        </span>
                      );
                    } else if (planName === 'intermediate') {
                      return (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">
                          Intermediate
                        </span>
                      );
                    } else if (planName === 'starter') {
                      return (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          Starter
                        </span>
                      );
                    }

                    return null;
                  })()}
                </div>
                <p className="text-gray-600">{profileData?.email || user?.email || ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username:</label>
                <p className="text-gray-900">{profileData?.name || user?.name || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
                <p className="text-gray-900">{profileData?.email || user?.email || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone:</label>
                <p className="text-gray-900">{profileData?.phone || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website:</label>
                {profileData?.website ? (
                  <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="text-[#6C60FF] hover:underline break-all">{profileData.website}</a>
                ) : (
                  <p className="text-gray-900">Not set</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    Location:
                  </label>
                  {(!profileData?.location || profileData?.location === 'Not set') && (
                    <button
                      type="button"
                      onClick={async () => {
                        console.log('🔘 AUTO-DETECT BUTTON CLICKED (Non-edit mode)');
                        console.log('🌍 Starting location detection...');

                        if ('geolocation' in navigator) {
                          console.log('✅ Geolocation API is available');

                          navigator.geolocation.getCurrentPosition(
                            async (position) => {
                              const { latitude, longitude } = position.coords;
                              console.log('✅ Got coordinates:', { latitude, longitude });

                              try {
                                console.log('📡 Calling Nominatim API...');
                                const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
                                console.log('🔗 API URL:', apiUrl);

                                const response = await fetch(apiUrl);
                                console.log('📥 Response status:', response.status);

                                const data = await response.json();
                                console.log('📦 Response data:', data);

                                if (data && data.address) {
                                  console.log('✅ Address data:', data.address);

                                  // Build location string like CreateMemory does
                                  const { city, town, state, country } = data.address;
                                  let locationString = '';

                                  if (city && state && country) {
                                    locationString = `${city}, ${state}, ${country}`;
                                  } else if (town && state && country) {
                                    locationString = `${town}, ${state}, ${country}`;
                                  } else if (city && country) {
                                    locationString = `${city}, ${country}`;
                                  } else if (state && country) {
                                    locationString = `${state}, ${country}`;
                                  } else if (city) {
                                    locationString = city;
                                  } else if (country) {
                                    locationString = country;
                                  } else {
                                    locationString = data.display_name?.split(',').slice(0, 2).join(',').trim() || '';
                                  }

                                  console.log('🏙️ Final location string:', locationString);

                                  if (locationString) {
                                    console.log('💾 Setting form data with location:', locationString);
                                    setFormData(prev => {
                                      const newData = { ...prev, location: locationString };
                                      console.log('📝 New form data:', newData);
                                      return newData;
                                    });
                                    console.log('🔄 Toggling edit mode...');
                                    onEditToggle(true);
                                    console.log('✅ Location set and edit mode enabled!');
                                    alert(`Location detected: ${locationString}`);
                                  } else {
                                    console.error('❌ locationString is empty');
                                    alert('Unable to determine your location from coordinates.');
                                  }
                                } else {
                                  console.error('❌ No address data in response');
                                  alert('Unable to determine your location from coordinates.');
                                }
                              } catch (error) {
                                console.error('❌ Error reverse geocoding:', error);
                                alert(`Failed to detect your location: ${error.message}`);
                              }
                            },
                            (error) => {
                              console.error('❌ Geolocation error:', error);
                              console.error('Error code:', error.code);
                              console.error('Error message:', error.message);
                              alert(`Unable to detect your location: ${error.message}`);
                            },
                            {
                              enableHighAccuracy: false,
                              timeout: 10000,
                              maximumAge: 0
                            }
                          );
                        } else {
                          console.error('❌ Geolocation not available');
                          alert('Geolocation is not supported by your browser.');
                        }
                      }}
                      className="flex items-center gap-1 text-xs text-[#6C60FF] hover:text-[#5850E5] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      Turn on auto-detect
                    </button>
                  )}
                </div>
                <p className="text-gray-900">{profileData?.location || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                  TikTok:
                </label>
                {profileData?.tiktok_url ? (
                  <a
                    href={profileData.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black hover:underline break-all"
                  >
                    {profileData.tiktok_url}
                  </a>
                ) : (
                  <p className="text-gray-900">Not set</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 14 14" fill="none">
                    <g clipPath="url(#clip0_10446_7044_view)">
                      <path d="M9.91602 1.16667H4.08268C2.47185 1.16667 1.16602 2.47251 1.16602 4.08334V9.91667C1.16602 11.5275 2.47185 12.8333 4.08268 12.8333H9.91602C11.5268 12.8333 12.8327 11.5275 12.8327 9.91667V4.08334C12.8327 2.47251 11.5268 1.16667 9.91602 1.16667Z" stroke="#E4405F" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9.33284 6.63249C9.40483 7.11797 9.3219 7.61379 9.09586 8.04942C8.86982 8.48505 8.51217 8.83832 8.07379 9.05897C7.6354 9.27962 7.1386 9.35642 6.65405 9.27845C6.16949 9.20048 5.72186 8.97171 5.37483 8.62467C5.02779 8.27763 4.79901 7.83 4.72104 7.34545C4.64307 6.8609 4.71988 6.3641 4.94053 5.92571C5.16118 5.48732 5.51445 5.12967 5.95008 4.90363C6.38571 4.67759 6.88153 4.59467 7.367 4.66666C7.86221 4.74009 8.32067 4.97085 8.67466 5.32484C9.02865 5.67883 9.2594 6.13729 9.33284 6.63249Z" stroke="#E4405F" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10.209 3.79167H10.2148" stroke="#E4405F" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_10446_7044_view">
                        <rect width="14" height="14" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                  Instagram:
                </label>
                {profileData?.instagram_url ? (
                  <a
                    href={profileData.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E4405F] hover:underline break-all"
                  >
                    {profileData.instagram_url}
                  </a>
                ) : (
                  <p className="text-gray-900">Not set</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn:
                </label>
                {profileData?.linkedin_url ? (
                  <a
                    href={profileData.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0077B5] hover:underline break-all"
                  >
                    {profileData.linkedin_url}
                  </a>
                ) : (
                  <p className="text-gray-900">Not set</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook:
                </label>
                {profileData?.facebook_url ? (
                  <a
                    href={profileData.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1877F2] hover:underline break-all"
                  >
                    {profileData.facebook_url}
                  </a>
                ) : (
                  <p className="text-gray-900">Not set</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 mt-6 p-4 bg-gray-100 border border-gray-200 rounded-xl">
              <Checkbox
                checked={showEBusinessCard}
                onCheckedChange={async (checked) => {
                  const next = checked as boolean;
                  setShowEBusinessCard(next);
                  try {
                    await dashboardAPI.updateIsBusinessCard(next);
                    toast.success(next ? 'E-business card enabled' : 'E-business card disabled');
                  } catch {
                    setShowEBusinessCard(!next);
                    toast.error('Failed to update e-business card setting');
                  }
                }}
                className="w-6 h-6 mt-0.5 flex-shrink-0 data-[state=checked]:bg-[#0075FF] data-[state=checked]:border-[#0075FF] data-[state=checked]:text-white [&_svg]:[stroke-width:3]"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Show e-business card</p>
                <p className="text-sm text-gray-500 mt-0.5">This e-signature will appear at the bottom of your campaigns.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AccountSecurity({ sectionRef, isEditing, onEditToggle, updateUser }: {
  sectionRef: React.RefObject<HTMLDivElement>;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
  updateUser?: (user: Partial<any>) => void;
}) {
  console.log('🔍 AccountSecurity component - isEditing:', isEditing);
  const [settings, setSettings] = useState({
    twoFactorAuth: false,
    backupCodes: false
  });
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [passwordSecurity, setPasswordSecurity] = useState(() => getPasswordSecurity());

  // Auto-fill current password and open Account Security if user came from login with change_password = 1
  useEffect(() => {
    console.log('🔑 [AccountSecurity] Checking for temp_current_password...');
    const tempPassword = sessionStorage.getItem('temp_current_password');
    console.log('🔑 [AccountSecurity] temp_current_password:', tempPassword ? `[${tempPassword.length} chars]` : 'NOT FOUND');

    if (tempPassword) {
      console.log('🔑 [AccountSecurity] ✅ Auto-filling current password from login');
      setPasswordData(prev => ({ ...prev, current_password: tempPassword }));
      console.log('🔑 [AccountSecurity] Password field updated');
      // DON'T clear the temporary password here - keep it until password is successfully changed
      // This ensures if user navigates away and comes back, the field is still auto-filled
      console.log('🔑 [AccountSecurity] Keeping temp_current_password in sessionStorage until password change');
    } else {
      console.log('🔑 [AccountSecurity] ❌ No temp password found - user will need to enter manually');
    }
  }, []);

  const handleSave = () => {
    console.log('Saving account security settings:', settings);
    onEditToggle(false);
  };

  const handleCancel = () => {
    onEditToggle(false);
    setSettings({
      twoFactorAuth: false,
      backupCodes: false
    });
    // Reset password form
    setPasswordData({
      current_password: '',
      new_password: '',
      new_password_confirmation: ''
    });
    setPasswordError('');
    setShowSuccessModal(false);
  };

  const handlePasswordChange = async () => {
    // Validate passwords match
    if (passwordData.new_password !== passwordData.new_password_confirmation) {
      setPasswordError('New passwords do not match');
      return;
    }

    // Validate password length
    if (passwordData.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    // Validate all fields are filled
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.new_password_confirmation) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError('');

    try {
      const response = await authAPI.changePassword(passwordData);

      if (response.success) {
        console.log('Password changed successfully');

        // Update user object in localStorage to clear change_password flag
        const storedUser = localStorage.getItem('stasht_user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            user.change_password = 0;
            localStorage.setItem('stasht_user', JSON.stringify(user));
            console.log('🔑 Updated user object in localStorage - change_password flag cleared');

            // Also update the AuthContext user state so UI updates immediately
            if (updateUser) {
              updateUser({ change_password: 0 });
              console.log('🔑 Updated AuthContext user state - banner will disappear');
            }
          } catch (e) {
            console.error('Failed to update user object:', e);
          }
        }

        // Clear the require_password_change flag if it exists
        sessionStorage.removeItem('require_password_change');
        // Clear the temp_current_password now that password has been successfully changed
        sessionStorage.removeItem('temp_current_password');
        console.log('🔑 Cleared temp_current_password after successful password change');

        // Save password security data to local storage
        savePasswordSecurity(passwordData.new_password);
        // Update password security state
        setPasswordSecurity(getPasswordSecurity());
        // Reset form
        setPasswordData({
          current_password: '',
          new_password: '',
          new_password_confirmation: ''
        });
        // Show success modal
        setShowSuccessModal(true);
        // Close edit mode after showing modal
        setTimeout(() => {
          onEditToggle(false);
        }, 100);
      } else {
        setPasswordError(response.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Password change error:', error);
      setPasswordError('An error occurred while changing password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isEditing) {
    return (
      <div ref={sectionRef} id="security" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 scroll-mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Account Security</h2>
            <p className="text-sm text-gray-500">Manage your password and security settings</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  id="currentPassword"
                  name="current-password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent bg-gray-50"
                  placeholder="Enter current password"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button 
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  name="new-password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent bg-gray-50"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button 
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <PasswordStrengthIndicator 
                password={passwordData.new_password} 
                showFeedback={true}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirm-password"
                  value={passwordData.new_password_confirmation}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, new_password_confirmation: e.target.value }))}
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-transparent bg-gray-50"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {passwordError && (
              <div className="text-red-600 text-sm mt-2">
                {passwordError}
              </div>
            )}

            {/* Change Password Button */}
            <button
              onClick={handlePasswordChange}
              disabled={isChangingPassword || !passwordData.current_password || !passwordData.new_password || !passwordData.new_password_confirmation}
              className="bg-[#6C60FF] text-white px-4 py-2 rounded-lg hover:bg-[#5A4FFF] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChangingPassword ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>

          <div className="flex items-center justify-between py-4 border-t border-gray-100">
            <div>
              <h3 className="text-base font-medium text-gray-900">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({...prev, twoFactorAuth: !prev.twoFactorAuth}))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.twoFactorAuth ? 'bg-[#6C60FF]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-gray-100">
          <button 
            onClick={handleSave}
            className="bg-[#6C60FF] text-white px-6 py-2 rounded-lg hover:bg-[#5A4FFF] transition-colors"
          >
            Save Changes
          </button>
          <button 
            onClick={handleCancel}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} id="security" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 scroll-mt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Account Security</h2>
            <p className="text-sm text-gray-500">Manage your password and security settings</p>
          </div>
        </div>
        <button 
          onClick={() => onEditToggle(true)}
          className="px-4 py-2 text-[#6C60FF] hover:bg-[#6C60FF]/10 rounded-lg transition-colors font-medium"
        >
          Edit
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center py-3">
          <div>
            <h3 className="font-medium text-gray-900">Password</h3>
            <p className="text-sm text-gray-500">Last changed {passwordSecurity.lastChanged}</p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
            passwordSecurity.strength === 'weak' ? 'bg-red-100 text-red-700' :
            passwordSecurity.strength === 'medium' ? 'bg-orange-100 text-orange-700' :
            'bg-green-100 text-green-700'
          }`}>
            {passwordSecurity.strength}
          </span>
        </div>
        
        <div className="flex justify-between items-center py-3">
          <div>
            <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500">Not enabled</p>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
            Disabled
          </span>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Password Changed Successfully
            </h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              Your password has been updated and saved securely.
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-[#6C60FF] text-white py-2 px-4 rounded-lg hover:bg-[#5A4FFF] transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StorageManagement({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement> }) {
  const { user } = useAuth();
  const [storageData, setStorageData] = useState({
    totalUsers: 0,
    totalMemories: 0,
    categories: 0,
    labels: 0,
    planStorageSize: 100, // in MB after conversion
    totalStorageUsed: 0, // in MB
    memoriesStorageSize: 0, // in MB
    memoryImagesStorageSize: 0, // in MB
    planId: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleUpgrade = (planId: string, isYearly: boolean) => {
    console.log('Upgrading to plan:', planId, 'Yearly:', isYearly);
    // TODO: Implement actual upgrade API call
  };

  useEffect(() => {
    const fetchStorageData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch storage overview data
        const storageResponse = await dashboardAPI.getStorageOverview();

        let totalUsers = 0;
        let totalMemories = 0;
        let categories = 0;
        let labels = 0;
        let planStorageSize = 100; // Default 100MB
        let totalStorageUsed = 0;
        let memoriesStorageSize = 0;
        let memoryImagesStorageSize = 0;
        let planId = null;

        if (storageResponse?.success && storageResponse.data?.data?.storage_overview) {
          const overview = storageResponse.data.data.storage_overview;
          
          // Get counts
          totalMemories = overview.memories_count || 0;
          categories = overview.categories_count || 0;
          labels = overview.labels_count || 0;
          
          // Convert plan storage size from GB to MB (multiply by 1024)
          planStorageSize = overview.plan_storage_size_gb ? overview.plan_storage_size_gb * 1024 : 100;

          // Storage sizes are already in MB from API
          totalStorageUsed = overview.total_storage_used_mb || 0;
          memoriesStorageSize = overview.memories_storage_mb || 0;
          memoryImagesStorageSize = overview.memory_images_storage_mb || 0;
          
          planId = overview.plan_id;
        }

        setStorageData({
          totalUsers, // Keep as 0 as requested
          totalMemories,
          categories,
          labels,
          planStorageSize,
          totalStorageUsed,
          memoriesStorageSize,
          memoryImagesStorageSize,
          planId
        });
      } catch (error) {
        console.error('Error fetching storage data:', error);
        // Keep default values of 0
      } finally {
        setIsLoading(false);
      }
    };

    fetchStorageData();
  }, []);

  return (
    <div ref={sectionRef} id="storage" className="space-y-6 scroll-mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Storage Overview</h2>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Total Users</p>
            <p className="text-xl font-bold text-blue-900">{isLoading ? '...' : storageData.totalUsers}</p>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Total Campaigns</p>
            <p className="text-xl font-bold text-green-900">{isLoading ? '...' : storageData.totalMemories}</p>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-purple-600 font-medium">Categories</p>
            <p className="text-xl font-bold text-purple-900">{isLoading ? '...' : storageData.categories}</p>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-orange-600 font-medium">Labels</p>
            <p className="text-xl font-bold text-orange-900">{isLoading ? '...' : storageData.labels}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Storage Used</span>
          <span className="text-gray-600">0.09 MB</span>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-5 h-5 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Storage Usage</h3>
              <p className="text-sm text-gray-600">Plan • {storageData.totalStorageUsed.toFixed(1)} MB of {(storageData.planStorageSize / 1024).toFixed(0)} GB used</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-medium text-gray-900">{storageData.planStorageSize > 0 ? ((storageData.totalStorageUsed / storageData.planStorageSize) * 100).toFixed(1) : 0}% Used</p>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div className="bg-[#6C60FF] h-2 rounded-full" style={{width: `${storageData.planStorageSize > 0 ? Math.min((storageData.totalStorageUsed / storageData.planStorageSize) * 100, 100) : 0}%`}}></div>
          </div>

          <div className="flex justify-between text-sm text-gray-600">
            <span>{storageData.totalStorageUsed.toFixed(1)} MB used</span>
            <span>{(Math.max(storageData.planStorageSize - storageData.totalStorageUsed, 0) / 1024).toFixed(1)} GB remaining</span>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#6C60FF] rounded-full"></div>
              <div>
                <p className="text-xs text-gray-600">Campaigns</p>
                <p className="text-sm font-medium">{storageData.memoriesStorageSize.toFixed(1)} MB</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <div>
                <p className="text-xs text-gray-600">Images</p>
                <p className="text-sm font-medium">{storageData.memoryImagesStorageSize.toFixed(1)} MB</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              <div>
                <p className="text-xs text-gray-600">Categories</p>
                <p className="text-sm font-medium">0.0 MB</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <div>
                <p className="text-xs text-gray-600">Labels</p>
                <p className="text-sm font-medium">0.0 MB</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Need More Storage?</h4>
              <p className="text-sm text-blue-700 mb-3">Upgrade to get more space and advanced features</p>
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="bg-[#6C60FF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5A4FFF] transition-colors">
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="text-base font-semibold text-gray-900 mb-1">Your Data</h4>
          <p className="text-sm text-gray-600">Current user: {user?.name || 'Unknown'} ({user?.email || 'No email'})</p>
        </div>
      </div>

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlan={user?.plan_name}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

function CategoriesSettings({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement> }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Only one category can be toggled on at a time. Value matches category_id from
  // the notification-preferences API: a real category's numeric id, or the literal
  // string "shopify"/"cars".
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);
  // The GET response also resolves category_id to a name (e.g. category_id "2937" ->
  // category.name "Used Cars"). The categories list here comes from a different endpoint
  // (getCategoriesLabels) than the one notification-preferences resolves ids against, and
  // the two don't reliably agree on id — so match on name for real categories, which both
  // responses always carry, and keep id matching only for the synthetic "shopify"/"cars".
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  // The rest of the notification-preferences payload, kept around so a PUT for
  // category_id doesn't clobber the user's email/push/moderation settings.
  const savedPreferencesRef = useRef<{ email_notifications: any; push_notifications: any; moderation_enabled: boolean }>({
    email_notifications: { new_memories: true, comments: true },
    push_notifications: { new_memories: true, comments: true },
    moderation_enabled: true,
  });
  // Same synthetic-category gating as the "Add Campaign" modal — tracked as their own
  // pieces of state (not folded into a single fetch) so the category list re-renders
  // with Shopify/Cars the moment each check resolves, instead of a one-time snapshot
  // that could win a race against these two slower calls.
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [carsAvailable, setCarsAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardAPI.shopifyGetStatus();
        if (!cancelled) setShopifyConnected(res?.data?.connected === true);
      } catch { if (!cancelled) setShopifyConnected(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardAPI.carsGetCatalog();
        const list = res?.data?.data?.cars || (res?.data as any)?.cars || [];
        if (!cancelled) setCarsAvailable(res?.success === true && Array.isArray(list) && list.length > 0);
      } catch { if (!cancelled) setCarsAvailable(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Base list plus the synthetic entries — recomputed every render so it always
  // reflects the latest shopifyConnected/carsAvailable state.
  const displayCategories = [
    ...categories,
    ...(shopifyConnected ? [{ id: 'shopify', name: 'Shopify' }] : []),
    ...(carsAvailable ? [{ id: 'cars', name: 'Cars' }] : []),
  ];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const [response, prefsResponse] = await Promise.all([
          dashboardAPI.getCategoriesLabels(),
          dashboardAPI.getNotificationPreferences(),
        ]);

        if (prefsResponse.success && prefsResponse.data) {
          // apiRequest returns the whole server payload as `data` (i.e. { status, data: {...} }),
          // it doesn't unwrap the inner `data` — so the real fields are one level deeper.
          const prefsData = (prefsResponse.data as any)?.data || prefsResponse.data;

          savedPreferencesRef.current = {
            email_notifications: prefsData.email_notifications || savedPreferencesRef.current.email_notifications,
            push_notifications: prefsData.push_notifications || savedPreferencesRef.current.push_notifications,
            moderation_enabled: prefsData.moderation_enabled ?? savedPreferencesRef.current.moderation_enabled,
          };

          const rawCategoryId = prefsData.category_id;
          if (rawCategoryId === 'shopify' || rawCategoryId === 'cars') {
            setSelectedCategoryId(rawCategoryId);
            setSelectedCategoryName(null);
          } else if (rawCategoryId != null && !isNaN(Number(rawCategoryId))) {
            setSelectedCategoryId(Number(rawCategoryId));
            setSelectedCategoryName(prefsData.category?.name ?? null);
          } else {
            setSelectedCategoryId(null);
            setSelectedCategoryName(null);
          }
        }

        if (response.success && response.data) {
          const actualData = response.data?.data || response.data;

          const candidates = [
            actualData?.sidebar?.categories?.items,
            actualData?.data?.sidebar?.categories?.items,
            actualData?.data?.categories?.items,
            actualData?.categories?.items,
            Array.isArray(actualData?.categories) ? actualData.categories : null,
            Array.isArray(actualData?.data?.categories) ? actualData.data.categories : null,
          ];

          let categoriesArray: any[] = [];
          for (const candidate of candidates) {
            if (Array.isArray(candidate) && candidate.length > 0 && candidate[0]?.name) {
              categoriesArray = candidate;
              break;
            }
          }

          // Same categories as the Memories page sidebar — only "Shared With" and
          // "Published" (read-only, not real user categories) are left out. Shopify/Cars
          // are appended separately in displayCategories once their own checks resolve.
          const uniqueCategories = categoriesArray
            .filter(cat => {
              const name = (cat.name || '').toLowerCase().trim();
              return name !== 'shared with' && name !== 'published';
            })
            .filter((cat, i, self) => self.findIndex(c => c.name === cat.name) === i);

          setCategories(uniqueCategories);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const normalizeCategoryName = (name: any) => (name ?? '').toString().trim().toLowerCase();

  const isCategoryChecked = (cat: any) => {
    if (cat.id === 'shopify' || cat.id === 'cars') return selectedCategoryId === cat.id;
    return selectedCategoryName != null && normalizeCategoryName(cat.name) === normalizeCategoryName(selectedCategoryName);
  };

  const handleToggle = async (cat: any, checked: boolean) => {
    const newCategoryId = checked ? cat.id : null;
    const previousCategoryId = selectedCategoryId;
    const previousCategoryName = selectedCategoryName;
    setSelectedCategoryId(newCategoryId);
    setSelectedCategoryName(checked && cat.id !== 'shopify' && cat.id !== 'cars' ? cat.name : null);
    try {
      const response = await dashboardAPI.updateNotificationPreferences({
        ...savedPreferencesRef.current,
        category_id: newCategoryId,
      });
      if (!response.success) throw new Error(response.error || 'Failed to save');
    } catch (error) {
      console.error('Error saving category preference:', error);
      setSelectedCategoryId(previousCategoryId);
      setSelectedCategoryName(previousCategoryName);
    }
  };

  return (
    <div ref={sectionRef} id="categories" className="space-y-6 scroll-mt-8">
      <div className="flex items-center gap-3">
        <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          <p className="text-base text-gray-600">Make category always visible in Add new campaigns section</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-4 text-base text-gray-400">Loading categories...</div>
      ) : displayCategories.length === 0 ? (
        <div className="py-4 text-base text-gray-400">No categories found</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {displayCategories.map((cat) => (
            <div key={cat.id || cat.name} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || getCategoryColor(cat.name) }} />
                <span className="text-base font-medium text-gray-900">{cat.name}</span>
              </div>
              <Switch
                className="h-6 w-11 [&>span]:size-5"
                checked={isCategoryChecked(cat)}
                onCheckedChange={(checked) => handleToggle(cat, checked)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrivacySettings({ sectionRef, isEditing, onEditToggle }: { 
  sectionRef: React.RefObject<HTMLDivElement>;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
}) {
  const [settings, setSettings] = useState({
    profileVisibility: 'public',
    allowDirectMessages: true,
    showOnlineStatus: true,
    allowTagging: true
  });
  const handleSave = () => {
    console.log('Saving privacy settings:', settings);
    onEditToggle(false);
  };

  const handleCancel = () => {
    onEditToggle(false);
    setSettings({
      profileVisibility: 'public',
      allowDirectMessages: true,
      showOnlineStatus: true,
      allowTagging: true
    });
  };

  if (isEditing) {
    return (
      <div ref={sectionRef} id="privacy" className="space-y-6 scroll-mt-8">
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Privacy Settings</h2>
            <p className="text-sm text-gray-600">Control your privacy and data sharing preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Visibility</label>
            <select
              value={settings.profileVisibility}
              onChange={(e) => setSettings(prev => ({...prev, profileVisibility: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="friends">Friends Only</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-900">Allow Direct Messages</h3>
              <p className="text-sm text-gray-600">Allow others to send you direct messages</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({...prev, allowDirectMessages: !prev.allowDirectMessages}))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.allowDirectMessages ? 'bg-[#6C60FF]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.allowDirectMessages ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-900">Show Online Status</h3>
              <p className="text-sm text-gray-600">Let others see when you're online</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({...prev, showOnlineStatus: !prev.showOnlineStatus}))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.showOnlineStatus ? 'bg-[#6C60FF]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.showOnlineStatus ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-900">Allow Tagging</h3>
              <p className="text-sm text-gray-600">Allow others to tag you in campaigns</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({...prev, allowTagging: !prev.allowTagging}))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.allowTagging ? 'bg-[#6C60FF]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.allowTagging ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            onClick={handleSave}
            className="bg-[#6C60FF] text-white px-6 py-2 rounded-lg hover:bg-[#5A4FFF] transition-colors"
          >
            Save Changes
          </button>
          <button 
            onClick={handleCancel}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} id="privacy" className="space-y-6 scroll-mt-8">
      <div className="space-y-6">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Storage Actions</h3>
          <p className="text-sm text-gray-600 mb-6">Manage your data backup, recovery, and maintenance</p>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Export Data</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Import Data</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Recover Data</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Cleanup Old Data</span>
            </button>
            
            <button className="flex items-center gap-2 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm font-medium">Clear All Data</span>
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">Your data is automatically backed up before major operations. Export your data regularly to maintain additional backups.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Privacy Settings</h2>
            <p className="text-sm text-gray-600">Control your privacy and data sharing preferences</p>
          </div>
        </div>
        <button 
          onClick={() => onEditToggle(true)}
          className="px-4 py-2 text-[#6C60FF] hover:bg-[#6C60FF]/10 rounded-lg transition-colors"
        >
          Edit
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Profile Visibility:</span>
          <span className="bg-[#6C60FF] text-white px-3 py-1 rounded-full text-sm font-medium">public</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Direct Messages:</span>
          <span className="bg-[#6C60FF] text-white px-3 py-1 rounded-full text-sm font-medium">Allowed</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Online Status:</span>
          <span className="bg-[#6C60FF] text-white px-3 py-1 rounded-full text-sm font-medium">Visible</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Tagging:</span>
          <span className="bg-[#6C60FF] text-white px-3 py-1 rounded-full text-sm font-medium">Allowed</span>
        </div>
      </div>
    </div>
  );
}

function NotificationPreferences({ sectionRef, isEditing, onEditToggle }: {
  sectionRef: React.RefObject<HTMLDivElement>;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
}) {
  // Get user role from localStorage
  const getUserRole = () => {
    try {
      const storedUser = localStorage.getItem('stasht_user');
      console.log('stored user', storedUser);
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return user?.role;
      }
    } catch (error) {
      console.error('Error parsing stasht_user from localStorage:', error);
    }
    return null;
  };

  const userRole = getUserRole();

  console.log('user role profile page ', userRole);


  const [emailNotifications, setEmailNotifications] = useState({
    newMemories: true,
    comments: true
  });

  const [pushNotifications, setPushNotifications] = useState({
    newMemories: true,
    comments: true
  });

  const [moderationEnabled, setModerationEnabled] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load notification preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      console.log('🔍 dashboardAPI methods:', Object.keys(dashboardAPI));
      console.log('🔍 getNotificationPreferences exists:', typeof dashboardAPI.getNotificationPreferences);
      console.log('🔍 updateNotificationPreferences exists:', typeof dashboardAPI.updateNotificationPreferences);
      try {
        const response = await dashboardAPI.getNotificationPreferences();
        console.log('📩 Loaded notification preferences:', response);

        if (response.success && response.data) {
          // apiRequest returns the whole server payload as `data` (i.e. { status, data: {...} }),
          // it doesn't unwrap the inner `data` — so the real fields are one level deeper.
          const prefsData = (response.data as any)?.data || response.data;
          setEmailNotifications({
            newMemories: prefsData.email_notifications?.new_memories ?? true,
            comments: prefsData.email_notifications?.comments ?? true
          });
          setPushNotifications({
            newMemories: prefsData.push_notifications?.new_memories ?? true,
            comments: prefsData.push_notifications?.comments ?? true
          });
          setModerationEnabled(prefsData.moderation_enabled ?? true);
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const preferences = {
        email_notifications: {
          new_memories: emailNotifications.newMemories,
          comments: emailNotifications.comments
        },
        push_notifications: {
          new_memories: pushNotifications.newMemories,
          comments: pushNotifications.comments
        },
        moderation_enabled: moderationEnabled
      };

      const response = await dashboardAPI.updateNotificationPreferences(preferences);
      console.log('📩 Saved notification preferences:', response);

      if (response.success) {
        console.log('✅ Notification preferences saved successfully');

        // Trigger storage event to notify other tabs/windows of the change
        localStorage.setItem('moderation_preference_updated', Date.now().toString());
        console.log('📊 Triggered moderation preference update event');

        onEditToggle(false);
      } else {
        console.error('❌ Failed to save notification preferences:', response.error);
      }
    } catch (error) {
      console.error('❌ Error saving notification preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onEditToggle(false);
    // Reload preferences to reset any unsaved changes
    dashboardAPI.getNotificationPreferences().then(response => {
      if (response.success && response.data) {
        const prefsData = (response.data as any)?.data || response.data;
        setEmailNotifications({
          newMemories: prefsData.email_notifications?.new_memories ?? true,
          comments: prefsData.email_notifications?.comments ?? true
        });
        setPushNotifications({
          newMemories: prefsData.push_notifications?.new_memories ?? true,
          comments: prefsData.push_notifications?.comments ?? true
        });
        setModerationEnabled(prefsData.moderation_enabled ?? true);
      }
    });
  };

  if (isEditing) {
    return (
      <div ref={sectionRef} id="notifications" className="space-y-6 scroll-mt-8">
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v13.5m0 0l-3-3m3 3l3-3M3 3h6m6 0h6" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
            <p className="text-sm text-gray-600">Choose what notifications you want to receive</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">New Campaigns</span>
                <button
                  onClick={() => setEmailNotifications(prev => ({...prev, newMemories: !prev.newMemories}))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    emailNotifications.newMemories ? 'bg-[#6C60FF]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      emailNotifications.newMemories ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Comments</span>
                <button
                  onClick={() => setEmailNotifications(prev => ({...prev, comments: !prev.comments}))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    emailNotifications.comments ? 'bg-[#6C60FF]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      emailNotifications.comments ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Push Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">New Campaigns</span>
                <button
                  onClick={() => setPushNotifications(prev => ({...prev, newMemories: !prev.newMemories}))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    pushNotifications.newMemories ? 'bg-[#6C60FF]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pushNotifications.newMemories ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Comments</span>
                <button
                  onClick={() => setPushNotifications(prev => ({...prev, comments: !prev.comments}))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    pushNotifications.comments ? 'bg-[#6C60FF]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pushNotifications.comments ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Moderation Settings - Hidden for roles 3 & 4 */}
          {![3, '3', 4, '4'].includes(userRole) && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Moderation Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-700">Enable Moderation Tab</span>
                    <p className="text-sm text-gray-500 mt-1">Show or hide the moderation tab in your campaigns</p>
                  </div>
                  <button
                    onClick={() => setModerationEnabled(prev => !prev)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      moderationEnabled ? 'bg-[#6C60FF]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        moderationEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#6C60FF] text-white px-6 py-2 rounded-lg hover:bg-[#5A4FFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} id="notifications" className="space-y-6 scroll-mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v13.5m0 0l-3-3m3 3l3-3M3 3h6m6 0h6" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
            <p className="text-sm text-gray-600">Choose what notifications you want to receive</p>
          </div>
        </div>
        <button 
          onClick={() => onEditToggle(true)}
          className="px-4 py-2 text-[#6C60FF] hover:bg-[#6C60FF]/10 rounded-lg transition-colors"
        >
          Edit
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Email Notifications</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">New Campaigns:</span>
              <button
                onClick={() => setEmailNotifications(prev => ({...prev, newMemories: !prev.newMemories}))}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                  emailNotifications.newMemories
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                {emailNotifications.newMemories ? 'On' : 'Off'}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Comments:</span>
              <button
                onClick={() => setEmailNotifications(prev => ({...prev, comments: !prev.comments}))}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                  emailNotifications.comments
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                {emailNotifications.comments ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Push Notifications</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">New Campaigns:</span>
              <button
                onClick={() => setPushNotifications(prev => ({...prev, newMemories: !prev.newMemories}))}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                  pushNotifications.newMemories
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                {pushNotifications.newMemories ? 'On' : 'Off'}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Comments:</span>
              <button
                onClick={() => setPushNotifications(prev => ({...prev, comments: !prev.comments}))}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                  pushNotifications.comments
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                {pushNotifications.comments ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>

        {/* Moderation Settings - Hidden for roles 3 & 4 */}
        {![3, '3', 4, '4'].includes(userRole) && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Moderation Settings</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-700">Enable Moderation Tab:</span>
                  <p className="text-xs text-gray-500 mt-1">Show or hide the moderation tab in your campaigns</p>
                </div>
                <button
                  onClick={() => setModerationEnabled(prev => !prev)}
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                    moderationEnabled
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {moderationEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppPreferences({ sectionRef, isEditing, onEditToggle }: { 
  sectionRef: React.RefObject<HTMLDivElement>;
  isEditing: boolean;
  onEditToggle: (editing: boolean) => void;
}) {
  const [settings, setSettings] = useState({
    theme: 'Light',
    language: 'English (US)',
    dateFormat: 'MM/DD/YYYY',
    timezone: 'Eastern Time',
    autoSave: true,
    showTutorials: true
  });

  const handleSave = () => {
    console.log('Saving app preferences:', settings);
    onEditToggle(false);
  };

  const handleCancel = () => {
    onEditToggle(false);
    setSettings({
      theme: 'Light',
      language: 'English (US)',
      dateFormat: 'MM/DD/YYYY',
      timezone: 'Eastern Time',
      autoSave: true,
      showTutorials: true
    });
  };

  if (isEditing) {
    return (
      <div ref={sectionRef} id="preferences" className="space-y-6 scroll-mt-8">
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">App Preferences</h2>
            <p className="text-sm text-gray-600">Customize your app experience and preferences</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => setSettings(prev => ({...prev, theme: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            >
              <option value="Light">Light</option>
              <option value="Dark">Dark</option>
              <option value="Auto">Auto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={settings.language}
              onChange={(e) => setSettings(prev => ({...prev, language: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            >
              <option value="English (US)">English (US)</option>
              <option value="English (UK)">English (UK)</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
            <select
              value={settings.dateFormat}
              onChange={(e) => setSettings(prev => ({...prev, dateFormat: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings(prev => ({...prev, timezone: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C60FF] focus:border-[#6C60FF]"
            >
              <option value="Eastern Time">Eastern Time</option>
              <option value="Central Time">Central Time</option>
              <option value="Mountain Time">Mountain Time</option>
              <option value="Pacific Time">Pacific Time</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-900">Auto Save</h3>
              <p className="text-sm text-gray-600">Automatically save your changes</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({...prev, autoSave: !prev.autoSave}))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoSave ? 'bg-[#6C60FF]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoSave ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-900">Show Tutorials</h3>
              <p className="text-sm text-gray-600">Display helpful tutorials and tips</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({...prev, showTutorials: !prev.showTutorials}))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.showTutorials ? 'bg-[#6C60FF]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.showTutorials ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            onClick={handleSave}
            className="bg-[#6C60FF] text-white px-6 py-2 rounded-lg hover:bg-[#5A4FFF] transition-colors"
          >
            Save Changes
          </button>
          <button 
            onClick={handleCancel}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} id="preferences" className="space-y-6 scroll-mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-[#6C60FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">App Preferences</h2>
            <p className="text-sm text-gray-600">Customize your app experience and preferences</p>
          </div>
        </div>
        <button 
          onClick={() => onEditToggle(true)}
          className="px-4 py-2 text-[#6C60FF] hover:bg-[#6C60FF]/10 rounded-lg transition-colors"
        >
          Edit
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Theme:</span>
          <button className="bg-[#6C60FF] text-white px-4 py-1 rounded-full text-sm font-medium">
            {settings.theme}
          </button>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Language:</span>
          <button className="bg-[#6C60FF] text-white px-4 py-1 rounded-full text-sm font-medium">
            {settings.language}
          </button>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Date Format:</span>
          <button className="bg-[#6C60FF] text-white px-4 py-1 rounded-full text-sm font-medium">
            {settings.dateFormat}
          </button>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Auto Save:</span>
          <button className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
            settings.autoSave 
              ? 'bg-[#6C60FF] text-white' 
              : 'bg-gray-200 text-gray-600'
          }`}>
            {settings.autoSave ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveAccount({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement> }) {
  const { logout } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmation: ''
  });
  const [errors, setErrors] = useState({
    password: '',
    confirmation: '',
    general: ''
  });

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setFormData({ password: '', confirmation: '' });
    setErrors({ password: '', confirmation: '', general: '' });
  };

  const handleCloseModal = () => {
    if (!isDeleting) {
      setIsModalOpen(false);
      setFormData({ password: '', confirmation: '' });
      setErrors({ password: '', confirmation: '', general: '' });
    }
  };

  const validateForm = () => {
    const newErrors = { password: '', confirmation: '', general: '' };
    let isValid = true;

    if (!formData.password) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    if (!formData.confirmation) {
      newErrors.confirmation = 'Confirmation is required';
      isValid = false;
    } else if (formData.confirmation !== 'DELETE') {
      newErrors.confirmation = 'Please type DELETE to confirm';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleDeleteAccount = async () => {
    if (!validateForm()) {
      return;
    }

    setIsDeleting(true);
    setErrors({ password: '', confirmation: '', general: '' });

    try {
      const response = await authAPI.deleteAccount({
        password: formData.password,
        confirmation: formData.confirmation
      });

      if (response.success) {
        // Account deleted successfully, logout and redirect
        alert('Your account has been permanently deleted.');
        await logout();
        window.location.href = '/';
      } else {
        setErrors({
          ...errors,
          general: response.error || 'Failed to delete account. Please check your password and try again.'
        });
      }
    } catch (error) {
      setErrors({
        ...errors,
        general: 'An error occurred while deleting your account. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div ref={sectionRef} id="remove" className="space-y-6 scroll-mt-8">
      <div className="flex items-center gap-3">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h2 className="text-lg font-semibold text-red-600">Remove Account</h2>
          <p className="text-sm text-gray-600">Permanently delete your account and all associated data</p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-red-900 mb-1">Delete Account:</h4>
            <p className="text-sm text-red-700">This action cannot be undone. This will permanently delete your account and all associated data.</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleOpenModal}
        className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete Account
      </button>

      {/* Delete Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-600">Delete Account</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isDeleting}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 space-y-6">
              {/* Warning Message */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-900 mb-3">The following will be permanently deleted:</h4>
                <ul className="space-y-2 text-sm text-red-700">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>All photos and videos owned by the user are deleted from storage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>All campaigns created by the user are deleted</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>The user is removed from all collaborative campaigns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>The user's comments and captions are removed from shared content</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>AI metadata (face vectors, labels, captions) linked to the user is deleted</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>No media or campaign belonging to the user appears in search, feeds, or albums</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>Storage usage metrics reflect the deletion</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>The deleted user cannot log in or be recovered</span>
                  </li>
                </ul>
              </div>

              {/* Error Message */}
              {errors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{errors.general}</p>
                </div>
              )}

              {/* Password Field */}
              <div>
                <label htmlFor="delete-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your password to confirm
                </label>
                <input
                  id="delete-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isDeleting}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.password
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-[#6C60FF]'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {/* Confirmation Field */}
              <div>
                <label htmlFor="delete-confirmation" className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  id="delete-confirmation"
                  type="text"
                  value={formData.confirmation}
                  onChange={(e) => setFormData({ ...formData, confirmation: e.target.value })}
                  disabled={isDeleting}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.confirmation
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-[#6C60FF]'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  placeholder="Type DELETE"
                />
                {errors.confirmation && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmation}</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={handleCloseModal}
                disabled={isDeleting}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete Account Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileSettingsPage() {
  const { user, updateUser } = useAuth();
  const [activeSection, setActiveSection] = useState('personal');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  
  // Profile data state
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Fetch user profile data from API
  useEffect(() => {
    const fetchProfileData = async () => {
      if (user) {
        setIsLoadingProfile(true);
        try {
          const response = await dashboardAPI.getUserProfile();
          console.log('🔍 Profile data response:', response);

          // Also fetch storage overview to get plan_name
          const storageResponse = await dashboardAPI.getStorageOverview();
          console.log('🔍 Storage overview response:', storageResponse);

          if (response.success && response.data) {
            // Handle nested response structure: data.data.user
            let userData = response.data?.data?.user || response.data?.user || response.data;

            // Add plan_name from storage overview if not already present
            if (!userData.plan_name && storageResponse?.success && storageResponse.data?.data?.storage_overview) {
              const overview = storageResponse.data.data.storage_overview;
              userData = {
                ...userData,
                plan_name: overview.plan_name
              };
            }

            setProfileData(userData);
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    fetchProfileData();
  }, [user]);
  
  // Force component to re-render when user data changes
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (user) {
      setRefreshKey(prev => prev + 1);
    }
  }, [user?.name, user?.email, user?.avatar, user?.profile_image]);

  // Auto-open Account Security section when redirected for password change
  useEffect(() => {
    const tempPassword = sessionStorage.getItem('temp_current_password');

    // Also check if user object has change_password flag set
    const storedUser = localStorage.getItem('stasht_user');
    let userNeedsPasswordChange = false;

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        userNeedsPasswordChange = user.change_password === 1;
        console.log('🔍 ProfileSettingsPage - user.change_password:', user.change_password);
      } catch (e) {
        console.error('Failed to parse user object:', e);
      }
    }

    console.log('🔍 ProfileSettingsPage - temp password check:', tempPassword);
    console.log('🔍 ProfileSettingsPage - userNeedsPasswordChange:', userNeedsPasswordChange);

    if (tempPassword || userNeedsPasswordChange) {
      console.log('🔑 Auto-opening security section and edit mode');
      setActiveSection('security');
      setEditingSection('security');
      console.log('🔍 Set activeSection to security and editingSection to security');
      // DON'T clear the temporary password here - AccountSecurity component needs to read it first
      // It will be cleared after AccountSecurity component has auto-filled the password
    }
  }, []);

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 ProfileSettingsPage state update - activeSection:', activeSection, 'editingSection:', editingSection);
  }, [activeSection, editingSection]);

  // Create refs for each section
  const personalRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const storageRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const privacyRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const removeRef = useRef<HTMLDivElement>(null);

  const sectionRefs = {
    personal: personalRef,
    security: securityRef,
    storage: storageRef,
    categories: categoriesRef,
    privacy: privacyRef,
    notifications: notificationsRef,
    preferences: preferencesRef,
    remove: removeRef,
  };


  const scrollToSection = (sectionId: string) => {
    const ref = sectionRefs[sectionId as keyof typeof sectionRefs];
    if (ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
      setActiveSection(sectionId);
    }
  };

  const sections: SettingsSection[] = [
    {
      id: 'personal',
      name: 'Personal Information',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <circle cx="12" cy="12" r="10" strokeWidth={2}/>
          <circle cx="12" cy="8" r="3" strokeWidth={2}/>
          <path d="M6.168 18.849A6 6 0 0 1 12 16a6 6 0 0 1 5.832 2.849" strokeWidth={2} strokeLinecap="round"/>
        </svg>
      )
    },
    {
      id: 'security',
      name: 'Account Security',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'storage',
      name: 'Storage Management',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      )
    },
    {
      id: 'categories',
      name: 'Categories',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      id: 'privacy',
      name: 'Privacy Settings',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    {
      id: 'notifications',
      name: 'Notification Preferences',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v13.5m0 0l-3-3m3 3l3-3M3 3h6m6 0h6" />
        </svg>
      )
    },
    {
      id: 'preferences',
      name: 'App Preferences',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'remove',
      name: 'Remove Account',
      isDangerous: true,
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    }
  ];

  const renderAllSections = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <PersonalInformation 
            key={`personal-${refreshKey}`}
            user={user} 
            profileData={profileData}
            isLoadingProfile={isLoadingProfile}
            sectionRef={personalRef} 
            isEditing={editingSection === 'personal'}
            onEditToggle={(editing) => setEditingSection(editing ? 'personal' : null)}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <AccountSecurity
            sectionRef={securityRef}
            isEditing={editingSection === 'security'}
            onEditToggle={(editing) => setEditingSection(editing ? 'security' : null)}
            updateUser={updateUser}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <StorageManagement sectionRef={storageRef} />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <CategoriesSettings sectionRef={categoriesRef} />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hidden">
          <PrivacySettings
            sectionRef={privacyRef}
            isEditing={editingSection === 'privacy'}
            onEditToggle={(editing) => setEditingSection(editing ? 'privacy' : null)}
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <NotificationPreferences
            sectionRef={notificationsRef}
            isEditing={editingSection === 'notifications'}
            onEditToggle={(editing) => setEditingSection(editing ? 'notifications' : null)}
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hidden">
          <AppPreferences
            sectionRef={preferencesRef}
            isEditing={editingSection === 'preferences'}
            onEditToggle={(editing) => setEditingSection(editing ? 'preferences' : null)}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <RemoveAccount sectionRef={removeRef} />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Header with Done Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>
        {/* <button 
          onClick={() => window.history.back()}
          className="bg-[#6C60FF] text-white px-6 py-2 rounded-lg hover:bg-[#5A4FFF] transition-colors"
        >
          Done
        </button> */}
      </div>

      {/* Security Warning Banner - Show when user needs to change password */}
      {user?.change_password === 1 && (
        <div className="mb-4 md:mb-6 bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 rounded-lg p-4 md:p-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
            {/* Icon - Hidden on mobile for cleaner look */}
            <div className="hidden md:block flex-shrink-0">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-orange-900 mb-2 flex items-center gap-2">
                <span className="text-xl md:hidden">⚠️</span>
                <span>Password Change Required</span>
              </h3>
              <p className="text-sm md:text-base text-orange-800 mb-3">
                For security reasons, you must change your temporary password before using the website.
                Please scroll down to the <strong>Account Security</strong> section below to set a new permanent password.
              </p>
              <div className="flex items-start gap-2 text-xs md:text-sm text-orange-700 bg-orange-100/50 p-2 rounded">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Your current password field has been pre-filled. Just enter your new password.</span>
              </div>
            </div>

            {/* Button - Full width on mobile, auto width on desktop */}
            <button
              onClick={() => {
                setActiveSection('security');
                setEditingSection('security');
                // Scroll to security section
                const securitySection = document.getElementById('security');
                if (securitySection) {
                  securitySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className="w-full md:w-auto md:flex-shrink-0 px-4 py-2.5 md:py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-sm md:text-base font-medium rounded-lg transition-colors"
            >
              Change Password Now
            </button>
          </div>
        </div>
      )}

      {/* Content Sections */}
      {renderAllSections()}
    </div>
  );
}