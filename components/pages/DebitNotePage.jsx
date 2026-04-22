"use client"

import { Fragment, useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/components/providers/NotificationProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Loader2, Search, CheckCircle2, AlertCircle, FileText, ChevronDown, ChevronRight,
  TrendingDown, TrendingUp, RefreshCw,
} from "lucide-react"

const REASONS = {
  "Damage Done": {
    docType: "Debit Note",
    description: "Party is charged for goods damaged during handling.",
    amountBasis: "custom",
    color: "red",
  },
  "Wrong Product": {
    docType: "Credit Note",
    description: "We sent the wrong product — full refund to party.",
    amountBasis: "full",
    color: "blue",
  },
  "Quality Issue": {
    docType: "Credit Note",
    description: "Product did not meet quality standards — adjustable refund.",
    amountBasis: "adjustable",
    color: "amber",
  },
  "Material Shortage": {
    docType: "Credit Note",
    description: "Quantity short-delivered — refund for missing qty.",
    amountBasis: "shortage",
    color: "orange",
  },
  "Material Return": {
    docType: "Credit Note",
    description: "Material returned by party — credit issued for returned goods.",
    amountBasis: "full",
    color: "purple",
  },
  "Other": {
    docType: null, // user chooses
    description: "Custom resolution — choose document type and amount.",
    amountBasis: "custom",
    color: "gray",
  },
}

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (val) => {
  if (!val) return "—"
  try {
    const d = new Date(val)
    if (isNaN(d)) return val
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
  } catch { return val }
}

const reasonBadgeClass = (reason) => {
  const map = {
    "Damage Done": "bg-red-50 text-red-700 border-red-200",
    "Wrong Product": "bg-blue-50 text-blue-700 border-blue-200",
    "Quality Issue": "bg-amber-50 text-amber-700 border-amber-200",
    "Material Shortage": "bg-orange-50 text-orange-700 border-orange-200",
    "Material Return": "bg-purple-50 text-purple-700 border-purple-200",
    "Other": "bg-gray-50 text-gray-700 border-gray-200",
  }
  return map[reason] || "bg-gray-50 text-gray-700 border-gray-200"
}

export default function DebitNotePage({ user }) {
  const { toast } = useToast()
  const { updateCount } = useNotification()

  const [entries, setEntries] = useState([])        // pending: Actual5 set, Debit Note Issued At null
  const [historyEntries, setHistoryEntries] = useState([])  // done: Debit Note Issued At set
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [expandedRows, setExpandedRows] = useState({})

  // Dialog state
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [docType, setDocType] = useState("")          // "Debit Note" | "Credit Note"
  const [noteNumber, setNoteNumber] = useState("")
  const [amount, setAmount] = useState("")
  const [noteFile, setNoteFile] = useState(null)
  const [noteRemarks, setNoteRemarks] = useState("")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("Material Return")
        .select("*")
        .not("Actual5", "is", null)   // must be management-approved first
        .order("id", { ascending: false })
      if (error) throw error

      const pending = []
      const history = []
      ;(data || []).forEach((row) => {
        // "Material Return" reason skips credit note — handled directly in Return of Material page
        if (row["Reason Of Material Return"] === "Material Return") return
        if (row["Debit Note Issued At"] && String(row["Debit Note Issued At"]).trim() !== "") {
          history.push(row)
        } else {
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
  useEffect(() => { updateCount("Debit Note", entries.length) }, [entries.length, updateCount])

  const filtered = (list) => {
    if (!searchTerm.trim()) return list
    const t = searchTerm.toLowerCase()
    return list.filter((r) => Object.values(r).some((v) => v?.toString().toLowerCase().includes(t)))
  }

  const displayList = activeTab === "pending" ? filtered(entries) : filtered(historyEntries)
  const toggleExpand = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))

  // Derive the suggested amount and docType from reason + entry data
  const suggestedAmount = useMemo(() => {
    if (!selectedEntry) return 0
    const reason = selectedEntry["Reason Of Material Return"] || ""
    const config = REASONS[reason] || REASONS["Other"]
    const qty = Number(selectedEntry["Qty Of Return Material"] || selectedEntry["Qty"]) || 0
    const rate = Number(selectedEntry["Rate Of Material"]) || 0

    if (config.amountBasis === "full" || config.amountBasis === "adjustable") {
      return qty * rate
    }
    if (config.amountBasis === "shortage") {
      const dispatched = Number(selectedEntry["Qty"]) || 0
      const returned = Number(selectedEntry["Qty Of Return Material"]) || 0
      const shortage = Math.max(0, dispatched - returned)
      return shortage * rate
    }
    return 0  // custom — user enters
  }, [selectedEntry])

  const handleOpen = (entry) => {
    setSelectedEntry(entry)
    setDocType("Credit Note")
    setNoteNumber("")
    setNoteFile(null)
    setNoteRemarks("")
    setAmount("")
  }

  // Update amount when suggestedAmount changes (after selectedEntry is set)
  useEffect(() => {
    if (selectedEntry && suggestedAmount > 0) {
      setAmount(String(suggestedAmount.toFixed(2)))
    }
  }, [suggestedAmount, selectedEntry])

  const handleClose = () => {
    setSelectedEntry(null)
    setDocType("")
    setNoteNumber("")
    setAmount("")
    setNoteFile(null)
    setNoteRemarks("")
  }

  const handleSubmit = async () => {
    if (!docType) {
      toast({ title: "Required", description: "Select a document type.", variant: "destructive" })
      return
    }
    if (!noteNumber.trim()) {
      toast({ title: "Required", description: "Enter the note number.", variant: "destructive" })
      return
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({ title: "Required", description: "Enter a valid amount.", variant: "destructive" })
      return
    }

    try {
      setSubmitting(true)

      let fileUrl = null
      if (noteFile) {
        const ext = noteFile.name.split(".").pop()
        const path = `material_return/${selectedEntry.id}_debit_note_${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from("images")
          .upload(path, noteFile, { cacheControl: "3600", upsert: false })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(path)
        fileUrl = publicUrl
      }

      const payload = {
        "Debit Note": docType,
        "Debit Note Number": noteNumber.trim(),
        "Debit Note Amount": Number(amount),
        "Debit Note Issued At": getISTTimestamp(),
      }
      if (fileUrl) payload["Debit Note Copy"] = fileUrl
      if (noteRemarks.trim()) payload["Remarks"] = (selectedEntry["Remarks"] ? selectedEntry["Remarks"] + "\n" : "") + `[Debit/Credit Note] ${noteRemarks.trim()}`

      const { error } = await supabase
        .from("Material Return")
        .update(payload)
        .eq("id", selectedEntry.id)
      if (error) throw error

      toast({
        title: "Issued",
        description: `${docType} #${noteNumber.trim()} issued for Return No. ${selectedEntry["Return No."]}`,
      })
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
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
        <span className="text-gray-600">Loading credit notes...</span>
      </div>
    )
  }

  const reasonConfig = selectedEntry
    ? (REASONS[selectedEntry["Reason Of Material Return"]] || REASONS["Other"])
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Credit Note</h1>
          <p className="text-gray-600">Issue credit notes for management-approved material returns</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="flex items-center gap-2 w-fit">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Pending Note Issuance</p>
              <div className="text-2xl font-bold text-purple-900">{entries.length}</div>
            </div>
            <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Notes Issued</p>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Note No.</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-gray-300" />
                      <span>No {activeTab} records found</span>
                    </div>
                  </TableCell>
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
                            className="bg-purple-600 hover:bg-purple-700 h-8 text-xs"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Issue Note
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
                        <Badge variant="outline" className={`text-xs ${reasonBadgeClass(entry["Reason Of Material Return"])}`}>
                          {entry["Reason Of Material Return"] || "—"}
                        </Badge>
                      </TableCell>
                      {activeTab === "history" && (
                        <>
                          <TableCell>
                            {entry["Debit Note"] === "Debit Note" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                <TrendingUp className="w-3 h-3" />Debit Note
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                <TrendingDown className="w-3 h-3" />Credit Note
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-mono">{entry["Debit Note Number"] || "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            {entry["Debit Note Amount"] ? fmt(entry["Debit Note Amount"]) : "—"}
                          </TableCell>
                        </>
                      )}
                    </TableRow>

                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={10} className="p-0 bg-gray-50/50 border-b border-gray-200">
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                            {entry["Invoice Number"] && (
                              <div className="col-span-2">
                                <p className="text-gray-500 text-xs mb-0.5">Invoice Number</p>
                                <p className="font-semibold text-blue-700">{entry["Invoice Number"]}</p>
                              </div>
                            )}
                            <div><p className="text-gray-500 text-xs mb-0.5">D.O Number</p><p className="font-medium">{entry["D.O Number"] || "—"}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Submitted On</p><p className="font-medium">{formatDate(entry["Time Stamp"])}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Mgmt Approved</p><p className="font-medium">{formatDate(entry["Actual5"])}</p></div>
                            <div className="col-span-2">
                              <p className="text-gray-500 text-xs mb-0.5">Reason</p>
                              <p className="font-medium text-orange-600">{entry["Reason Of Material Return"] || "—"}</p>
                            </div>
                            {entry["Remarks"] && (
                              <div className="col-span-2">
                                <p className="text-gray-500 text-xs mb-0.5">Remarks</p>
                                <p className="font-medium">{entry["Remarks"]}</p>
                              </div>
                            )}
                            {entry["Management Remarks"] && (
                              <div className="col-span-2">
                                <p className="text-gray-500 text-xs mb-0.5">Management Remarks</p>
                                <p className="font-medium text-amber-700">{entry["Management Remarks"]}</p>
                              </div>
                            )}
                            {entry["Qty Of Return Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Return Qty</p><p className="font-medium">{entry["Qty Of Return Material"]}</p></div>}
                            {entry["Rate Of Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Rate</p><p className="font-semibold text-green-700">₹{entry["Rate Of Material"]}</p></div>}
                            {entry["Condition of Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Condition</p>
                                <Badge variant="outline" className={entry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                                  {entry["Condition of Material"]}
                                </Badge>
                              </div>
                            )}
                            {entry["Debit Note"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Note Type</p>
                                <p className="font-semibold">{entry["Debit Note"]}</p>
                              </div>
                            )}
                            {entry["Debit Note Number"] && <div><p className="text-gray-500 text-xs mb-0.5">Note Number</p><p className="font-mono font-medium">{entry["Debit Note Number"]}</p></div>}
                            {entry["Debit Note Amount"] && <div><p className="text-gray-500 text-xs mb-0.5">Amount</p><p className="font-bold text-purple-700">{fmt(entry["Debit Note Amount"])}</p></div>}
                            {entry["Debit Note Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Note Copy</p>
                                <a href={entry["Debit Note Copy"]} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View Document</a>
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

      {/* Issue Note Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Issue Credit Note
            </DialogTitle>
            <DialogDescription>
              Return No. <strong>{selectedEntry?.["Return No."]}</strong> — {selectedEntry?.["Party Name"]}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && reasonConfig && (
            <div className="space-y-5 py-2">

              {/* Reason context card */}
              <div className={`rounded-lg border p-4 space-y-2 ${
                reasonConfig.color === "red" ? "bg-red-50 border-red-200" :
                reasonConfig.color === "blue" ? "bg-blue-50 border-blue-200" :
                reasonConfig.color === "amber" ? "bg-amber-50 border-amber-200" :
                reasonConfig.color === "orange" ? "bg-orange-50 border-orange-200" :
                "bg-gray-50 border-gray-200"
              }`}>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-xs ${reasonBadgeClass(selectedEntry["Reason Of Material Return"])}`}>
                    {selectedEntry["Reason Of Material Return"] || "Other"}
                  </Badge>
                  {reasonConfig.docType && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      reasonConfig.docType === "Debit Note"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      Suggested: {reasonConfig.docType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{reasonConfig.description}</p>
                <div className="grid grid-cols-2 gap-3 text-sm pt-1">
                  <div><p className="text-xs text-gray-500">Product</p><p className="font-semibold">{selectedEntry["Product Name"]}</p></div>
                  <div><p className="text-xs text-gray-500">Return Qty</p><p className="font-semibold">{selectedEntry["Qty Of Return Material"] || selectedEntry["Qty"]}</p></div>
                  <div><p className="text-xs text-gray-500">Rate</p><p className="font-semibold">{selectedEntry["Rate Of Material"] ? `₹${selectedEntry["Rate Of Material"]}` : "—"}</p></div>
                  <div>
                    <p className="text-xs text-gray-500">Suggested Amount</p>
                    <p className="font-bold text-purple-700">{suggestedAmount > 0 ? fmt(suggestedAmount) : "Enter manually"}</p>
                  </div>
                  {selectedEntry["Condition of Material"] && (
                    <div>
                      <p className="text-xs text-gray-500">Condition</p>
                      <Badge variant="outline" className={selectedEntry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50 text-xs" : "text-red-600 border-red-200 bg-red-50 text-xs"}>
                        {selectedEntry["Condition of Material"]}
                      </Badge>
                    </div>
                  )}
                  {selectedEntry["Management Remarks"] && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Management Remarks</p>
                      <p className="text-sm font-medium text-amber-700">{selectedEntry["Management Remarks"]}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Document Type</Label>
                <div className="rounded-xl border border-green-500 bg-green-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-semibold text-gray-900">Credit Note</p>
                  </div>
                  <p className="text-xs text-gray-500">Refund the party (e.g. our fault, quality, shortage)</p>
                </div>
              </div>

              {/* Note number + amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Credit Note Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. DN-2024-001"
                    value={noteNumber}
                    onChange={(e) => setNoteNumber(e.target.value)}
                    disabled={submitting}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Amount (₹) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={submitting}
                    className="h-10"
                  />
                  {suggestedAmount > 0 && Number(amount) !== suggestedAmount && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setAmount(String(suggestedAmount.toFixed(2)))}
                    >
                      Reset to suggested {fmt(suggestedAmount)}
                    </button>
                  )}
                </div>
              </div>

              {/* File upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Upload Note Document</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
                  disabled={submitting}
                  className="h-10"
                />
                {noteFile && <p className="text-xs text-green-600">✓ {noteFile.name}</p>}
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Additional Remarks</Label>
                <Textarea
                  placeholder="Any notes about this credit note..."
                  value={noteRemarks}
                  onChange={(e) => setNoteRemarks(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !docType || !noteNumber.trim() || !amount}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Issuing...</>
                : <><FileText className="w-4 h-4 mr-2" />Issue {docType || "Note"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
