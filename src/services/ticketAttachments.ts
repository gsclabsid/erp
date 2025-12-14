import { isDemoMode } from "@/lib/demo";
import { api } from "@/lib/api";

export type TicketAttachment = {
  id: string; // storage path or synthetic id
  ticketId: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

const DEMO_KEY = 'demo_ticket_attachments';
function loadDemo(): TicketAttachment[] { try { return JSON.parse(localStorage.getItem(DEMO_KEY)||'[]'); } catch { return []; } }
function saveDemo(list: TicketAttachment[]) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {} }

const BUCKET = 'tickets';

async function ensureBucket(): Promise<void> {
  // Client SDK cannot create bucket; assume it exists. Documented as a prerequisite.
}

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  if (isDemoMode()) {
    return loadDemo().filter(a => a.ticketId === ticketId);
  }
  
  try {
    const attachments = await api.get<any[]>(`/ticket-attachments?ticketId=${ticketId}`);
    return attachments.map((a: any) => ({
      id: a.id,
      ticketId: a.ticket_id,
      name: a.name,
      url: a.url,
      uploadedAt: a.uploaded_at,
      uploadedBy: a.uploaded_by,
    }));
  } catch (e) {
    console.warn("Ticket attachments API unavailable, using localStorage", e);
    return loadDemo().filter(a => a.ticketId === ticketId);
  }
}

export async function uploadAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const actor = (() => { try { const raw = (isDemoMode()? (sessionStorage.getItem('demo_auth_user')||localStorage.getItem('demo_auth_user')):null)||localStorage.getItem('auth_user'); const u = raw? JSON.parse(raw): null; return (u?.email||u?.id||'user') as string; } catch { return 'user'; } })();
  const name = `${Date.now()}_${file.name}`;
  const att: TicketAttachment = { id: `ATT-${Math.floor(Math.random()*900000+100000)}`, ticketId, name: file.name, url: URL.createObjectURL(file), uploadedAt: new Date().toISOString(), uploadedBy: actor };
  
  if (isDemoMode()) {
    const list = loadDemo();
    saveDemo([...list, att]);
    return att;
  }
  
  try {
    const created = await api.post<any>('/ticket-attachments', {
      id: att.id,
      ticket_id: ticketId,
      name: file.name,
      url: att.url, // In production, this should be a server URL after file upload
      uploaded_at: att.uploadedAt,
      uploaded_by: actor,
    });
    return {
      id: created.id,
      ticketId: created.ticket_id,
      name: created.name,
      url: created.url,
      uploadedAt: created.uploaded_at,
      uploadedBy: created.uploaded_by,
    };
  } catch (e) {
    console.warn("Ticket attachments API unavailable, using localStorage", e);
    const list = loadDemo();
    saveDemo([...list, att]);
    return att;
  }
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  if (isDemoMode()) {
    const list = loadDemo();
    const next = list.filter(a => a.id !== attachmentId);
    saveDemo(next);
    return;
  }
  
  try {
    await api.delete(`/ticket-attachments/${attachmentId}`);
  } catch (e) {
    console.warn("Ticket attachments API unavailable, using localStorage", e);
    const list = loadDemo();
    const next = list.filter(a => a.id !== attachmentId);
    saveDemo(next);
  }
}
