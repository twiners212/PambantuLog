import { User, Ticket, TicketComment, Category } from '../types';

export const mockUsers: User[] = [
  {
    id: 'user-1',
    fullName: 'Admin Super',
    email: 'admin@company.com',
    role: 'admin',
    department: 'IT',
  },
  {
    id: 'user-2',
    fullName: 'Mike Chen',
    email: 'm.chen@company.com',
    role: 'agent',
    department: 'IT Support',
  },
  {
    id: 'user-3',
    fullName: 'Sarah Jenkins',
    email: 's.jenkins@company.com',
    role: 'karyawan',
    department: 'Marketing',
  },
  {
    id: 'user-4',
    fullName: 'John Support',
    email: 'john@support',
    role: 'agent',
    department: 'IT Support',
  },
];

export const mockCategories: Category[] = [
  { id: 'cat-1', name: 'Hardware' },
  { id: 'cat-2', name: 'Software' },
  { id: 'cat-3', name: 'Network' },
  { id: 'cat-4', name: 'Other' },
];

export const mockTickets: Ticket[] = [
  {
    id: 'HD-8492',
    title: 'Cannot access VPN from remote office',
    description: 'Ever since the OS update last night, I haven\'t been able to connect to the corporate VPN. It hangs on "Verifying Credentials" for about 2 minutes and then times out with Error Code 809.',
    status: 'in_progress',
    priority: 'high',
    createdById: 'user-3',
    assignedToId: 'user-2',
    categoryId: 'cat-3',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'HD-8493',
    title: 'Requesting new monitor',
    description: 'My current monitor is flickering.',
    status: 'open',
    priority: 'medium',
    createdById: 'user-3',
    assignedToId: null,
    categoryId: 'cat-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const mockComments: TicketComment[] = [
  {
    id: 'c-1',
    ticketId: 'HD-8492',
    authorId: 'system',
    content: 'Ticket Created',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isSystem: true,
  },
  {
    id: 'c-2',
    ticketId: 'HD-8492',
    authorId: 'user-2',
    content: 'Hi Sarah, looking into this now. I see several others reporting similar issues after the OS update. Could you confirm which specific version you updated to? (Apple Menu > About This Mac).',
    createdAt: new Date(Date.now() - 80000000).toISOString(),
    isSystem: false,
  },
  {
    id: 'c-3',
    ticketId: 'HD-8492',
    authorId: 'user-3',
    content: 'It\'s macOS Sonoma 14.1.',
    createdAt: new Date(Date.now() - 79000000).toISOString(),
    isSystem: false,
  },
  {
    id: 'c-4',
    ticketId: 'HD-8492',
    authorId: 'system',
    content: 'Status: Open → In Progress',
    createdAt: new Date(Date.now() - 78000000).toISOString(),
    isSystem: true,
  }
];
