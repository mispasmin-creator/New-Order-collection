"use client"

import ManageUsersPage from "@/components/pages/ManageUsersPage"
import { useAuth } from "@/components/providers/AuthProvider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function ManageUsers() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.replace("/dashboard")
    }
  }, [user, router])

  if (!user || user.role !== "ADMIN") return null

  return <ManageUsersPage />
}
