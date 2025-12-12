import { api } from "@/lib/api";

const LS_KEY = "user_dept_access"; // { [userId: string]: string[] of department names }
const CURRENT_USER_KEY = "current_user_id";

export type UserDepartmentAccess = {
  id: string;
  user_id: string;
  department: string; // department name (normalized text)
  created_at?: string;
};

function readLocal(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLocal(data: Record<string, string[]>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export async function listUserDepartmentAccess(userId: string): Promise<string[]> {
  if (!userId) return [];
  
  try {
    const departments = await api.get<string[]>(`/user-department-access?userId=${userId}`);
    // Cache in localStorage
    const map = readLocal();
    map[userId] = departments;
    writeLocal(map);
    return departments;
  } catch (error) {
    console.warn("Failed to load user department access from API, using localStorage", error);
    const map = readLocal();
    return map[userId] || [];
  }
}

export async function setUserDepartmentAccess(userId: string, departments: string[]): Promise<{ savedRemotely: boolean }> {
  if (!userId) return { savedRemotely: false };
  const list = Array.from(new Set(departments.map(d => (d || '').trim()).filter(Boolean)));
  
  try {
    await api.post('/user-department-access', {
      userId,
      departments: list,
    });
    // Update local cache
    const map = readLocal();
    map[userId] = list;
    writeLocal(map);
    return { savedRemotely: true };
  } catch (error) {
    console.warn("Failed to save user department access to API, using localStorage", error);
    // Fallback to localStorage
    const map = readLocal();
    map[userId] = list;
    writeLocal(map);
    return { savedRemotely: false };
  }
}

export async function getAccessibleDepartmentsForCurrentUser(): Promise<Set<string>> {
  try {
    const uid = localStorage.getItem(CURRENT_USER_KEY);
    if (!uid) return new Set();
    const depts = await listUserDepartmentAccess(uid);
    return new Set(depts.map(d => d.toString()));
  } catch {
    return new Set();
  }
}
