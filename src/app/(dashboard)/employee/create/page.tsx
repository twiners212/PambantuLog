"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
}

export default function CreateTicketPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [priority, setPriority] = useState("medium")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState("")

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const ALLOWED_TYPES = ["image/png", "image/jpeg", "application/pdf"]

  // Fetch categories from the DB
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/v1/categories")
        if (res.ok) {
          const data = await res.json()
          setCategories(data.data || [])
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchCategories()
  }, [])

  const handleFileChange = (selectedFile: File | null) => {
    setFileError("")
    if (!selectedFile) {
      setFile(null)
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError("File exceeds 5MB limit.")
      return
    }
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setFileError("Only PNG, JPG, and PDF files are allowed.")
      return
    }
    setFile(selectedFile)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (fileError) return
    setLoading(true)

    if (!title || !categoryId || !description) {
      toast.error("Please fill in all required fields (Title, Category, Description)")
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append("title", title)
      formData.append("categoryId", categoryId)
      formData.append("priority", priority)
      formData.append("description", description)
      if (file) {
        formData.append("file", file)
      }

      const res = await fetch("/api/v1/tickets", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Ticket submitted successfully")
        router.push("/employee/tickets")
      } else {
        console.error("Submission failed:", data.message)
        toast.error(data.message || "Failed to submit ticket")
      }
    } catch (err) {
      console.error(err)
      toast.error("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Submit a Request</h1>
        <p className="text-muted-foreground mt-2">Please provide details about the issue you&apos;re facing.</p>
      </div>

      <Card className="border-outline-variant shadow-sm">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Issue Title</label>
              <Input 
                placeholder="E.g., Cannot access VPN" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Category</label>
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Priority</label>
                <Select value={priority} onValueChange={setPriority} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description</label>
              <Textarea 
                placeholder="Please describe the issue in detail..." 
                className="min-h-[120px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Attachment (Optional)</label>
              <div 
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative overflow-hidden",
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                {file ? (
                  <div className="flex flex-col items-center">
                    <p className="text-sm font-medium text-primary">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF up to 5MB</p>
                  </>
                )}
                <Input 
                  id="file-upload" 
                  type="file" 
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden" 
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </div>
              {fileError && <p className="text-xs text-destructive mt-1 font-medium">{fileError}</p>}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/50 border-t p-6 rounded-b-xl flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading || !!fileError}>
              {loading ? "Submitting..." : "Submit Ticket"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
