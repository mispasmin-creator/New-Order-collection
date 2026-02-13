"use client"

import Sales from "@/components/pages/Sales"
import { useAuth } from "@/components/providers/AuthProvider"

export default function SalesFormRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <Sales user={user} orders={orders} updateOrders={updateOrders} />
}
