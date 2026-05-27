"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { User, Lock, Save, Loader2 } from "lucide-react"

export default function ProfilePage() {
  const { profile, refresh } = useAuth()
  const [loading, setLoading] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  
  const [fullName, setFullName] = useState("")
  const [department, setDepartment] = useState("")
  
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (profile) {
      Promise.resolve().then(() => {
        setFullName(profile.fullName || "")
        setDepartment(profile.department || "")
      })
    }
  }, [profile])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, department }),
      })
      
      const data = await res.json()
      if (data.success) {
        toast.success("Profile updated successfully")
        await refresh()
      } else {
        toast.error(data.message || "Failed to update profile")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long")
      return
    }
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setPassLoading(true)
    const supabase = createSupabaseBrowserClient()
    
    if (!supabase) {
      toast.success("Mock: Password updated successfully")
      setPassword("")
      setConfirmPassword("")
      setPassLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Password updated successfully")
        setPassword("")
        setConfirmPassword("")
      }
    } catch {
      toast.error("An error occurred while updating password")
    } finally {
      setPassLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Profile & Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account preferences and security</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card className="border-border shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle>Personal Information</CardTitle>
            </div>
            <CardDescription>Update your display name and department</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium leading-none">Email Address</label>
                <Input id="email" value={profile?.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-medium leading-none">Role</label>
                <Input id="role" value={profile?.role || ""} disabled className="bg-muted capitalize" />
              </div>

              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium leading-none">Full Name</label>
                <Input 
                  id="fullName" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="department" className="text-sm font-medium leading-none">Department</label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department">
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
            </CardContent>
            <CardFooter className="bg-muted/30 pt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto ml-auto">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Security */}
        <Card className="border-border shadow-md h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium leading-none">New Password</label>
                <Input 
                  id="newPassword" 
                  type="password"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium leading-none">Confirm Password</label>
                <Input 
                  id="confirmPassword" 
                  type="password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="Confirm new password"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 pt-6">
              <Button type="submit" variant="secondary" disabled={passLoading} className="w-full sm:w-auto ml-auto">
                {passLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Update Password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
