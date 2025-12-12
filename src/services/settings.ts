
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
  // Return default settings - system settings API not yet implemented
  return { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {} } as SystemSettings;
}

export async function updateSystemSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  // System settings API not yet implemented - return merged defaults
  return { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {}, ...patch } as SystemSettings;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  // Return default user settings - user settings API not yet implemented
  return { id: userId, user_id: userId, notifications: true, email_notifications: true, notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true }, dark_mode: false, dashboard_prefs: {} } as UserSettings;
}

export async function upsertUserSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  // User settings API not yet implemented - return merged defaults
  return { id: userId, user_id: userId, notifications: true, email_notifications: true, notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true }, dark_mode: false, dashboard_prefs: {}, ...patch } as UserSettings;
}
