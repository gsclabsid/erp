import { isDemoMode, getDemoProperties } from "@/lib/demo";
import { getCachedValue, invalidateCache } from "@/lib/data-cache";
import { api } from "@/lib/api";

export type Property = {
  id: string;
  name: string;
  address: string | null;
  type: string;
  status: string;
  manager: string | null;
  created_at?: string;
  updated_at?: string;
};

const table = "properties";
const PROPERTY_CACHE_KEY = "properties:list";
const PROPERTY_CACHE_TTL = 60_000;

function toCamel(row: any): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? null,
    type: row.type,
    status: row.status,
    manager: row.manager ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toSnake(p: Partial<Property>) {
  return {
    id: p.id,
    name: p.name,
    address: p.address ?? null,
    type: p.type,
    status: p.status,
    manager: p.manager ?? null,
  };
}

export async function listProperties(options?: { force?: boolean }): Promise<Property[]> {
  if (isDemoMode()) return getDemoProperties();
  return getCachedValue(
    PROPERTY_CACHE_KEY,
    async () => {
      const properties = await api.get<Property[]>('/properties');
      return properties.map(toCamel);
    },
    { ttlMs: PROPERTY_CACHE_TTL, force: options?.force },
  );
}

export async function deleteProperty(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  // Delete related records first to avoid FK constraints
  // This should be handled by the API endpoint with CASCADE or explicit deletes
  await api.delete(`/properties/${id}`);
  invalidateCache(PROPERTY_CACHE_KEY);
}

export async function createProperty(p: Property): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const created = await api.post<Property>('/properties', toSnake(p));
  invalidateCache(PROPERTY_CACHE_KEY);
  return toCamel(created);
}

export async function updateProperty(id: string, patch: Partial<Property>): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const updated = await api.put<Property>(`/properties/${id}`, toSnake(patch));
  invalidateCache(PROPERTY_CACHE_KEY);
  return toCamel(updated);
}
