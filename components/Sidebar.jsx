"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  Activity,
  ShoppingCart,
  FileCheck,
  CheckSquare,
  Truck,
  Calendar,
  Package,
  FileText,
  Receipt,
  Scale,
  LogOut,
  User,
  RotateCcw,
  PackageCheck,
  BadgeCheck,
  ShieldCheck,
  Users,
} from "lucide-react"

// Map page names to icons
const pageIcons = {
  "Dashboard": LayoutDashboard,
  "Process Dashboard": Activity,
  "Order": ShoppingCart,
  "Check PO": FileCheck,
  "Received Accounts": FileText,
  "Arrange Logistics": Truck,
  "Logistics Approval": CheckSquare,
  "Check for Delivery": Truck,
  "Dispatch Planning": Calendar,
  "Accounts Approval": BadgeCheck,
  "Logistic": Package,
  "Load Material": Truck,
  "Invoice": Receipt,
  "TC": FileCheck,
  "Wetman Entry": Scale,
  "Material Return": RotateCcw,
  "Fullkitting": PackageCheck,
  "Return of Material": RotateCcw,
  "Retention": Receipt,
  "Management Approval": ShieldCheck,
  "Debit Note": FileText,
  "Bilty Update": PackageCheck,
  "Make PI": FileText,
  "Received PI Payment": Receipt,
  "Manage Users": Users,
}

const pageRoutes = {
  "Dashboard": "/dashboard",
  "Process Dashboard": "/process-dashboard",
  "Order": "/order",
  "Make PI": "/payments-pi",
  "Received PI Payment": "/received-pi-payment",
  "Check PO": "/check-po",
  "Received Accounts": "/received-accounts",
  "Arrange Logistics": "/arrange-logistics",
  "Logistics Approval": "/logistics-approval",
  "Check for Delivery": "/check-delivery",
  "Dispatch Planning": "/dispatch-planning",
  "Accounts Approval": "/accounts-approval",
  "Logistic": "/logistic",
  "Load Material": "/load-material",
  "Invoice": "/invoice",
  "Fullkitting": "/fullkitting",
  "TC": "/tc",
  "Wetman Entry": "/wetman-entry",
  "Bilty Entry": "/bilty-entry",
  "MATERIAL RECEIPT": "/material-receipt",
  "Material Return": "/material-return",
  "Return of Material": "/return-of-material",
  "Retention": "/retention",
  "Management Approval": "/management-approval",
  "Debit Note": "/debit-note",
  "Bilty Update": "/logistics-fulfillment",
  "Manage Users": "/manage-users",
}

const defaultPageOrder = [
  "Dashboard",
  "Process Dashboard",
  "Order",
  "Check PO",
  "Received Accounts",
  "Check for Delivery",
  "Arrange Logistics",
  "Logistics Approval",
  "Dispatch Planning",
  "Accounts Approval",
  "Logistic",
  "Load Material",
  "Wetman Entry",
  "Invoice",
  "TC",
  "Bilty Update",
  "Fullkitting",
  "Material Return",
  "Management Approval",
  "Debit Note",
  "Return of Material",
  "Retention",
  "Make PI",
  "Received PI Payment"
]

export default function Sidebar({ user, onLogout, sidebarOpen, setSidebarOpen }) {
  const pathname = usePathname()

  // Get user's accessible pages and sort them
  const hasAllAccess = user.pageAccess && user.pageAccess.some(p => p.toLowerCase().trim() === "all");
  const isAdmin = user.role === "ADMIN";

  const userPages = (() => {
    const pages = hasAllAccess
      ? [...defaultPageOrder]
      : (user.pageAccess || [])
          .filter(page => pageIcons[page])
          .sort((a, b) => {
            const indexA = defaultPageOrder.indexOf(a);
            const indexB = defaultPageOrder.indexOf(b);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });
    // Always show Manage Users for master role
    if (isAdmin && !pages.includes("Manage Users")) pages.push("Manage Users");
    return pages;
  })();

  // Helper to check if page is active
  const isPageActive = (pageName) => {
    const route = pageRoutes[pageName]
    if (pageName === "Dashboard" && pathname === "/dashboard") return true
    return pathname === route
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-white shadow-lg flex-col border-r border-[#5b6e33]/10">
        <SidebarContent
          user={user}
          pathname={pathname}
          onLogout={onLogout}
          userPages={userPages}
          setSidebarOpen={setSidebarOpen}
        />
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="PASMIN Logo" width={60} height={60} style={{ height: 'auto' }} className="rounded-lg" />
            <h1 className="text-xl font-bold text-gray-800">Order Management System</h1>
          </div>
        </div>
        <SidebarContent
          user={user}
          pathname={pathname}
          onLogout={onLogout}
          userPages={userPages}
          isMobile={true}
          setSidebarOpen={setSidebarOpen}
        />
      </div>
    </>
  )
}

function SidebarContent({ user, pathname, onLogout, userPages, isMobile = false, setSidebarOpen }) {

  const isPageActive = (pageName) => {
    const route = pageRoutes[pageName];
    // Exact match or sub-route
    return pathname === route;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header - only show on desktop */}
      {!isMobile && (
        <div className="p-6 border-b bg-gradient-to-b from-[#5b6e33]/5 to-transparent">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-1.5 rounded-xl bg-[#5b6e33]/10">
              <Image src="/logo.png" alt="PASMIN Logo" width={56} height={56} style={{ height: 'auto' }} className="rounded-lg" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">Order Management System</h1>
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <User className="h-4 w-4 text-[#5b6e33]/70 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {user.firm} - {user.role}
              </p>

            </div>
          </div>
        </div>
      )}

      {/* Mobile user info */}
      {isMobile && (
        <div className="p-4 border-b bg-[#5b6e33]/5">
          <div className="flex items-center space-x-3">
            <div className="bg-[#5b6e33] rounded-full p-2">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {user.firm} - {user.role}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Access: {userPages.length} pages
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {userPages.length > 0 ? (
            userPages.map((pageName) => {
              const Icon = pageIcons[pageName] || FileText
              const isActive = isPageActive(pageName)
              const route = pageRoutes[pageName] || "#"

              return (
                <li key={pageName}>
                  <Link href={route} onClick={() => isMobile && setSidebarOpen(false)}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={`w-full justify-start text-left h-auto min-h-[40px] py-2 whitespace-normal border-l-4 rounded-l-none transition-colors ${isActive
                        ? "bg-[#5b6e33] text-white hover:bg-[#48581f] border-l-[#3a4717] shadow-sm"
                        : "text-gray-700 hover:bg-[#5b6e33]/10 border-l-transparent"
                        }`}
                    >
                      <Icon className="mr-3 h-4 w-4 flex-shrink-0 self-start mt-0.5" />
                      <span className="flex-1 leading-tight text-left">{pageName === "Wetman Entry" ? "Weighment Entry" : pageName === "Debit Note" ? "Credit Note" : pageName}</span>
                    </Button>
                  </Link>
                </li>
              )
            })
          ) : (
            <li className="text-center py-4 text-gray-500 text-sm">
              No pages accessible. Contact administrator.
            </li>
          )}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 bg-transparent h-10"
          onClick={onLogout}
        >
          <LogOut className="mr-3 h-4 w-4 flex-shrink-0" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  )
}
