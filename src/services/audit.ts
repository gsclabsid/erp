import { listAssets, type Asset } from "@/services/assets";
import { playNotificationSound } from "@/lib/sound";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

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
  if (isDemoMode()) return false;
  try {
    const sessions = await api.get<AuditSession[]>('/audit-sessions?isActive=true');
    return sessions.length > 0;
  } catch {
    return false;
  }
}

export async function getActiveSession(): Promise<AuditSession | null> {
  if (isDemoMode()) return null;
  try {
    const sessions = await api.get<AuditSession[]>('/audit-sessions?isActive=true');
    return sessions.length > 0 ? sessions[0] : null;
  } catch {
    return null;
  }
}

export async function startAuditSession(freq: 1 | 3 | 6, initiated_by?: string | null, property_id?: string | null): Promise<AuditSession> {
  if (isDemoMode()) {
    throw new Error("Audit sessions not available in demo mode");
  }
  
  const sessionId = `AUDIT-${Math.floor(Math.random()*900000+100000)}`;
  try {
    const session = await api.post<AuditSession>('/audit-sessions', {
      id: sessionId,
      started_at: new Date().toISOString(),
      frequency_months: freq,
      initiated_by: initiated_by || null,
      is_active: true,
      property_id: property_id || null,
    });
    return session;
  } catch (e: any) {
    throw new Error(e?.message || "Failed to start audit session");
  }
}

export async function endAuditSession(): Promise<void> {
  if (isDemoMode()) return;
  try {
    const active = await getActiveSession();
    if (active) {
      await api.put(`/audit-sessions/${active.id}`, { is_active: false });
    }
  } catch (e) {
    console.warn("Failed to end audit session", e);
  }
}

export async function getAssignment(sessionId: string, department: string): Promise<AuditAssignment> {
  if (isDemoMode()) {
    return {
      session_id: sessionId,
      department,
      status: "pending",
      submitted_at: null,
      submitted_by: null,
    };
  }
  
  try {
    const assignments = await api.get<AuditAssignment[]>(`/audit-assignments?sessionId=${sessionId}&department=${department}`);
    return assignments.length > 0 ? assignments[0] : {
      session_id: sessionId,
      department,
      status: "pending",
      submitted_at: null,
      submitted_by: null,
    };
  } catch (e) {
    console.warn("Failed to get audit assignment", e);
    return {
      session_id: sessionId,
      department,
      status: "pending",
      submitted_at: null,
      submitted_by: null,
    };
  }
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
  if (isDemoMode()) return [];
  try {
    const reviews = await api.get<AuditReview[]>(`/audit-reviews?sessionId=${sessionId}&department=${department}`);
    return reviews;
  } catch (e) {
    console.warn("Failed to get audit reviews", e);
    return [];
  }
}

export async function saveReviewsFor(sessionId: string, department: string, rows: AuditReview[]): Promise<void> {
  if (isDemoMode()) return;
  try {
    await api.post('/audit-reviews', rows);
  } catch (e) {
    console.warn("Failed to save audit reviews", e);
  }
}

export async function submitAssignment(sessionId: string, department: string, submitted_by?: string | null): Promise<void> {
  if (isDemoMode()) return;
  try {
    await api.post('/audit-assignments', {
      session_id: sessionId,
      department,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by: submitted_by || null,
    });
  } catch (e) {
    console.warn("Failed to submit audit assignment", e);
  }
}

export async function getProgress(sessionId: string, departments: string[]): Promise<{ total: number; submitted: number; }> {
  if (isDemoMode()) {
    return { total: departments.length, submitted: 0 };
  }
  try {
    const assignments = await api.get<AuditAssignment[]>(`/audit-assignments?sessionId=${sessionId}`);
    const submitted = assignments.filter(a => a.status === 'submitted').length;
    return { total: departments.length, submitted };
  } catch (e) {
    console.warn("Failed to get audit progress", e);
    return { total: departments.length, submitted: 0 };
  }
}

export async function listAssignments(sessionId: string): Promise<AuditAssignment[]> {
  if (isDemoMode()) return [];
  try {
    const assignments = await api.get<AuditAssignment[]>(`/audit-assignments?sessionId=${sessionId}`);
    return assignments;
  } catch (e) {
    console.warn("Failed to list audit assignments", e);
    return [];
  }
}

export async function getDepartmentReviewSummary(sessionId: string): Promise<Record<string, { verified: number; missing: number; damaged: number }>> {
  if (isDemoMode()) return {};
  try {
    const reviews = await api.get<AuditReview[]>(`/audit-reviews?sessionId=${sessionId}`);
    const summary: Record<string, { verified: number; missing: number; damaged: number }> = {};
    reviews.forEach((r) => {
      const dept = r.department || 'unknown';
      if (!summary[dept]) {
        summary[dept] = { verified: 0, missing: 0, damaged: 0 };
      }
      if (r.status === 'verified') summary[dept].verified++;
      else if (r.status === 'missing') summary[dept].missing++;
      else if (r.status === 'damaged') summary[dept].damaged++;
    });
    return summary;
  } catch (e) {
    console.warn("Failed to get department review summary", e);
    return {};
  }
}

export async function listReviewsForSession(sessionId: string): Promise<AuditReview[]> {
  if (isDemoMode()) return [];
  try {
    const reviews = await api.get<AuditReview[]>(`/audit-reviews?sessionId=${sessionId}`);
    return reviews;
  } catch (e) {
    console.warn("Failed to list audit reviews", e);
    return [];
  }
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
  if (isDemoMode()) {
    throw new Error("Audit reports not available in demo mode");
  }
  
  const reportId = `AUDIT-RPT-${Math.floor(Math.random()*900000+100000)}`;
  try {
    const report = await api.post<AuditReport>('/audit-reports', {
      id: reportId,
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      generated_by: generated_by || null,
      summary: {},
    });
    return {
      id: report.id,
      session_id: report.session_id,
      generated_at: report.generated_at,
      generated_by: report.generated_by || null,
      payload: report.summary || {},
    };
  } catch (e: any) {
    throw new Error(e?.message || "Failed to create audit report");
  }
}

export async function listAuditReports(sessionId: string): Promise<AuditReport[]> {
  if (isDemoMode()) return [];
  try {
    const reports = await api.get<any[]>(`/audit-reports?sessionId=${sessionId}`);
    return reports.map((r: any) => ({
      id: r.id,
      session_id: r.session_id,
      generated_at: r.generated_at,
      generated_by: r.generated_by || null,
      payload: r.summary || {},
    }));
  } catch (e) {
    console.warn("Failed to list audit reports", e);
    return [];
  }
}

export async function getAuditReport(id: string): Promise<AuditReport | null> {
  if (isDemoMode()) return null;
  try {
    const report = await api.get<any>(`/audit-reports/${id}`);
    return {
      id: report.id,
      session_id: report.session_id,
      generated_at: report.generated_at,
      generated_by: report.generated_by || null,
      payload: report.summary || {},
    };
  } catch (e) {
    console.warn("Failed to get audit report", e);
    return null;
  }
}

export async function listRecentAuditReports(limit: number = 20): Promise<AuditReport[]> {
  if (isDemoMode()) return [];
  try {
    const reports = await api.get<any[]>('/audit-reports');
    return reports
      .sort((a, b) => (a.generated_at < b.generated_at ? 1 : -1))
      .slice(0, limit)
      .map((r: any) => ({
        id: r.id,
        session_id: r.session_id,
        generated_at: r.generated_at,
        generated_by: r.generated_by || null,
        payload: r.summary || {},
      }));
  } catch (e) {
    console.warn("Failed to list recent audit reports", e);
    return [];
  }
}

export async function listSessions(limit: number = 200): Promise<AuditSession[]> {
  if (isDemoMode()) return [];
  try {
    const sessions = await api.get<AuditSession[]>('/audit-sessions');
    return sessions.slice(0, limit);
  } catch (e) {
    console.warn("Failed to list audit sessions", e);
    return [];
  }
}

export async function getSessionById(id: string): Promise<AuditSession | null> {
  if (isDemoMode()) return null;
  try {
    const session = await api.get<AuditSession>(`/audit-sessions/${id}`);
    return session;
  } catch (e) {
    console.warn("Failed to get audit session", e);
    return null;
  }
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
