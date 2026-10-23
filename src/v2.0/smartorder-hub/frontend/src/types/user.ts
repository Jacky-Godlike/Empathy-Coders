export type UserRole = 'owner' | 'staff';

export interface CurrentUser {
  role: UserRole;
  name: string;
}

export const USER_OPTIONS: CurrentUser[] = [
  { role: 'owner', name: 'Demo Owner' },
  { role: 'staff', name: 'Demo Staff' },
];

export function canApproveOrders(user: CurrentUser): boolean {
  return user.role === 'owner';
}

export function loadStoredUser(): CurrentUser {
  try {
    const raw = window.localStorage.getItem('smartorderhub.currentUser');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CurrentUser>;
      const match = USER_OPTIONS.find(
        (option) => option.role === parsed.role && option.name === parsed.name
      );
      if (match) return match;
    }
  } catch {
    // localStorage can be unavailable in private mode; fall back to the owner.
  }
  return USER_OPTIONS[0];
}
