"use client"

import FullkittingPage from "@/components/pages/FullkittingPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function FullkittingRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <FullkittingPage user={user} orders={orders} updateOrders={updateOrders} />
}
