"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Loader2, Search, CheckCircle2, PackageCheck, Truck, ChevronDown, ChevronRight,
  RefreshCw, Phone, Eye,
} from "lucide-react"
import { getSignedUrl } from "@/lib/storageUtils"

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

const EMPTY_FORM = {
  transporterName: "",
  transporterMobile: "",
  vehicleNo: "",
  receivedDate: "",
  remarks: "",
}

export default function ReturnOfMaterialPage({ user }) {
  const { toast } = useToast()

  const [entries, setEntries] = useState([])         // pending return dispatch
  const [historyEntries, setHistoryEntries] = useState([])  // dispatched
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [expandedRows, setExpandedRows] = useState({})
  const [masterTransporters, setMasterTransporters] = useState([])

  // Modal state
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchMasterTransporters = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("MASTER")
        .select('"Transporter Name"')
        .not("Transporter Name", "is", null)
      if (error) throw error
      if (data) {
        const unique = [...new Set(data.map((d) => d["Transporter Name"]).filter((t) => t && t.trim() !== ""))]
        setMasterTransporters(unique.sort())
      }
    } catch (err) {
      console.error("Error fetching transporters:", err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      // All reasons — management approved AND credit note issued
      const { data, error } = await supabase
        .from("Material Return")
        .select("*")
        .not("Actual5", "is", null)
        .not("Debit Note Issued At", "is", null)
        .order("id", { ascending: false })
      if (error) throw error

      const pending = []
      const history = []
      ;(data || []).forEach((row) => {
        if (row["Return Dispatched At"] && String(row["Return Dispatched At"]).trim() !== "") {
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

  useEffect(() => { fetchData(); fetchMasterTransporters() }, [fetchData, fetchMasterTransporters])

  const filtered = (list) => {
    if (!searchTerm.trim()) return list
    const t = searchTerm.toLowerCase()
    return list.filter((r) => Object.values(r).some((v) => v?.toString().toLowerCase().includes(t)))
  }

  const displayList = activeTab === "pending" ? filtered(entries) : filtered(historyEntries)
  const toggleExpand = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))

  const handleOpen = (entry) => {
    setSelectedEntry(entry)
    setForm({
      transporterName: entry["Return Transporter Name"] || "",
      transporterMobile: entry["Return Transporter Mobile"] || "",
      vehicleNo: entry["Return Vehicle No"] || "",
      receivedDate: entry["Return Received At"] ? new Date(entry["Return Received At"]).toISOString().split("T")[0] : "",
      remarks: "",
    })
  }

  const handleClose = () => {
    setSelectedEntry(null)
    setForm(EMPTY_FORM)
  }

  const handleViewFile = async (url) => {
    if (!url) return
    const signed = await getSignedUrl(url)
    window.open(signed, "_blank")
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    if (!form.transporterName.trim()) {
      toast({ title: "Required", description: "Enter the transporter name.", variant: "destructive" })
      return
    }
    if (!form.transporterMobile.trim()) {
      toast({ title: "Required", description: "Enter the transporter mobile number.", variant: "destructive" })
      return
    }
    try {
      setSubmitting(true)
      const payload = {
        "Return Transporter Name": form.transporterName.trim(),
        "Return Transporter Mobile": form.transporterMobile.trim(),
        "Return Vehicle No": form.vehicleNo.trim(),
        "Return Dispatched At": getISTTimestamp(),
        ...(form.receivedDate ? { "Return Received At": form.receivedDate } : {}),
      }
      if (form.remarks.trim()) {
        payload["Remarks"] = (selectedEntry["Remarks"]
          ? selectedEntry["Remarks"] + "\n"
          : "") + `[Return Dispatch] ${form.remarks.trim()}`
      }

      const { error } = await supabase
        .from("Material Return")
        .update(payload)
        .eq("id", selectedEntry.id)
      if (error) throw error

      toast({ title: "Return Dispatched", description: `Return for No. ${selectedEntry["Return No."]} dispatched successfully.` })
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
        <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
        <span className="text-gray-600">Loading return dispatch entries...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Return of Material</h1>
          <p className="text-gray-600">Arrange physical dispatch of material back to warehouse after Credit Note issuance</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="flex items-center gap-2 w-fit">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-teal-50 border-teal-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-teal-600">Pending Return Dispatch</p>
              <div className="text-2xl font-bold text-teal-900">{entries.length}</div>
            </div>
            <div className="h-10 w-10 bg-teal-500 rounded-full flex items-center justify-center text-white">
              <Truck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Returns Dispatched</p>
              <div className="text-2xl font-bold text-green-900">{historyEntries.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle2 className="h-5 w-5" />
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
              placeholder="Search by party, product, return no, transporter..."
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
                <TableHead>Credit Note No.</TableHead>
                {activeTab === "history" && (
                  <>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Vehicle No.</TableHead>
                    <TableHead>Dispatched On</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <PackageCheck className="w-8 h-8 text-gray-300" />
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
                            className="bg-teal-600 hover:bg-teal-700 h-8 text-xs"
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            Return
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
                      <TableCell className="font-bold text-sm">{entry["Qty Of Return Material"] || entry["Qty"]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${reasonBadgeClass(entry["Reason Of Material Return"])}`}>
                          {entry["Reason Of Material Return"] || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-purple-700">{entry["Debit Note Number"] || "—"}</TableCell>
                      {activeTab === "history" && (
                        <>
                          <TableCell className="text-sm">{entry["Return Transporter Name"] || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{entry["Return Vehicle No"] || "—"}</TableCell>
                          <TableCell className="text-sm text-gray-600">{formatDate(entry["Return Dispatched At"])}</TableCell>
                        </>
                      )}
                    </TableRow>

                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={12} className="p-0 bg-gray-50/50 border-b border-gray-200">
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
                            <div><p className="text-gray-500 text-xs mb-0.5">Credit Note Issued</p><p className="font-medium">{formatDate(entry["Debit Note Issued At"])}</p></div>
                            {entry["Debit Note Amount"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Credit Note Amount</p><p className="font-bold text-purple-700">{fmt(entry["Debit Note Amount"])}</p></div>
                            )}
                            {entry["Qty Of Return Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Return Qty</p><p className="font-medium">{entry["Qty Of Return Material"]}</p></div>}
                            {entry["Rate Of Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Rate</p><p className="font-semibold text-green-700">₹{entry["Rate Of Material"]}</p></div>}
                            {entry["Condition of Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Condition</p>
                                <Badge variant="outline" className={entry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50 text-xs" : "text-red-600 border-red-200 bg-red-50 text-xs"}>
                                  {entry["Condition of Material"]}
                                </Badge>
                              </div>
                            )}
                            {entry["Management Remarks"] && (
                              <div className="col-span-2"><p className="text-gray-500 text-xs mb-0.5">Management Remarks</p><p className="font-medium text-amber-700">{entry["Management Remarks"]}</p></div>
                            )}
                            {/* Return dispatch details (history) */}
                            {entry["Return Transporter Name"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Transporter</p><p className="font-semibold">{entry["Return Transporter Name"]}</p></div>
                            )}
                            {entry["Return Transporter Mobile"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Transporter Mobile</p><p className="font-medium">{entry["Return Transporter Mobile"]}</p></div>
                            )}
                            {entry["Return Vehicle No"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Vehicle No.</p><p className="font-mono font-medium">{entry["Return Vehicle No"]}</p></div>
                            )}
                            {entry["Return Driver Name"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Driver Name</p><p className="font-medium">{entry["Return Driver Name"]}</p></div>
                            )}
                            {entry["Return Driver Mobile"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Driver Mobile</p><p className="font-medium">{entry["Return Driver Mobile"]}</p></div>
                            )}
                            {entry["Return Dispatched At"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Dispatched At</p><p className="font-medium text-teal-700">{formatDate(entry["Return Dispatched At"])}</p></div>
                            )}
                            {entry["Return Received At"] && (
                              <div><p className="text-gray-500 text-xs mb-0.5">Received Date</p><p className="font-medium text-green-700">{formatDate(entry["Return Received At"])}</p></div>
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

      {/* Return Dispatch Modal */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-600" />
              Arrange Return Dispatch
            </DialogTitle>
            <DialogDescription>
              Return No. <strong>{selectedEntry?.["Return No."]}</strong> — {selectedEntry?.["Party Name"]}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-5 py-2">

              {/* Product summary card */}
              <div className="rounded-lg border bg-teal-50 border-teal-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Product Details</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2 bg-white rounded-lg border border-teal-100 px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Product Being Returned</p>
                      <p className="font-bold text-gray-900 text-base">{selectedEntry["Product Name"]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Return Qty</p>
                      <p className="font-bold text-teal-700 text-xl">{selectedEntry["Qty Of Return Material"] || selectedEntry["Qty"]}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Reason</p>
                    <Badge variant="outline" className={`text-xs ${reasonBadgeClass(selectedEntry["Reason Of Material Return"])}`}>
                      {selectedEntry["Reason Of Material Return"] || "—"}
                    </Badge>
                  </div>
                  {selectedEntry["Reason Of Material Return"] !== "Material Return" && (
                    <div>
                      <p className="text-xs text-gray-500">Credit Note No.</p>
                      <p className="font-mono font-semibold text-purple-700">{selectedEntry["Debit Note Number"] || "—"}</p>
                    </div>
                  )}
                  {selectedEntry["Debit Note Amount"] && (
                    <div>
                      <p className="text-xs text-gray-500">Credit Note Amount</p>
                      <p className="font-bold text-purple-700">{fmt(selectedEntry["Debit Note Amount"])}</p>
                    </div>
                  )}
                  {selectedEntry["Condition of Material"] && (
                    <div>
                      <p className="text-xs text-gray-500">Condition</p>
                      <Badge variant="outline" className={selectedEntry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50 text-xs" : "text-red-600 border-red-200 bg-red-50 text-xs"}>
                        {selectedEntry["Condition of Material"]}
                      </Badge>
                    </div>
                  )}
                  {selectedEntry["Invoice Number"] && (
                    <div>
                      <p className="text-xs text-gray-500">Invoice No.</p>
                      <p className="font-mono font-semibold text-blue-700">{selectedEntry["Invoice Number"]}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Debit Note</p>
                    {selectedEntry["Debit Note Copy"] ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleViewFile(selectedEntry["Debit Note Copy"])}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Debit Note
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not uploaded</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Transporter fields */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> Transporter Info
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label className="text-sm font-medium">
                    Transporter Name <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.transporterName}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, transporterName: v }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Transporter" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {masterTransporters.length === 0 ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        masterTransporters.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label className="text-sm font-medium">
                    Transporter Mobile <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      name="transporterMobile"
                      placeholder="10-digit number"
                      value={form.transporterMobile}
                      onChange={handleChange}
                      disabled={submitting}
                      className="h-10 pl-9"
                      maxLength={15}
                    />
                  </div>
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label className="text-sm font-medium">Vehicle No.</Label>
                  <Input
                    name="vehicleNo"
                    placeholder="e.g. MH04 AB 1234"
                    value={form.vehicleNo}
                    onChange={handleChange}
                    disabled={submitting}
                    className="h-10 uppercase"
                  />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label className="text-sm font-medium">Received Delivery Date</Label>
                  <Input
                    name="receivedDate"
                    type="date"
                    value={form.receivedDate}
                    onChange={handleChange}
                    disabled={submitting}
                    className="h-10"
                  />
                </div>
              </div>



              <div className="space-y-2">
                <Label className="text-sm font-medium">Remarks</Label>
                <Textarea
                  name="remarks"
                  placeholder="Any additional notes about this return dispatch..."
                  value={form.remarks}
                  onChange={handleChange}
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
              disabled={submitting || !form.transporterName.trim() || !form.transporterMobile.trim()}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                : <><Truck className="w-4 h-4 mr-2" />Confirm Return Dispatch</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
