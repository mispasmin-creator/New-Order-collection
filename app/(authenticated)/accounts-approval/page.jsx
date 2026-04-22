"use client"

import AccountsApprovalPage from "@/components/pages/AccountsApprovalPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function AccountsApprovalRoute() {
  const { user } = useAuth()
  return <AccountsApprovalPage user={user} />
}
