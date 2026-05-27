"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/components/auth-provider"
import { UserPlus } from "lucide-react"

export default function CreateEmployeePage() {
  const router = useRouter()
  const { profile } = useAuth()
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    department: "",
    role: "karyawan",
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Only admins can create employees
  if (profile && profile.role !== "admin") {
    return (
      <div className="p-8 text-center text-destructive font-semibold">
        Access Denied. You do not have permission to view this page.
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      
      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess("Employee created successfully!")
        setFormData({
          fullName: "",
          email: "",
          password: "",
          department: "",
          role: "karyawan",
        })
      } else {
        setError(data.message || "Failed to create employee")
      }
    } catch (err) {
      setError("An error occurred while creating the employee.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <UserPlus className="w-8 h-8" />
          Create Employee
        </h1>
        <p className="text-muted-foreground mt-2">
          Add a new user to the system. They will receive an email confirmation if configured.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Employee Details</CardTitle>
            <CardDescription>Enter the basic information and role for the new user.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm font-semibold text-destructive-foreground bg-destructive rounded-md border border-destructive-foreground/20 shadow-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 text-sm font-semibold text-emerald-800 bg-emerald-100 rounded-md border border-emerald-200 shadow-sm">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Full Name</label>
              <Input
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="john.doe@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Temporary Password</label>
                <Input
                  type="password"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Department</label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HRD">HRD</SelectItem>
                    <SelectItem value="Finance & Accounting">Finance & Accounting</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="Procurement">Procurement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Role</label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="karyawan">Karyawan (Standard User)</SelectItem>
                    <SelectItem value="agent">Agent (Support Staff)</SelectItem>
                    <SelectItem value="admin">Admin (System Administrator)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t pt-6 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/tickets")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Employee"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
