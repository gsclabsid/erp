import { api } from "@/lib/api";

const TABLE = "user_property_access";
const LS_KEY = "user_access"; // { [userId: string]: string[] }
const CURRENT_USER_KEY = "current_user_id";

export type UserPropertyAccess = {
  id: string;
  user_id: string;
  property_id: string;
  created_at?: string;
};

function readLocal(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLocal(data: Record<string, string[]>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export async function listUserPropertyAccess(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const result = await api.get<Array<{ property_id: string }>>(`/user-property-access?userId=${userId}`);
    const propertyIds = result.map((r: any) => r.property_id || r.propertyId);
    // Cache in localStorage
    const map = readLocal();
    map[userId] = propertyIds;
    writeLocal(map);
    return propertyIds;
  } catch (error) {
    console.warn("Failed to load user property access from API, using localStorage", error);
    const map = readLocal();
    return map[userId] || [];
  }
}

export async function setUserPropertyAccess(userId: string, propertyIds: string[]): Promise<void> {
  if (!userId) return;
  try {
    await api.post('/user-property-access', {
      userId,
      propertyIds: Array.from(new Set(propertyIds)),
    });
    // Update local cache
    const map = readLocal();
    map[userId] = Array.from(new Set(propertyIds));
    writeLocal(map);
  } catch (error) {
    console.warn("Failed to save user property access to API, using localStorage", error);
    // Fallback to localStorage
    const map = readLocal();
    map[userId] = Array.from(new Set(propertyIds));
    writeLocal(map);
  }
}

export async function grantUserProperty(userId: string, propertyId: string): Promise<void> {
  if (!userId || !propertyId) return;
  try {
    const current = await listUserPropertyAccess(userId);
    if (!current.includes(propertyId)) {
      await setUserPropertyAccess(userId, [...current, propertyId]);
    }
  } catch (error) {
    console.warn("Failed to grant user property access via API, using localStorage", error);
    // Fallback to localStorage
    const map = readLocal();
    const arr = new Set(map[userId] || []);
    arr.add(propertyId);
    map[userId] = Array.from(arr);
    writeLocal(map);
  }
}

export async function revokeUserProperty(userId: string, propertyId: string): Promise<void> {
  if (!userId || !propertyId) return;
  try {
    await api.delete(`/user-property-access?userId=${userId}&propertyId=${propertyId}`);
    // Update local cache
    const map = readLocal();
    const arr = new Set(map[userId] || []);
    arr.delete(propertyId);
    map[userId] = Array.from(arr);
    writeLocal(map);
  } catch (error) {
    console.warn("Failed to revoke user property access via API, using localStorage", error);
    // Fallback to localStorage
    const map = readLocal();
    const arr = new Set(map[userId] || []);
    arr.delete(propertyId);
    map[userId] = Array.from(arr);
    writeLocal(map);
  }
}

export async function getAccessiblePropertyIdsForCurrentUser(): Promise<Set<string>> {
  try {
    const uid = localStorage.getItem(CURRENT_USER_KEY);
    if (!uid) return new Set();
    const props = await listUserPropertyAccess(uid);
    return new Set(props);
  } catch {
    return new Set();
  }
}

export function setCurrentUserIdLocal(userId: string | null) {
  try {
    if (userId) localStorage.setItem(CURRENT_USER_KEY, userId);
    else localStorage.removeItem(CURRENT_USER_KEY);
  } catch {}
}
