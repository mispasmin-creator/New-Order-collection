"use client"

import WetmanEntryPage from "@/components/pages/WetmanEntryPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function WetmanEntryRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <WetmanEntryPage user={user} orders={orders} updateOrders={updateOrders} />
}
