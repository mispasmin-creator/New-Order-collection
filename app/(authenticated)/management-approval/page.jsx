"use client"

import ManagementApprovalPage from "@/components/pages/ManagementApprovalPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function ManagementApprovalRoute() {
  const { user } = useAuth()
  return <ManagementApprovalPage user={user} />
}
