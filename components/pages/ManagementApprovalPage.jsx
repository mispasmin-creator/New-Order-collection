"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/components/providers/NotificationProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Loader2, Search, CheckCircle2, AlertCircle, ShieldCheck, ChevronDown, ChevronRight, XCircle,
} from "lucide-react"

const formatDate = (val) => {
  if (!val) return "—"
  try {
    const d = new Date(val)
    if (isNaN(d)) return val
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
  } catch { return val }
}

export default function ManagementApprovalPage({ user }) {
  const { toast } = useToast()
  const { updateCount } = useNotification()

  const [entries, setEntries] = useState([])
  const [historyEntries, setHistoryEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [expandedRows, setExpandedRows] = useState({})

  const [selectedEntry, setSelectedEntry] = useState(null)
  const [remarks, setRemarks] = useState("")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("Material Return")
        .select("*")
        .order("id", { ascending: false })
      if (error) throw error

      const pending = []
      const history = []
      ;(data || []).forEach((row) => {
        const isActioned =
          (row["Actual5"] && String(row["Actual5"]).trim() !== "") ||
          (row["Management Status"] && String(row["Management Status"]).trim() !== "")
        if (isActioned) {
          history.push(row)
        } else if (row["Time Stamp"] && String(row["Time Stamp"]).trim() !== "") {
          pending.push(row)
        }
      })
      setEntries(pending)
      setHistoryEntries(history)
    } catch (err) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { updateCount("Management Approval", entries.length) }, [entries.length, updateCount])

  const filtered = (list) => {
    if (!searchTerm.trim()) return list
    const t = searchTerm.toLowerCase()
    return list.filter((r) => Object.values(r).some((v) => v?.toString().toLowerCase().includes(t)))
  }

  const displayList = activeTab === "pending" ? filtered(entries) : filtered(historyEntries)

  const toggleExpand = (id) =>
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))

  const handleOpen = (entry) => {
    setSelectedEntry(entry)
    setRemarks(entry["Management Remarks"] || "")
  }

  const handleClose = () => {
    setSelectedEntry(null)
    setRemarks("")
  }

  const handleApprove = async () => {
    try {
      setSubmitting(true)
      const { error } = await supabase
        .from("Material Return")
        .update({
          "Actual5": getISTTimestamp(),
          "Management Status": "Approved",
          "Management Remarks": remarks.trim(),
        })
        .eq("id", selectedEntry.id)
      if (error) throw error

      toast({ title: "Approved", description: `Return No. ${selectedEntry["Return No."]} approved.` })
      handleClose()
      fetchData()
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast({ title: "Remarks Required", description: "Please enter a reason for rejection.", variant: "destructive" })
      return
    }
    try {
      setSubmitting(true)
      const { error } = await supabase
        .from("Material Return")
        .update({
          "Management Status": "Rejected",
          "Management Remarks": remarks.trim(),
        })
        .eq("id", selectedEntry.id)
      if (error) throw error

      toast({ title: "Rejected", description: `Return No. ${selectedEntry["Return No."]} rejected.` })
      handleClose()
      fetchData()
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-amber-600" />
        <span className="text-gray-600">Loading management approval...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Management Approval</h1>
        <p className="text-gray-600">Review and approve material return requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Approval</p>
              <div className="text-2xl font-bold text-amber-900">{entries.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Actioned</p>
              <div className="text-2xl font-bold text-green-900">{historyEntries.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="bg-white border rounded-md shadow-sm p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by party, product, return no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Button onClick={fetchData} variant="outline" className="h-10 px-3" disabled={loading}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Pending ({entries.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            History ({historyEntries.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                {activeTab === "pending" && <TableHead className="w-[110px]">Action</TableHead>}
                <TableHead className="w-8" />
                <TableHead>Return No.</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Reason</TableHead>
                {activeTab === "history" && (
                  <>
                    <TableHead>Status</TableHead>
                    <TableHead>Actioned On</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-gray-500">No records found</TableCell>
                </TableRow>
              ) : (
                displayList.map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow className="hover:bg-gray-50">
                      {activeTab === "pending" && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleOpen(entry)}
                            className="bg-amber-600 hover:bg-amber-700 h-8 text-xs"
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                        </TableCell>
                      )}
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(entry.id)}>
                          {expandedRows[entry.id]
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">{entry["Return No."]}</TableCell>
                      <TableCell className="text-sm">{entry["Party Name"]}</TableCell>
                      <TableCell className="text-sm">{entry["Product Name"]}</TableCell>
                      <TableCell className="font-bold text-sm">{entry["Qty"]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-xs">
                          {entry["Reason Of Material Return"] || "—"}
                        </Badge>
                      </TableCell>
                      {activeTab === "history" && (
                        <>
                          <TableCell>
                            {entry["Management Status"] === "Rejected" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                <XCircle className="w-3 h-3" />Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />Approved
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(entry["Actual5"])}
                          </TableCell>
                        </>
                      )}
                    </TableRow>

                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={8} className="p-0 bg-gray-50/50 border-b border-gray-200">
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                            {entry["Invoice Number"] && (
                              <div className="col-span-2">
                                <p className="text-gray-500 text-xs mb-0.5">Invoice Number</p>
                                <p className="font-semibold text-blue-700">{entry["Invoice Number"]}</p>
                              </div>
                            )}
                            <div><p className="text-gray-500 text-xs mb-0.5">D.O Number</p><p className="font-medium">{entry["D.O Number"] || "—"}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Submitted On</p><p className="font-medium">{formatDate(entry["Time Stamp"])}</p></div>
                            <div className="col-span-2">
                              <p className="text-gray-500 text-xs mb-0.5">Reason Of Return</p>
                              <p className="font-medium text-orange-600">{entry["Reason Of Material Return"] || "—"}</p>
                            </div>
                            {entry["Remarks"] && (
                              <div className="col-span-2">
                                <p className="text-gray-500 text-xs mb-0.5">Remarks</p>
                                <p className="font-medium">{entry["Remarks"]}</p>
                              </div>
                            )}
                            {entry["Transporter Name"] && <div><p className="text-gray-500 text-xs mb-0.5">Transporter</p><p className="font-medium">{entry["Transporter Name"]}</p></div>}
                            {entry["Vehicle No."] && <div><p className="text-gray-500 text-xs mb-0.5">Vehicle No.</p><p className="font-medium">{entry["Vehicle No."]}</p></div>}
                            {entry["Qty Of Return Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Return Qty</p><p className="font-medium">{entry["Qty Of Return Material"]}</p></div>}
                            {entry["Condition of Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Condition</p>
                                <Badge variant="outline" className={entry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                                  {entry["Condition of Material"]}
                                </Badge>
                              </div>
                            )}
                            {entry["Credit Note No."] && <div><p className="text-gray-500 text-xs mb-0.5">Credit Note No.</p><p className="font-medium">{entry["Credit Note No."]}</p></div>}
                            {entry["Amount"] && <div><p className="text-gray-500 text-xs mb-0.5">Amount</p><p className="font-semibold text-green-700">₹{entry["Amount"]}</p></div>}
                            {entry["Management Remarks"] && (
                              <div className="col-span-2">
                                <p className="text-gray-500 text-xs mb-0.5">Management Remarks</p>
                                <p className="font-medium text-amber-700">{entry["Management Remarks"]}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Management Approval
            </DialogTitle>
            <DialogDescription>
              Return No. <strong>{selectedEntry?.["Return No."]}</strong> — {selectedEntry?.["Party Name"]}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                {selectedEntry["Invoice Number"] && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Invoice Number</p>
                    <p className="font-semibold text-blue-700">{selectedEntry["Invoice Number"]}</p>
                  </div>
                )}
                <div><p className="text-xs text-gray-500">Party</p><p className="font-semibold">{selectedEntry["Party Name"]}</p></div>
                <div><p className="text-xs text-gray-500">Product</p><p className="font-semibold">{selectedEntry["Product Name"]}</p></div>
                <div><p className="text-xs text-gray-500">Qty</p><p className="font-semibold">{selectedEntry["Qty"]}</p></div>
                <div><p className="text-xs text-gray-500">D.O Number</p><p className="font-semibold">{selectedEntry["D.O Number"] || "—"}</p></div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Reason Of Return</p>
                  <p className="font-semibold text-orange-600">{selectedEntry["Reason Of Material Return"] || "—"}</p>
                </div>
                {selectedEntry["Remarks"] && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Remarks (from entry)</p>
                    <p className="font-medium text-gray-700">{selectedEntry["Remarks"]}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Management Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter approval remarks or notes..."
                  rows={3}
                  className="resize-none"
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleReject} disabled={submitting} variant="destructive">
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                : <><XCircle className="w-4 h-4 mr-2" />Reject</>}
            </Button>
            <Button onClick={handleApprove} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                : <><ShieldCheck className="w-4 h-4 mr-2" />Approve</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
