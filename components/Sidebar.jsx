"use client"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  ShoppingCart,
  FileCheck,
  CheckSquare,
  Truck,
  Calendar,
  Package,
  FileText,
  Receipt,
  Scale,
  FileImage,
  Layers,
  Archive,
  LogOut,
  User,
  X,
  Bell,
} from "lucide-react"
import { useEffect, useState } from "react"

// Map page names to icons
const pageIcons = {
  "Dashboard": LayoutDashboard,
  "Order": ShoppingCart,
  "Check PO": FileCheck,
  "Received Accounts": FileText,
  "Check for Delivery": Truck,
  "Dispatch Planning": Calendar,
  "Logistic": Package,
  "Load Material": Truck,
  "Invoice": Receipt,
  "Sales Form": FileText,
  "Wetman Entry": Scale,
  "Fullkiting": Layers,
  "Bilty Entry": FileImage,
  "CRM": Layers,
  "MATERIAL RECEIPT": Archive,
}

const pageRoutes = {
  "Dashboard": "/dashboard",
  "Order": "/order",
  "Check PO": "/check-po",
  "Received Accounts": "/received-accounts",
  "Check for Delivery": "/check-delivery",
  "Dispatch Planning": "/dispatch-planning",
  "Logistic": "/logistic",
  "Load Material": "/load-material",
  "Invoice": "/invoice",
  "Sales Form": "/sales-form",
  "Wetman Entry": "/wetman-entry",
  "Fullkiting": "/fullkiting",
  "Bilty Entry": "/bilty-entry",
  "CRM": "/crm",
  "MATERIAL RECEIPT": "/material-receipt",
}

// Default page order for sorting
const defaultPageOrder = [
  "Dashboard",
  "Order",
  "Check PO",
  "Received Accounts",
  "Check for Delivery",
  "Dispatch Planning",
  "Logistic",
  "Load Material",
  "Invoice",
  "Sales Form",
  "Wetman Entry",
  "Fullkiting",
  "Bilty Entry",
  "CRM",
  "MATERIAL RECEIPT"
]

import { useNotification } from "@/components/providers/NotificationProvider"

export default function Sidebar({ user, onLogout, sidebarOpen, setSidebarOpen }) {
  const { counts: notificationCounts, updateCounts } = useNotification()
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    fetchNotificationCounts()

    // Event listener for external refresh triggers
    const handleRefresh = () => fetchNotificationCounts()
    window.addEventListener('refresh-sidebar-counts', handleRefresh)

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchNotificationCounts, 30000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('refresh-sidebar-counts', handleRefresh)
    }
  }, [])

  const fetchNotificationCounts = async () => {
    try {
      setIsLoading(true)
      const counts = {}

      // Fetch real-time count for "Order" from Supabase
      const { count: orderCount, error: orderError } = await supabase
        .from('ORDER RECEIPT')
        .select('*', { count: 'exact', head: true })

      if (!orderError && orderCount !== null) {
        counts["Order"] = orderCount
      }

      // Fetch real-time count for "Check PO" from Supabase
      let checkPOQuery = supabase
        .from('ORDER RECEIPT')
        .select('"Planned 1", "Actual 1", "Firm Name"')
        .not('Planned 1', 'is', null)

      if (user.role !== "master") {
        const userFirms = user.firm ? user.firm.split(',').map(f => f.trim()) : []
        if (!userFirms.includes('all')) {
          checkPOQuery = checkPOQuery.in('Firm Name', userFirms)
        }
      }

      const { data: checkPOData, error: checkPOError } = await checkPOQuery

      if (!checkPOError && checkPOData) {
        // Filter in JS to ensure we don't count empty strings if they slip through
        const count = checkPOData.filter(row =>
          row["Planned 1"] && // robustly check if planned is truthy
          String(row["Planned 1"]).trim() !== "" &&
          (!row["Actual 1"] || String(row["Actual 1"]).trim() === "")
        ).length
        counts["Check PO"] = count
      }

      // Fetch real-time count for "Received Accounts" from Supabase
      let receivedAccQuery = supabase
        .from('ORDER RECEIPT')
        .select('"Planned 2", "Actual 2", "Firm Name"')
        .not('Planned 2', 'is', null)

      if (user.role !== "master") {
        const userFirms = user.firm ? user.firm.split(',').map(f => f.trim()) : []
        if (!userFirms.includes('all')) {
          receivedAccQuery = receivedAccQuery.in('Firm Name', userFirms)
        }
      }

      const { data: receivedAccData, error: receivedAccError } = await receivedAccQuery

      if (!receivedAccError && receivedAccData) {
        const count = receivedAccData.filter(row =>
          row["Planned 2"] &&
          String(row["Planned 2"]).trim() !== "" &&
          (!row["Actual 2"] || String(row["Actual 2"]).trim() === "")
        ).length
        counts["Received Accounts"] = count
      }

      // Fetch real-time count for "Check for Delivery" from Supabase
      let checkDeliveryQuery = supabase
        .from('ORDER RECEIPT')
        .select('"Planned 3", "Actual 3", "Firm Name"')
        .not('Planned 3', 'is', null)

      if (user.role !== "master") {
        const userFirms = user.firm ? user.firm.split(',').map(f => f.trim()) : []
        if (!userFirms.includes('all')) {
          checkDeliveryQuery = checkDeliveryQuery.in('Firm Name', userFirms)
        }
      }

      const { data: checkDeliveryData, error: checkDeliveryError } = await checkDeliveryQuery

      if (!checkDeliveryError && checkDeliveryData) {
        const count = checkDeliveryData.filter(row =>
          row["Planned 3"] &&
          String(row["Planned 3"]).trim() !== "" &&
          (!row["Actual 3"] || String(row["Actual 3"]).trim() === "")
        ).length
        counts["Check for Delivery"] = count
      }

      // Fetch real-time count for "Dispatch Planning" from Supabase
      let dispatchStartQuery = supabase
        .from('ORDER RECEIPT')
        .select('"Planned 4", "Actual 4", "Firm Name"')
        .not('Planned 4', 'is', null)

      if (user.role !== "master") {
        const userFirms = user.firm ? user.firm.split(',').map(f => f.trim()) : []
        if (!userFirms.includes('all')) {
          dispatchStartQuery = dispatchStartQuery.in('Firm Name', userFirms)
        }
      }

      const { data: dispatchStartData, error: dispatchStartError } = await dispatchStartQuery

      if (!dispatchStartError && dispatchStartData) {
        const count = dispatchStartData.filter(row =>
          row["Planned 4"] &&
          String(row["Planned 4"]).trim() !== "" &&
          (!row["Actual 4"] || String(row["Actual 4"]).trim() === "")
        ).length
        counts["Dispatch Planning"] = count
      }

      // Fetch real-time count for "Logistic" from Supabase
      const { data: logisticData, error: logisticError } = await supabase
        .from('DISPATCH')
        .select('Planned1, Actual1')
        .not('Planned1', 'is', null)

      if (!logisticError && logisticData) {
        const count = logisticData.filter(row =>
          row["Planned1"] &&
          (!row["Actual1"] || String(row["Actual1"]).trim() === "")
        ).length
        counts["Logistic"] = count
      }

      // Fetch real-time count for "Load Material" from Supabase
      const { data: loadMaterialData, error: loadMaterialError } = await supabase
        .from('DISPATCH')
        .select('Planned2, Actual2')
        .not('Planned2', 'is', null)

      if (!loadMaterialError && loadMaterialData) {
        const count = loadMaterialData.filter(row =>
          row["Planned2"] &&
          (!row["Actual2"] || String(row["Actual2"]).trim() === "")
        ).length
        counts["Load Material"] = count
      }

      // Fetch real-time count for "Invoice" from Supabase
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('DISPATCH')
        .select('Planned3, Actual3')
        .not('Planned3', 'is', null)

      if (!invoiceError && invoiceData) {
        const count = invoiceData.filter(row =>
          row["Planned3"] &&
          (!row["Actual3"] || String(row["Actual3"]).trim() === "")
        ).length
        counts["Invoice"] = count
      }

      // Fetch real-time count for "Sales Form" from Supabase
      const { data: salesData, error: salesError } = await supabase
        .from('DISPATCH')
        .select('Planned4, Actual4')
        .not('Planned4', 'is', null)

      if (!salesError && salesData) {
        const count = salesData.filter(row =>
          row["Planned4"] &&
          (!row["Actual4"] || String(row["Actual4"]).trim() === "")
        ).length
        counts["Sales Form"] = count
      }

      // Fetch real-time count for "Full Kitting" from Supabase
      const { data: fullKittingData, error: fullKittingError } = await supabase
        .from('DELIVERY')
        .select('"Planned 2", "Actual 2"')
        .not('Planned 2', 'is', null)

      if (!fullKittingError && fullKittingData) {
        const count = fullKittingData.filter(row =>
          row["Planned 2"] &&
          (!row["Actual 2"] || String(row["Actual 2"]).trim() === "")
        ).length
        counts["Fullkiting"] = count
      }

      // Fetch real-time count for "CRM" from Supabase
      const { data: crmData, error: crmError } = await supabase
        .from('DELIVERY')
        .select('"Planned 4", "Actual4"')
        .not('Planned 4', 'is', null)

      if (!crmError && crmData) {
        const count = crmData.filter(row =>
          row["Planned 4"] &&
          (!row["Actual4"] || String(row["Actual4"]).trim() === "")
        ).length
        counts["CRM"] = count
      }

      // Fetch real-time count for "Bilty Entry" from Supabase
      const { data: biltyEntryData, error: biltyEntryError } = await supabase
        .from('DELIVERY')
        .select('"Planned 3", "Actual3"')
        .not('Planned 3', 'is', null)

      if (!biltyEntryError && biltyEntryData) {
        const count = biltyEntryData.filter(row =>
          row["Planned 3"] &&
          (!row["Actual3"] || String(row["Actual3"]).trim() === "")
        ).length
        counts["Bilty Entry"] = count
      }

      // Fetch real-time count for "MATERIAL RECEIPT" from Supabase
      const { data: materialReceiptData, error: materialReceiptError } = await supabase
        .from('POST DELIVERY')
        .select('Planned, Actual')
        .not('Planned', 'is', null)

      if (!materialReceiptError && materialReceiptData) {
        const count = materialReceiptData.filter(row =>
          row["Planned"] &&
          (!row["Actual"] || String(row["Actual"]).trim() === "")
        ).length
        counts["MATERIAL RECEIPT"] = count
      }

      updateCounts(counts)
      console.log("Notification counts fetched:", counts)
    } catch (error) {
      console.error("Error fetching notification counts:", error)
      // Don't clear counts on error to avoid flickering if we have data
    } finally {
      setIsLoading(false)
    }
  }

  // Get user's accessible pages and sort them
  const hasAllAccess = user.pageAccess && user.pageAccess.some(p => p.toLowerCase().trim() === "all");

  const userPages = hasAllAccess
    ? [...defaultPageOrder] // Show all pages if access is 'All'
    : (user.pageAccess || [])
      .filter(page => pageIcons[page]) // Only show pages with icons
      .sort((a, b) => {
        const indexA = defaultPageOrder.indexOf(a);
        const indexB = defaultPageOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

  // Get notification count for a specific page
  const getNotificationCount = (pageName) => {
    return notificationCounts[pageName] || 0
  }

  // Helper to check if page is active
  const isPageActive = (pageName) => {
    const route = pageRoutes[pageName]
    if (pageName === "Dashboard" && pathname === "/dashboard") return true
    return pathname === route
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-white shadow-lg flex-col">
        <SidebarContent
          user={user}
          pathname={pathname}
          onLogout={onLogout}
          userPages={userPages}
          getNotificationCount={getNotificationCount}
          isLoading={isLoading}
          onRefreshCounts={fetchNotificationCounts}
          setSidebarOpen={setSidebarOpen}
        />
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Image src="/passary.jpeg" alt="PASMIN Logo" width={60} height={60} className="rounded-lg" />
            <h1 className="text-xl font-bold text-gray-800">Order 2 Delivery</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent
          user={user}
          pathname={pathname}
          onLogout={onLogout}
          userPages={userPages}
          getNotificationCount={getNotificationCount}
          isLoading={isLoading}
          onRefreshCounts={fetchNotificationCounts}
          isMobile={true}
          setSidebarOpen={setSidebarOpen}
        />
      </div>
    </>
  )
}

function SidebarContent({ user, pathname, onLogout, userPages, getNotificationCount, isLoading, onRefreshCounts, isMobile = false, setSidebarOpen }) {

  const isPageActive = (pageName) => {
    const route = pageRoutes[pageName];
    // Exact match or sub-route
    return pathname === route;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - only show on desktop */}
      {!isMobile && (
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-3">
            <Image src="/passary.jpeg" alt="PASMIN Logo" width={80} height={80} className="rounded-lg" />
            <h1 className="text-xl font-bold text-gray-800">Order 2 Delivery</h1>
            <button
              onClick={onRefreshCounts}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Refresh notification counts"
            >
              <svg
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
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
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 rounded-full p-2">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
                <button
                  onClick={onRefreshCounts}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-200"
                  title="Refresh notification counts"
                >
                  <svg
                    className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
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
              const notificationCount = getNotificationCount(pageName)
              const isActive = isPageActive(pageName)
              const route = pageRoutes[pageName] || "#"

              return (
                <li key={pageName}>
                  <Link href={route} onClick={() => isMobile && setSidebarOpen(false)}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={`w-full justify-start text-left h-10 relative ${isActive
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                      <span className="truncate flex-1">{pageName === "Wetman Entry" ? "Weighment Entry" : pageName}</span>

                      {notificationCount > 0 ? (
                        <span className="ml-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0">
                          {notificationCount > 99 ? '99+' : notificationCount}
                        </span>
                      ) : isLoading ? (
                        <span className="ml-2 w-5 h-5 flex items-center justify-center flex-shrink-0">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-300"></div>
                        </span>
                      ) : (
                        <span className="ml-2 w-5 h-5 flex-shrink-0"></span>
                      )}
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