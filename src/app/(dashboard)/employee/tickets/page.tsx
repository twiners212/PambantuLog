"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PlusCircle, MessageSquare, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { useTicketSearch } from "@/hooks/useTicketSearch"

const statusConfig: Record<string, { label: string, classes: string }> = {
  open: { label: 'Open', classes: 'bg-secondary/10 text-secondary' },
  in_progress: { label: 'In Progress', classes: 'bg-primary/10 text-primary' },
  pending: { label: 'Waiting on User', classes: 'bg-accent/10 text-accent-foreground' },
  resolved: { label: 'Resolved', classes: 'bg-emerald-500/10 text-emerald-600' },
  closed: { label: 'Closed', classes: 'bg-muted text-muted-foreground' },
}

export default function MyTicketsPage() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  const {
    searchTerm: searchQuery,
    setSearchTerm: setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    setPage,
    tickets,
    pagination,
    isLoading: loading,
  } = useTicketSearch({
    viewType: "my_tickets",
    initialLimit: 5,
  })

  useEffect(() => {
    fetch("/api/v1/categories")
      .then((res) => res.json())
      .then((catData) => {
        if (catData.success) setCategories(catData.data || [])
      })
      .catch((err) => console.error("Failed to load categories:", err))
  }, [])

  if (loading && tickets.length === 0) {
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
            <Button className="w-full md:w-auto shadow-sm">
              <PlusCircle className="mr-2 h-4 w-4" /> New Ticket
            </Button>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
          <div className="relative w-full sm:flex-1 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
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

          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
            <SelectTrigger className="bg-background w-full sm:w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tickets.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            No tickets match your filters.
          </Card>
        ) : (
          tickets.map((ticket) => {
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
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {ticket.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                        {ticket.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
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
      {!loading && pagination.totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.totalItems)} of{" "}
            {pagination.totalItems} tickets
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <div className="text-sm font-medium px-2 text-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
