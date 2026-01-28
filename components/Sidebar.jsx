"use client"

import { Button } from "@/components/ui/button"
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
  "Test Report",
  "MATERIAL RECEIPT"
]

// Google Apps Script URL (same as in your BiltyEntryPage)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec"

export default function Sidebar({ user, currentPage, setCurrentPage, onLogout, sidebarOpen, setSidebarOpen }) {
  const [notificationCounts, setNotificationCounts] = useState({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchNotificationCounts()
    
    // Refresh counts every 30 seconds
    const interval = setInterval(fetchNotificationCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotificationCounts = async () => {
    try {
      setIsLoading(true)
      
      // Fetch from COUNT sheet
      const response = await fetch(`${SCRIPT_URL}?sheet=COUNT`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.data) {
          // Process COUNT sheet data
          const counts = processCountSheetData(data.data)
          setNotificationCounts(counts)
          console.log("Notification counts fetched:", counts)
        }
      }
    } catch (error) {
      console.error("Error fetching notification counts:", error)
      setNotificationCounts({})
    } finally {
      setIsLoading(false)
    }
  }

  // Process data from COUNT sheet (Pages and Pending columns)
  const processCountSheetData = (sheetData) => {
    const counts = {}
    
    if (!sheetData || sheetData.length < 2) return counts
    
    // Find header row
    let headerRowIndex = -1
    let headers = []
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (row && row.length > 0) {
        const hasPagesHeader = row.some(cell => 
          cell && cell.toString().trim().toLowerCase().includes("pages")
        )
        if (hasPagesHeader) {
          headerRowIndex = i
          headers = row.map(h => h?.toString().trim() || "")
          break
        }
      }
    }
    
    if (headerRowIndex === -1) {
      console.log("No headers found in COUNT sheet")
      return counts
    }
    
    // Get column indices
    const pageIndex = headers.findIndex(h => h.toLowerCase().includes("pages"))
    const pendingIndex = headers.findIndex(h => h.toLowerCase().includes("pending"))
    
    if (pageIndex === -1 || pendingIndex === -1) {
      console.log("Required columns not found in COUNT sheet")
      return counts
    }
    
    // Start from row after header
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row || row.length === 0) continue
      
      const pageName = row[pageIndex]?.toString().trim()
      const pendingCount = row[pendingIndex]?.toString().trim()
      
      if (pageName && pageName !== "" && pendingCount !== undefined && pendingCount !== "") {
        // Map sheet page names to sidebar page names
        const mappedPageName = mapCountSheetPageToSidebarPage(pageName)
        if (mappedPageName) {
          const count = parseInt(pendingCount) || 0
          counts[mappedPageName] = count
        }
      }
    }
    
    return counts
  }

  // Helper function to map COUNT sheet page names to sidebar page names
  const mapCountSheetPageToSidebarPage = (sheetPage) => {
    const mapping = {
      "Order": "Order",
      "Check PO": "Check PO",
      "Received Accou": "Received Accounts", // Note: "Received Accou" from your sheet
      "Check for Delive": "Check for Delivery", // Note: "Check for Delive" from your sheet
      "Dispatch Plannir": "Dispatch Planning", // Note: "Dispatch Plannir" from your sheet
      "Logistic": "Logistic",
      "Load Material": "Load Material",
      "Invoice": "Invoice",
      "Sales Form": "Sales Form",
      "Wetman Entry": "Wetman Entry",
      "Fullkiting": "Fullkiting",
      "Bilty Entry": "Bilty Entry",
      "CRM": "CRM",
      "Material Receipt": "MATERIAL RECEIPT",
      // Add mappings for other pages if needed
    }
    return mapping[sheetPage] || sheetPage // Fallback to original name if no mapping
  }

  const handlePageChange = (pageName) => {
    setCurrentPage(pageName)
    setSidebarOpen(false) // Close sidebar on mobile after selection
  }

  // Get user's accessible pages and sort them
  const userPages = (user.pageAccess || [])
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

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-white shadow-lg flex-col">
        <SidebarContent 
          user={user} 
          currentPage={currentPage} 
          onPageChange={handlePageChange} 
          onLogout={onLogout} 
          userPages={userPages}
          getNotificationCount={getNotificationCount}
          isLoading={isLoading}
          onRefreshCounts={fetchNotificationCounts}
        />
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">Order 2 Delivery</h1>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent
          user={user}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onLogout={onLogout}
          userPages={userPages}
          getNotificationCount={getNotificationCount}
          isLoading={isLoading}
          onRefreshCounts={fetchNotificationCounts}
          isMobile={true}
        />
      </div>
    </>
  )
}

function SidebarContent({ user, currentPage, onPageChange, onLogout, userPages, getNotificationCount, isLoading, onRefreshCounts, isMobile = false }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header - only show on desktop */}
      {!isMobile && (
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-3">
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
              
              return (
                <li key={pageName}>
                  <Button
                    variant={currentPage === pageName ? "default" : "ghost"}
                    className={`w-full justify-start text-left h-10 relative ${
                      currentPage === pageName
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={() => onPageChange(pageName)}
                  >
                    <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    <span className="truncate flex-1">{pageName}</span>
                    
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