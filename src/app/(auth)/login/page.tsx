"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Headset, ArrowRight, ShieldCheck, Zap, Server } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { refresh } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (data.success) {
        await refresh()
        if (data.user.role === 'admin' || data.user.role === 'agent') {
          router.push("/admin")
        } else {
          router.push("/employee/tickets")
        }
      } else {
        setError(data.message || "Invalid credentials.")
      }
    } catch {
      setError("An error occurred during login.")
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (qEmail: string, qPassword: string) => {
    setLoading(true)
    setError("")
    setEmail(qEmail)
    setPassword(qPassword)

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: qEmail, password: qPassword }),
      })
      const data = await res.json()

      if (data.success) {
        await refresh()
        if (data.user.role === 'admin' || data.user.role === 'agent') {
          router.push("/admin")
        } else {
          router.push("/employee/tickets")
        }
      } else {
        setError(data.message || "Kredensial tidak valid.")
      }
    } catch {
      setError("Terjadi kesalahan saat login.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground selection:bg-primary/20">
      {/* Left Panel - Branding & Welcome (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-muted relative overflow-hidden flex-col justify-between p-12 border-r border-border/50">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute top-[60%] -right-[20%] w-[60%] h-[60%] rounded-full bg-chart-2/10 blur-[100px]" />
          <div className="absolute bottom-0 left-[20%] w-[50%] h-[50%] rounded-full bg-chart-4/5 blur-[80px]" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
            <Headset className="w-7 h-7" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-primary">PambantuLog</span>
        </div>

        <div className="relative z-10 max-w-lg mt-20">
          <h1 className="text-5xl font-bold tracking-tighter leading-[1.1] mb-6">
            Unified Internal <br/>
            <span className="text-primary">Helpdesk Hub.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            A centralized ticketing system to facilitate incident reporting, technical support requests, and operational asset management transparently and measurably.
          </p>

          <div className="space-y-5">
            <div className="flex items-center gap-4 text-sm font-medium text-foreground">
              <div className="w-10 h-10 rounded-full bg-background border shadow-sm flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-chart-2" />
              </div>
              <p>Faster resolution with automated workflows</p>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium text-foreground">
              <div className="w-10 h-10 rounded-full bg-background border shadow-sm flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-chart-4" />
              </div>
              <p>Isolated Role-Based Access Control (RBAC) security</p>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium text-foreground">
              <div className="w-10 h-10 rounded-full bg-background border shadow-sm flex items-center justify-center shrink-0">
                <Server className="w-5 h-5 text-chart-5" />
              </div>
              <p>Modern, fast, and reliable infrastructure</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} PambantuLog Helpdesk System.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Mobile Logo Only */}
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-md">
            <Headset className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-primary">PambantuLog</span>
        </div>

        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Please sign in using your employee credentials.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 text-sm font-medium text-destructive-foreground bg-destructive/90 rounded-xl shadow-sm animate-in zoom-in-95 duration-300">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="email">
                  Email Address
                </label>
                <Input 
                  id="email"
                  type="email" 
                  placeholder="email@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 px-4 bg-muted/50 border-border focus-visible:bg-background focus-visible:ring-primary/30 transition-all rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground" htmlFor="password">
                    Password
                  </label>
                  <a href="#" className="text-xs font-semibold text-primary hover:underline hover:text-primary/80 transition-colors">
                    Forgot password?
                  </a>
                </div>
                <Input 
                  id="password"
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 px-4 bg-muted/50 border-border focus-visible:bg-background focus-visible:ring-primary/30 transition-all rounded-xl"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300" 
              disabled={loading}
            >
              {loading ? "Signing in..." : (
                <span className="flex items-center justify-center gap-2">
                  Sign In <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Dev Mode - Manual Testing */}
          <div className="mt-12 pt-8 border-t border-border relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Quick Access Testing
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full text-xs h-10 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors border-border/60" 
                disabled={loading}
                onClick={() => quickLogin('admin@company.com', 'admin123')}
              >
                Admin Login
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full text-xs h-10 rounded-lg hover:bg-chart-2/5 hover:text-chart-2 transition-colors border-border/60" 
                disabled={loading}
                onClick={() => quickLogin('karyawan@company.com', 'user123')}
              >
                User Login
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full text-xs h-10 rounded-lg hover:bg-chart-4/5 hover:text-chart-4 transition-colors border-border/60" 
                disabled={loading}
                onClick={() => quickLogin('john@support', 'support123')}
              >
                Agent Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
