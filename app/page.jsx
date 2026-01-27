"use client"

import { useState, useEffect } from "react"
import LoginForm from "@/components/LoginForm"
import MainLayout from "@/components/MainLayout"

export default function HomePage() {
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem('order2delivery_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        localStorage.removeItem('order2delivery_user')
      }
    }
  }, [])

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
    localStorage.setItem('order2delivery_user', JSON.stringify(loggedInUser))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('order2delivery_user')
  }

  const updateOrders = (newOrders) => {
    setOrders(newOrders)
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />
  }

  return <MainLayout user={user} onLogout={handleLogout} orders={orders} updateOrders={updateOrders} />
}