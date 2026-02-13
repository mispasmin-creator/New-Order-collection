"use client"

import Fullkiting from "@/components/pages/Fullkitting"
import { useAuth } from "@/components/providers/AuthProvider"

export default function FullkitingRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <Fullkiting user={user} orders={orders} updateOrders={updateOrders} />
}
