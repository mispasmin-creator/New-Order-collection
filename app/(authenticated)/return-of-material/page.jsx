"use client"

import ReturnOfMaterialPage from "@/components/pages/ReturnOfMaterialPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function Page() {
  const { user } = useAuth()

  if (!user) return null

  return <ReturnOfMaterialPage user={user} />
}
