"use client"

import MaterialReceiptPage from "@/components/pages/MaterialReceiptPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function MaterialReceiptRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <MaterialReceiptPage user={user} orders={orders} updateOrders={updateOrders} />
}
