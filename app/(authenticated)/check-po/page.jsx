"use client"

import CheckPOPage from "@/components/pages/CheckPOPage"
import { useAuth } from "@/components/providers/AuthProvider"
import { useRouter } from "next/navigation"

export default function CheckPOPageRoute() {
    const { user, orders, updateOrders } = useAuth()
    const router = useRouter()

    const handleNavigate = (pageName) => {
        const routes = {
            "Dashboard": "/dashboard",
            "Order": "/order",
            "Check PO": "/check-po",
            "Received Accounts": "/received-accounts",
            "Check for Delivery": "/check-delivery",
            "Dispatch Planning": "/dispatch-planning",
            "Logistic": "/logistic",
            "Load Material": "/load-material",
            "Invoice": "/invoice",
            "Sales Form": "/sales-form",
            "Wetman Entry": "/wetman-entry",
            "Fullkiting": "/fullkiting",
            "Bilty Entry": "/bilty-entry",
            "CRM": "/crm",
            "MATERIAL RECEIPT": "/material-receipt",
        }

        const path = routes[pageName]
        if (path) {
            router.push(path)
        }
    }

    return (
        <CheckPOPage
            user={user}
            orders={orders}
            updateOrders={updateOrders}
            onNavigate={handleNavigate}
        />
    )
}
