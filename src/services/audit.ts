import { listAssets, type Asset } from "@/services/assets";
import { playNotificationSound } from "@/lib/sound";

export type AuditSession = {
  id: string;
  started_at: string;
  frequency_months: 1 | 3 | 6;
  initiated_by?: string | null;
  is_active: boolean;
  property_id?: string | null;
};

export type AuditAssignment = {
  session_id: string;
  department: string;
  status: "pending" | "submitted";
  submitted_at?: string | null;
  submitted_by?: string | null;
};

export type AuditReview = {
  session_id: string;
  asset_id: string;
  department: string;
  status: "verified" | "missing" | "damaged";
  comment?: string | null;
  updated_at?: string;
};

export async function isAuditActive(): Promise<boolean> {
  return false;
}

export async function getActiveSession(): Promise<AuditSession | null> {
  return null;
}

export async function startAuditSession(freq: 1 | 3 | 6, initiated_by?: string | null, property_id?: string | null): Promise<AuditSession> {
  throw new Error("Audit sessions are not yet implemented with PostgreSQL API");
}

export async function endAuditSession(): Promise<void> {
  // No-op: audit sessions not yet implemented
}

export async function getAssignment(sessionId: string, department: string): Promise<AuditAssignment> {
  return {
    session_id: sessionId,
    department,
    status: "pending",
    submitted_at: null,
    submitted_by: null,
  };
}

export async function listDepartmentAssets(department: string, propertyId?: string): Promise<Asset[]> {
  const all = await listAssets();
  const norm = (s: string) => (s || '').toLowerCase();
  const pid = norm(String(propertyId || ''));
  return (all || [])
    .filter(a => norm(a.department || '') === norm(department || ''))
    .filter(a => {
      if (!propertyId) return true;
      const apid = norm(String(a.property_id || ''));
      const aprop = norm(String(a.property || ''));
      // Match by exact property_id, or by property code/name equality, or by containing code within name
      return apid === pid || aprop === pid || (pid && aprop.includes(pid));
    });
}

export async function getReviewsFor(sessionId: string, department: string): Promise<AuditReview[]> {
  return [];
}

export async function saveReviewsFor(sessionId: string, department: string, rows: AuditReview[]): Promise<void> {
  // No-op: audit reviews not yet implemented
}

export async function submitAssignment(sessionId: string, department: string, submitted_by?: string | null): Promise<void> {
  // No-op: audit assignments not yet implemented
}

export async function getProgress(sessionId: string, departments: string[]): Promise<{ total: number; submitted: number; }> {
  return { total: departments.length, submitted: 0 };
}

export async function listAssignments(sessionId: string): Promise<AuditAssignment[]> {
  return [];
}

export async function getDepartmentReviewSummary(sessionId: string): Promise<Record<string, { verified: number; missing: number; damaged: number }>> {
  return {};
}

export async function listReviewsForSession(sessionId: string): Promise<AuditReview[]> {
  return [];
}

export type AuditReport = {
  id: string;
  session_id: string;
  generated_at: string;
  generated_by?: string | null;
  payload: any;
};

export type AuditIncharge = {
  property_id: string;
  user_id: string;
  user_name?: string | null;
};

// Local storage fallback keys
const AI_LS_KEY = 'audit_incharge_map'; // { [property_id]: { user_id, user_name } }

function readLocalAI(): Record<string, { user_id: string; user_name?: string | null }>{
  try { return JSON.parse(localStorage.getItem(AI_LS_KEY) || '{}'); } catch { return {}; }
}
function writeLocalAI(data: Record<string, { user_id: string; user_name?: string | null }>) {
  try { localStorage.setItem(AI_LS_KEY, JSON.stringify(data)); } catch {}
}

export async function getAuditIncharge(propertyId: string): Promise<AuditIncharge | null> {
  if (!propertyId) return null;
  const map = readLocalAI();
  const v = map[propertyId];
  return v ? { property_id: propertyId, user_id: v.user_id, user_name: v.user_name ?? null } : null;
}

export async function setAuditIncharge(propertyId: string, userId: string, userName?: string | null): Promise<void> {
  if (!propertyId || !userId) return;
  const map = readLocalAI();
  map[propertyId] = { user_id: userId, user_name: userName ?? null };
  writeLocalAI(map);
}

export async function listAuditInchargeForUser(userId: string, userEmail?: string | null): Promise<string[]> {
  if (!userId) return [];
  const map = readLocalAI();
  return Object.entries(map).filter(([, v]) => String(v.user_id) === String(userId)).map(([pid]) => String(pid));
}

export async function setAuditInchargeForUser(userId: string, userName: string | null, propertyIds: string[]): Promise<void> {
  if (!userId) return;
  const uniq = Array.from(new Set((propertyIds || []).map(String)));
  const map = readLocalAI();
  // Remove prior assignments for this user not in list
  Object.keys(map).forEach((pid) => {
    if (String(map[pid].user_id) === String(userId) && !uniq.includes(String(pid))) {
      delete map[pid];
    }
  });
  // Upserts
  uniq.forEach((pid) => { map[pid] = { user_id: userId, user_name: userName ?? map[pid]?.user_name ?? null }; });
  writeLocalAI(map);
}

export async function createAuditReport(sessionId: string, generated_by?: string | null): Promise<AuditReport> {
  throw new Error("Audit reports are not yet implemented with PostgreSQL API");
}

export async function listAuditReports(sessionId: string): Promise<AuditReport[]> {
  return [];
}

export async function getAuditReport(id: string): Promise<AuditReport | null> {
  return null;
}

export async function listRecentAuditReports(limit: number = 20): Promise<AuditReport[]> {
  return [];
}

export async function listSessions(limit: number = 200): Promise<AuditSession[]> {
  return [];
}

export async function getSessionById(id: string): Promise<AuditSession | null> {
  return null;
}

// Friendly display name: {PropertyCode-DD-MM-YYYY-Frequency}
export function formatAuditSessionName(s: Partial<AuditSession> | null | undefined): string {
  if (!s) return "";
  const prop = String((s as any).property_id || '').trim() || 'UNK';
  const dt = (() => {
    try { return s.started_at ? new Date(s.started_at) : new Date(); } catch { return new Date(); }
  })();
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = String(dt.getFullYear());
  const freq = (s as any).frequency_months ?? '?';
  return `${prop}-${dd}-${mm}-${yyyy}-${freq}`;
}
