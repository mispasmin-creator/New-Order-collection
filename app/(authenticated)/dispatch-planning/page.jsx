"use client"

import DispatchPlanningPage from "@/components/pages/DispatchPlanningPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function DispatchPlanningRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <DispatchPlanningPage user={user} orders={orders} updateOrders={updateOrders} />
}
