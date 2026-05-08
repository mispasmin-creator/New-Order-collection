"use client"

import MaterialReturnPage from "@/components/pages/MaterialReturnPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function Page() {
  const { user } = useAuth()
  
  if (!user) return null
  
  return <MaterialReturnPage user={user} />
}
