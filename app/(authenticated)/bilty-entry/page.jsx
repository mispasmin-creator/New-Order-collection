"use client"

import UnifiedLogistics from "@/components/pages/UnifiedLogistics"
import { useAuth } from "@/components/providers/AuthProvider"

export default function BiltyEntryRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <UnifiedLogistics user={user} orders={orders} updateOrders={updateOrders} />
}
