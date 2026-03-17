"use client"

import DebitNotePage from "@/components/pages/DebitNotePage"
import { useAuth } from "@/components/providers/AuthProvider"

export default function Page() {
  const { user } = useAuth()
  
  if (!user) return null
  
  return <DebitNotePage user={user} />
}
