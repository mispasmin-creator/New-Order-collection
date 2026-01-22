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
                                                                                                 
} from "lucide-react"

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Order", icon: ShoppingCart },
  { name: "Check PO", icon: FileCheck },
  { name: "Received Accounts", icon: FileText },
  { name: "Check for Delivery", icon: Truck },
  { name: "Dispatch Planning", icon: Calendar },
  { name: "Logistic", icon: Package },
  { name: "Load Material", icon: Truck },
  { name: "Invoice", icon: Receipt },   
  { name: "Sales Form", icon: FileText },
  { name: "Wetman Entry", icon: Scale },
  { name: "Fullkiting", icon: Layers },
  { name: "Bilty Entry", icon: FileImage },
  { name: "CRM", icon: Layers },
  { name: "Test Report", icon: CheckSquare },
  { name: "MATERIAL RECEIPT", icon: Archive },
]

export default function Sidebar({ user, currentPage, setCurrentPage, onLogout, sidebarOpen, setSidebarOpen }) {
  const handlePageChange = (pageName) => {
    setCurrentPage(pageName)
    setSidebarOpen(false) // Close sidebar on mobile after selection
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-white shadow-lg flex-col">
        <SidebarContent user={user} currentPage={currentPage} onPageChange={handlePageChange} onLogout={onLogout} />
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
          isMobile={true}
        />
      </div>
    </>
  )
}

function SidebarContent({ user, currentPage, onPageChange, onLogout, isMobile = false }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header - only show on desktop */}
      {!isMobile && (
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-800">Order 2 Delivery</h1>
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
              <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {user.firm} - {user.role}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.name}>
                <Button
                  variant={currentPage === item.name ? "default" : "ghost"}
                  className={`w-full justify-start text-left h-10 ${
                    currentPage === item.name
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => onPageChange(item.name)}
                >
                  <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Button>
              </li>
            )
          })}
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
