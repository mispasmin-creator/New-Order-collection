"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Loader2, FileText } from "lucide-react"

export default function DebitNotePage({ user }) {
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")

  // A clean boilerplate for the Debit Note module
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debit Note</h1>
          <p className="text-gray-600">Manage your debit notes</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search debit notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>

          <Button
            variant="outline"
            className="h-10 px-3"
            disabled={true} // Loading state placeholder
          >
            <Loader2 className={`w-4 h-4 mr-2 ${false ? "animate-spin" : "hidden"}`} /> 
            Refresh
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${
              activeTab === "pending"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Pending (0)
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${
              activeTab === "history"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            History (0)
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-4 px-6">ID</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Amount</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6">Status</TableHead>
                <TableHead className="font-semibold text-gray-900 py-4 px-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-gray-300" />
                    <span className="text-md font-medium text-gray-500">No {activeTab} debit notes found</span>
                    <span className="text-sm text-gray-400">Data will appear here once connected</span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
