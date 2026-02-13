"use client"

import LogisticPage from "@/components/pages/LogisticPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function LogisticRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <LogisticPage user={user} orders={orders} updateOrders={updateOrders} />
}
