"use client"

import TestReportPage from "@/components/pages/TestReportPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function LoadMaterialRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <TestReportPage user={user} orders={orders} updateOrders={updateOrders} />
}
