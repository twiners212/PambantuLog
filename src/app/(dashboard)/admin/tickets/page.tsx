"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

const statusConfig: Record<string, { label: string, classes: string }> = {
  open: { label: 'Open', classes: 'bg-secondary/10 text-secondary' },
  in_progress: { label: 'In Progress', classes: 'bg-primary/10 text-primary' },
  pending: { label: 'Waiting on User', classes: 'bg-accent/10 text-accent-foreground' },
  resolved: { label: 'Resolved', classes: 'bg-emerald-500/10 text-emerald-600' },
  closed: { label: 'Closed', classes: 'bg-muted text-muted-foreground' },
}

interface TicketWithRelations {
  id: string
  title: string
  description: string
  status: string
  priority: string
  createdAt: string
  category: { id: string; name: string } | null
  createdBy: { id: string; fullName: string; email: string; department: string | null } | null
  assignedTo?: { id: string; fullName: string; } | null
}

interface Category { id: string; name: string; }
interface UserData { id: string; fullName: string; }

export default function AdminTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [agents, setAgents] = useState<UserData[]>([])

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch(`/api/v1/tickets`)
        const data = await res.json()
        setTickets(data.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchTickets()
  }, [])

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, agentRes] = await Promise.all([
          fetch("/api/v1/categories"),
          fetch("/api/v1/users?role=agent,admin")
        ]);
        const catData = await catRes.json();
        const agentData = await agentRes.json();
        if (catData.success) setCategories(catData.data);
        if (agentData.success) setAgents(agentData.data);
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
    };
    fetchMetadata();
  }, []);

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category?.id !== categoryFilter) return false;
    
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        if (t.assignedTo) return false;
      } else {
        if (t.assignedTo?.id !== assigneeFilter) return false;
      }
    }
    
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedTickets = filteredTickets.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Master Ticket List</h1>
            <p className="text-muted-foreground mt-2">Manage and assign all organization requests</p>
          </div>
          
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ID or Title..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 bg-card"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="pending">Waiting on User</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg transition-all">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <>
            <Table className="hidden md:table">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px] font-semibold">ID</TableHead>
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Requester</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-medium">
                      No tickets match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTickets.map((ticket) => {
                  const status = statusConfig[ticket.status]

                  return (
                    <TableRow 
                      key={ticket.id} 
                      className="group cursor-pointer hover:bg-accent/5 hover:shadow-[0_0_15px_rgba(0,0,0,0.05)] transition-all relative z-0 hover:z-10"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <TableCell className="font-mono text-muted-foreground text-xs">
                        <span className="bg-muted px-2 py-1 rounded-md border border-border">
                          {ticket.id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {ticket.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ticket.category?.name}</TableCell>
                      <TableCell>{ticket.createdBy?.fullName || 'Unknown'}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status?.classes}`}>
                          {status?.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })
                )}
              </TableBody>
            </Table>
            <div className="flex flex-col md:hidden">
              {paginatedTickets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-medium">
                  No tickets match your filters.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {paginatedTickets.map((ticket) => {
                    const status = statusConfig[ticket.status];
                    return (
                      <div 
                        key={ticket.id}
                        className="p-4 flex flex-col gap-3 hover:bg-accent/5 cursor-pointer transition-colors"
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded-md border border-border">
                            {ticket.id.slice(0, 8)}
                          </span>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${status?.classes}`}>
                            {status?.label}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-sm line-clamp-1">{ticket.title}</h3>
                          <p className="text-muted-foreground text-xs mt-1">
                            {ticket.category?.name} &bull; {ticket.createdBy?.fullName || 'Unknown'}
                          </p>
                        </div>
                        <div className="text-right text-xs font-medium text-muted-foreground mt-1">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && filteredTickets.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(safePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safePage * ITEMS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length} tickets
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <div className="text-sm font-medium px-2 text-foreground">
              Page {safePage} of {totalPages}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
