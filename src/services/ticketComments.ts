import { isDemoMode } from "@/lib/demo";
import { api } from "@/lib/api";

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
  if (isDemoMode()) {
    const all = loadDemo();
    return all.filter(c => c.ticketId === ticketId).sort((a,b) => a.createdAt < b.createdAt ? -1 : 1);
  }
  
  try {
    const comments = await api.get<any[]>(`/ticket-comments?ticketId=${ticketId}`);
    return comments.map((c: any) => ({
      id: c.id,
      ticketId: c.ticket_id,
      author: c.user_name || c.user_id || 'user',
      message: c.comment,
      createdAt: c.created_at,
    }));
  } catch (e) {
    console.warn("Ticket comments API unavailable, using localStorage", e);
    const all = loadDemo();
    return all.filter(c => c.ticketId === ticketId).sort((a,b) => a.createdAt < b.createdAt ? -1 : 1);
  }
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
  
  let userId: string | null = null;
  try {
    const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
    const u = raw ? JSON.parse(raw) : null;
    userId = u?.id || null;
  } catch {}
  
  const payload: TicketComment = {
    id: `CMT-${Math.floor(Math.random()*900000+100000)}`,
    ticketId,
    author,
    message,
    createdAt: new Date().toISOString(),
  };
  
  if (isDemoMode()) {
    const list = loadDemo();
    saveDemo([...list, payload]);
    return payload;
  }
  
  try {
    const created = await api.post<any>('/ticket-comments', {
      ticket_id: ticketId,
      user_id: userId,
      user_name: author,
      comment: message,
      created_at: payload.createdAt,
    });
    return {
      id: created.id,
      ticketId: created.ticket_id,
      author: created.user_name || created.user_id || author,
      message: created.comment,
      createdAt: created.created_at,
    };
  } catch (e) {
    console.warn("Ticket comments API unavailable, using localStorage", e);
    const list = loadDemo();
    saveDemo([...list, payload]);
    return payload;
  }
}
