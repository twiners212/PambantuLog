"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Headset, Ticket, PlusCircle, List, UserPlus, Settings, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"

export function Sidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  
  const isAdminOrAgent = profile?.role === 'admin' || profile?.role === 'agent'
  const isAdmin = profile?.role === 'admin'

  const links = [
    { name: "My Tickets", href: "/employee/tickets", icon: Ticket, show: true },
    { name: "Submit Ticket", href: "/employee/create", icon: PlusCircle, show: true },
    { name: "Dashboard Analytics", href: "/admin", icon: Activity, show: isAdminOrAgent },
    { name: "Master List", href: "/admin/tickets", icon: List, show: isAdminOrAgent },
    { name: "Create Employee", href: "/admin/employees/create", icon: UserPlus, show: isAdmin },
    { name: "Profile & Settings", href: "/profile", icon: Settings, show: true },
  ]

  return (
    <nav className="flex flex-col gap-1 p-4 fixed md:relative z-40 left-0 top-0 h-full w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex shrink-0">
      <div className="mb-12 px-2 flex items-center gap-3">
        <div aria-label="Organization Logo" className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold shadow-sm">
          <Headset className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-sidebar-foreground">PambantuLog</h1>
          <p className="text-sm text-sidebar-foreground/70">Internal Support</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        {links.filter(l => l.show).map((link) => {
          const isActive = pathname === link.href
          const Icon = link.icon
          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold text-sm",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{link.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
