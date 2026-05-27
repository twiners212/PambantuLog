"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PlusCircle, MessageSquare, Search, ChevronLeft, ChevronRight } from "lucide-react"

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
  createdBy: { id: string; fullName: string } | null
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([])
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  useEffect(() => {
    const fetchTicketsAndMeta = async () => {
      try {
        const [ticketRes, catRes] = await Promise.all([
          fetch("/api/v1/tickets?view=my_tickets"),
          fetch("/api/v1/categories")
        ]);
        const ticketData = await ticketRes.json()
        const catData = await catRes.json()
        
        setTickets(ticketData.data || [])
        if (catData.success) setCategories(catData.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchTicketsAndMeta()
  }, [])

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category?.id !== categoryFilter) return false;
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[140px] w-full rounded-xl bg-card border-border border" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">My Tickets</h1>
            <p className="text-muted-foreground mt-2">Track the status of your requests</p>
          </div>
          <Link href="/employee/create">
            <Button className="flex items-center gap-2 w-full md:w-auto">
              <PlusCircle className="w-4 h-4" />
              <span>New Ticket</span>
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
          <div className="relative w-full sm:flex-1 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 bg-card"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="bg-background w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="pending">Waiting</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="bg-background w-full sm:w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Category</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {paginatedTickets.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            No tickets match your filters.
          </Card>
        ) : (
          paginatedTickets.map(ticket => {
            const status = statusConfig[ticket.status]
            
            return (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                <Card className="hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group bg-card border-border">
                  <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md border border-border">
                          {ticket.id.slice(0, 8)}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status?.classes}`}>
                          {status?.label}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {ticket.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {ticket.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-6 shrink-0 text-sm text-muted-foreground">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-foreground">{ticket.category?.name}</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="hidden md:flex flex-col items-center justify-center p-3 rounded-full bg-accent/10 text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
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
