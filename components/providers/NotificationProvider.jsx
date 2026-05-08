"use client"

import { createContext, useContext, useState } from "react"

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
    const [counts, setCounts] = useState({})

    const updateCount = (key, value) => {
        setCounts(prev => {
            // Only update if value changed to avoid re-renders
            if (prev[key] === value) return prev
            return {
                ...prev,
                [key]: value
            }
        })
    }

    // Bulk update
    const updateCounts = (newCounts) => {
        setCounts(prev => ({
            ...prev,
            ...newCounts
        }))
    }

    return (
        <NotificationContext.Provider value={{ counts, updateCount, updateCounts }}>
            {children}
        </NotificationContext.Provider>
    )
}

export const useNotification = () => useContext(NotificationContext)
