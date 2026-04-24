"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { getISTTimestamp } from "@/lib/dateUtils"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Search, CheckCircle2, AlertCircle, BadgeCheck, ChevronDown, ChevronRight } from "lucide-react"
import { useNotification } from "@/components/providers/NotificationProvider"
import { groupRowsByPo } from "@/lib/workflowGrouping"

const STATUS_DISPATCHED = "Dispatched"
const STATUS_ACCOUNTS_APPROVED = "Accounts Approved"

const formatDate = (value) => {
  if (!value) return ""
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return String(value)
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`
  } catch {
    return String(value)
  }
}

export default function AccountsApprovalPage({ user }) {
  const { updateCount } = useNotification()
  const { toast } = useToast()
  const [rows, setRows] = useState([])
  const [historyRows, setHistoryRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [expandedGroup, setExpandedGroup] = useState(null)
  // PO-level form: one payment term decision per PO
  const [paymentTermStatus, setPaymentTermStatus] = useState("")
  const [remarks, setRemarks] = useState("")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      let orderQuery = supabase.from("ORDER RECEIPT").select("*").order("id", { ascending: false })

      if (user.role !== "ADMIN") {
        const userFirms = user.firm ? user.firm.split(",").map((f) => f.trim()) : []
        if (!userFirms.includes("all")) {
          orderQuery = orderQuery.in("Firm Name", userFirms)
        }
      }

      const { data: orderData, error: orderError } = await orderQuery
      if (orderError) throw orderError

      const orderMap = new Map()
      ;(orderData || []).forEach((row) => orderMap.set(row.id, row))

      const { data: splitData, error: splitError } = await supabase
        .from("po_logistics_splits")
        .select("*")
        .in("status", [STATUS_DISPATCHED, STATUS_ACCOUNTS_APPROVED])
        .order("id", { ascending: false })

      if (splitError) throw splitError

      const merge = (split) => {
        const order = orderMap.get(split.po_id)
        if (!order) return null
        return {
          id: split.id,
          poId: split.po_id,
          splitStatus: split.status || "",
          allocatedQty: parseFloat(split.allocated_qty) || 0,
          transporterName: split.transporter_name || "",
          rate: split.rate || "",
          paymentTermStatus: split.payment_term_status || "",
          accountsRemarks: split.accounts_remarks || "",
          doNumber: order["DO-Delivery Order No."] || "",
          partyPONumber: order["PARTY PO NO (As Per Po Exact)"] || "",
          partyName: order["Party Names"] || "",
          productName: order["Product Name"] || "",
          firmName: order["Firm Name"] || "",
          address: order["Address"] || "",
          quantity: parseFloat(order["Quantity"]) || 0,
          totalValue: parseFloat(order["Total PO Basic Value"]) || 0,
          poRate: order["Rate Of Material"] || "",
          gstNumber: order["Gst Number"] || "",
          contactPersonName: order["Contact Person Name"] || "",
          partyPODate: order["Party PO Date"] || "",
          typeOfTransporting: order["Type Of Transporting"] || "",
          paymentToBeTaken: order["Payment to Be Taken"] || "",
          retentionPayment: order["Retention Payment"] || "",
          retentionPercentage: parseFloat(order["Retention Percentage"]) || 0,
          leadTimeFinalPayment: order["Lead Time For Collection Of Final Payment"] || "",
          specificConcern: order["Specific Concern"] || "",
        }
      }

      const pending = []
      const history = []
      ;(splitData || []).forEach((split) => {
        const merged = merge(split)
        if (!merged) return
        if (merged.splitStatus === STATUS_DISPATCHED) pending.push(merged)
        else history.push(merged)
      })

      setRows(pending)
      setHistoryRows(history)
    } catch (error) {
      console.error("Error fetching accounts approval data:", error)
      toast({ title: "Error loading data", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    updateCount("Accounts Approval", rows.length)
  }, [rows.length, updateCount])

  const displayRows = useMemo(() => {
    const source = activeTab === "pending" ? rows : historyRows
    if (!searchTerm.trim()) return source
    const term = searchTerm.toLowerCase()
    return source.filter((row) =>
      Object.values(row).some((v) => v?.toString().toLowerCase().includes(term))
    )
  }, [activeTab, rows, historyRows, searchTerm])

  const groupedRows = useMemo(() => groupRowsByPo(displayRows), [displayRows])

  const handleOpen = (group) => {
    setSelectedGroup(group)
    setPaymentTermStatus("")
    setRemarks("")
  }

  const handleClose = () => {
    setSelectedGroup(null)
    setPaymentTermStatus("")
    setRemarks("")
  }

  const handleSubmit = async () => {
    if (!paymentTermStatus) {
      toast({ title: "Validation Error", description: "Please select a payment term status.", variant: "destructive" })
      return
    }
    if (paymentTermStatus === "Not Followed" && !remarks.trim()) {
      toast({ title: "Validation Error", description: "Please enter remarks for 'Not Followed'.", variant: "destructive" })
      return
    }

    try {
      setSubmitting(true)

      const splitIds = selectedGroup.rows.map((r) => r.id)

      const { error } = await supabase
        .from("po_logistics_splits")
        .update({
          status: STATUS_ACCOUNTS_APPROVED,
          payment_term_status: paymentTermStatus,
          accounts_remarks: paymentTermStatus === "Not Followed" ? remarks.trim() : null,
        })
        .in("id", splitIds)

      if (error) throw error

      toast({
        title: "Approved",
        description: "PO moved to Logistic.",
        className: "bg-green-50 text-green-800 border-green-200",
      })

      handleClose()
      await fetchData()
    } catch (error) {
      console.error("Error submitting accounts approval:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading accounts approval...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts Approval</h1>
          <p className="text-gray-600">Review payment terms before releasing to Logistic</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-600">Pending Approval</p>
              <div className="text-2xl font-bold text-amber-900">{rows.length}</div>
            </div>
            <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Approved</p>
              <div className="text-2xl font-bold text-green-900">{historyRows.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
              <BadgeCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + tabs */}
      <div className="bg-white border rounded-md shadow-sm p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search..."
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
            Pending ({rows.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            History ({historyRows.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-8" />
                {activeTab === "pending" && <TableHead>Action</TableHead>}
                <TableHead>PO Number</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead>Splits</TableHead>
                {activeTab === "history" && <TableHead>Payment Term</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No records found</TableCell>
                </TableRow>
              ) : (
                groupedRows.map((group) => {
                  const isExpanded = expandedGroup === group.key
                  return (
                    <Fragment key={group.key}>
                      {/* PO group header — clickable to expand */}
                      <TableRow
                        className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                      >
                        <TableCell className="text-gray-400 pl-3">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                          }
                        </TableCell>
                        {activeTab === "pending" && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => handleOpen(group)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Review
                            </Button>
                          </TableCell>
                        )}
                        <TableCell className="font-semibold text-slate-900">{group.poNumber}</TableCell>
                        <TableCell className="text-slate-700">{group.partyName}</TableCell>
                        <TableCell className="text-slate-600">{group.rows[0]?.firmName}</TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500">
                            {group.rows.length} split{group.rows.length > 1 ? "s" : ""}
                          </span>
                        </TableCell>
                        {activeTab === "history" && (
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              group.rows[0]?.paymentTermStatus === "Not Followed"
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {group.rows[0]?.paymentTermStatus || "—"}
                            </span>
                          </TableCell>
                        )}
                      </TableRow>

                      {/* Expanded: ORDER RECEIPT detail cards */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0 border-b border-slate-200">
                            <div className="bg-slate-50/80 px-6 py-4 space-y-3">
                              {group.rows.map((row) => (
                                <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-gray-800">{row.productName}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                        Ordered: {row.quantity}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Allocated: {row.allocatedQty}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">DO Number</span>
                                      <p className="font-mono font-medium text-gray-800">{row.doNumber || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Party PO Date</span>
                                      <p className="font-medium text-gray-800">{row.partyPODate || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Rate</span>
                                      <p className="font-medium text-gray-800">{row.poRate ? `₹${row.poRate}` : "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Total PO Value</span>
                                      <p className="font-medium text-green-700">{row.totalValue ? `₹${Number(row.totalValue).toLocaleString()}` : "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Transporter</span>
                                      <p className="font-medium text-gray-800">{row.transporterName || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Transport Type</span>
                                      <p className="font-medium text-gray-800">{row.typeOfTransporting || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Payment</span>
                                      <p className="font-medium text-gray-800">{row.paymentToBeTaken || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">GST Number</span>
                                      <p className="font-medium text-gray-800">{row.gstNumber || "—"}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Contact Person</span>
                                      <p className="font-medium text-gray-800">{row.contactPersonName || "—"}</p>
                                    </div>
                                    {row.retentionPayment && (
                                      <div>
                                        <span className="text-gray-500">Retention Payment</span>
                                        <p className="font-medium text-gray-800">{row.retentionPayment} ({row.retentionPercentage}%)</p>
                                      </div>
                                    )}
                                    {row.leadTimeFinalPayment && (
                                      <div>
                                        <span className="text-gray-500">Lead Time (Final)</span>
                                        <p className="font-medium text-gray-800">{row.leadTimeFinalPayment}</p>
                                      </div>
                                    )}
                                    {row.address && (
                                      <div className="col-span-2">
                                        <span className="text-gray-500">Address</span>
                                        <p className="font-medium text-gray-800">{row.address}</p>
                                      </div>
                                    )}
                                    {row.specificConcern && (
                                      <div className="col-span-2">
                                        <span className="text-gray-500">Specific Concern</span>
                                        <p className="font-medium text-orange-700">{row.specificConcern}</p>
                                      </div>
                                    )}
                                    {row.accountsRemarks && (
                                      <div className="col-span-2">
                                        <span className="text-gray-500">Accounts Remarks</span>
                                        <p className="font-medium text-red-600 italic">{row.accountsRemarks}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accounts Approval</DialogTitle>
            <DialogDescription>
              PO: {selectedGroup?.poNumber} · {selectedGroup?.rows[0]?.partyName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Order details */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order Details</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Party</p>
                  <p className="font-medium">{selectedGroup?.rows[0]?.partyName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment To Be Taken</p>
                  <p className="font-medium">{selectedGroup?.rows[0]?.paymentToBeTaken || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Retention Payment</p>
                  <p className="font-medium">{selectedGroup?.rows[0]?.retentionPayment || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Retention %</p>
                  <p className="font-medium">{selectedGroup?.rows[0]?.retentionPercentage || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lead Time (Final Payment)</p>
                  <p className="font-medium">{selectedGroup?.rows[0]?.leadTimeFinalPayment || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Specific Concern</p>
                  <p className="font-medium">{selectedGroup?.rows[0]?.specificConcern || "—"}</p>
                </div>
              </div>

              {/* Products/splits */}
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Splits</p>
                <div className="space-y-1">
                  {selectedGroup?.rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-slate-100">
                      <span className="font-medium text-slate-800">{row.productName}</span>
                      <span className="text-xs text-slate-500">{row.transporterName} · {row.allocatedQty} qty</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment term selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Payment Term Status *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setPaymentTermStatus("Followed"); setRemarks("") }}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentTermStatus === "Followed"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">Followed</p>
                  <p className="text-xs text-gray-500 mt-1">Payment terms were adhered to</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTermStatus("Not Followed")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentTermStatus === "Not Followed"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">Not Followed</p>
                  <p className="text-xs text-gray-500 mt-1">Payment terms were not adhered to</p>
                </button>
              </div>
            </div>

            {/* Remarks — only when Not Followed */}
            {paymentTermStatus === "Not Followed" && (
              <div className="space-y-1">
                <Label className="text-sm">Remarks *</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Describe why payment terms were not followed..."
                  className="h-24 resize-none"
                  disabled={submitting}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !paymentTermStatus ||
                (paymentTermStatus === "Not Followed" && !remarks.trim())
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                "Approve & Send to Logistic"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
