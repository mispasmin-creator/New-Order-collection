"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

const users = [
  // Master Admin
  { id: "master", password: "master123", role: "master", firm: "ALL", name: "Master Admin" },

  // Admins
  { id: "admin1", password: "adminA", role: "admin", firm: "AAA", name: "AAA Admin" },
  { id: "admin2", password: "adminBBB", role: "admin", firm: "BBB", name: "BBB Admin" },
  { id: "admin3", password: "adminref", role: "admin", firm: "CCC", name: "CCC Admin" },
  { id: "admin4", password: "adminDDD", role: "admin", firm: "DDD", name: "DDD Admin" },

  // Users
  { id: "user1", password: "userA", role: "user", firm: "AAA", name: "AAA User" },
  { id: "user2", password: "userBBB", role: "user", firm: "BBB", name: "BBB User" },
  { id: "user3", password: "userref", role: "admin", firm: "CCC", name: "CCC User" },
  { id: "user4", password: "userDDD", role: "user", firm: "DDD", name: "DDD User" },
]

export default function LoginForm({ onLogin }) {
  const [credentials, setCredentials] = useState({ id: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const user = users.find((u) => u.id === credentials.id && u.password === credentials.password)

    if (user) {
      onLogin(user)
    } else {
      setError("Invalid credentials. Please try again.")
    }

    setLoading(false)
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
                <Label htmlFor="id" className="text-sm font-medium">
                  User ID
                </Label>
                <Input
                  id="id"
                  type="text"
                  placeholder="Enter your user ID"
                  value={credentials.id}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, id: e.target.value }))}
                  className="h-11"
                  required
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
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">Demo Credentials:</h3>
              <div className="text-xs text-gray-600 space-y-2">
                <div className="flex justify-between">
                  <strong>Master:</strong> <span>master / master123</span>
                </div>
                <div className="flex justify-between">
                  <strong>Admin:</strong> <span>admin1 / adminA</span>
                </div>
                <div className="flex justify-between">
                  <strong>User:</strong> <span>user1 / userA</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
