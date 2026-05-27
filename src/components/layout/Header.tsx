"use client"

import { useState, useEffect } from "react"
import { Menu, Bell, User, LogOut, Moon, Sun, CheckCircle2 } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { useAuth } from "@/components/auth-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NotificationItem {
  id: string
  message: string
  ticketId: string
  ticketTitle: string
  authorName: string
  createdAt: string
}

export function Header() {
  const { setTheme, theme } = useTheme()
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = createSupabaseBrowserClient()
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [hasUnread, setHasUnread] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (profile) {
      fetch("/api/v1/notifications")
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const clearedAt = localStorage.getItem(`notifications_cleared_${profile.id}`)
            let activeNotifs = data.data
            if (clearedAt) {
              const clearTime = parseInt(clearedAt, 10)
              activeNotifs = activeNotifs.filter((n: NotificationItem) => new Date(n.createdAt).getTime() > clearTime)
            }
            setNotifications(activeNotifs)
            setHasUnread(activeNotifs.length > 0)
          }
        })
        .catch(err => console.error("Failed to load notifications", err))
    }
  }, [profile])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && hasUnread) {
      setHasUnread(false)
    }
  }

  const handleClearNotifications = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (profile && notifications.length > 0) {
      // Menggunakan waktu dari notifikasi terbaru (dari server) untuk mencegah isu perbedaan jam (clock drift) antara server dan komputer klien.
      const maxTime = Math.max(...notifications.map((n) => new Date(n.createdAt).getTime()))
      localStorage.setItem(`notifications_cleared_${profile.id}`, maxTime.toString())
    }
    
    setNotifications([])
    setHasUnread(false)
  }

  const handleLogout = async () => {
    await supabase?.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex justify-between items-center px-6 h-16 w-full sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-muted-foreground p-2 -ml-2 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent md:hidden">PambantuLog</div>
      </div>
      
      <div className="flex items-center gap-4">
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all p-2 rounded-full relative focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background">
              <Bell className="w-5 h-5" />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background animate-pulse"></span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="flex items-center justify-between px-2 py-1">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              {notifications.length > 0 && (
                <button 
                  onClick={handleClearNotifications}
                  className="text-xs text-primary hover:underline px-2"
                >
                  Clear all
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground/50" />
                <p>No new notifications</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.map((notif, index) => (
                  <div key={notif.id}>
                    <DropdownMenuItem 
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                      onClick={() => router.push(`/tickets/${notif.ticketId}`)}
                    >
                      <span className="font-semibold text-sm line-clamp-1">{notif.ticketTitle}</span>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium text-foreground">{notif.authorName}</span>: {notif.message}
                      </span>
                    </DropdownMenuItem>
                    {index < notifications.length - 1 && <DropdownMenuSeparator />}
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden border-2 border-background shadow-sm hover:shadow-md transition-all ml-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background">
              <User className="w-5 h-5 text-primary-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {profile && (
              <>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile.fullName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer">
              {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              Toggle Theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
