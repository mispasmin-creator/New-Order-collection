"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { useNotification } from "@/components/providers/NotificationProvider"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Search, Loader2, IndianRupee, Clock, AlertCircle, CheckCircle2, FileText, Calendar } from "lucide-react"

export const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const formatDate = (d) => {
  if (!d) return ""
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return d
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
  } catch { return d }
}

export default function RetentionPage({ user }) {
  const { toast } = useToast()
  const { updateCount } = useNotification()

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [retentionRecords, setRetentionRecords] = useState({}) // po_number -> record
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all, pending, paid, due_today, due_week, overdue

  // Modal State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [amountToAdd, setAmountToAdd] = useState("")
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      const [ordersRes, retentionRes] = await Promise.all([
        supabase.from("ORDER RECEIPT").select("*").eq("Retention Payment", "Yes").order("id", { ascending: false }),
        supabase.from("po_retention_records").select("*")
      ])

      if (ordersRes.error) throw ordersRes.error
      if (retentionRes.error && retentionRes.error.code !== '42P01') throw retentionRes.error // ignore table not found if newly created

      setOrders(ordersRes.data || [])
      
      const recordsMap = {}
      if (retentionRes.data) {
        retentionRes.data.forEach(r => {
          recordsMap[r.po_number] = r
        })
      }
      setRetentionRecords(recordsMap)

    } catch (err) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  // Process data (Group by PO)
  const processedData = useMemo(() => {
    const groups = {}
    orders.forEach(r => {
      const poNumber = r["PARTY PO NO (As Per Po Exact)"] || "N/A"
      if (!groups[poNumber]) {
        groups[poNumber] = {
          poNumber,
          partyName: r["Party Name"] || r["Party Names"] || "",
          firmName: r["Firm Name"] || "",
          orderDate: r["Timestamp"],
          retentionPercentage: Number(r["Retention Percentage"]) || 0,
          leadTime: Number(r["Lead Time for Retention"]) || 0,
          totalOrderAmount: 0,
          rows: []
        }
      }
      const val = Number(r["Total PO Basic Value"]) || 0
      const adj = Number(r["Adjusted Amount"]) || 0
      groups[poNumber].totalOrderAmount += (adj > 0 && adj <= val * 10) ? adj : val
      groups[poNumber].rows.push(r)
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Calculate fields
    const list = Object.values(groups).map(g => {
      const retentionAmount = (g.totalOrderAmount * g.retentionPercentage) / 100
      
      let dueDateObj = new Date(g.orderDate)
      if (isNaN(dueDateObj.getTime())) dueDateObj = new Date()
      dueDateObj.setDate(dueDateObj.getDate() + g.leadTime)
      
      const record = retentionRecords[g.poNumber] || { amount_received: 0, status: "Pending", remarks: "" }
      const amountReceived = Number(record.amount_received) || 0
      const balance = Math.max(0, retentionAmount - amountReceived)
      
      // Determine computed status
      let paymentStatus = record.status
      if (paymentStatus === "Pending" && amountReceived > 0 && amountReceived < retentionAmount) {
        paymentStatus = "Partial"
      }
      if (balance === 0 && retentionAmount > 0) {
        paymentStatus = "Paid"
      }
      
      // Calculate days remaining
      const timeDiff = dueDateObj.getTime() - today.getTime()
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

      return {
        ...g,
        retentionAmount,
        dueDateObj,
        amountReceived,
        balance,
        paymentStatus,
        daysRemaining: daysDiff,
        remarks: record.remarks || ""
      }
    })

    return list.sort((a, b) => a.dueDateObj - b.dueDateObj)
  }, [orders, retentionRecords])

  // Update Sidebar Notification Count (Pending Cases)
  const pendingCasesCount = useMemo(() => processedData.filter(d => d.paymentStatus !== "Paid").length, [processedData])
  useEffect(() => { updateCount("Retention", pendingCasesCount) }, [pendingCasesCount, updateCount])

  // Filter Data
  const filteredData = useMemo(() => {
    let result = processedData

    if (user && user.role !== "master") {
      const firms = user.firm ? user.firm.split(",").map(f => f.trim().toLowerCase()) : []
      if (!firms.includes("all")) {
        result = result.filter(o => firms.includes((o.firmName || "").toLowerCase()))
      }
    }

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      result = result.filter(o => o.poNumber.toLowerCase().includes(t) || o.partyName.toLowerCase().includes(t))
    }

    if (statusFilter !== "all") {
      result = result.filter(o => {
        if (statusFilter === "pending") return o.paymentStatus === "Pending" || o.paymentStatus === "Partial"
        if (statusFilter === "paid") return o.paymentStatus === "Paid"
        if (statusFilter === "overdue") return o.daysRemaining < 0 && o.paymentStatus !== "Paid"
        if (statusFilter === "due_today") return o.daysRemaining === 0 && o.paymentStatus !== "Paid"
        if (statusFilter === "due_week") return o.daysRemaining >= 0 && o.daysRemaining <= 7 && o.paymentStatus !== "Paid"
        return true
      })
    }

    return result
  }, [processedData, searchTerm, statusFilter, user])

  // Aggregated Stats
  const stats = useMemo(() => {
    let totalReceivable = 0
    let dueThisMonth = 0
    let overdueAmount = 0
    let collectedAmount = 0

    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    processedData.forEach(o => {
      totalReceivable += o.retentionAmount
      collectedAmount += o.amountReceived

      if (o.paymentStatus !== "Paid") {
        if (o.daysRemaining < 0) overdueAmount += o.balance
        if (o.dueDateObj.getMonth() === currentMonth && o.dueDateObj.getFullYear() === currentYear) {
          dueThisMonth += o.balance
        }
      }
    })

    return { totalReceivable, dueThisMonth, overdueAmount, collectedAmount, pendingCases: pendingCasesCount }
  }, [processedData, pendingCasesCount])

  const handleOpenDialog = (item) => {
    setSelectedGroup(item)
    setAmountToAdd("")
    setRemarks(item.remarks)
    setDialogOpen(true)
  }

  const handleUpdatePayment = async (markAsPaid = false) => {
    if (!selectedGroup) return

    setSubmitting(true)
    try {
      const newAmountReceived = markAsPaid 
        ? selectedGroup.retentionAmount 
        : selectedGroup.amountReceived + (Number(amountToAdd) || 0)
        
      let newStatus = "Pending"
      if (newAmountReceived >= selectedGroup.retentionAmount) newStatus = "Paid"
      else if (newAmountReceived > 0) newStatus = "Partial"

      const payload = {
        po_number: selectedGroup.poNumber,
        amount_received: newAmountReceived,
        status: newStatus,
        remarks: remarks || "",
        updated_at: getISTTimestamp()
      }

      const { error } = await supabase.from("po_retention_records").upsert(payload, { onConflict: "po_number" })
      if (error) throw error

      toast({
        title: "Success",
        description: `Retention payment updated for PO: ${selectedGroup.poNumber}`,
        className: "bg-green-50 border-green-200 text-green-800"
      })
      
      setDialogOpen(false)
      fetchData()
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const renderStatusBadge = (status, daysRemaining) => {
    if (status === "Paid") return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>
    if (daysRemaining < 0) return <Badge className="bg-red-100 text-red-800 border-red-200">Overdue</Badge>
    if (status === "Partial") return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Partial</Badge>
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Pending</Badge>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading Retention Data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retention Tracker</h1>
          <p className="text-gray-600">Manage and track retention payments receivable from customers</p>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-blue-600">Total Receivable</p>
            <p className="text-xl font-bold text-blue-900 mt-1 tabular-nums">{formatCurrency(stats.totalReceivable)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-orange-600">Due This Month</p>
            <p className="text-xl font-bold text-orange-900 mt-1 tabular-nums">{formatCurrency(stats.dueThisMonth)}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-red-600">Overdue Balance</p>
            <p className="text-xl font-bold text-red-900 mt-1 tabular-nums">{formatCurrency(stats.overdueAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-600">Collected Amount</p>
            <p className="text-xl font-bold text-green-900 mt-1 tabular-nums">{formatCurrency(stats.collectedAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-600">Pending Cases</p>
            <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{stats.pendingCases}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input 
            placeholder="Search by PO Number or Customer..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <div className="w-full md:w-64">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="pending">Pending & Partial</SelectItem>
              <SelectItem value="paid">Fully Paid</SelectItem>
              <SelectItem value="due_today">Due Today</SelectItem>
              <SelectItem value="due_week">Due This Week</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-center w-[100px]">Action</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead className="text-right">Order Value</TableHead>
                <TableHead className="text-right">Ret. %</TableHead>
                <TableHead className="text-right">Ret. Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2"><FileText className="w-8 h-8 text-gray-300" /><span>No retention records found</span></div>
                </TableCell></TableRow>
              ) : (
                filteredData.map(row => (
                  <TableRow key={row.poNumber} className="hover:bg-slate-50">
                    <TableCell className="text-center">
                      <Button size="sm" onClick={() => handleOpenDialog(row)} className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">Manage</Button>
                    </TableCell>
                    <TableCell className="font-semibold text-xs">{row.poNumber}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={row.partyName}>{row.partyName}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">{formatCurrency(row.totalOrderAmount)}</TableCell>
                    <TableCell className="text-right text-xs font-medium bg-slate-50">{row.retentionPercentage}%</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-indigo-700">{formatCurrency(row.retentionAmount)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-700">{formatDate(row.dueDateObj)}</span>
                        {row.paymentStatus !== "Paid" && (
                          <span className={`text-[10px] font-medium ${row.daysRemaining < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                            {row.daysRemaining < 0 ? `${Math.abs(row.daysRemaining)}d overdue` : `${row.daysRemaining}d left`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{renderStatusBadge(row.paymentStatus, row.daysRemaining)}</TableCell>
                    <TableCell className="text-right tabular-nums text-green-700 font-medium">{formatCurrency(row.amountReceived)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-red-600">{formatCurrency(row.balance)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Manage Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Retention Payment</DialogTitle>
            <DialogDescription>Update payment status and details for PO: <strong>{selectedGroup?.poNumber}</strong></DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Retention Amount</p>
                  <p className="font-semibold text-lg text-indigo-700 tabular-nums">{formatCurrency(selectedGroup.retentionAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Current Balance</p>
                  <p className="font-semibold text-lg text-red-600 tabular-nums">{formatCurrency(selectedGroup.balance)}</p>
                </div>
              </div>

              {selectedGroup.paymentStatus !== "Paid" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Add Partial Payment (₹)</label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={amountToAdd} 
                      onChange={e => setAmountToAdd(e.target.value)} 
                      max={selectedGroup.balance}
                    />
                    <Button 
                      variant="secondary" 
                      onClick={() => handleUpdatePayment(false)} 
                      disabled={submitting || !amountToAdd || Number(amountToAdd) <= 0 || Number(amountToAdd) > selectedGroup.balance}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">This will reduce the current balance.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Remarks / Notes</label>
                <Textarea 
                  placeholder="Add any internal notes..." 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleUpdatePayment(false)} disabled={submitting}>
              Save Remarks Only
            </Button>
            {selectedGroup?.paymentStatus !== "Paid" && (
              <Button onClick={() => handleUpdatePayment(true)} disabled={submitting} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Fully Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
