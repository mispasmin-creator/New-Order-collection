"use client"

import Dashboard from "@/components/pages/Dashboard"
import { useAuth } from "@/components/providers/AuthProvider"

export default function DashboardPage() {
    const { user, orders, updateOrders } = useAuth()
    return <Dashboard user={user} orders={orders} updateOrders={updateOrders} />
}
