import { isDemoMode } from "@/lib/demo";
import { updateAsset } from "@/services/assets";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";
import { api } from "@/lib/api";
import {
  sendApprovalSubmittedEmail,
  sendApprovalForwardedEmail,
  sendApprovalDecisionEmail,
  getManagerEmails,
  getAdminEmails,
} from "@/services/email";

export type ApprovalAction = "create" | "edit" | "decommission";
export type ApprovalStatus = "pending_manager" | "pending_admin" | "approved" | "rejected";

export type ApprovalRequest = {
  id: string;
  assetId: string;
  action: ApprovalAction;
  status: ApprovalStatus;
  requestedBy: string; // user id or email
  requestedAt: string; // ISO
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  // Optional change summary when action = edit
  patch?: Record<string, any> | null;
  department?: string | null;
};

export type ApprovalEvent = {
  id: string;
  approvalId: string;
  eventType: string; // submitted | forwarded | approved | rejected | applied | patch_updated
  message?: string | null;
  author?: string | null;
  createdAt: string;
};

const TABLE = "approvals";
const LS_KEY = "approvals";
const EV_LS_KEY = "approval_events";
const APPROVAL_CACHE_PREFIX = "approvals:list";
const APPROVAL_CACHE_TTL = 30_000;

function makeApprovalCacheKey(
  status?: ApprovalStatus,
  department?: string | null,
  requestedBy?: string | null,
  assetIds?: string[] | null
): string {
  const parts = [
    status || "all",
    ((department || "").toString().trim().toLowerCase()) || "all",
    ((requestedBy || "").toString().trim().toLowerCase()) || "all",
    assetIds && assetIds.length
      ? assetIds.map((id) => String(id).toLowerCase()).sort().join(",")
      : "all",
  ];
  return `${APPROVAL_CACHE_PREFIX}:${parts.join("|")}`;
}

function loadLocal(): ApprovalRequest[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ApprovalRequest[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(list: ApprovalRequest[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

function loadLocalEvents(): ApprovalEvent[] {
  try { return JSON.parse(localStorage.getItem(EV_LS_KEY) || '[]') as ApprovalEvent[]; } catch { return []; }
}
function saveLocalEvents(list: ApprovalEvent[]) {
  try { localStorage.setItem(EV_LS_KEY, JSON.stringify(list)); } catch {}
}

export async function resyncApprovalDepartments(): Promise<{ updated: number; total: number; errors: number; }> {
  // Get approvals and users; update approvals.department to match requester's current department
  // Local fallback
  const list = loadLocal();
  let usersFallback: any[] = [];
  try {
    const raw = localStorage.getItem('app_users_fallback');
    usersFallback = raw ? JSON.parse(raw) : [];
  } catch {}
  const byEmail = new Map<string, string | null>();
  const byId = new Map<string, string | null>();
  for (const u of usersFallback) {
    if (u?.email) byEmail.set(String(u.email).toLowerCase(), u.department ?? null);
    if (u?.id) byId.set(String(u.id), u.department ?? null);
  }
  let updated = 0;
  const next = list.map(a => {
    const key = (a.requestedBy || '').toLowerCase();
    const target = byEmail.get(key) ?? byId.get(a.requestedBy || '') ?? null;
    if (typeof target !== 'undefined' && a.department !== target) {
      updated++;
      return { ...a, department: target } as ApprovalRequest;
    }
    return a;
  });
  saveLocal(next);
  return { updated, total: list.length, errors: 0 };
}

export async function listApprovals(
  status?: ApprovalStatus,
  department?: string | null,
  requestedBy?: string | null,
  assetIds?: string[] | null,
  options?: { force?: boolean }
): Promise<ApprovalRequest[]> {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (department) params.append('department', department);
    if (requestedBy) params.append('requestedBy', requestedBy);
    if (assetIds && assetIds.length) {
      assetIds.forEach(id => params.append('assetId', id));
    }
    
    const queryString = params.toString();
    const url = `/approvals${queryString ? `?${queryString}` : ''}`;
    const approvals = await api.get<ApprovalRequest[]>(url);
    // Cache in localStorage
    if (approvals && approvals.length > 0) {
      saveLocal(approvals);
    }
    return approvals.map(toCamel);
  } catch (error) {
    console.warn("Failed to load approvals from API, using localStorage", error);
    const list = loadLocal();
    let out = list;
    if (status) out = out.filter(a => a.status === status);
    if (department) out = out.filter(a => (a.department || '').toLowerCase() === (department || '').toLowerCase());
    if (requestedBy) out = out.filter(a => (a.requestedBy || '').toLowerCase() === (requestedBy || '').toLowerCase());
    if (assetIds && assetIds.length) {
      const set = new Set(assetIds.map((x) => String(x).toLowerCase()));
      out = out.filter(a => set.has(String(a.assetId).toLowerCase()));
    }
    return out;
  }
}

export async function submitApproval(input: Omit<ApprovalRequest, "id" | "status" | "requestedAt" | "reviewedBy" | "reviewedAt">): Promise<ApprovalRequest> {
  // Try to infer requester department from auth_user (demo-aware)
  let dept: string | null = null;
  try {
    const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
    if (raw) {
      const u = JSON.parse(raw);
      dept = u?.department || null;
    }
  } catch {}
  // Fallback: try local users cache if still null
  if (!dept) {
    try {
      const rawU = localStorage.getItem('app_users_fallback');
      if (rawU && (input.requestedBy || '').length) {
        const users = JSON.parse(rawU) as Array<{ id?: string; email?: string; department?: string | null }>;
        const key = (input.requestedBy || '').toLowerCase();
        const found = users.find(u => (u.email || '').toLowerCase() === key || (u.id || '') === input.requestedBy);
        dept = found?.department || null;
      }
    } catch {}
  }
  const normalizedDept = typeof (input.department ?? dept) === 'string'
    ? String(input.department ?? dept).trim() || null
    : ((input.department ?? dept) as any ?? null);
  let finalDept = normalizedDept;
  const payload: ApprovalRequest = {
    id: `APR-${Math.floor(Math.random()*900000+100000)}`,
    assetId: input.assetId,
    action: input.action,
    status: "pending_manager",
    requestedBy: input.requestedBy,
    requestedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    notes: input.notes ?? null,
    patch: input.patch ?? null,
    department: finalDept,
  };
  
  try {
    const created = await api.post<ApprovalRequest>('/approvals', toSnake(payload));
    // Cache in localStorage
    const list = loadLocal();
    saveLocal([created, ...list]);
    invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
    
    // Send email notification to managers
    try {
      const managerEmails = await getManagerEmails(created.department ?? undefined);
      if (managerEmails.length > 0) {
        // Get requester name
        let requesterName = created.requestedBy;
        try {
          const authUser = localStorage.getItem('auth_user');
          if (authUser) {
            const user = JSON.parse(authUser);
            requesterName = user?.name || user?.email || requesterName;
          }
        } catch {}
        
        await sendApprovalSubmittedEmail({
          approvalId: created.id,
          requesterName,
          assetName: `Asset ${created.assetId}`,
          action: created.action,
          notes: created.notes ?? undefined,
          managersToNotify: managerEmails,
        });
      }
    } catch (error) {
      console.warn('Failed to send approval submitted email:', error);
    }
    
    return created;
  } catch (error) {
    console.warn("Failed to save approval to API, using localStorage", error);
    // Fallback to localStorage
    const list = loadLocal();
    saveLocal([payload, ...list]);
    invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
    
    // Send email notification to managers
    try {
      const managerEmails = await getManagerEmails(payload.department ?? undefined);
      if (managerEmails.length > 0) {
        let requesterName = payload.requestedBy;
        try {
          const authUser = localStorage.getItem('auth_user');
          if (authUser) {
            const user = JSON.parse(authUser);
            requesterName = user?.name || user?.email || requesterName;
          }
        } catch {}
        
        await sendApprovalSubmittedEmail({
          approvalId: payload.id,
          requesterName,
          assetName: `Asset ${payload.assetId}`,
          action: payload.action,
          notes: payload.notes ?? undefined,
          managersToNotify: managerEmails,
        });
      }
    } catch (error) {
      console.warn('Failed to send approval submitted email:', error);
    }
    
    return payload;
  }
}

export async function forwardApprovalToAdmin(id: string, manager: string, notes?: string): Promise<ApprovalRequest | null> {
  const patch = { status: 'pending_admin' as ApprovalStatus, reviewedBy: manager, reviewedAt: new Date().toISOString(), notes: notes ?? null };
  
  try {
    const updated = await api.put<ApprovalRequest>(`/approvals/${id}`, toSnake(patch));
    // Update local cache
    const list = loadLocal();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      list[idx] = updated;
      saveLocal(list);
    } else {
      saveLocal([updated, ...list]);
    }
    invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
    
    // Send email notification to admins
    try {
      const adminEmails = await getAdminEmails();
      if (adminEmails.length > 0) {
        let managerName = manager;
        try {
          const authUser = localStorage.getItem('auth_user');
          if (authUser) {
            const user = JSON.parse(authUser);
            managerName = user?.name || user?.email || manager;
          }
        } catch {}
        
        await sendApprovalForwardedEmail({
          approvalId: updated.id,
          managerName,
          assetName: `Asset ${updated.assetId}`,
          action: updated.action,
          notes: notes ?? undefined,
          adminsToNotify: adminEmails,
        });
      }
    } catch (error) {
      console.warn('Failed to send approval forwarded email:', error);
    }
    
    return updated;
  } catch (error) {
    console.warn("Failed to update approval via API, using localStorage", error);
    // Fallback to localStorage
    const list = loadLocal();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      const updated = { ...list[idx], ...patch } as ApprovalRequest;
      const next = [...list];
      next[idx] = updated;
      saveLocal(next);
      invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
      
      // Send email notification to admins
      try {
        const adminEmails = await getAdminEmails();
        if (adminEmails.length > 0) {
          let managerName = manager;
          try {
            const authUser = localStorage.getItem('auth_user');
            if (authUser) {
              const user = JSON.parse(authUser);
              managerName = user?.name || user?.email || manager;
            }
          } catch {}
          
          await sendApprovalForwardedEmail({
            approvalId: updated.id,
            managerName,
            assetName: `Asset ${updated.assetId}`,
            action: updated.action,
            notes: notes ?? undefined,
            adminsToNotify: adminEmails,
          });
        }
      } catch (error) {
        console.warn('Failed to send approval forwarded email:', error);
      }
      
      return updated;
    }
    return null;
  }
}

export async function decideApprovalFinal(id: string, decision: Exclude<ApprovalStatus, "pending_manager" | "pending_admin">, admin: string, notes?: string): Promise<ApprovalRequest | null> {
  const patch = { status: decision, reviewedBy: admin, reviewedAt: new Date().toISOString(), notes: notes ?? null };
  
  try {
    const updated = await api.put<ApprovalRequest>(`/approvals/${id}`, toSnake(patch));
    
    // If approved and it's an edit with a patch, try to apply changes to the asset
    if (decision === 'approved' && updated.action === 'edit' && updated.patch && Object.keys(updated.patch).length) {
      try {
        await updateAsset(updated.assetId, updated.patch as any);
      } catch (e) {
        console.warn('Patch could not be applied:', e);
      }
    }
    
    // Update local cache
    const list = loadLocal();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      list[idx] = updated;
      saveLocal(list);
    } else {
      saveLocal([updated, ...list]);
    }
    invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
    
    // Send email notification to requester
    try {
      let adminName = admin;
      try {
        const authUser = localStorage.getItem('auth_user');
        if (authUser) {
          const user = JSON.parse(authUser);
          adminName = user?.name || user?.email || admin;
        }
      } catch {}
      
      await sendApprovalDecisionEmail({
        approvalId: updated.id,
        approverName: adminName,
        requesterEmail: updated.requestedBy,
        assetName: `Asset ${updated.assetId}`,
        action: updated.action,
        decision: decision === 'approved' ? 'approved' : 'rejected',
        notes: notes ?? undefined,
        forwardingManagerEmail: undefined,
        department: updated.department,
      });
    } catch (error) {
      console.warn('Failed to send approval decision email:', error);
    }
    
    return updated;
  } catch (error) {
    console.warn("Failed to update approval via API, using localStorage", error);
    // Fallback to localStorage
    const list = loadLocal();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      const updated = { ...list[idx], ...patch } as ApprovalRequest;
      if (decision === 'approved' && updated.action === 'edit' && updated.patch && Object.keys(updated.patch).length) {
        try {
          await updateAsset(updated.assetId, updated.patch as any);
        } catch (e) {
          console.warn('Patch could not be applied:', e);
        }
      }
      
      const next = [...list];
      next[idx] = updated;
      saveLocal(next);
      invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
      
      // Send email notification to requester
      try {
        let adminName = admin;
        try {
          const authUser = localStorage.getItem('auth_user');
          if (authUser) {
            const user = JSON.parse(authUser);
            adminName = user?.name || user?.email || admin;
          }
        } catch {}
        
        await sendApprovalDecisionEmail({
          approvalId: updated.id,
          approverName: adminName,
          requesterEmail: updated.requestedBy,
          assetName: `Asset ${updated.assetId}`,
          action: updated.action,
          decision: decision === 'approved' ? 'approved' : 'rejected',
          notes: notes ?? undefined,
          forwardingManagerEmail: undefined,
          department: updated.department,
        });
      } catch (error) {
        console.warn('Failed to send approval decision email:', error);
      }
      
      return updated;
    }
    return null;
  }
}

// Admin overrides approval without level 1 (manager) step
export async function adminOverrideApprove(id: string, admin: string, notes?: string): Promise<ApprovalRequest | null> {
  const msg = notes && notes.trim().length ? notes : "admin approved it without level 1 approval";
  const res = await decideApprovalFinal(id, 'approved', admin, msg);
  return res;
}

export async function updateApprovalPatch(id: string, manager: string, patchData: Record<string, any>): Promise<ApprovalRequest | null> {
  const patch = { patch: patchData } as Partial<ApprovalRequest>;
  
  try {
    const updated = await api.put<ApprovalRequest>(`/approvals/${id}`, toSnake(patch));
    // Update local cache
    const list = loadLocal();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      list[idx] = updated;
      saveLocal(list);
    } else {
      saveLocal([updated, ...list]);
    }
    invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
    return updated;
  } catch (error) {
    console.warn("Failed to update approval patch via API, using localStorage", error);
    // Fallback to localStorage
    const list = loadLocal();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      const updated = { ...list[idx], patch: patchData } as ApprovalRequest;
      const next = [...list];
      next[idx] = updated;
      saveLocal(next);
      invalidateCacheByPrefix(APPROVAL_CACHE_PREFIX);
      return updated;
    }
    return null;
  }
}

export async function listApprovalEvents(approvalId: string): Promise<ApprovalEvent[]> {
  try {
    const events = await api.get<ApprovalEvent[]>(`/approval-events?approvalId=${approvalId}`);
    return events.map((ev: any) => ({
      id: ev.id,
      approvalId: ev.approval_id || ev.approvalId,
      eventType: ev.event_type || ev.eventType,
      author: ev.author,
      message: ev.message,
      createdAt: ev.created_at || ev.createdAt,
    }));
  } catch (error) {
    console.warn("Failed to load approval events from API, using localStorage", error);
    return loadLocalEvents().filter(ev => ev.approvalId === approvalId).sort((a,b) => (a.createdAt > b.createdAt ? 1 : -1));
  }
}

// Add a comment event on an approval (used for per-field diff notes)
export async function addApprovalComment(approvalId: string, author: string, field: string, message: string): Promise<void> {
  const msg = `${field}: ${message}`;
  const ev: ApprovalEvent = {
    id: `AEV-${Math.floor(Math.random()*900000+100000)}`,
    approvalId,
    eventType: 'comment',
    author,
    message: msg,
    createdAt: new Date().toISOString(),
  };
  
  try {
    await api.post('/approval-events', {
      id: ev.id,
      approval_id: approvalId,
      event_type: 'comment',
      author,
      message: msg,
      created_at: ev.createdAt,
    });
    // Update local cache
    const list = loadLocalEvents();
    saveLocalEvents([...list, ev]);
  } catch (error) {
    console.warn("Failed to save approval comment to API, using localStorage", error);
    // Fallback to localStorage
    const list = loadLocalEvents();
    saveLocalEvents([...list, ev]);
  }
}

function toCamel(row: any): ApprovalRequest {
  return {
    id: row.id,
    assetId: row.asset_id,
    action: row.action,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    notes: row.notes ?? null,
    patch: row.patch ?? null,
  department: row.department ?? null,
  };
}

function toSnake(input: Partial<ApprovalRequest>) {
  const row: any = {};
  if ("id" in input) row.id = input.id;
  if ("assetId" in input) row.asset_id = input.assetId;
  if ("action" in input) row.action = input.action;
  if ("status" in input) row.status = input.status;
  if ("requestedBy" in input) row.requested_by = input.requestedBy;
  if ("requestedAt" in input) row.requested_at = input.requestedAt;
  if ("reviewedBy" in input) row.reviewed_by = input.reviewedBy ?? null;
  if ("reviewedAt" in input) row.reviewed_at = input.reviewedAt ?? null;
  if ("notes" in input) row.notes = input.notes ?? null;
  if ("patch" in input) row.patch = input.patch ?? null;
  if ("department" in input) row.department = input.department ?? null;
  return row;
}
