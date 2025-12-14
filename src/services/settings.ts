import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

export type SystemSettings = {
  id: boolean; // singleton true
  timezone: string | null;
  language: string | null;
  backup_frequency: "hourly" | "daily" | "weekly" | "monthly" | string | null;
  auto_backup: boolean | null;
  appearance: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  notifications: boolean | null;
  email_notifications: boolean | null;
  notification_types: Record<string, any> | null;
  dark_mode: boolean | null;
  dashboard_prefs: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

const SYS_TABLE = "system_settings";
const USER_TABLE = "user_settings";

export async function getSystemSettings(): Promise<SystemSettings> {
  if (isDemoMode()) {
    return { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {} } as SystemSettings;
  }
  
  try {
    const settings = await api.get<Record<string, any>>('/system-settings');
    return {
      id: true,
      timezone: settings.timezone || "UTC",
      language: settings.language || "en",
      backup_frequency: settings.backup_frequency || "daily",
      auto_backup: settings.auto_backup ?? true,
      appearance: settings.appearance || {},
    } as SystemSettings;
  } catch (e) {
    console.warn("System settings API unavailable, using defaults", e);
    return { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {} } as SystemSettings;
  }
}

export async function updateSystemSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  if (isDemoMode()) {
    return { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {}, ...patch } as SystemSettings;
  }
  
  try {
    await api.post('/system-settings', { settings: patch });
    return await getSystemSettings();
  } catch (e) {
    console.warn("System settings API unavailable, using defaults", e);
    return { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {}, ...patch } as SystemSettings;
  }
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  if (isDemoMode()) {
    return { id: userId, user_id: userId, notifications: true, email_notifications: true, notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true }, dark_mode: false, dashboard_prefs: {} } as UserSettings;
  }
  
  try {
    const settings = await api.get<Record<string, any>>(`/user-settings?userId=${userId}`);
    return {
      id: userId,
      user_id: userId,
      notifications: settings.notifications ?? true,
      email_notifications: settings.email_notifications ?? true,
      notification_types: settings.notification_types || { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true },
      dark_mode: settings.dark_mode ?? false,
      dashboard_prefs: settings.dashboard_prefs || {},
    } as UserSettings;
  } catch (e) {
    console.warn("User settings API unavailable, using defaults", e);
    return { id: userId, user_id: userId, notifications: true, email_notifications: true, notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true }, dark_mode: false, dashboard_prefs: {} } as UserSettings;
  }
}

export async function upsertUserSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  if (isDemoMode()) {
    return { id: userId, user_id: userId, notifications: true, email_notifications: true, notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true }, dark_mode: false, dashboard_prefs: {}, ...patch } as UserSettings;
  }
  
  try {
    await api.post('/user-settings', { userId, settings: patch });
    return await getUserSettings(userId);
  } catch (e) {
    console.warn("User settings API unavailable, using defaults", e);
    return { id: userId, user_id: userId, notifications: true, email_notifications: true, notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true }, dark_mode: false, dashboard_prefs: {}, ...patch } as UserSettings;
  }
}
