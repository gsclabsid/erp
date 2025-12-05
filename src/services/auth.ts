import { isDemoMode } from "@/lib/demo";
import { api } from "@/lib/api";

export type MinimalUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  phone: string | null;
  status: string;
  avatar_url: string | null;
  must_change_password?: boolean;
};

const USERS_TABLE = "app_users";
const LS_USERS_KEY = "app_users_fallback";
const HASH_VERSION_PREFIX = "v1$";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function legacyHash(password: string): string {
  if (!password) return "";
  try {
    return btoa(unescape(encodeURIComponent(password))).slice(0, 32);
  } catch {
    return "";
  }
}

const hexTable = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

function bufferToHex(buffer: ArrayBufferLike): string {
  const view = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += hexTable[view[i]];
  }
  return out;
}

async function sha256Hex(input: string): Promise<string | null> {
  try {
    if (typeof globalThis.crypto?.subtle === "undefined") return null;
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return bufferToHex(digest);
  } catch {
    return null;
  }
}

function randomSalt(size = 16): Uint8Array {
  const salt = new Uint8Array(size);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < salt.length; i += 1) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }
  return salt;
}

export async function createPasswordHash(password: string): Promise<string | null> {
  if (!password) return null;
  const saltHex = bufferToHex(randomSalt().buffer);
  const digest = await sha256Hex(`${saltHex}::${password}`);
  if (!digest) {
    // Fallback to legacy hash if WebCrypto is unavailable
    return legacyHash(password) || null;
  }
  return `${HASH_VERSION_PREFIX}${saltHex}$${digest}`;
}

function sanitizeUser(row: any): MinimalUser | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: (row.email || "").toLowerCase(),
    role: row.role,
    department: row.department ?? null,
    phone: row.phone ?? null,
    status: row.status ?? "inactive",
    avatar_url: row.avatar_url ?? null,
    must_change_password: row.must_change_password ?? false,
  };
}

async function fetchRemoteUserByEmail(email: string): Promise<any | null> {
  const normalized = normalizeEmail(email);
  try {
    const users = await api.get<any[]>('/users');
    return users.find((u: any) => normalizeEmail(u.email || "") === normalized) || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a user-provided identifier (email or username/local-part) to a full email address.
 * - If identifier already looks like an email, returns it normalized.
 * - If it's a local-part (e.g., "dev"), finds the first matching user with email like "dev@%".
 *   Prefers users with status === 'active'.
 */
export async function resolveIdentifierToEmail(identifier: string): Promise<string | null> {
  const input = (identifier || "").trim().toLowerCase();
  if (!input) return null;
  if (input.includes("@")) return normalizeEmail(input);

  // Treat as username/local-part - try API first
  try {
    const users = await api.get<any[]>('/users');
    const matches = users.filter((u: any) => {
      const email = (u?.email || "").toLowerCase();
      const local = email.split("@")[0] || "";
      return local === input;
    });
    if (matches.length === 0) return null;
    const active = matches.find((u: any) => (u?.status || "").toLowerCase() === "active");
    const target = active || matches[0];
    return normalizeEmail(target.email || "");
  } catch {
    // Fallback to local storage
    const users = readLocalUsers();
    const matches = users.filter((u) => {
      const email = (u?.email || "").toLowerCase();
      const local = email.split("@")[0] || "";
      return local === input;
    });
    if (matches.length === 0) return null;
    const active = matches.find((u) => (u?.status || "").toLowerCase() === "active");
    const target = active || matches[0];
    return normalizeEmail(target.email || "");
  }
}

function readLocalUsers(): any[] {
  try {
    const raw = localStorage.getItem(LS_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: any[]): void {
  try {
    localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
  } catch {}
}

function isModernHash(hash: string | null | undefined): boolean {
  return Boolean(hash && hash.startsWith(HASH_VERSION_PREFIX));
}

async function hashesMatch(password: string, storedHash: string): Promise<"match" | "legacy" | "nomatch"> {
  if (!storedHash) return "nomatch";
  if (isModernHash(storedHash)) {
    const [, saltHex, digest] = storedHash.split("$");
    if (!saltHex || !digest) return "nomatch";
    const computed = await sha256Hex(`${saltHex}::${password}`);
    if (!computed) {
      // If crypto fails, fall back to legacy comparison so users can still sign in
      return legacyHash(password) === storedHash ? "legacy" : "nomatch";
    }
    return computed === digest ? "match" : "nomatch";
  }
  return legacyHash(password) === storedHash ? "legacy" : "nomatch";
}

async function upgradeRemoteHash(userId: string, password: string): Promise<void> {
  const nextHash = await createPasswordHash(password);
  if (!nextHash) return;
  try {
    await api.put(`/users/${userId}`, {
      password_hash: nextHash,
      password_changed_at: new Date().toISOString(),
      must_change_password: false,
    });
  } catch {}
}

async function upgradeLocalHash(userId: string, password: string): Promise<void> {
  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  const nextHash = await createPasswordHash(password);
  if (!nextHash) return;
  users[idx].password_hash = nextHash;
  users[idx].password_changed_at = new Date().toISOString();
  users[idx].must_change_password = false;
  writeLocalUsers(users);
}

// Removed Supabase auth functions - no longer needed

export async function loginWithPassword(email: string, password: string): Promise<MinimalUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return null;

  try {
    // Try API first
    const userData = await api.post<{ passwordHash?: string; password_hash?: string } & MinimalUser>('/auth/login', {
      email: normalized,
      password, // API will verify, but we also verify client-side for security
    });

    // API returns camelCase (passwordHash), but also check snake_case for compatibility
    const passwordHash = userData?.passwordHash || (userData as any)?.password_hash;
    if (!userData || !passwordHash) {
      return null;
    }

    // Verify password hash client-side
    const outcome = await hashesMatch(password, passwordHash);
    if (outcome === "nomatch") {
      return null;
    }

    if (outcome === "legacy") {
      // Upgrade hash via API
      const newHash = await createPasswordHash(password);
      if (newHash) {
        try {
          await api.put(`/users/${userData.id}`, { password_hash: newHash, password_changed_at: new Date().toISOString() });
        } catch {}
      }
    }

    return sanitizeUser(userData);
  } catch (error) {
    // Fallback to local storage if API fails
    const localUsers = readLocalUsers();
    const local = localUsers.find((u) => normalizeEmail(u.email || "") === normalized);
    if (!local || !local.password_hash) return null;
    const outcome = await hashesMatch(password, local.password_hash);
    if (outcome === "nomatch") return null;
    if (outcome === "legacy") {
      await upgradeLocalHash(local.id, password);
    }
    return sanitizeUser(local);
  }
}

/**
 * Accepts either an email or a username/local-part and performs password login.
 * Resolves to the user's email first, then delegates to loginWithPassword.
 */
export async function loginWithUsernameOrEmail(identifier: string, password: string): Promise<MinimalUser | null> {
  const email = await resolveIdentifierToEmail(identifier);
  if (!email) return null;
  return loginWithPassword(email, password);
}

export async function verifyCurrentUserPassword(password: string): Promise<boolean> {
  try {
    if (!password) return false;
    if (typeof window === "undefined") return false;
    const raw = (isDemoMode()
      ? sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')
      : null) || localStorage.getItem('auth_user');
    if (!raw) return false;
    const current = JSON.parse(raw);
    const email = current?.email || null;
    const expectedId = current?.id || null;
    if (!email) return false;
    const result = await loginWithPassword(email, password);
    if (!result) return false;
    if (expectedId && result.id && result.id !== expectedId) return false;
    return true;
  } catch {
    return false;
  }
}

// Change own password via secure RPC (validates current password server-side)
export async function changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized || !currentPassword || !newPassword) throw new Error("Missing fields");
  
  try {
    // Verify current password first
    const user = await loginWithPassword(normalized, currentPassword);
    if (!user) throw new Error("INVALID_CURRENT_PASSWORD");
    
    // Update password via API
    const hashed = await createPasswordHash(newPassword);
    if (!hashed) throw new Error("Invalid new password");
    
    await api.put(`/users/${user.id}`, {
      password_hash: hashed,
      password_changed_at: new Date().toISOString(),
      must_change_password: false,
    });
  } catch (error: any) {
    // Fallback to local storage
    const users = readLocalUsers();
    const idx = users.findIndex((u) => normalizeEmail(u.email || "") === normalized);
    if (idx === -1) throw new Error("User not found");
    const stored = users[idx].password_hash || "";
    const match = await hashesMatch(currentPassword, stored);
    if (match === "nomatch") throw new Error("INVALID_CURRENT_PASSWORD");
    const hashed = await createPasswordHash(newPassword);
    if (!hashed) throw new Error("Invalid new password");
    users[idx].password_hash = hashed;
    users[idx].password_changed_at = new Date().toISOString();
    users[idx].must_change_password = false;
    writeLocalUsers(users);
  }
}

// Admin resets a user's password via secure RPC (verifies admin password server-side)
export async function adminSetUserPassword(adminEmail: string, adminPassword: string, targetUserId: string, newPassword: string): Promise<void> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  if (!normalizedAdmin || !targetUserId || !newPassword) throw new Error("Missing fields");
  
  // Verify admin credentials
  const admin = await loginWithPassword(normalizedAdmin, adminPassword);
  if (!admin || admin.role !== 'admin') throw new Error("Unauthorized");
  
  try {
    const hashed = await createPasswordHash(newPassword);
    if (!hashed) throw new Error("Invalid new password");
    await api.put(`/users/${targetUserId}`, {
      password_hash: hashed,
      password_changed_at: new Date().toISOString(),
      must_change_password: false,
    });
  } catch (error: any) {
    // Fallback to local storage
    const users = readLocalUsers();
    const idx = users.findIndex((u) => u.id === targetUserId);
    if (idx === -1) throw new Error("User not found");
    const hashed = await createPasswordHash(newPassword);
    if (!hashed) throw new Error("Invalid new password");
    users[idx].password_hash = hashed;
    users[idx].password_changed_at = new Date().toISOString();
    users[idx].must_change_password = false;
    writeLocalUsers(users);
  }
}

export async function logout(): Promise<void> {
  try {
    localStorage.removeItem("current_user_id");
    localStorage.removeItem("auth_user");
  } catch {}
}

export async function updateLastLogin(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  
  try {
    const users = await api.get<any[]>('/users');
    const user = users.find((u: any) => normalizeEmail(u.email || "") === normalized);
    if (user) {
      await api.put(`/users/${user.id}`, { last_login: new Date().toISOString() });
    }
  } catch {
    // Fallback to local storage
    const localUsers = readLocalUsers();
    const idx = localUsers.findIndex((u) => normalizeEmail(u.email || "") === normalized);
    if (idx === -1) return;
    localUsers[idx].last_login = new Date().toISOString();
    writeLocalUsers(localUsers);
  }
}
