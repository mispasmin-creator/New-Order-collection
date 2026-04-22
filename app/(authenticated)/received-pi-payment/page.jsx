"use client"
import ReceivedPIPaymentPage from "@/components/pages/ReceivedPIPaymentPage"
import { useAuth } from "@/components/providers/AuthProvider"
export default function ReceivedPIPaymentRoute() {
  const { user } = useAuth()
  return <ReceivedPIPaymentPage user={user} />
}
