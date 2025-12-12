import { playNotificationSound } from "@/lib/sound";
import { api } from "@/lib/api";
import { getCurrentUserId } from "@/services/permissions";
import { listUsers } from "@/services/users";

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: string; // e.g., report, qr, system
  read: boolean;
  created_at: string; // ISO
  user_id?: string | null;
};

const LS_KEY = "notifications";

function loadLocal(): Notification[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) as Notification[] : [];
  } catch {
    return [];
  }
}

function saveLocal(list: Notification[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

export async function listNotifications(limit = 50): Promise<Notification[]> {
  try {
    const userId = getCurrentUserId();
    if (userId) {
      const notifications = await api.get<Notification[]>(`/notifications?user_id=${userId}&limit=${limit}`);
      // Cache in localStorage as fallback
      if (notifications && notifications.length > 0) {
        saveLocal(notifications);
      }
      return notifications;
    }
  } catch (error) {
    console.warn("Failed to load notifications from API, using localStorage", error);
  }
  return loadLocal().slice(0, limit);
}

export async function addNotification(
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  opts?: { silent?: boolean }
): Promise<Notification> {
  const userId = getCurrentUserId();
  const payload: Notification = {
    id: `NTF-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
    user_id: userId,
  };
  
  try {
    if (userId) {
      const created = await api.post<Notification>('/notifications', {
        id: payload.id,
        user_id: userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        read: payload.read,
      });
      // Update local cache
      const list = loadLocal();
      saveLocal([created, ...list]);
      try { if (!opts?.silent) playNotificationSound(); } catch {}
      return created;
    }
  } catch (error) {
    console.warn("Failed to save notification to API, using localStorage", error);
  }
  
  // Fallback to localStorage
  const list = loadLocal();
  const updated = [payload, ...list];
  saveLocal(updated);
  try { if (!opts?.silent) playNotificationSound(); } catch {}
  return payload;
}

// Direct notification to a specific user (by user_id). Useful for @mentions or ticket assignment updates.
export async function addUserNotification(
  userId: string,
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  opts?: { silent?: boolean }
): Promise<Notification> {
  const payload: Notification = {
    id: `NTF-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
    user_id: userId,
  };
  
  try {
    const created = await api.post<Notification>('/notifications', {
      id: payload.id,
      user_id: userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      read: payload.read,
    });
    // Update local cache if this is the current user
    const currentUserId = getCurrentUserId();
    if (currentUserId === userId) {
      const list = loadLocal();
      saveLocal([created, ...list]);
    }
    try { if (!opts?.silent) playNotificationSound(); } catch {}
    return created;
  } catch (error) {
    console.warn("Failed to save user notification to API, using localStorage", error);
  }
  
  // Fallback to localStorage
  const list = loadLocal();
  const updated = [payload, ...list];
  saveLocal(updated);
  try { if (!opts?.silent) playNotificationSound(); } catch {}
  return payload;
}

// Fan-out notifications to all users with the specified role (e.g., 'admin' or 'manager').
export async function addRoleNotification(
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  role: 'admin' | 'manager',
  opts?: { silent?: boolean }
): Promise<void> {
  try {
    // Get all users with the specified role
    const users = await listUsers();
    const targetUsers = users.filter(u => (u.role || '').toLowerCase() === role && (u.status || '').toLowerCase() === 'active');
    
    if (targetUsers.length === 0) {
      // No users found, add notification for current user as fallback
      await addNotification(input, opts);
      return;
    }
    
    // Create notification for each user
    for (const user of targetUsers) {
      await addUserNotification(user.id, input, { silent: true });
    }
    
    // Play sound once for the sender
    try { if (!opts?.silent) playNotificationSound(); } catch {}
  } catch (error) {
    console.warn("Failed to send role notifications via API, falling back to single notification", error);
    // Fallback: add single notification for current user
    await addNotification(input, opts);
  }
}

export async function markAllRead(): Promise<void> {
  try {
    const userId = getCurrentUserId();
    if (userId) {
      await api.put('/notifications/mark-all-read', { user_id: userId });
      // Update local cache
      const list = loadLocal().map(n => ({ ...n, read: true }));
      saveLocal(list);
      return;
    }
  } catch (error) {
    console.warn("Failed to mark all notifications as read via API, using localStorage", error);
  }
  
  // Fallback to localStorage
  const list = loadLocal().map(n => ({ ...n, read: true }));
  saveLocal(list);
}

export async function clearAllNotifications(): Promise<void> {
  try {
    const userId = getCurrentUserId();
    if (userId) {
      await api.delete(`/notifications?user_id=${userId}`);
      saveLocal([]);
      return;
    }
  } catch (error) {
    console.warn("Failed to clear notifications via API, using localStorage", error);
  }
  
  // Fallback to localStorage
  saveLocal([]);
}
