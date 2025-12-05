import { isDemoMode, getDemoAssets } from "@/lib/demo";
import { getCachedValue, invalidateCache } from "@/lib/data-cache";
import { api } from "@/lib/api";

export type Asset = {
  id: string; // e.g., AST-001
  name: string;
  type: string;
  property: string; // storing property code for display/filter
  property_id?: string | null;
  department?: string | null;
  quantity: number;
  purchaseDate: string | null;
  expiryDate: string | null;
  poNumber: string | null;
  condition: string | null;
  status: string;
  location?: string | null;
  description?: string | null;
  serialNumber?: string | null;
  created_at?: string;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  amcEnabled?: boolean;
  amcStartDate?: string | null;
  amcEndDate?: string | null;
};

const table = "assets";
const ASSET_CACHE_KEY = "assets:list";
const ASSET_CACHE_TTL = 60_000; // 1 minute keeps dashboards snappy without going stale
const BASE_COLUMNS =
  "id,name,type,property,property_id,department,quantity,purchase_date,expiry_date,po_number,condition,status,location,description,serial_number,created_at,created_by,created_by_name,created_by_email";
const AMC_COLUMNS = ",amc_enabled,amc_start_date,amc_end_date";
let supportsAmcFields: boolean | null = hasSupabaseEnv ? null : false;
let supportsCreatorFields: boolean | null = hasSupabaseEnv ? null : false;

// Helpers to convert between DB (snake_case) and app (camelCase)
function toCamel(row: any): Asset {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    property: row.property,
    property_id: row.property_id ?? null,
    department: row.department ?? null,
    quantity: row.quantity,
    purchaseDate: row.purchase_date ?? null,
    expiryDate: row.expiry_date ?? null,
    poNumber: row.po_number ?? null,
    condition: row.condition ?? null,
    status: row.status,
    location: row.location ?? null,
    description: row.description ?? null,
    serialNumber: row.serial_number ?? null,
    created_at: row.created_at,
    createdById: row.created_by ?? null,
    createdByName: row.created_by_name ?? null,
    createdByEmail: row.created_by_email ?? null,
    amcEnabled: row.amc_enabled ?? false,
    amcStartDate: row.amc_start_date ?? null,
    amcEndDate: row.amc_end_date ?? null,
  };
}

function isMissingColumnError(error?: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true; // undefined_column
  return /amc_/i.test(error.message || "");
}

function toSnake(asset: Partial<Asset>, options?: { includeAmc?: boolean }) {
  const row: any = {};
  if ("id" in asset) row.id = asset.id;
  if ("name" in asset) row.name = asset.name;
  if ("type" in asset) row.type = asset.type;
  if ("property" in asset) row.property = asset.property;
  if ("property_id" in asset) row.property_id = asset.property_id ?? null;
  if ("department" in asset) row.department = asset.department ?? null;
  if ("quantity" in asset) row.quantity = asset.quantity;
  if ("purchaseDate" in asset) row.purchase_date = asset.purchaseDate ?? null;
  if ("expiryDate" in asset) row.expiry_date = asset.expiryDate ?? null;
  if ("poNumber" in asset) row.po_number = asset.poNumber ?? null;
  if ("condition" in asset) row.condition = asset.condition ?? null;
  if ("status" in asset) row.status = asset.status;
  if ("location" in asset) row.location = asset.location ?? null;
  if ("description" in asset) row.description = asset.description ?? null;
  if ("serialNumber" in asset) row.serial_number = asset.serialNumber ?? null;
  if (supportsCreatorFields !== false) {
    if ("createdById" in asset) row.created_by = asset.createdById ?? null;
    if ("createdByName" in asset) row.created_by_name = asset.createdByName ?? null;
    if ("createdByEmail" in asset) row.created_by_email = asset.createdByEmail ?? null;
  }
  const includeAmc = options?.includeAmc ?? supportsAmcFields !== false;
  if (includeAmc) {
    if ("amcEnabled" in asset) row.amc_enabled = asset.amcEnabled ?? false;
    if ("amcStartDate" in asset) row.amc_start_date = asset.amcStartDate ?? null;
    if ("amcEndDate" in asset) row.amc_end_date = asset.amcEndDate ?? null;
  }
  return row;
}

export async function listAssets(options?: { force?: boolean }): Promise<Asset[]> {
  if (isDemoMode()) return getDemoAssets();
  return getCachedValue(
    ASSET_CACHE_KEY,
    async () => {
      const assets = await api.get<Asset[]>('/assets');
      return assets.map(toCamel);
    },
    { ttlMs: ASSET_CACHE_TTL, force: options?.force },
  );
}

export async function createAsset(asset: Asset): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  // Enrich with creator info when available
  try {
    const raw = localStorage.getItem('auth_user');
    if (raw) {
      const u = JSON.parse(raw) as { id?: string; name?: string; email?: string };
      (asset as any).createdById = u?.id ?? null;
      (asset as any).createdByName = u?.name ?? null;
      (asset as any).createdByEmail = u?.email ?? null;
    }
  } catch {}
  const payload = toSnake(asset, { includeAmc: true });
  const created = await api.post<Asset>('/assets', payload);
  invalidateCache(ASSET_CACHE_KEY);
  return toCamel(created);
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const payload = toSnake(patch, { includeAmc: true });
  const updated = await api.put<Asset>(`/assets/${id}`, payload);
  invalidateCache(ASSET_CACHE_KEY);
  return toCamel(updated);
}

export async function deleteAsset(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  await api.delete(`/assets/${id}`);
  invalidateCache(ASSET_CACHE_KEY);
}

export async function getAssetById(id: string): Promise<Asset | null> {
  if (isDemoMode()) {
    const list = getDemoAssets();
    return list.find(a => a.id === id) || null;
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCamel(data) : null;
}
