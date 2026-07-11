"use client"

import ProcessDashboard from "@/components/pages/ProcessDashboard"
import { useAuth } from "@/components/providers/AuthProvider"

export default function ProcessDashboardPage() {
    const { user } = useAuth()
    return <ProcessDashboard user={user} />
}
