"use client"

import OrderPage from "@/components/pages/OrderPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function OrderPageRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <OrderPage user={user} orders={orders} updateOrders={updateOrders} />
}
