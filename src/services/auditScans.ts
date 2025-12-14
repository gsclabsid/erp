import { getCurrentUserId } from "@/services/permissions";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

export type AuditScan = {
  id: string;
  session_id: string;
  asset_id: string;
  property_id?: string | null;
  department: string;
  status: "verified" | "damaged";
  scanned_by: string;
  scanned_by_name?: string | null;
  scanned_by_email?: string | null;
  scanned_at: string;
};

export async function verifyAssetViaScan(params: {
  sessionId: string; // text id to match audit_sessions.id type
  assetId: string;
  status: "verified" | "damaged";
  comment?: string | null;
}): Promise<void> {
  if (isDemoMode()) {
    throw new Error("Audit scans not available in demo mode");
  }
  
  try {
    const userId = getCurrentUserId();
    await api.post('/audit-scans', {
      session_id: params.sessionId,
      asset_id: params.assetId,
      scanned_at: new Date().toISOString(),
      scanned_by: userId || null,
      status: params.status,
    });
    // Also save as review
    await api.post('/audit-reviews', [{
      session_id: params.sessionId,
      asset_id: params.assetId,
      department: '', // Will be set by the review save
      status: params.status,
      comment: params.comment || null,
    }]);
  } catch (e: any) {
    throw new Error(e?.message || "Failed to verify asset via scan");
  }
}

export async function listMyScansForSession(sessionId: string): Promise<AuditScan[]> {
  if (isDemoMode()) return [];
  try {
    const userId = getCurrentUserId();
    if (!userId) return [];
    const scans = await api.get<any[]>(`/audit-scans?sessionId=${sessionId}`);
    return scans
      .filter((s: any) => s.scanned_by === userId)
      .map((s: any) => ({
        id: s.id,
        session_id: s.session_id,
        asset_id: s.asset_id,
        property_id: null,
        department: '',
        status: s.status === 'scanned' ? 'verified' : s.status,
        scanned_by: s.scanned_by,
        scanned_by_name: null,
        scanned_by_email: null,
        scanned_at: s.scanned_at,
      }));
  } catch (e) {
    console.warn("Failed to list audit scans", e);
    return [];
  }
}
