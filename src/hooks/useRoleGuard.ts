"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

export function useRoleGuard(allowedRoles: string[]) {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return;
    
    if (!profile) {
      router.push("/login")
    } else if (!allowedRoles.includes(profile.role)) {
      router.replace("/unauthorized")
    }
  }, [profile, loading, allowedRoles, router])

  return { profile, loading }
}
