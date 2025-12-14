import { isDemoMode } from "@/lib/demo";
import { api } from "@/lib/api";

export type Report = {
  id: string;
  name: string;
  type: string;
  format: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
  file_url: string | null;
  // Optional filter metadata to support correct downloads
  filter_session_id?: string | null;
  filter_department?: string | null;
  filter_property?: string | null;
  filter_asset_type?: string | null;
  created_by?: string | null;
  created_by_id?: string | null;
  created_at?: string;
};

const table = "reports";

export async function listReports(): Promise<Report[]> {
  if (isDemoMode()) {
    try {
      const raw = localStorage.getItem("demo_reports");
      const list: Report[] = raw ? JSON.parse(raw) : [];
      // ensure sorted desc by created_at
      return list.sort((a, b) => (a.created_at || "") < (b.created_at || "") ? 1 : -1);
    } catch {
      return [];
    }
  }
  
  try {
    const reports = await api.get<Report[]>('/reports');
    return reports.sort((a, b) => (a.created_at || "") < (b.created_at || "") ? 1 : -1);
  } catch (e) {
    console.warn("Reports API unavailable, using empty list", e);
    return [];
  }
}

export async function createReport(payload: Omit<Report, "id" | "created_at">): Promise<Report> {
  const report: Report = {
    id: `RPT-${Math.floor(Math.random()*900000+100000)}`,
    name: payload.name,
    type: payload.type,
    format: payload.format,
    status: payload.status ?? "Completed",
    date_from: payload.date_from ?? null,
    date_to: payload.date_to ?? null,
    file_url: payload.file_url ?? null,
    filter_department: (payload as any).filter_department ?? null,
    filter_property: (payload as any).filter_property ?? null,
    filter_asset_type: (payload as any).filter_asset_type ?? null,
    created_by: (payload as any).created_by ?? null,
    created_by_id: (payload as any).created_by_id ?? null,
    created_at: new Date().toISOString(),
  } as Report;
  
  if (isDemoMode()) {
    try {
      const raw = localStorage.getItem("demo_reports");
      const list: Report[] = raw ? JSON.parse(raw) : [];
      const updated = [report, ...list];
      localStorage.setItem("demo_reports", JSON.stringify(updated));
    } catch {}
    return report;
  }
  
  try {
    const created = await api.post<Report>('/reports', report);
    return created;
  } catch (e) {
    console.warn("Reports API unavailable, using local storage", e);
    try {
      const raw = localStorage.getItem("reports");
      const list: Report[] = raw ? JSON.parse(raw) : [];
      const updated = [report, ...list];
      localStorage.setItem("reports", JSON.stringify(updated));
    } catch {}
    return report;
  }
}

export async function clearReports(): Promise<void> {
  if (isDemoMode()) {
    try { localStorage.setItem('demo_reports', JSON.stringify([])); } catch {}
    return;
  }
  
  try {
    await api.delete('/reports');
  } catch (e) {
    console.warn("Reports API unavailable, clearing local storage", e);
    try { localStorage.removeItem('reports'); localStorage.removeItem('report_meta'); } catch {}
  }
}
