import { getCurrentUserId } from "@/services/permissions";

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
  throw new Error("Audit scans are not yet implemented with PostgreSQL API");
}

export async function listMyScansForSession(sessionId: string): Promise<AuditScan[]> {
  return [];
}
