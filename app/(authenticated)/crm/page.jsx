"use client"

import Crm from "@/components/pages/Crm"
import { useAuth } from "@/components/providers/AuthProvider"

export default function CrmRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <Crm user={user} orders={orders} updateOrders={updateOrders} />
}
