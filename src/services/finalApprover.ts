
// Property-wise Final Approver mapping
// Remote table expectation (if available): final_approvers(property_id text primary key, user_id text, user_name text nullable)

export type FinalApprover = {
  property_id: string;
  user_id: string;
  user_name?: string | null;
};

export async function getFinalApprover(propertyId: string): Promise<FinalApprover | null> {
  if (!propertyId) return null;
  return null;
}

export async function listFinalApproverPropsForUser(userId: string): Promise<string[]> {
  if (!userId) return [];
  return [];
}

// List by email (preferred for Admin assigning users on Users page)
export async function listFinalApproverPropsForEmail(email: string): Promise<string[]> {
  const em = (email || '').trim();
  if (!em) return [];
  return [];
}

export async function setFinalApproverForProperty(propertyId: string, userId: string, userName?: string | null): Promise<void> {
  if (!propertyId || !userId) return;
  // Final approver API not yet implemented
}

export async function setFinalApproverPropsForUser(userId: string, userName: string | null, propertyIds: string[]): Promise<void> {
  if (!userId) return;
  // Final approver API not yet implemented
}

// Save using target user's email (resolves auth.uid on the server)
export async function setFinalApproverPropsForEmail(email: string, userName: string | null, propertyIds: string[]): Promise<void> {
  const em = (email || '').trim();
  if (!em) return;
  // Final approver API not yet implemented
}

export async function isFinalApprover(userId: string, propertyId: string): Promise<boolean> {
  if (!userId || !propertyId) return false;
  const list = await listFinalApproverPropsForUser(userId);
  return list.includes(String(propertyId));
}
