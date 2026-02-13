"use client"

import InvoicePage from "@/components/pages/InvoicePage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function InvoiceRoute() {
    const { user, orders, updateOrders } = useAuth()
    return <InvoicePage user={user} orders={orders} updateOrders={updateOrders} />
}
