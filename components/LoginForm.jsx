"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

export default function LoginForm({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)  
  

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
        if (data["Page Acess"]) {
          pageAccess = data["Page Acess"].split(',').map(p => p.trim())
        }

        // Prepare user object
        const loginUser = {
          id: data.id,
          username: data.Username,
          name: data.Username, // Use Username as name if no Name column
          role: data.Role,
          firm: data["Firm_Name"], // Keep as string, components will split if needed
          pageAccess: pageAccess
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-sm sm:max-w-md">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center space-y-2 pb-6">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-800">Order 2 Delivery</CardTitle>
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
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                  className="h-11"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                  className="h-11"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-600 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
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

            {/* {demoCredentials.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">Sample Credentials:</h3>
                <div className="text-xs text-gray-600 space-y-2">
                  {demoCredentials.map((user, index) => (
                    <div key={index} className="flex justify-between">
                      <strong>{user.name}:</strong> 
                      <span>{user.id} / {user.password}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Users loaded from Google Sheets. Page access is controlled per user.
                </p>
              </div>
            )} */}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}