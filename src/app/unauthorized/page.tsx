"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { ShieldAlert } from "lucide-react"
import { useRouter } from "next/navigation"

export default function UnauthorizedPage() {
  const { profile } = useAuth()
  const router = useRouter()

  const handleGoBack = () => {
    if (profile?.role === "admin" || profile?.role === "agent") {
      router.push("/admin/tickets")
    } else if (profile?.role === "karyawan") {
      router.push("/employee/tickets")
    } else {
      router.push("/login")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        <div className="w-24 h-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-bold text-foreground">403</h1>
        <h2 className="text-2xl font-semibold text-foreground mt-0">Unauthorized Access</h2>
        <p className="text-muted-foreground">
          Anda tidak memiliki izin (role) yang diperlukan untuk mengakses halaman ini. Jika menurut Anda ini adalah kesalahan, silakan hubungi administrator.
        </p>
        <Button onClick={handleGoBack} size="lg" className="mt-8 w-full">
          Kembali ke Dashboard
        </Button>
      </div>
    </div>
  )
}
