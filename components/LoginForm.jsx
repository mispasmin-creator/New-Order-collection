"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { fetchUsersData } from "@/lib/users"

export default function LoginForm({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [demoCredentials, setDemoCredentials] = useState([])

  // Fetch users from Google Sheet on component mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true)
        const usersData = await fetchUsersData()
        setUsers(usersData)
        
        // Create demo credentials from the first few users
        const demos = usersData.slice(0, 3).map((user, index) => ({
          id: user.username,
          password: user.password,
          role: user.role,
          name: user.name
        }))
        setDemoCredentials(demos)
      } catch (error) {
        console.error("Failed to load users:", error)
        setError("Failed to load user database. Using fallback credentials.")
        
        // Fallback to hardcoded users if sheet fails
        const fallbackUsers = [
          { id: "admin", username: "admin", password: "admin12345", name: "Admin", role: "master", firm: "ALL", pageAccess: ["Dashboard", "Order", "Check PO", "Received Accounts", "Check for Delivery", "Dispatch Planning", "Logistic", "Load Material", "Invoice", "Sales Form", "Wetman Entry", "Fullkiting", "Bilty Entry", "CRM", "Test Report", "MATERIAL RECEIPT"] },
          { id: "user", username: "user", password: "user123", name: "Mukesh", role: "user", firm: "AAA", pageAccess: ["Dashboard", "Order", "Check PO", "Received Accounts", "Check for Delivery", "Dispatch Planning"] },
          { id: "purchaser", username: "Purchaser", password: "P@12345", name: "EA", role: "admin", firm: "EA", pageAccess: ["Dashboard", "Order", "Check PO", "Received Accounts", "Check for Delivery", "Dispatch Planning"] },
        ]
        setUsers(fallbackUsers)
        setDemoCredentials(fallbackUsers.slice(0, 3))
      } finally {
        setLoadingUsers(false)
      }
    }
    
    loadUsers()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const user = users.find((u) => 
      u.username.toLowerCase() === credentials.username.toLowerCase() && 
      u.password === credentials.password
    )

    if (user) {
      // Prepare user object for the main app
      const loginUser = {
        id: user.username,
        username: user.username,
        name: user.name,
        role: user.role,
        firm: user.firm,
        pageAccess: user.pageAccess || []
      }
      onLogin(loginUser)
    } else {
      setError("Invalid credentials. Please check your username and password.")
    }

    setLoading(false)
  }

  if (loadingUsers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center space-y-2 pb-6">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-800">
                Order 2 Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Loading user database...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
                disabled={loading || loadingUsers}
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

            {demoCredentials.length > 0 && (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}