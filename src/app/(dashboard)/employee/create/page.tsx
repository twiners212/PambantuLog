"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadCloud, CheckCircle2, Loader2, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  validateAttachments,
  compressImage,
  ALLOWED_EXTENSIONS,
} from "@/lib/file-compression";
import { generateIdempotencyToken } from "@/lib/idempotency";

interface Category {
  id: string;
  name: string;
}

export default function CreateTicketPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  
  const [file, setFile] = useState<File | null>(null)
  const [rawSize, setRawSize] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState("")
  
  // Anti-double submission token per form lifecycle
  const [idempotencyKey] = useState(() => generateIdempotencyToken())

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

  const handleFileChange = async (selectedFile: File | null) => {
    setFileError("")
    if (!selectedFile) {
      setFile(null)
      setRawSize(null)
      return
    }

    // 1. Strict validation (whitelist, blacklist executables, max size)
    const validation = validateAttachments([selectedFile], { maxFiles: 5, maxRawSizeMb: 10 });
    if (!validation.isValid) {
      setFileError(validation.error || "Berkas tidak valid");
      toast.error(validation.error || "Berkas tidak valid");
      return;
    }

    setRawSize(selectedFile.size);

    // 2. Client-side Image Compression (WebP/JPEG, max 1920px, target 300-600 KB)
    const isImage = selectedFile.type.startsWith("image/");
    if (isImage) {
      setCompressing(true);
      try {
        const compressed = await compressImage(selectedFile, {
          maxWidth: 1920,
          initialQuality: 0.8,
          minQuality: 0.65,
          targetMaxSizeKb: 600,
        });

        setFile(compressed);
        const originalKb = (selectedFile.size / 1024).toFixed(0);
        const compressedKb = (compressed.size / 1024).toFixed(0);
        toast.success(`Gambar terkompresi: ${originalKb} KB → ${compressedKb} KB`);
      } catch (err) {
        console.warn("Gagal mengompresi gambar, menggunakan berkas asli:", err);
        setFile(selectedFile);
      } finally {
        setCompressing(false);
      }
    } else {
      // Non-image (.pdf, .log) passthrough
      setFile(selectedFile);
    }
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
    if (fileError || compressing) return

    // Quick client-side check matching Zod schema
    if (title.trim().length < 5) {
      toast.error("Judul tiket minimal 5 karakter")
      return
    }
    if (title.trim().length > 150) {
      toast.error("Judul tiket maksimal 150 karakter")
      return
    }
    if (!categoryId) {
      toast.error("Silakan pilih kategori tiket")
      return
    }
    if (!description.trim()) {
      toast.error("Deskripsi tiket tidak boleh kosong")
      return
    }
    if (description.trim().length > 3000) {
      toast.error("Deskripsi tiket maksimal 3.000 karakter")
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("title", title.trim())
      formData.append("categoryId", categoryId)
      formData.append("priority", priority)
      formData.append("description", description.trim())
      formData.append("idempotencyKey", idempotencyKey)
      if (file) {
        formData.append("file", file)
      }

      const res = await fetch("/api/v1/tickets", {
        method: "POST",
        headers: {
          "X-Idempotency-Key": idempotencyKey,
        },
        body: formData,
      })

      const data = await res.json()

      if (res.status === 429) {
        toast.error(data.message || "Batas pembuatan tiket tercapai. Coba lagi nanti.")
        return
      }

      if (res.status === 409) {
        toast.warning(data.message || "Permintaan tiket sedang diproses.")
        return
      }

      if (data.success) {
        toast.success("Tiket berhasil diajukan!")
        router.push("/employee/tickets")
      } else {
        // Display validation errors if returned
        if (data.errors) {
          const firstErr = Object.values(data.errors)[0] as string[];
          toast.error(firstErr?.[0] || data.message || "Validasi gagal")
        } else {
          toast.error(data.message || "Gagal mengajukan tiket")
        }
      }
    } catch (err) {
      console.error(err)
      toast.error("Terjadi kesalahan jaringan atau server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Buat Tiket Baru</h1>
        <p className="text-muted-foreground mt-2">
          Jelaskan kendala atau permintaan bantuan yang Anda hadapi.
        </p>
      </div>

      <Card className="border-outline-variant shadow-sm">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex justify-between">
                <span>Judul Kendala *</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {title.length}/150 karakter (min. 5)
                </span>
              </label>
              <Input 
                placeholder="Contoh: Tidak dapat terhubung ke VPN kantor" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Kategori *</label>
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Tingkat Prioritas *</label>
                <Select value={priority} onValueChange={setPriority} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih prioritas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low (Rendah)</SelectItem>
                    <SelectItem value="MEDIUM">Medium (Sedang)</SelectItem>
                    <SelectItem value="HIGH">High (Tinggi)</SelectItem>
                    <SelectItem value="URGENT">Urgent (Kritis)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex justify-between">
                <span>Deskripsi Rinci *</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {description.length}/3.000 karakter
                </span>
              </label>
              <Textarea 
                placeholder="Jelaskan kronologi kendala, langkah yang sudah dicoba, dan pesan kesalahan yang muncul..." 
                className="min-h-[140px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={3000}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-foreground">
                  Lampiran Berkas (Opsional)
                </label>
                <span className="text-xs text-muted-foreground">
                  Maks. 5 berkas, format: {ALLOWED_EXTENSIONS.join(", ")}
                </span>
              </div>
              
              <div 
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative overflow-hidden",
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  compressing && "opacity-75 pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                {compressing ? (
                  <div className="flex flex-col items-center py-2">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                    <p className="text-sm font-semibold text-foreground">Mengompresi Gambar...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Menyesuaikan resolusi dan kualitas (WebP/JPEG)
                    </p>
                  </div>
                ) : file ? (
                  <div className="flex flex-col items-center py-1">
                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                      {file.type.startsWith("image/") ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                      <span>{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span className="bg-muted px-2 py-0.5 rounded font-mono">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      {rawSize && rawSize !== file.size && (
                        <span className="text-emerald-600 font-medium">
                          (Dihemat {(((rawSize - file.size) / rawSize) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3 text-xs text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setRawSize(null);
                      }}
                    >
                      Hapus Berkas
                    </Button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">Klik untuk memilih</span> atau seret berkas ke sini
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Otomatis dikompresi ke 300–600 KB & maks. 1920px. Format skrip (.exe, .sh) ditolak.
                    </p>
                  </>
                )}

                <Input 
                  id="file-upload" 
                  type="file" 
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.log"
                  className="hidden" 
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </div>

              {fileError && (
                <div className="flex items-center gap-1.5 text-xs text-destructive mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="bg-muted/50 border-t p-6 rounded-b-xl flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading || compressing || !!fileError}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mengirimkan...
                </>
              ) : (
                "Kirim Tiket"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
