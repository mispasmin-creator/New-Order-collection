"use client"

import SaleForm3Page from "@/components/pages/SaleForm3Page"
import { useAuth } from "@/components/providers/AuthProvider"

export default function SaleForm3Route() {
    const { user, orders, updateOrders } = useAuth()
    return <SaleForm3Page user={user} orders={orders} updateOrders={updateOrders} />
}
