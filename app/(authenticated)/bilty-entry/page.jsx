"use client"

import BiltyEntry from "@/components/pages/BiltyEntry"
import { useAuth } from "@/components/providers/AuthProvider"

export default function BiltyEntryRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <BiltyEntry user={user} orders={orders} updateOrders={updateOrders} />
}
