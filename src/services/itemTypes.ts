import { api } from "@/lib/api";

export type ItemType = { name: string; created_at?: string };

export async function listItemTypes(): Promise<ItemType[]> {
  const defaults = ["Furniture","Electronics","Vehicles","Machinery","Office Supplies","Other"]; 
  try {
    const types = await api.get<ItemType[]>('/item-types');
    if (!types || types.length === 0) {
      // Seed defaults if empty
      for (const name of defaults) {
        try {
          await api.post('/item-types', { name });
        } catch {}
      }
      return defaults.map((n) => ({ name: n }));
    }
    return types;
  } catch (e) {
    console.warn("item_types unavailable, falling back to defaults", e);
    return defaults.map((n) => ({ name: n }));
  }
}

export async function createItemType(name: string): Promise<ItemType> {
  if (!name || !name.trim()) throw new Error("Type name required");
  return await api.post<ItemType>('/item-types', { name });
}

export async function deleteItemType(name: string): Promise<void> {
  if (!name || !name.trim()) throw new Error("Type name required");
  await api.delete(`/item-types/${encodeURIComponent(name)}`);
}
