"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import LoginForm from "@/components/LoginForm"
import { useAuth } from "@/components/providers/AuthProvider"

export default function HomePage() {
  const { user, login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  if (user) {
    return null // or a loading spinner while redirecting
  }

  return <LoginForm onLogin={login} />
}