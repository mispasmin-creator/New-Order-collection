"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/providers/AuthProvider"
import Sidebar from "@/components/Sidebar"
import { useRouter } from "next/navigation"
import { NotificationProvider } from "@/components/providers/NotificationProvider"

export default function AuthenticatedLayout({ children }) {
    const { user, logout, loading } = useAuth()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (!loading && !user) {
            router.push('/')
        }
    }, [user, loading, router])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <NotificationProvider>
                <Sidebar
                    user={user}
                    onLogout={logout}
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
                        <div className="p-4 sm:p-6">
                            {children}
                        </div>
                    </div>
                </main>
            </NotificationProvider>
        </div>
    )
}
