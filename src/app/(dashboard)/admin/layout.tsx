"use client"

import { useRoleGuard } from "@/hooks/useRoleGuard"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useRoleGuard(["admin", "agent"])

  if (loading || !profile) {
    return <div className="p-8 text-center text-muted-foreground">Checking permissions...</div>
  }

  if (profile.role !== "admin" && profile.role !== "agent") {
    return null
  }

  return <>{children}</>
}
