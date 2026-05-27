"use client"

import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Activity, Clock, CheckCircle, Ticket, AlertCircle, TrendingUp, Printer } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface TicketData {
  id: string
  status: string
  createdAt: string
  assignedTo?: { id: string; fullName: string; department: string | null } | null
}

const statusConfig: Record<string, { label: string, color: string, icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'var(--color-chart-1)', icon: <Ticket className="w-5 h-5" /> },
  in_progress: { label: 'In Progress', color: 'var(--color-chart-2)', icon: <Activity className="w-5 h-5" /> },
  pending: { label: 'Waiting', color: 'var(--color-chart-3)', icon: <AlertCircle className="w-5 h-5" /> },
  resolved: { label: 'Resolved', color: 'var(--color-chart-4)', icon: <CheckCircle className="w-5 h-5" /> },
  closed: { label: 'Closed', color: 'var(--color-chart-5)', icon: <Clock className="w-5 h-5" /> },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-md border border-border/50 p-4 rounded-xl shadow-xl">
        <p className="font-bold text-foreground mb-1">{label || payload[0].name}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
          <p className="text-muted-foreground font-medium">
            Tickets: <span className="text-foreground font-bold">{payload[0].value}</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

const StatCard = ({ title, value, icon, color, loading }: { title: string, value: number, icon: React.ReactNode, color: string, loading: boolean }) => (
  <Card 
    className="group relative overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 bg-card print:hidden"
  >
    <div 
      className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 blur-2xl" 
      style={{ backgroundColor: color }} 
    />
    <div 
      className="absolute left-0 top-0 w-1 h-full opacity-70 group-hover:opacity-100 transition-opacity" 
      style={{ backgroundColor: color }} 
    />
    
    <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
      <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
      <div 
        className="p-2 rounded-lg transition-transform duration-300 group-hover:scale-110 shadow-sm relative overflow-hidden"
        style={{ color: color }}
      >
        <div className="absolute inset-0 opacity-15" style={{ backgroundColor: color }} />
        <div className="relative z-10">{icon}</div>
      </div>
    </CardHeader>
    <CardContent className="relative z-10">
      {loading ? (
        <Skeleton className="h-10 w-20 rounded-lg" />
      ) : (
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-extrabold tracking-tighter text-foreground">{value}</div>
        </div>
      )}
    </CardContent>
  </Card>
)

export default function AdminDashboardPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === "admin"

  const [tickets, setTickets] = useState<TicketData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [timeRange, setTimeRange] = useState("all") // all, daily, monthly, yearly
  const [selectedAgent, setSelectedAgent] = useState("all")
  const [agents, setAgents] = useState<{id: string, fullName: string, department: string | null}[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/v1/tickets`)
        const data = await res.json()
        setTickets(data.data || [])
        
        // Fetch agents if admin
        if (isAdmin) {
          const agentRes = await fetch("/api/v1/users?role=agent")
          const agentData = await agentRes.json()
          if (agentData.success) {
            setAgents(agentData.data)
          }
        }
      } catch (err) {
        console.error("Failed to fetch data", err)
      } finally {
        setLoading(false)
      }
    }
    
    // Only fetch when profile is ready to know if admin
    if (profile) {
      fetchData()
    }
  }, [profile, isAdmin])

  // Filter Logic
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // 1. Filter by Agent
      if (isAdmin) {
        if (selectedAgent !== "all") {
          if (t.assignedTo?.id !== selectedAgent) return false;
        }
      } else {
        // If not admin (i.e. agent), API already filters assigned tickets, but just to be safe
        if (t.assignedTo?.id !== profile?.id) return false;
      }

      // 2. Filter by Time Range
      if (timeRange !== "all" && t.createdAt) {
        const ticketDate = new Date(t.createdAt)
        const now = new Date()
        
        if (timeRange === "daily") {
          if (ticketDate.toDateString() !== now.toDateString()) return false;
        } else if (timeRange === "monthly") {
          if (ticketDate.getMonth() !== now.getMonth() || ticketDate.getFullYear() !== now.getFullYear()) return false;
        } else if (timeRange === "yearly") {
          if (ticketDate.getFullYear() !== now.getFullYear()) return false;
        }
      }
      return true;
    })
  }, [tickets, selectedAgent, timeRange, isAdmin, profile])

  const counts = {
    open: filteredTickets.filter(t => t.status === "open").length,
    in_progress: filteredTickets.filter(t => t.status === "in_progress").length,
    pending: filteredTickets.filter(t => t.status === "pending").length,
    resolved: filteredTickets.filter(t => t.status === "resolved").length,
    closed: filteredTickets.filter(t => t.status === "closed").length,
  }
  const totalTickets = filteredTickets.length;

  const chartData = [
    { name: 'Open', count: counts.open, fill: statusConfig.open.color },
    { name: 'In Progress', count: counts.in_progress, fill: statusConfig.in_progress.color },
    { name: 'Waiting', count: counts.pending, fill: statusConfig.pending.color },
    { name: 'Resolved', count: counts.resolved, fill: statusConfig.resolved.color },
    { name: 'Closed', count: counts.closed, fill: statusConfig.closed.color },
  ]

  // Narrative generation
  const resolutionRate = totalTickets > 0 ? ((counts.resolved + counts.closed) / totalTickets) * 100 : 0
  let performanceNarrative = ""
  let strengthStr = ""
  let recommendationStr = ""

  if (totalTickets === 0) {
    performanceNarrative = "Belum ada data tiket untuk periode ini."
    strengthStr = "-"
    recommendationStr = "-"
  } else {
    if (resolutionRate >= 80) {
      performanceNarrative = "Kinerja sangat baik. Sebagian besar beban kerja berhasil diselesaikan dengan tingkat resolusi tinggi tanpa penumpukan (bottleneck) yang signifikan."
      strengthStr = "Resolusi masalah yang cepat dan efisien. Rasio penyelesaian di atas ekspektasi."
      recommendationStr = "Pertahankan ritme kerja dan dokumentasikan solusi-solusi dari kasus yang sering muncul untuk referensi bersama."
    } else if (resolutionRate >= 50) {
      performanceNarrative = "Kinerja cukup baik dengan beban kerja yang masih stabil, meskipun ada beberapa tiket yang masih berjalan (In Progress)."
      strengthStr = "Mampu mengelola volume tiket yang masuk secara teratur."
      recommendationStr = "Percepat tindak lanjut pada tiket yang berada di status 'In Progress' agar tidak terjadi antrean panjang."
    } else {
      performanceNarrative = "Terdapat penumpukan tiket yang belum terpecahkan. Mayoritas tiket masih dalam status Open atau Waiting."
      strengthStr = "Respons awal terhadap tiket masuk terlihat."
      recommendationStr = "Fokus pada penyelesaian tiket lama. Lakukan koordinasi dengan tim jika menghadapi kendala teknis (blocker)."
    }
    
    if (counts.pending > counts.in_progress) {
      recommendationStr += " Terdapat banyak tiket berstatus 'Waiting on User', segera berikan follow-up atau konfirmasi batas waktu ke pelapor."
    }
  }

  // Target Print Agent metadata
  const printAgentName = isAdmin 
    ? (selectedAgent === "all" ? "Seluruh Agen (Sistem)" : agents.find(a => a.id === selectedAgent)?.fullName || "-")
    : profile?.fullName;
  const printDepartment = isAdmin
    ? (selectedAgent === "all" ? "All Departments" : agents.find(a => a.id === selectedAgent)?.department || "-")
    : profile?.department;


  return (
    <div className="space-y-8 pb-8">
      {/* -------------------- PRINT ONLY PERFORMANCE REVIEW REPORT -------------------- */}
      <div className="hidden print:block font-sans text-black bg-white min-h-screen">
        
        {/* REPORT HEADER */}
        <div className="border-b border-gray-300 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif text-gray-900 mb-1">PERFORMANCE REVIEW REPORT</h1>
            <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">PambantuLog &bull; Internal IT Support &amp; Helpdesk</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-mono">REPORT ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}-{new Date().getFullYear()}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">GENERATED: {new Date().toLocaleString('id-ID')}</p>
          </div>
        </div>

        {/* METADATA SECTION */}
        <div className="mb-10">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">I. Document Information</h2>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <table className="w-full text-left">
              <tbody>
                <tr className="border-b border-gray-100"><th className="py-2 text-gray-500 font-medium w-1/3">Employee Name</th><td className="py-2 font-semibold text-gray-900">{printAgentName}</td></tr>
                <tr className="border-b border-gray-100"><th className="py-2 text-gray-500 font-medium">Department</th><td className="py-2 font-semibold text-gray-900">{printDepartment}</td></tr>
              </tbody>
            </table>
            <table className="w-full text-left">
              <tbody>
                <tr className="border-b border-gray-100"><th className="py-2 text-gray-500 font-medium w-1/3">Reporting Period</th><td className="py-2 font-semibold text-gray-900 capitalize">{timeRange}</td></tr>
                <tr className="border-b border-gray-100"><th className="py-2 text-gray-500 font-medium">Total Workload</th><td className="py-2 font-semibold text-gray-900">{totalTickets} Tickets</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* METRICS SECTION */}
        <div className="mb-10">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">II. Statistical Summary</h2>
          <div className="grid grid-cols-5 gap-0 border-y border-gray-300 divide-x divide-gray-300">
            <div className="p-4 text-center">
              <p className="text-4xl font-light text-gray-900 mb-2">{counts.open}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Open</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-4xl font-light text-gray-900 mb-2">{counts.in_progress}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">In Progress</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-4xl font-light text-gray-900 mb-2">{counts.pending}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Waiting</p>
            </div>
            <div className="p-4 text-center bg-gray-50">
              <p className="text-4xl font-semibold text-gray-900 mb-2">{counts.resolved}</p>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Resolved</p>
            </div>
            <div className="p-4 text-center bg-gray-50">
              <p className="text-4xl font-semibold text-gray-900 mb-2">{counts.closed}</p>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Closed</p>
            </div>
          </div>
        </div>

        {/* ANALYSIS SECTION */}
        <div className="mb-12">
           <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">III. Executive Analysis & Evaluation</h2>
           
           <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Performance Overview</h3>
              <p className="text-sm text-gray-700 leading-relaxed text-justify">{performanceNarrative}</p>
           </div>
           
           <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 border-l-2 border-gray-400 pl-2">Key Strengths</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{strengthStr}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 border-l-2 border-gray-400 pl-2">Recommendations for Improvement</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{recommendationStr}</p>
              </div>
           </div>
        </div>

        {/* SIGNATURES */}
        <div className="mt-20 pt-8">
          <div className="grid grid-cols-3 gap-8 text-center text-sm">
            <div>
              <p className="mb-20 text-gray-600">Prepared By,</p>
              <div className="border-b border-gray-400 mx-8 mb-2"></div>
              <p className="font-semibold text-gray-900">System Administrator</p>
            </div>
            <div>
              <p className="mb-20 text-gray-600">Reviewed By,</p>
              <div className="border-b border-gray-400 mx-8 mb-2"></div>
              <p className="font-semibold text-gray-900">Supervisor / Manager</p>
            </div>
            <div>
              <p className="mb-20 text-gray-600">Acknowledged By,</p>
              <div className="border-b border-gray-400 mx-8 mb-2"></div>
              <p className="font-semibold text-gray-900">{printAgentName}</p>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="fixed bottom-0 left-0 w-full text-center pb-4 text-[10px] text-gray-400 font-mono border-t border-gray-100 pt-4 mt-16">
          <p>CONFIDENTIAL &bull; PAMBANTULOG SYSTEM &bull; GENERATED VIA AUTOMATED REPORTING MODULE</p>
        </div>
      </div>
      {/* ----------------------------------------------------------------------------- */}

      {/* -------------------- NORMAL DASHBOARD UI (HIDDEN ON PRINT) -------------------- */}
      <div className="print:hidden space-y-8">
        <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              Dashboard Analytics
              <TrendingUp className="w-8 h-8 text-primary opacity-80" />
            </h1>
            <p className="text-muted-foreground text-lg">Real-time overview of support tickets and system workload.</p>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-border/50">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] bg-card">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="daily">Hari Ini</SelectItem>
                <SelectItem value="monthly">Bulan Ini</SelectItem>
                <SelectItem value="yearly">Tahun Ini</SelectItem>
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[180px] bg-card">
                  <SelectValue placeholder="Pilih Agen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Agen</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button onClick={() => window.print()} className="flex items-center gap-2 shadow-sm">
              <Printer className="w-4 h-4" />
              Export Review (PDF)
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Open Tickets" value={counts.open} icon={<Ticket className="w-5 h-5" />} color={statusConfig.open.color} loading={loading} />
          <StatCard title="In Progress" value={counts.in_progress} icon={<Activity className="w-5 h-5" />} color={statusConfig.in_progress.color} loading={loading} />
          <StatCard title="Waiting on User" value={counts.pending} icon={<AlertCircle className="w-5 h-5" />} color={statusConfig.pending.color} loading={loading} />
          <StatCard title="Resolved" value={counts.resolved} icon={<CheckCircle className="w-5 h-5" />} color={statusConfig.resolved.color} loading={loading} />
          <StatCard title="Closed" value={counts.closed} icon={<Clock className="w-5 h-5" />} color={statusConfig.closed.color} loading={loading} />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-lg border-border/50 md:col-span-2 overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b border-border/30 bg-muted/20 pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Ticket Distribution
              </CardTitle>
              <CardDescription className="text-sm font-medium">Visual breakdown of tickets by their current status</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-[350px] w-full rounded-xl" />
              ) : filteredTickets.length > 0 ? (
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 13, fontWeight: 500 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 13, fontWeight: 500 }}
                      />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-muted)', opacity: 0.3, radius: 8 }} />
                      <Bar 
                        dataKey="count" 
                        radius={[6, 6, 0, 0]} 
                        animationDuration={1500}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground font-medium bg-muted/10 rounded-xl">
                  No tickets found to display chart.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b border-border/30 bg-muted/20 pb-4">
              <CardTitle className="text-xl font-bold">Status Breakdown</CardTitle>
              <CardDescription className="text-sm font-medium">Proportional view of workloads</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-[350px] w-full rounded-xl" />
              ) : filteredTickets.length > 0 ? (
                <div className="h-[350px] w-full flex flex-col">
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie
                        data={chartData.filter(d => d.count > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="count"
                        stroke="none"
                        animationDuration={1500}
                        animationEasing="ease-out"
                      >
                        {chartData.filter(d => d.count > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="h-1/5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-2">
                    {chartData.filter(d => d.count > 0).map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.fill }} />
                        {entry.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                 <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground font-medium bg-muted/10 rounded-xl">
                  No data available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
