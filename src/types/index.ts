export type Role = 'admin' | 'agent' | 'karyawan';
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  department: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  createdById: string;
  assignedToId: string | null;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  satisfactionScore?: number;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  createdAt: string;
  isSystem: boolean;
}
