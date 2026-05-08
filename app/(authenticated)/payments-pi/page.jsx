"use client"
import MakePIPage from "@/components/pages/MakePIPage"
import { useAuth } from "@/components/providers/AuthProvider"
export default function MakePIRoute() {
  const { user } = useAuth()
  return <MakePIPage user={user} />
}
