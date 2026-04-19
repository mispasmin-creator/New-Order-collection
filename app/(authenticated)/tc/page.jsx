"use client"

import TCPage from "@/components/pages/TCPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function TCRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <TCPage user={user} orders={orders} updateOrders={updateOrders} />
}
