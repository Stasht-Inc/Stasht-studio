/**
 * Whether the signed-in user can manage the current property's Contact Us widgets: its creator,
 * owner or admins (Chris, 2026-09-28). The API checks the same thing, so this only decides what
 * Studio shows. The user_id check covers property selections stored before user_role was kept.
 */
export function canManagePropertyWidgets(
  property: { user_role?: string; is_creator?: boolean; user_id?: number } | null,
  user: unknown,
): boolean {
  if (!property) return false;
  if (property.is_creator) return true;
  if (property.user_role === 'owner' || property.user_role === 'admin') return true;
  const me = Number((user as { external_user_id?: number | string } | null)?.external_user_id);
  return Number.isFinite(me) && me > 0 && Number(property.user_id) === me;
}
