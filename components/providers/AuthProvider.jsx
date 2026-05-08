"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [orders, setOrders] = useState([])

    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const refreshUserData = async () => {
            // Check for stored user session
            const storedUserStr = localStorage.getItem('order2delivery_user')
            if (storedUserStr) {
                try {
                    const storedUser = JSON.parse(storedUserStr)
                    setUser(storedUser) // Set initial state from local storage for instant render

                    // Fetch latest data from Supabase to update permissions/firms
                    const { data, error } = await supabase
                        .from('USER')
                        .select('*')
                        .eq('id', storedUser.id)
                        .single()

                    if (data) {
                        // Parse Page Access (comma separated string to array)
                        let pageAccess = []
                        if (data["Page Acess"]) {
                            pageAccess = data["Page Acess"].split(',').map(p => p.trim())
                        }

                        const updatedUser = {
                            ...storedUser,
                            username: data.Username,
                            name: data.Username,
                            role: data.Role,
                            firm: data["Firm_Name"],
                            pageAccess: pageAccess
                        }

                        setUser(updatedUser)
                        localStorage.setItem('order2delivery_user', JSON.stringify(updatedUser))
                    } else if (error) {
                        console.error("Error refreshing user data:", error)
                    }

                } catch (e) {
                    console.error("Error parsing stored user:", e)
                    localStorage.removeItem('order2delivery_user')
                }
            }
            setLoading(false)
        }

        refreshUserData()
    }, [])

    const login = (loggedInUser) => {
        setUser(loggedInUser)
        localStorage.setItem('order2delivery_user', JSON.stringify(loggedInUser))
        router.push('/dashboard')
    }

    const logout = () => {
        setUser(null)
        localStorage.removeItem('order2delivery_user')
        router.push('/')
    }

    const updateOrders = (newOrders) => {
        setOrders(newOrders)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, orders, updateOrders }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
