import { isDemoMode } from "@/lib/demo";

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
  // Ticket attachments API not yet implemented - use localStorage
  return loadDemo().filter(a => a.ticketId === ticketId);
}

export async function uploadAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const actor = (() => { try { const raw = (isDemoMode()? (sessionStorage.getItem('demo_auth_user')||localStorage.getItem('demo_auth_user')):null)||localStorage.getItem('auth_user'); const u = raw? JSON.parse(raw): null; return (u?.email||u?.id||'user') as string; } catch { return 'user'; } })();
  const name = `${Date.now()}_${file.name}`;
  // Ticket attachments API not yet implemented - use localStorage
  const att: TicketAttachment = { id: `ATT-${Math.floor(Math.random()*900000+100000)}`, ticketId, name: file.name, url: URL.createObjectURL(file), uploadedAt: new Date().toISOString(), uploadedBy: actor };
  const list = loadDemo();
  saveDemo([...list, att]);
  return att;
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  // Ticket attachments API not yet implemented - remove from localStorage
  const list = loadDemo();
  const next = list.filter(a => a.id !== attachmentId);
  saveDemo(next);
}
