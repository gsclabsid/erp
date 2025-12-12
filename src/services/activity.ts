import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId } from "@/services/permissions";

export type Activity = {
  id: number;
  type: string;
  message: string;
  user_name: string | null;
  created_at: string;
};


// Demo-mode local storage helpers
const DEMO_LS_KEY = "demo_recent_activity";

function loadDemoActivity(): Activity[] {
  try {
    const raw = localStorage.getItem(DEMO_LS_KEY);
    const parsed: Activity[] = raw ? JSON.parse(raw) : [];
    if (parsed.length === 0) {
      // Seed a handful of today activities
      const now = new Date();
      const base: Activity[] = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        type: ["system", "asset_created", "qr_generated", "report"][i % 4],
        message:
          i % 4 === 1
            ? `Created demo asset AST-${String(100 + i)}`
            : i % 4 === 2
            ? `Generated QR codes for Property ${((i % 5) + 1).toString().padStart(3, "0")}`
            : i % 4 === 3
            ? `Report export completed`
            : "Welcome to SAMS Demo",
        user_name: i % 3 === 0 ? "Admin" : i % 3 === 1 ? "Manager" : "System",
        created_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + i, (i * 7) % 60, 0).toISOString(),
      }));
      saveDemoActivity(base);
      return base;
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveDemoActivity(list: Activity[]) {
  try {
    localStorage.setItem(DEMO_LS_KEY, JSON.stringify(list));
  } catch {}
}

export async function listActivity(limit = 20): Promise<Activity[]> {
  if (isDemoMode()) {
    const data = loadDemoActivity()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
    return data;
  }
  return [];
}

export async function logActivity(type: string, message: string, user_name?: string | null) {
  // Derive a sensible default actor label when not explicitly provided
  let derivedName: string | null = null;
  try {
    const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
    if (raw) {
      const u = JSON.parse(raw);
      derivedName = u?.name || u?.email || u?.id || null;
    }
  } catch {}
  if (isDemoMode()) {
    const list = loadDemoActivity();
    const next: Activity = {
      id: (list[0]?.id ?? 0) + 1,
      type,
      message,
      user_name: (user_name ?? derivedName) ?? null,
      created_at: new Date().toISOString(),
    };
    saveDemoActivity([next, ...list]);
    return;
  }
  // Activity logging not yet implemented with PostgreSQL API
}

export function subscribeActivity(onInsert: (a: Activity) => void) {
  if (isDemoMode()) {
    // No realtime; optional polling could be added. Return no-op unsubscribe.
    return () => {};
  }
  // Activity subscriptions not yet implemented with PostgreSQL API
  return () => {};
}
