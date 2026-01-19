"use client"

import { useState, useEffect } from "react"
import LoginForm from "@/components/LoginForm"
import MainLayout from "@/components/MainLayout"

export default function App() {
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem("currentUser")
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }

    // Load orders from localStorage
    const savedOrders = localStorage.getItem("orders")
    if (savedOrders) {
      setOrders(JSON.parse(savedOrders))
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem("currentUser", JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem("currentUser")
  }

  const updateOrders = (newOrders) => {
    setOrders(newOrders)
    localStorage.setItem("orders", JSON.stringify(newOrders))
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />
  }

  return <MainLayout user={user} onLogout={handleLogout} orders={orders} updateOrders={updateOrders} />
}
