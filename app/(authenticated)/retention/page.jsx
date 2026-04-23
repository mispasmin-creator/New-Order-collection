"use client"

import RetentionPage from "@/components/pages/RetentionPage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function Page() {
  const { user } = useAuth()

  if (!user) return null

  return <RetentionPage user={user} />
}