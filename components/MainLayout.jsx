"use client"

import { useState } from "react"
import Sidebar from "./Sidebar"
import Dashboard from "./pages/Dashboard"
import OrderPage from "./pages/OrderPage"
import CheckPOPage from "./pages/CheckPOPage"

import CheckDeliveryPage from "./pages/CheckDeliveryPage"
import DispatchPlanningPage from "./pages/DispatchPlanningPage"
import LogisticPage from "./pages/LogisticPage"
import TestReportPage from "./pages/TestReportPage"
import InvoicePage from "./pages/InvoicePage"
import WetmanEntryPage from "./pages/WetmanEntryPage"
import ReceivedAccounts from "./pages/ReceivedAccounts"
import MaterialReceiptPage from "./pages/MaterialReceiptPage"

export default function MainLayout({ user, onLogout, orders, updateOrders }) {
  const [currentPage, setCurrentPage] = useState("Dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const renderPage = () => {
    const pageProps = { user, orders, updateOrders }

    switch (currentPage) {
      case "Dashboard":
        return <Dashboard {...pageProps} />
      case "Order":
        return <OrderPage {...pageProps} />
      case "Check PO":
        return<CheckPOPage 
  user={user} 
  orders={orders} 
  updateOrders={updateOrders} 
  onNavigate={setCurrentPage} 
/>
      case  "Received Accounts":
        return <ReceivedAccounts {...pageProps} />
      case "Check for Delivery":
        return <CheckDeliveryPage {...pageProps} />
      case "Dispatch Planning":
        return <DispatchPlanningPage {...pageProps} />
      case "Logistic":
        return <LogisticPage {...pageProps} />
      case "Test Report":
        return <TestReportPage {...pageProps} />
      case "Invoice":
        return <InvoicePage {...pageProps} />
      case "Wetman Entry":
        return <WetmanEntryPage {...pageProps} />
    
      case "MATERIAL RECEIPT":
        return <MaterialReceiptPage {...pageProps} />
      default:
        return <Dashboard {...pageProps} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar
        user={user}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md text-gray-600 hover:bg-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Order 2 Delivery</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6">{renderPage()}</div>
        </div>
      </main>
    </div>
  )
}
