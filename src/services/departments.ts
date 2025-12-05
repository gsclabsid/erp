import { api } from "@/lib/api";

export type Department = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
};

const table = "departments";
const LS_KEY = "departments_fallback";

function seedLocalIfEmpty(): Department[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Department[];
  } catch {}
  const now = new Date().toISOString();
  const seeded: Department[] = [
    { id: crypto?.randomUUID?.() || "IT", name: "IT", code: "IT", is_active: true, created_at: now },
    { id: crypto?.randomUUID?.() || "HR", name: "HR", code: "HR", is_active: true, created_at: now },
    { id: crypto?.randomUUID?.() || "FIN", name: "Finance", code: "FIN", is_active: true, created_at: now },
    { id: crypto?.randomUUID?.() || "OPS", name: "Operations", code: "OPS", is_active: true, created_at: now },
  ];
  try { localStorage.setItem(LS_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}

function readLocal(): Department[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? (JSON.parse(raw) as Department[]) : seedLocalIfEmpty(); } catch { return seedLocalIfEmpty(); }
}

function writeLocal(list: Department[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

export async function listDepartments(): Promise<Department[]> {
  try {
    const departments = await api.get<Department[]>('/departments');
    // Merge with local cache for offline support
    const local = readLocal();
    const byName = new Map<string, Department>();
    const add = (d?: Department) => {
      if (!d) return;
      const key = (d.name || '').trim().toLowerCase() || d.id;
      if (!key) return;
      if (!byName.has(key)) byName.set(key, d);
    };
    for (const d of departments) add(d);
    for (const d of local) add(d);
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return readLocal();
  }
}

export async function createDepartment(payload: { name: string; code?: string | null; is_active?: boolean; id?: string; }): Promise<Department> {
  const id = payload.id || (crypto?.randomUUID?.() || String(Date.now()));
  const record: Omit<Department, "created_at"> & { created_at?: string } = {
    id,
    name: payload.name,
    code: payload.code ?? null,
    is_active: payload.is_active ?? true,
  };
  try {
    const created = await api.post<Department>('/departments', { ...record, created_at: new Date().toISOString() });
    // Mirror to local cache
    try {
      const local = readLocal();
      const exists = local.find(d => d.id === created.id);
      const merged = exists ? local.map(d => d.id === created.id ? created : d) : [created, ...local];
      writeLocal(merged);
    } catch {}
    return created;
  } catch {
    // Fallback to local if API fails
    const list = readLocal();
    const now = new Date().toISOString();
    const created: Department = { ...record, created_at: now } as Department;
    writeLocal([created, ...list]);
    return created;
  }
}

export async function updateDepartment(id: string, patch: Partial<Pick<Department, "name" | "code" | "is_active">>): Promise<Department> {
  try {
    const updated = await api.put<Department>(`/departments/${id}`, patch);
    // Mirror to local cache
    try {
      const local = readLocal();
      const idx = local.findIndex(d => d.id === id);
      if (idx >= 0) { local[idx] = updated; writeLocal([...local]); }
    } catch {}
    return updated;
  } catch {
    const list = readLocal();
    const idx = list.findIndex(d => d.id === id);
    if (idx === -1) throw new Error("Not found");
    const updated = { ...list[idx], ...patch } as Department;
    const next = [...list];
    next[idx] = updated;
    writeLocal(next);
    return updated;
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  try {
    await api.delete(`/departments/${id}`);
    // Mirror local cache
    try { const next = readLocal().filter(d => d.id !== id); writeLocal(next); } catch {}
  } catch {
    const next = readLocal().filter(d => d.id !== id);
    writeLocal(next);
  }
}
