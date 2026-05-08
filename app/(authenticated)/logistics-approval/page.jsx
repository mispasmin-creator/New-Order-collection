"use client"

import LogisticsApproval from "@/components/pages/LogisticsApproval"
import { useAuth } from "@/components/providers/AuthProvider"

export default function LogisticsApprovalPage() {
    const { user, orders, updateOrders } = useAuth()
    return <LogisticsApproval user={user} orders={orders} updateOrders={updateOrders} />
}
