"use client"

import CheckDeliveryPage from "@/components/pages/CheckDeliveryPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function CheckDeliveryRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <CheckDeliveryPage user={user} orders={orders} updateOrders={updateOrders} />
}
