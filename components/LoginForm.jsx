"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Lock, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import Image from "next/image"

export default function LoginForm({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const { data, error } = await supabase
        .from('USER')
        .select('*')
        .eq('Username', credentials.username)
        .eq('Password', credentials.password)
        .single()

      if (error) {
        // If no rows found, .single() returns an error
        console.error("Login error:", error)
        setError("Invalid credentials. Please check your username and password.")
      } else if (data) {
        // Parse Page Access (comma separated string to array)
        let pageAccess = []
        let viewerPages = {}
        if (data["Page Acess"]) {
          const rawPages = data["Page Acess"].split(',').map(p => p.trim())
          rawPages.forEach(p => {
            if (p.endsWith(':view') || p.endsWith(':viewer')) {
              const pageName = p.substring(0, p.lastIndexOf(':'))
              pageAccess.push(pageName)
              viewerPages[pageName] = true
            } else {
              pageAccess.push(p)
            }
          })
        }

        // Prepare user object
        const loginUser = {
          id: data.id,
          username: data.Username,
          name: data.Username, // Use Username as name if no Name column
          role: data.Role,
          firm: data["Firm_Name"], // Keep as string, components will split if needed
          pageAccess: pageAccess,
          viewerPages: viewerPages
        }
        onLogin(loginUser)
      } else {
        setError("Invalid credentials. Please check your username and password.")
      }
    } catch (err) {
      console.error("Unexpected login error:", err)
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f6ea] via-[#eef1e0] to-[#dfe6c9] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-sm sm:max-w-md">
        <Card className="shadow-xl border-0 ring-1 ring-[#5b6e33]/10">
          <CardHeader className="text-center space-y-2 pb-6">
            <div className="flex justify-center mb-2">
              <div className="p-2.5 rounded-2xl bg-[#5b6e33]/10">
                <Image src="/logo.png" alt="Logo" width={64} height={64} className="rounded-lg" />
              </div>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-800">Order Management System</CardTitle>
            <CardDescription className="text-gray-600 text-sm sm:text-base">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5b6e33]/60" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={credentials.username}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                    className="h-11 pl-10 focus-visible:ring-[#5b6e33] focus-visible:border-[#5b6e33]"
                    required
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5b6e33]/60" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                    className="h-11 pl-10 pr-10 focus-visible:ring-[#5b6e33] focus-visible:border-[#5b6e33]"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#5b6e33] transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-600 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-[#5b6e33] hover:bg-[#48581f] text-white font-medium shadow-sm shadow-[#5b6e33]/30 transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
