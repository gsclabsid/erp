import { isDemoMode, getDemoUsers } from "@/lib/demo";
import { createPasswordHash } from "@/services/auth";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";
import { api } from "@/lib/api";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  phone: string | null;
  last_login: string | null;
  status: string;
  avatar_url: string | null;
  must_change_password?: boolean;
  password_changed_at?: string | null;
  active_session_id?: string | null;
  password_hash?: string | null;
};

const table = "app_users";
const USERS_CACHE_KEY = "users:list";
const USERS_CACHE_TTL = 30_000;

export async function listUsers(options?: { force?: boolean }): Promise<AppUser[]> {
  if (isDemoMode()) return getDemoUsers() as any;
  try {
    return await getCachedValue(
      USERS_CACHE_KEY,
      async () => {
        return await api.get<AppUser[]>('/users');
      },
      { ttlMs: USERS_CACHE_TTL, force: options?.force }
    );
  } catch {
    return [];
  }
}

// Optionally accept a password for local fallback; DB uses auth for real password handling
export async function createUser(payload: Omit<AppUser, "id"> & { password?: string }): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const { password, ...dbPayload } = payload as any;
  
  // Ensure role is lowercase
  if (dbPayload.role) {
    dbPayload.role = dbPayload.role.toLowerCase();
  }
  
  const hashed = password ? await createPasswordHash(password) : null;
  const insertPayload: any = {
    ...dbPayload,
    password_hash: hashed,
  };
  if (hashed) {
    insertPayload.password_changed_at = dbPayload?.password_changed_at ?? new Date().toISOString();
  }
  
  const user = await api.post<AppUser>('/users', insertPayload);
  invalidateCacheByPrefix(USERS_CACHE_KEY);
  return user;
}

export async function updateUser(id: string, patch: Partial<AppUser>): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const user = await api.put<AppUser>(`/users/${id}`, patch);
  invalidateCacheByPrefix(USERS_CACHE_KEY);
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  await api.delete(`/users/${id}`);
  invalidateCacheByPrefix(USERS_CACHE_KEY);
}
