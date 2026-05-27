import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen print:h-auto overflow-hidden print:overflow-visible bg-background print:bg-white">
      <div className="print:hidden shrink-0 flex">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden print:overflow-visible w-full">
        <div className="print:hidden">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible p-4 md:p-6 lg:p-12 print:p-0">
          <div className="max-w-[1440px] mx-auto print:max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
