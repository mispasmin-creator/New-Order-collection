"use client"

import ReceivedAccounts from "@/components/pages/ReceivedAccounts"
import { useAuth } from "@/components/providers/AuthProvider"

export default function ReceivedAccountsPage() {
    const { user, orders, updateOrders } = useAuth()
    return <ReceivedAccounts user={user} orders={orders} updateOrders={updateOrders} />
}
