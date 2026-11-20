// components/products/ProductBrandThumb.tsx — a small product thumbnail for a product with no photo (Chris 20 Nov 2026,
// point 17: "If you don't add a custom cover photo, it should use the avatar"): the account's avatar / logo, else its
// initials on its profile colour — the Avatar every author row uses. A shared product (a salesperson's External view)
// shows its owner's. Big covers use MemoryCard's UserFallbackAvatar (the campaign brand cover) instead.
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAuth } from '../../contexts/AuthContext';
import { userDisplayUtils } from '../../utils/authUtils';

export interface BrandOwner { name: string | null; profile_image: string | null; profile_color: string | null }

export default function ProductBrandThumb({ owner, className = '' }: { owner?: BrandOwner | null; className?: string }) {
  const { user } = useAuth();
  const name = (owner ? owner.name : user?.name) || '';
  const avatar = (owner ? owner.profile_image : user?.avatar) || undefined;
  const color = userDisplayUtils.formatProfileColor((owner ? owner.profile_color : user?.profile_color) || undefined) || '#6C60FF';
  return (
    <Avatar data-testid="product-brand-thumb" className={`h-full w-full rounded-md ${className}`}>
      {avatar && <AvatarImage src={avatar} alt="" className="object-cover" />}
      <AvatarFallback className="rounded-md text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {userDisplayUtils.generateInitials(name) || '•'}
      </AvatarFallback>
    </Avatar>
  );
}
