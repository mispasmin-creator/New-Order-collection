"use client"

import ArrangeLogistics from "@/components/pages/ArrangeLogistics"
import { useAuth } from "@/components/providers/AuthProvider"

export default function ArrangeLogisticsPage() {
    const { user, orders, updateOrders } = useAuth()
    return <ArrangeLogistics user={user} orders={orders} updateOrders={updateOrders} />
}
