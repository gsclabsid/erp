import { isDemoMode } from "@/lib/demo";
import { api } from "@/lib/api";

export type PageKey = 'assets' | 'properties' | 'qrcodes' | 'users' | 'reports' | 'settings' | 'audit';

export type UserPermission = {
  id?: string;
  user_id: string;
  page: PageKey;
  can_view: boolean;
  can_edit: boolean;
};

const TABLE = 'user_permissions';
const LS_KEY = 'user_permissions'; // { [userId]: { [page]: { v: boolean, e: boolean } } }
const CURRENT_USER_KEY = 'current_user_id';

type LocalPermMap = Record<string, Record<PageKey, { v: boolean; e: boolean }>>;

function readLocal(): LocalPermMap {
  try {
    const key = isDemoMode() ? 'demo_user_permissions' : LS_KEY;
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch { return {}; }
}
function writeLocal(data: LocalPermMap) {
  try {
    const key = isDemoMode() ? 'demo_user_permissions' : LS_KEY;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function getCurrentUserId(): string | null {
  try {
    const key = isDemoMode() ? 'demo_current_user_id' : CURRENT_USER_KEY;
    return localStorage.getItem(key);
  } catch { return null; }
}

export async function listUserPermissions(userId: string): Promise<Record<PageKey, { v: boolean; e: boolean }>> {
  if (!userId) return {} as any;
  
  try {
    const permissions = await api.get<UserPermission[]>(`/user-permissions?userId=${userId}`);
    const map: LocalPermMap = {};
    map[userId] = {} as Record<PageKey, { v: boolean; e: boolean }>;
    permissions.forEach((p: any) => {
      const page = (p.page || p.page_key) as PageKey;
      if (page) {
        map[userId][page] = {
          v: p.can_view || p.canView || false,
          e: p.can_edit || p.canEdit || false,
        };
      }
    });
    // Cache in localStorage
    const localMap = readLocal();
    localMap[userId] = map[userId];
    writeLocal(localMap);
    return map[userId];
  } catch (error) {
    console.warn("Failed to load user permissions from API, using localStorage", error);
    const map = readLocal();
    return (map[userId] || {}) as any;
  }
}

export async function setUserPermissions(userId: string, perms: Record<PageKey, { v?: boolean; e?: boolean }>): Promise<void> {
  if (!userId) return;
  
  const map = readLocal();
  const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
  (Object.keys(perms) as PageKey[]).forEach((p) => {
    const existing = cur[p] || { v: false, e: false };
    const next = { v: perms[p].v ?? existing.v, e: perms[p].e ?? existing.e };
    cur[p] = next;
  });
  
  try {
    const permissions = Object.entries(cur).map(([page, { v, e }]) => ({
      page: page as PageKey,
      v,
      e,
    }));
    await api.post('/user-permissions', {
      userId,
      permissions,
    });
    // Update local cache
    map[userId] = cur;
    writeLocal(map);
  } catch (error) {
    console.warn("Failed to save user permissions to API, using localStorage", error);
    // Fallback to localStorage
    map[userId] = cur;
    writeLocal(map);
  }
}

export async function canUserView(userId: string, page: PageKey): Promise<boolean | null> {
  const perms = await listUserPermissions(userId);
  if (!(page in perms)) return null;
  return !!perms[page]?.v;
}

export async function canUserEdit(userId: string, page: PageKey): Promise<boolean | null> {
  const perms = await listUserPermissions(userId);
  if (!(page in perms)) return null;
  return !!perms[page]?.e;
}

// Role-based defaults. Dashboard and Scan QR are always visible and not part of PageKey.
export function roleDefaults(roleRaw?: string): Record<PageKey, { v: boolean; e: boolean }> {
  const role = (roleRaw || '').toLowerCase();
  const base: Record<PageKey, { v: boolean; e: boolean }> = {
    assets: { v: false, e: false },
    properties: { v: false, e: false },
    qrcodes: { v: false, e: false },
    users: { v: false, e: false },
    reports: { v: false, e: false },
    settings: { v: false, e: false },
    audit: { v: false, e: false },
  };
  if (role === 'admin') {
    (Object.keys(base) as Array<keyof typeof base>).forEach((k) => {
      base[k] = { v: true, e: true };
    });
  } else if (role === 'manager') {
  base.assets = { v: true, e: true };
  base.properties = { v: true, e: true };
  base.qrcodes = { v: true, e: true };
  base.reports = { v: true, e: false };
  base.settings = { v: true, e: false };
  // Audit visibility for managers is handled by runtime conditions (active session/reports),
  // not by defaults. Admins can grant explicit audit perms via overrides.
    // users remains false by default, but can be elevated via overrides
  } else {
    // user
  base.assets = { v: true, e: true };
  base.qrcodes = { v: true, e: true };
  base.settings = { v: true, e: false };
  }
  return base;
}

export function mergeDefaultsWithOverrides(roleRaw: string | undefined, overrides: Record<PageKey, { v: boolean; e: boolean }>): Record<PageKey, { v: boolean; e: boolean }>{
  const d = roleDefaults(roleRaw);
  const out: Record<PageKey, { v: boolean; e: boolean }> = { ...d };
  (Object.keys(overrides) as PageKey[]).forEach((k) => {
    out[k] = {
      v: overrides[k].v ?? d[k].v,
      e: overrides[k].e ?? d[k].e,
    };
  });
  return out;
}
