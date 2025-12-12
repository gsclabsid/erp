import { isDemoMode } from "@/lib/demo";

export type TicketComment = {
  id: string;
  ticketId: string;
  author: string; // user label (email/id)
  message: string;
  createdAt: string; // ISO
};

const DEMO_KEY = "demo_ticket_comments";
function loadDemo(): TicketComment[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)||"[]"); } catch { return []; }
}
function saveDemo(list: TicketComment[]) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {}
}

export async function listTicketComments(ticketId: string): Promise<TicketComment[]> {
  // Ticket comments API not yet implemented - use localStorage
  const all = loadDemo();
  return all.filter(c => c.ticketId === ticketId).sort((a,b) => a.createdAt < b.createdAt ? -1 : 1);
}

export async function addTicketComment(ticketId: string, message: string, authorLabel?: string): Promise<TicketComment> {
  const author = (() => {
    if (authorLabel) return authorLabel;
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
      const u = raw ? JSON.parse(raw) : null;
      return (u?.email || u?.id || 'user') as string;
    } catch { return 'user'; }
  })();
  const payload: TicketComment = {
    id: `CMT-${Math.floor(Math.random()*900000+100000)}`,
    ticketId,
    author,
    message,
    createdAt: new Date().toISOString(),
  };
  // Ticket comments API not yet implemented - save to localStorage
  const list = loadDemo();
  saveDemo([...list, payload]);
  return payload;
}
