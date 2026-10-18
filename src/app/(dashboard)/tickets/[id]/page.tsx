"use client"

import { useEffect, useState, use } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BadgeAlert, Paperclip, Calendar, Badge, User as UserIcon, Send, Star, CheckCircle, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const statusConfig: Record<string, { label: string, classes: string }> = {
  open: { label: 'Open', classes: 'bg-secondary/10 text-secondary border-secondary/20' },
  in_progress: { label: 'In Progress', classes: 'bg-primary/10 text-primary border-primary/20' },
  pending: { label: 'Waiting on User', classes: 'bg-accent/10 text-accent-foreground border-accent/20' },
  resolved: { label: 'Resolved', classes: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  closed: { label: 'Closed', classes: 'bg-muted text-muted-foreground border-outline-variant' },
}

interface TicketDetail {
  id: string
  title: string
  description: string
  status: string
  priority: string
  attachmentUrl: string | null
  createdAt: string
  updatedAt: string
  category: { id: string; name: string } | null
  createdBy: { id: string; fullName: string; email: string; department: string | null; role: string } | null
  assignedTo: { id: string; fullName: string; email: string; department: string | null; role: string } | null
  comments: CommentData[]
}

interface CommentData {
  id: string
  ticketId: string
  userId: string
  message: string
  attachmentUrl: string | null
  createdAt: string
  user: { id: string; fullName: string; email: string; role: string } | null
}

function parseAttachmentUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((u) => typeof u === "string");
  } catch {
    // not JSON, treats as single URL
  }
  return [raw];
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const id = resolvedParams.id
  
  const { profile } = useAuth()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [reply, setReply] = useState("")
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [rating, setRating] = useState<number>(0)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null)
  
  const [agents, setAgents] = useState<{id: string, fullName: string, email: string, department: string, role: string}[]>([])
  const [isAssigning, setIsAssigning] = useState(false)

  const handleOpenPreview = (url: string) => {
    setActivePreviewUrl(url)
    setShowPreview(true)
    setTimeout(() => setPreviewOpen(true), 10)
  }

  const handleClosePreview = () => {
    setPreviewOpen(false)
    setTimeout(() => {
      setShowPreview(false)
      setActivePreviewUrl(null)
    }, 300)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setFetchError(null)
        const res = await fetch(`/api/v1/tickets/${id}`)
        const data = await res.json()
        if (data.success) {
          setTicket(data.data)
        } else {
          setFetchError(data.message || "Gagal memuat detail tiket")
        }
      } catch (err) {
        console.error(err)
        setFetchError("Terjadi kesalahan jaringan saat memuat tiket.")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  useEffect(() => {
    if (profile?.role === "admin") {
      fetch("/api/v1/users?role=agent,admin")
        .then(res => res.json())
        .then(data => {
          if (data.success) setAgents(data.data)
        })
        .catch(err => console.error(err))
    }
  }, [profile])

  const handleAssign = async (agentId: string | null) => {
    setIsAssigning(true)
    try {
      const res = await fetch(`/api/v1/tickets/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: agentId }),
      })
      const data = await res.json()
      if (data.success) {
        if (!agentId) {
          setTicket(prev => prev ? { ...prev, assignedTo: null } : prev)
          toast.success("Penugasan agen berhasil dilepas")
        } else {
          const assignedAgent = agents.find(a => a.id === agentId)
          if (assignedAgent) {
            setTicket(prev => prev ? { ...prev, assignedTo: assignedAgent } : prev)
          }
          toast.success("Tiket berhasil ditugaskan")
        }
      } else {
        toast.error(data.message || "Gagal mengubah penugasan tiket")
      }
    } catch (err) {
      console.error(err)
      toast.error("Terjadi kesalahan koneksi saat mengubah penugasan")
    } finally {
      setIsAssigning(false)
    }
  }

  const handleStatusChange = async (nextStatus: string) => {
    if (!ticket || nextStatus === ticket.status) return
    setIsUpdatingStatus(true)
    try {
      const res = await fetch(`/api/v1/tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setTicket({ ...ticket, status: nextStatus })
        toast.success(`Status tiket diubah menjadi ${statusConfig[nextStatus]?.label || nextStatus}`)
      } else {
        toast.error(`Gagal mengubah status: ${data.message}`)
      }
    } catch (err) {
      console.error(err)
      toast.error("Terjadi kesalahan saat mengubah status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || !profile) return

    try {
      const res = await fetch(`/api/v1/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      })
      const data = await res.json()
      if (data.success) {
        // Append the new comment with the current user's profile
        const newComment: CommentData = {
          ...data.data,
          user: { id: profile.id, fullName: profile.fullName, email: profile.email, role: profile.role },
        }
        setTicket(prev => prev ? { ...prev, comments: [...prev.comments, newComment] } : prev)
        setReply("")
        toast.success("Balasan berhasil dikirim")
      } else {
        toast.error(data.message || "Gagal mengirim balasan")
      }
    } catch (err) {
      console.error(err)
      toast.error("Terjadi kesalahan saat mengirim balasan")
    }
  }

  const handleSubmitFeedback = async () => {
    setFeedbackSubmitted(true)
    try {
      const res = await fetch(`/api/v1/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `[RATING] Karyawan memberikan rating pelayanan: ${rating}/5 Bintang.` }),
      })
      const data = await res.json()
      if (data.success && profile) {
        const newComment: CommentData = {
          ...data.data,
          user: { id: profile.id, fullName: profile.fullName, email: profile.email, role: profile.role },
        }
        setTicket(prev => prev ? { ...prev, comments: [...prev.comments, newComment] } : prev)
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-md h-32 flex flex-col justify-center gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-1/3" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[250px] w-full rounded-2xl" />
            <Skeleton className="h-[150px] w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-[600px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (fetchError || !ticket) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-2xl space-y-4 my-8 max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-destructive">Gagal Memuat Tiket</h2>
        <p className="text-muted-foreground">{fetchError || "Tiket tidak ditemukan atau Anda tidak memiliki akses ke tiket ini."}</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Kembali
        </Button>
      </div>
    )
  }

  const isEmployee = profile?.role === "karyawan"
  const isPrivileged = profile?.role === "admin" || profile?.role === "agent"
  const canRate = isEmployee && ticket.status === "resolved" && !feedbackSubmitted

  return (
    <div className="space-y-6">
      {/* Ticket Header */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-col gap-2 mb-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md border border-border">
                  {ticket.id.slice(0, 8)}
                </span>
                <span className="bg-destructive/10 text-destructive text-xs font-semibold px-2 py-1 rounded-full border border-destructive/20 flex items-center gap-1">
                  <BadgeAlert className="w-3.5 h-3.5" /> 
                  {ticket.priority.toUpperCase()} Priority
                </span>
              </div>
              <div className="flex">
                <span className={cn("text-xs font-semibold px-2 py-1 rounded-full border flex items-center gap-1", statusConfig[ticket.status]?.classes || "bg-muted text-muted-foreground border-border")}>
                  {statusConfig[ticket.status]?.label || ticket.status.toUpperCase()}
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground">{ticket.title}</h2>
          </div>
          
          {isPrivileged && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Ubah Status:</span>
              <Select
                value={ticket.status}
                onValueChange={handleStatusChange}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger className="w-[170px] bg-background">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending">Waiting on User</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Conditional Satisfaction Form */}
          {canRate && (
            <Card className="border-primary bg-primary/5 shadow-md">
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Ticket Resolved!
                </CardTitle>
                <CardDescription>Please rate the service you received to close this ticket.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button 
                      key={star} 
                      onClick={() => setRating(star)}
                      className={`p-1 rounded hover:bg-primary/20 transition-colors ${rating >= star ? 'text-yellow-500' : 'text-muted-foreground'}`}
                    >
                      <Star className="w-8 h-8 fill-current" />
                    </button>
                  ))}
                </div>
                <Button onClick={handleSubmitFeedback} disabled={rating === 0}>
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Description Card */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="border-b border-border px-6 py-4 bg-muted/30">
              <h3 className="text-lg font-semibold text-foreground">Description</h3>
            </div>
            <div className="p-6">
              <p className="text-card-foreground whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </p>
            </div>
            <div className="border-t border-border p-6 bg-card">
              {(() => {
                const attachments = parseAttachmentUrls(ticket.attachmentUrl);
                return (
                  <>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" /> Attachments ({attachments.length})
                    </h4>
                    {attachments.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {attachments.map((url, idx) => (
                          <button 
                            key={idx}
                            onClick={() => handleOpenPreview(url)}
                            className="flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left w-full sm:w-auto min-w-[200px] shadow-sm group"
                          >
                            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                              <Paperclip className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col overflow-hidden max-w-[200px]">
                              <span className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {url.split('/').pop()?.split('?')[0] || `Attachment ${idx + 1}`}
                              </span>
                              <span className="text-xs text-muted-foreground group-hover:text-primary/70 transition-colors">Click to preview</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No attachments provided.</p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Custom Preview Modal Overlay */}
          {activePreviewUrl && showPreview && (
            <div 
              className={cn(
                "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm transition-opacity duration-300 ease-in-out",
                previewOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              )} 
              onClick={handleClosePreview}
            >
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 h-12 w-12 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white transition-colors z-10" 
                onClick={handleClosePreview}
              >
                <X className="w-6 h-6" />
                <span className="sr-only">Close</span>
              </Button>
              <div 
                className={cn(
                  "relative w-full max-w-5xl h-full flex items-center justify-center transition-all duration-300 ease-out transform",
                  previewOpen ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0"
                )} 
                onClick={e => e.stopPropagation()}
              >
                {activePreviewUrl.includes('.pdf') ? (
                  <iframe 
                    src={activePreviewUrl} 
                    className="w-full h-full rounded-xl shadow-2xl bg-white" 
                    title="PDF Preview"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={activePreviewUrl} 
                    alt="Attachment Preview" 
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                  />
                )}
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Requester</p>
                <p className="text-foreground font-semibold">{ticket.createdBy?.fullName || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{ticket.createdBy?.email}</p>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-start gap-3 relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Badge className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Assignee</p>
                
                {profile?.role === "admin" ? (
                  <div className="mt-1">
                    <Select 
                      value={ticket.assignedTo?.id || "unassigned"} 
                      onValueChange={(val) => {
                        handleAssign(val === "unassigned" ? null : val);
                      }}
                      disabled={isAssigning}
                    >
                      <SelectTrigger className="h-8 w-full text-sm font-semibold bg-background border-border/50 hover:bg-muted/50 transition-colors shadow-sm focus:ring-1 focus:ring-primary">
                        <SelectValue placeholder="Select Assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          Unassigned
                        </SelectItem>
                        {agents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ticket.assignedTo?.department && (
                      <p className="text-xs text-muted-foreground mt-2 ml-1">{ticket.assignedTo.department}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-foreground font-semibold mt-1">{ticket.assignedTo?.fullName || 'Unassigned'}</p>
                    <p className="text-sm text-muted-foreground">{ticket.assignedTo?.department || 'N/A'}</p>
                  </>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                <p className="text-foreground font-semibold">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                <p className="text-sm text-muted-foreground">{new Date(ticket.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <BadgeAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                <p className="text-foreground font-semibold">{ticket.category?.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity & Comms */}
        <div className="lg:col-span-1 bg-card border border-border rounded-2xl shadow-sm flex flex-col h-[600px] lg:sticky lg:top-24 overflow-hidden">
          <div className="border-b border-border px-6 py-4 bg-muted/30">
            <h3 className="text-lg font-semibold text-foreground">Activity Thread</h3>
          </div>
          
          {/* Thread Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background/50">
            {ticket.comments
              .filter(comment => {
                if (comment.message.startsWith('[RATING]') && profile?.role !== 'admin') {
                  return false;
                }
                return true;
              })
              .map(comment => {
              const isMine = comment.userId === profile?.id
              const author = comment.user

              return (
                <div key={comment.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border shadow-sm
                    ${isMine ? 'bg-primary text-primary-foreground border-primary/30' : 'bg-muted text-muted-foreground border-border'}`}>
                    {author?.fullName?.charAt(0) || 'U'}
                  </div>
                  <div className={`flex-1 border p-3 shadow-sm ${isMine 
                    ? 'bg-primary/5 border-primary/20 rounded-l-2xl rounded-br-2xl' 
                    : 'bg-card border-border rounded-r-2xl rounded-bl-2xl'}`}>
                    <div className={`flex justify-between items-center mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <span className="font-semibold text-sm">{author?.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">
                      {comment.message.startsWith('[RATING]') ? (
                        <span className="flex items-center gap-2 text-yellow-600 font-semibold bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                          <Star className="w-4 h-4 fill-current" />
                          {comment.message.replace('[RATING]', '').trim()}
                        </span>
                      ) : (
                        comment.message
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add Comment Input */}
          <div className="border-t border-border p-4 bg-card rounded-b-2xl">
            <form onSubmit={handlePostReply} className="flex flex-col gap-3">
              <Textarea 
                placeholder="Type a reply..." 
                className="resize-none border-border bg-background focus-visible:ring-primary shadow-sm"
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!reply.trim() || ticket.status === 'closed'} className="gap-2">
                  <span>Post Reply</span>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
        
      </div>
    </div>
  )
}
