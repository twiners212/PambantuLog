"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

export function useRoleGuard(allowedRoles: string[]) {
  const { profile, loading } = useAuth()
  const router = useRouter()

  const rolesKey = allowedRoles.join(",")

  useEffect(() => {
    if (loading) return;
    
    if (!profile) {
      router.push("/login")
    } else if (!allowedRoles.includes(profile.role)) {
      router.replace("/unauthorized")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading, rolesKey, router])

  return { profile, loading }
}
