import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";
import { listUsers } from "@/services/users";

// Property-wise Final Approver mapping
// Remote table expectation (if available): final_approvers(property_id text primary key, user_id text, user_name text nullable)

export type FinalApprover = {
  property_id: string;
  user_id: string;
  user_name?: string | null;
};

export async function getFinalApprover(propertyId: string): Promise<FinalApprover | null> {
  if (!propertyId) return null;
  if (isDemoMode()) return null;
  try {
    const approvers = await api.get<FinalApprover[]>(`/final-approvers?propertyId=${propertyId}`);
    return approvers.length > 0 ? approvers[0] : null;
  } catch (e) {
    console.warn("Failed to get final approver", e);
    return null;
  }
}

export async function listFinalApproverPropsForUser(userId: string): Promise<string[]> {
  if (!userId) return [];
  if (isDemoMode()) return [];
  try {
    const approvers = await api.get<FinalApprover[]>(`/final-approvers?userId=${userId}`);
    return approvers.map(a => a.property_id);
  } catch (e) {
    console.warn("Failed to list final approver properties for user", e);
    return [];
  }
}

// List by email (preferred for Admin assigning users on Users page)
export async function listFinalApproverPropsForEmail(email: string): Promise<string[]> {
  const em = (email || '').trim();
  if (!em) return [];
  if (isDemoMode()) return [];
  try {
    // First find user by email
    const users = await listUsers();
    const user = users.find(u => u.email?.toLowerCase() === em.toLowerCase());
    if (!user) return [];
    return await listFinalApproverPropsForUser(user.id);
  } catch (e) {
    console.warn("Failed to list final approver properties for email", e);
    return [];
  }
}

export async function setFinalApproverForProperty(propertyId: string, userId: string, userName?: string | null): Promise<void> {
  if (!propertyId || !userId) return;
  if (isDemoMode()) return;
  try {
    await api.post('/final-approvers', {
      propertyId,
      userId,
      userName: userName || null,
    });
  } catch (e) {
    console.warn("Failed to set final approver for property", e);
  }
}

export async function setFinalApproverPropsForUser(userId: string, userName: string | null, propertyIds: string[]): Promise<void> {
  if (!userId) return;
  if (isDemoMode()) return;
  try {
    // Remove existing assignments for this user
    const existing = await listFinalApproverPropsForUser(userId);
    for (const propId of existing) {
      if (!propertyIds.includes(propId)) {
        await api.delete(`/final-approvers?propertyId=${propId}&userId=${userId}`);
      }
    }
    // Add new assignments
    for (const propId of propertyIds) {
      await api.post('/final-approvers', {
        propertyId: propId,
        userId,
        userName: userName || null,
      });
    }
  } catch (e) {
    console.warn("Failed to set final approver properties for user", e);
  }
}

// Save using target user's email (resolves auth.uid on the server)
export async function setFinalApproverPropsForEmail(email: string, userName: string | null, propertyIds: string[]): Promise<void> {
  const em = (email || '').trim();
  if (!em) return;
  if (isDemoMode()) return;
  try {
    // Find user by email
    const users = await listUsers();
    const user = users.find(u => u.email?.toLowerCase() === em.toLowerCase());
    if (!user) {
      throw new Error(`User with email ${em} not found`);
    }
    await setFinalApproverPropsForUser(user.id, userName, propertyIds);
  } catch (e) {
    console.warn("Failed to set final approver properties for email", e);
  }
}

export async function isFinalApprover(userId: string, propertyId: string): Promise<boolean> {
  if (!userId || !propertyId) return false;
  const list = await listFinalApproverPropsForUser(userId);
  return list.includes(String(propertyId));
}
