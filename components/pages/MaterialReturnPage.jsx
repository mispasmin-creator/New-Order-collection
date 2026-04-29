"use client"

import { useState, useEffect, Fragment } from "react"
import { getISTFullDisplayDateTime, getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, CheckCircle2, Loader2, FileText, Clock, RotateCcw, Truck, ClipboardList, Send, Camera, Eye, ChevronRight, ChevronDown, Filter, Trash2, AlertTriangle } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"
import { getSignedUrl } from "@/lib/storageUtils"
import { Label } from "@/components/ui/label"

export default function MaterialReturnPage({ user }) {
  const [returnEntries, setReturnEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("return_from_party")
  const [activeLogisticSubTab, setActiveLogisticSubTab] = useState("pending")
  const [activeReceivedSubTab, setActiveReceivedSubTab] = useState("pending")
  const [activeIssueSubTab, setActiveIssueSubTab] = useState("pending")
  const [activeCrmSubTab, setActiveCrmSubTab] = useState("pending")
  const [activeManagementSubTab, setActiveManagementSubTab] = useState("pending")

  const [selectedLogisticEntry, setSelectedLogisticEntry] = useState(null)
  const [selectedReceivedEntry, setSelectedReceivedEntry] = useState(null)
  const [selectedIssueEntry, setSelectedIssueEntry] = useState(null)
  const [selectedCrmEntry, setSelectedCrmEntry] = useState(null)
  const [selectedManagementEntry, setSelectedManagementEntry] = useState(null)

  const [partyList, setPartyList] = useState([])
  const [productList, setProductList] = useState([])
  const [transporterList, setTransporterList] = useState([])

  const [logisticFormData, setLogisticFormData] = useState({
    transporterName: "",
    vehicleNo: "",
    typeOfRate: "",
    rate: "",
  })

  const [receivedFormData, setReceivedFormData] = useState({
    qtyOfReturnMaterial: "",
    rateOfMaterial: "",
    conditionOfMaterial: "",
    photoOfReturnMaterial: null,
  })

  const [issueFormData, setIssueFormData] = useState({
    creditNoteNo: "",
    creditNoteFile: null,
    amount: "",
  })

  const [crmFormData, setCrmFormData] = useState({
    emailScreenshot: null,
  })

  const [managementRemarks, setManagementRemarks] = useState("")

  // Invoice lookup state
  const [invoiceLookupNo, setInvoiceLookupNo] = useState("")
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false)
  const [invoiceProducts, setInvoiceProducts] = useState([]) // rows from DISPATCH
  const [invoicePartyName, setInvoicePartyName] = useState("")
  // Per-product: { dispatchId, productName, qty, doNumber, removed: bool, reason: string }
  const [returnProductLines, setReturnProductLines] = useState([])

  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")

  const [formData, setFormData] = useState({
    doNumber: "",
    partyName: "",
    productName: "",
    qty: "",
    transportPayment: "",
    reasonOfMaterialReturn: "",
    returnNo: "",
    biltyNo: "",
    debitNoteCopy: null,
    billCopy: null,
    debitNote: "",
  })

  useEffect(() => {
    fetchData()
    fetchMasterData()
  }, [])

  const fetchMasterData = async () => {
    try {
      const { data, error } = await supabase.from('MASTER').select('*')
      if (error) throw error
      if (data && data.length > 0) {
        const keys = Object.keys(data[0])
        const partyKey = keys.find(k => k.trim() === "Party Name" || k.trim() === "Party Names") || keys.find(k => k.toLowerCase().includes("party"))
        const productKey = keys.find(k => k.trim() === "Product Name") || keys.find(k => k.toLowerCase().includes("product"))

        const parties = [...new Set(data.map(item => item[partyKey]).filter(Boolean))].sort()
        const products = [...new Set(data.map(item => item[productKey]).filter(Boolean))].sort()
        const transporters = [...new Set(data.map(item => item["Material Return Transporter Name"]).filter(Boolean))].sort()

        setPartyList(parties)
        setProductList(products)
        setTransporterList(transporters)
      }
    } catch (error) {
      console.error("Error fetching master data:", error)
    }
  }

  const handleInvoiceLookup = async () => {
    if (!invoiceLookupNo.trim()) {
      toast({ variant: "destructive", title: "Required", description: "Enter an invoice/bill number." })
      return
    }
    try {
      setInvoiceLookupLoading(true)
      const { data, error } = await supabase
        .from("DISPATCH")
        .select("id, \"Product Name\", \"Actual Truck Qty\", \"Qty To Be Dispatched\", \"Delivery Order No.\", \"Party Name\", po_id")
        .eq("Bill Number", invoiceLookupNo.trim())

      if (error) throw error
      if (!data || data.length === 0) {
        toast({ variant: "destructive", title: "Not Found", description: `No invoice found with number "${invoiceLookupNo.trim()}".` })
        return
      }

      // Fetch party name from ORDER RECEIPT if available
      const firstRow = data[0]
      let partyName = firstRow["Party Name"] || ""
      if (!partyName && firstRow.po_id) {
        const { data: orData } = await supabase
          .from("ORDER RECEIPT")
          .select("\"Party Names\"")
          .eq("id", firstRow.po_id)
          .single()
        if (orData) partyName = orData["Party Names"] || ""
      }

      // Fetch already-returned qty for this invoice from Material Return table
      const { data: existingReturns } = await supabase
        .from("Material Return")
        .select("\"Product Name\", \"Qty\"")
        .eq("Invoice Number", invoiceLookupNo.trim())

      // Sum already-returned qty per product name
      const alreadyReturnedMap = {}
      if (existingReturns) {
        for (const r of existingReturns) {
          const key = r["Product Name"] || ""
          alreadyReturnedMap[key] = (alreadyReturnedMap[key] || 0) + (Number(r["Qty"]) || 0)
        }
      }

      setInvoicePartyName(partyName)
      setInvoiceProducts(data)

      const lines = data.map((row) => {
        const dispatchedQty = Number(row["Actual Truck Qty"]) || Number(row["Qty To Be Dispatched"]) || 0
        const alreadyReturned = alreadyReturnedMap[row["Product Name"] || ""] || 0
        const availableQty = Math.max(0, dispatchedQty - alreadyReturned)
        return {
          dispatchId: row.id,
          productName: row["Product Name"] || "",
          originalQty: dispatchedQty,
          alreadyReturned,
          availableQty,
          returnQty: "",
          doNumber: row["Delivery Order No."] || "",
          removed: availableQty === 0, // auto-remove if nothing left to return
          reason: "",
          remarks: "",
          debitNoteFile: null,
        }
      })

      setReturnProductLines(lines)

      const fullyReturned = lines.filter((l) => l.availableQty === 0)
      if (fullyReturned.length > 0 && fullyReturned.length === lines.length) {
        toast({ title: "Fully Returned", description: "All quantities for this invoice have already been returned." })
      } else if (fullyReturned.length > 0) {
        toast({ title: "Note", description: `${fullyReturned.length} product(s) already fully returned and have been greyed out.` })
      }
    } catch (err) {
      console.error("Invoice lookup error:", err)
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setInvoiceLookupLoading(false)
    }
  }

  const resetInvoiceForm = () => {
    setInvoiceLookupNo("")
    setInvoiceProducts([])
    setInvoicePartyName("")
    setReturnProductLines([])
  }

  const generateNextReturnNo = (entries) => {
    if (!entries || entries.length === 0) return "0001"

    // Get all valid numeric return numbers
    const nos = entries
      .map(e => parseInt(e["Return No."]))
      .filter(n => !isNaN(n))

    if (nos.length === 0) return "0001"
    const maxNo = Math.max(...nos)
    return (maxNo + 1).toString().padStart(4, '0')
  }

  useEffect(() => {
    if (returnEntries.length >= 0) {
      const nextNo = generateNextReturnNo(returnEntries)
      setFormData(prev => ({ ...prev, returnNo: nextNo }))
    }
  }, [returnEntries])

  const [expandedRows, setExpandedRows] = useState({})
  const toggleRowExpansion = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('Material Return')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      setReturnEntries(data || [])
    } catch (error) {
      console.error("Error fetching material return data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data from Supabase",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmitReturnForm = async (e) => {
    e.preventDefault()
    const toReturn = returnProductLines.filter((l) => !l.removed)
    if (toReturn.length === 0) {
      toast({ variant: "destructive", title: "No Products", description: "All products were marked as good. Nothing to return." })
      return
    }
    const invalidQty = toReturn.filter((l) => {
      const rq = parseFloat(l.returnQty)
      return !rq || rq <= 0 || rq > l.availableQty
    })
    if (invalidQty.length > 0) {
      toast({ variant: "destructive", title: "Invalid Quantity", description: "Enter a valid return quantity (must be > 0 and ≤ original qty) for each product." })
      return
    }
    const missing = toReturn.filter((l) => !l.reason)
    if (missing.length > 0) {
      toast({ variant: "destructive", title: "Reason Required", description: "Please select a reason for each product being returned." })
      return
    }
    const missingNote = toReturn.filter((l) => !l.debitNoteFile)
    if (missingNote.length > 0) {
      toast({ variant: "destructive", title: "Debit Note Required", description: "Please upload a debit note for each product being returned." })
      return
    }

    try {
      setSubmitting(true)
      const timestamp = getISTTimestamp()

      // Upload debit note files per row
      const debitNoteUrls = await Promise.all(
        toReturn.map(async (line) => {
          const file = line.debitNoteFile
          const ext = file.name.split(".").pop()
          const path = `material_return/debit_note_${line.dispatchId}_${Date.now()}.${ext}`
          const { error: uploadErr } = await supabase.storage.from("images").upload(path, file, { cacheControl: "3600", upsert: false })
          if (uploadErr) throw uploadErr
          return supabase.storage.from("images").getPublicUrl(path).data.publicUrl
        })
      )

      // Build base return number and increment per row
      const baseNo = parseInt(formData.returnNo) || 1
      const inserts = toReturn.map((line, idx) => ({
        "Time Stamp": timestamp,
        "Invoice Number": invoiceLookupNo.trim(),
        "D.O Number": line.doNumber,
        "Party Name": invoicePartyName,
        "Product Name": line.productName,
        "Qty": parseFloat(line.returnQty),
        "Reason Of Material Return": line.reason,
        "Remarks": line.remarks || "",
        "Return No.": (baseNo + idx).toString().padStart(4, "0"),
        "Debit Note Copy": debitNoteUrls[idx] || "",
      }))

      const { error } = await supabase.from("Material Return").insert(inserts)
      if (error) throw error

      toast({ title: "Success", description: `${inserts.length} return entr${inserts.length > 1 ? "ies" : "y"} submitted for management approval.` })
      resetInvoiceForm()
      fetchData()
    } catch (error) {
      console.error("Error submitting material return form:", error)
      toast({ title: "Error", description: `Failed to submit. ${error.message}`, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogisticAction = (entry) => {
    setSelectedLogisticEntry(entry)
    setLogisticFormData({
      transporterName: entry["Transporter Name"] || "",
      vehicleNo: entry["Vehicle No."] || "",
      typeOfRate: entry["Type Of Rate"] || "",
      rate: entry["Rate"] || "",
    })
  }

  const handleLogisticSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const actualTime = getISTTimestamp()

      const payload = {
        "Transporter Name": logisticFormData.transporterName,
        "Vehicle No.": logisticFormData.vehicleNo,
        "Type Of Rate": logisticFormData.typeOfRate,
        "Rate": logisticFormData.rate,
        "Actual": actualTime, // Setting actual moves it to history
      }

      const { error } = await supabase
        .from('Material Return')
        .update(payload)
        .eq('id', selectedLogisticEntry.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Logistic details updated successfully!",
      })

      setSelectedLogisticEntry(null)
      fetchData()
    } catch (error) {
      console.error("Error updating logistic details:", error)
      toast({
        title: "Error",
        description: `Failed to update. ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const uploadFile = async (file, path) => {
    try {
      const { data, error } = await supabase.storage
        .from('images')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(path)

      return publicUrl
    } catch (error) {
      console.error("Upload error:", error)
      throw error
    }
  }

  const handleReceivedAction = (entry) => {
    setSelectedReceivedEntry(entry)
    setReceivedFormData({
      qtyOfReturnMaterial: entry["Qty Of Return Material"] || "",
      rateOfMaterial: entry["Rate Of Material"] || "",
      conditionOfMaterial: entry["Condition of Material"] || "",
      photoOfReturnMaterial: null,
    })
  }

  const handleReceivedSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const actual1Time = getISTTimestamp()
      let photoUrl = selectedReceivedEntry["Photo Of Return Material"] || ""

      if (receivedFormData.photoOfReturnMaterial) {
        const timestamp = Date.now()
        const path = `material_return/${selectedReceivedEntry.id}_received_${timestamp}`
        photoUrl = await uploadFile(receivedFormData.photoOfReturnMaterial, path)
      }

      const payload = {
        "Qty Of Return Material": receivedFormData.qtyOfReturnMaterial,
        "Rate Of Material": receivedFormData.rateOfMaterial,
        "Condition of Material": receivedFormData.conditionOfMaterial,
        "Photo Of Return Material": photoUrl,
        "Actual2": actual1Time, // Moves it to History (DB column: Actual2)
      }

      const { error } = await supabase
        .from('Material Return')
        .update(payload)
        .eq('id', selectedReceivedEntry.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Received details updated successfully!",
      })

      setSelectedReceivedEntry(null)
      fetchData()
    } catch (error) {
      console.error("Error updating received details:", error)
      toast({
        title: "Error",
        description: `Failed to update. ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewPhoto = async (url) => {
    if (!url) return
    const signed = await getSignedUrl(url)
    window.open(signed, '_blank')
  }

  const handleIssueAction = (entry) => {
    setSelectedIssueEntry(entry)
    setIssueFormData({
      creditNoteNo: entry["Credit Note No."] || "",
      creditNoteFile: null,
      amount: entry["Amount"] || "",
    })
  }

  const handleIssueSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const actual2Time = getISTTimestamp()
      let fileUrl = selectedIssueEntry["Credit Note Copy"] || ""

      if (issueFormData.creditNoteFile) {
        const timestamp = Date.now()
        const path = `material_return/${selectedIssueEntry.id}_issue_${timestamp}`
        fileUrl = await uploadFile(issueFormData.creditNoteFile, path)
      }

      const payload = {
        "Credit Note No.": issueFormData.creditNoteNo,
        "Credit Note Copy": fileUrl,
        "Amount": issueFormData.amount,
        "Actual3": actual2Time, // Moves it to History (DB column: Actual3)
      }

      const { error } = await supabase
        .from('Material Return')
        .update(payload)
        .eq('id', selectedIssueEntry.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Issue note updated successfully!",
      })

      setSelectedIssueEntry(null)
      fetchData()
    } catch (error) {
      console.error("Error updating issue note:", error)
      toast({
        title: "Error",
        description: `Failed to update. ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Filter logic for Arrange Logistic tab
  const getLogisticPending = () => {
    return returnEntries.filter(entry => {
      const planned = entry["Planned"]
      const actual = entry["Actual"]
      return (planned && planned !== "" && (!actual || actual === ""))
    })
  }

  const getLogisticHistory = () => {
    return returnEntries.filter(entry => {
      const planned = entry["Planned"]
      const actual = entry["Actual"]
      return (planned && planned !== "" && actual && actual !== "")
    })
  }

  // Filter logic for Received Return tab
  // Pending: Planned2 set, Actual2 null
  // History: both Planned2 and Actual2 set
  const getReceivedPending = () => {
    return returnEntries.filter(entry => {
      const planned2 = entry["Planned2"]
      const actual2 = entry["Actual2"]
      return (planned2 && planned2 !== "" && (!actual2 || actual2 === ""))
    })
  }

  const getReceivedHistory = () => {
    return returnEntries.filter(entry => {
      const planned2 = entry["Planned2"]
      const actual2 = entry["Actual2"]
      return (planned2 && planned2 !== "" && actual2 && actual2 !== "")
    })
  }

  // Filter logic for Issue Note tab
  // Pending: Planned3 set, Actual3 null
  // History: both Planned3 and Actual3 set
  const getIssuePending = () => {
    return returnEntries.filter(entry => {
      const planned3 = entry["Planned3"]
      const actual3 = entry["Actual3"]
      return (planned3 && planned3 !== "" && (!actual3 || actual3 === ""))
    })
  }

  const getIssueHistory = () => {
    return returnEntries.filter(entry => {
      const planned3 = entry["Planned3"]
      const actual3 = entry["Actual3"]
      return (planned3 && planned3 !== "" && actual3 && actual3 !== "")
    })
  }

  // Filter logic for CRM tab
  // Pending: Planned4 set, Actual4 null
  // History: both Planned4 and Actual4 set
  const getCrmPending = () => {
    return returnEntries.filter(entry => {
      const planned4 = entry["Planned4"]
      const actual4 = entry["Actual4"]
      return (planned4 && planned4 !== "" && (!actual4 || actual4 === ""))
    })
  }

  const getCrmHistory = () => {
    return returnEntries.filter(entry => {
      const planned4 = entry["Planned4"]
      const actual4 = entry["Actual4"]
      return (planned4 && planned4 !== "" && actual4 && actual4 !== "")
    })
  }

  // Filter logic for Management Approval tab
  // Pending: submitted (Time Stamp set), not yet approved (Actual5 null)
  // History: approved (Actual5 set)
  const getManagementPending = () => {
    return returnEntries.filter(entry => {
      const ts = entry["Time Stamp"]
      const actual5 = entry["Actual5"]
      return (ts && ts !== "" && (!actual5 || actual5 === ""))
    })
  }

  const getManagementHistory = () => {
    return returnEntries.filter(entry => {
      const actual5 = entry["Actual5"]
      return (actual5 && actual5 !== "")
    })
  }

  const handleCrmAction = (entry) => {
    setSelectedCrmEntry(entry)
    setCrmFormData({ emailScreenshot: null })
  }

  const handleCrmSubmit = async (e) => {
    e.preventDefault()
    if (!crmFormData.emailScreenshot) {
      toast({ title: "Required", description: "Please upload the email sent screenshot.", variant: "destructive" })
      return
    }
    try {
      setSubmitting(true)
      const actual4Time = getISTTimestamp()
      const timestamp = Date.now()
      const path = `material_return/${selectedCrmEntry.id}_crm_email_${timestamp}`
      const screenshotUrl = await uploadFile(crmFormData.emailScreenshot, path)

      const payload = {
        "Photo Of Email Sent": screenshotUrl,
        "Actual4": actual4Time,
      }

      const { error } = await supabase
        .from('Material Return')
        .update(payload)
        .eq('id', selectedCrmEntry.id)

      if (error) throw error

      toast({ title: "Success", description: "CRM marked as done!" })
      setSelectedCrmEntry(null)
      fetchData()
    } catch (error) {
      console.error("CRM submit error:", error)
      toast({ title: "Error", description: `Failed. ${error.message}`, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleManagementAction = (entry) => {
    setSelectedManagementEntry(entry)
    setManagementRemarks(entry["Management Remarks"] || "")
  }

  const handleManagementSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const actual5Time = getISTTimestamp()

      const payload = {
        "Actual5": actual5Time,
        "Management Remarks": managementRemarks.trim(),
      }

      const { error } = await supabase
        .from('Material Return')
        .update(payload)
        .eq('id', selectedManagementEntry.id)

      if (error) throw error

      toast({ title: "Success", description: "Management Approved successfully!" })
      setSelectedManagementEntry(null)
      setManagementRemarks("")
      fetchData()
    } catch (error) {
      console.error("Management approval error:", error)
      toast({ title: "Error", description: `Failed. ${error.message}`, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const searchFiltered = (list) => {
    if (!searchTerm.trim()) return list
    return list.filter(entry =>
      Object.values(entry).some(val =>
        val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const renderReturnFromPartyTab = () => (
    <Card className="border-blue-100 shadow-md w-full">
      <CardHeader className="bg-blue-50 border-b">
        <CardTitle className="text-blue-800 flex items-center gap-2">
          <RotateCcw className="w-5 h-5" />
          Material Return From Party Form
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">

        {/* Step 1 — Invoice Lookup */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">
            Invoice / Bill Number <span className="text-red-500">*</span>
          </Label>
          <p className="text-xs text-gray-500">Enter the invoice number from Invoice → Make Invoice to auto-populate party and product details.</p>
          <div className="flex gap-2">
            <Input
              value={invoiceLookupNo}
              onChange={(e) => setInvoiceLookupNo(e.target.value)}
              placeholder="e.g. INV-2024-001"
              className="h-10 flex-1"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleInvoiceLookup())}
            />
            <Button
              type="button"
              onClick={handleInvoiceLookup}
              disabled={invoiceLookupLoading || !invoiceLookupNo.trim()}
              className="bg-blue-600 hover:bg-blue-700 h-10 px-5 shrink-0"
            >
              {invoiceLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-1">Lookup</span>
            </Button>
            {invoiceProducts.length > 0 && (
              <Button type="button" variant="outline" onClick={resetInvoiceForm} className="h-10 shrink-0">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Step 2 — Products table */}
        {invoiceProducts.length > 0 && (
          <form onSubmit={handleSubmitReturnForm} className="space-y-5">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-sm">
              <p className="font-semibold text-blue-800">Invoice: {invoiceLookupNo}</p>
              <p className="text-blue-600 text-xs mt-0.5">Party: {invoicePartyName || "—"} &nbsp;·&nbsp; {invoiceProducts.length} product{invoiceProducts.length > 1 ? "s" : ""} found</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Select products to return &amp; assign reason
                <span className="ml-2 text-xs font-normal text-gray-500">(remove products that are in good condition using the trash icon)</span>
              </p>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-100 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Product</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Total Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Already Returned</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Available</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Return Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Remaining</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">D.O Number</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 min-w-[200px]">Reason</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 min-w-[180px]">Debit Note <span className="text-red-500">*</span></th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 min-w-[180px]">Remarks</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {returnProductLines.map((line, i) => (
                      <tr key={line.dispatchId} className={line.removed ? "opacity-40 bg-gray-50" : "bg-white"}>
                        <td className="px-3 py-2 font-medium text-gray-800">{line.productName || "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{line.originalQty}</td>
                        <td className="px-3 py-2 text-right text-xs text-orange-600">{line.alreadyReturned > 0 ? line.alreadyReturned : "—"}</td>
                        <td className="px-3 py-2 text-right text-xs font-medium text-blue-700">{line.availableQty}</td>
                        <td className="px-3 py-2 text-right">
                          {!line.removed ? (
                            <Input
                              type="number"
                              min="0.01"
                              max={line.availableQty}
                              step="any"
                              value={line.returnQty}
                              onChange={(e) =>
                                setReturnProductLines((prev) => {
                                  const next = [...prev]
                                  next[i] = { ...next[i], returnQty: e.target.value }
                                  return next
                                })
                              }
                              placeholder="0"
                              className="h-8 text-xs w-24 text-right ml-auto"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          {!line.removed && line.returnQty !== "" ? (
                            (() => {
                              const remaining = line.availableQty - (parseFloat(line.returnQty) || 0)
                              return (
                                <span className={remaining < 0 ? "text-red-500 font-medium" : remaining === 0 ? "text-gray-400" : "text-green-600 font-medium"}>
                                  {remaining < 0 ? "Exceeds!" : remaining}
                                </span>
                              )
                            })()
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{line.doNumber || "—"}</td>
                        <td className="px-3 py-2">
                          {!line.removed ? (
                            <Select
                              value={line.reason}
                              onValueChange={(val) =>
                                setReturnProductLines((prev) => {
                                  const next = [...prev]
                                  next[i] = { ...next[i], reason: val }
                                  return next
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Damage Done">Damage Done</SelectItem>
                                <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                                <SelectItem value="Material Shortage">Material Shortage</SelectItem>
                                <SelectItem value="Wrong Product">Wrong Product</SelectItem>
                                <SelectItem value="Material Return">Material Return</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Good — removed</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!line.removed ? (
                            <div className="space-y-1">
                              <Input
                                type="file"
                                accept=".pdf,image/*"
                                className="h-8 text-xs"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null
                                  setReturnProductLines((prev) => {
                                    const next = [...prev]
                                    next[i] = { ...next[i], debitNoteFile: file }
                                    return next
                                  })
                                }}
                              />
                              {line.debitNoteFile && (
                                <p className="text-[10px] text-green-600 truncate max-w-[160px]">✓ {line.debitNoteFile.name}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!line.removed && (
                            <Input
                              type="text"
                              placeholder="Optional remarks..."
                              value={line.remarks}
                              onChange={(e) =>
                                setReturnProductLines((prev) => {
                                  const next = [...prev]
                                  next[i] = { ...next[i], remarks: e.target.value }
                                  return next
                                })
                              }
                              className="h-8 text-xs"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${line.removed ? "text-green-600 hover:text-green-700" : "text-red-500 hover:text-red-600"}`}
                            title={line.removed ? "Undo remove" : "Remove (good quality)"}
                            onClick={() =>
                              setReturnProductLines((prev) => {
                                const next = [...prev]
                                next[i] = { ...next[i], removed: !next[i].removed, reason: next[i].removed ? next[i].reason : "" }
                                return next
                              })
                            }
                          >
                            {line.removed ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {returnProductLines.every((l) => l.removed) && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-md text-xs text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  All products removed — nothing will be submitted.
                </div>
              )}

              {returnProductLines.filter((l) => !l.removed).length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {returnProductLines.filter((l) => !l.removed).length} product(s) will be submitted for management approval.
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <Button
                type="submit"
                disabled={submitting || returnProductLines.every((l) => l.removed)}
                className="w-full bg-blue-600 hover:bg-blue-700 h-10"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Submit Return for Management Approval
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )

  const renderArrangeLogisticTab = () => {
    const list = activeLogisticSubTab === "pending" ? getLogisticPending() : getLogisticHistory()
    const filteredList = searchFiltered(list)

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Return Entries</p>
                <div className="text-2xl font-bold text-blue-900">{returnEntries.length}</div>
              </div>
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                <RotateCcw className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-orange-600">Pending Logistic</p>
                <div className="text-2xl font-bold text-orange-900">{getLogisticPending().length}</div>
              </div>
              <div className="h-10 w-10 bg-orange-500 rounded-full flex items-center justify-center text-white">
                <Truck className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-green-600">Completed Logistic</p>
                <div className="text-2xl font-bold text-green-900">{getLogisticHistory().length}</div>
              </div>
              <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
            <button
              onClick={() => setActiveLogisticSubTab("pending")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeLogisticSubTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Pending ({getLogisticPending().length})
            </button>
            <button
              onClick={() => setActiveLogisticSubTab("history")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeLogisticSubTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              History ({getLogisticHistory().length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-gray-200">
              <Filter className="w-4 h-4 text-gray-500" />
            </Button>
            <Select defaultValue="all">
              <SelectTrigger className="w-[100px] h-9 shrink-0 border-gray-200 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 border-b">
              <TableRow>
                {activeLogisticSubTab === "pending" && <TableHead className="w-[100px]">Action</TableHead>}
                <TableHead>Return No.</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="w-[60px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeLogisticSubTab === "pending" ? 6 : 5} className="text-center py-10 text-gray-500">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow className="hover:bg-gray-50/50">
                      {activeLogisticSubTab === "pending" && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleLogisticAction(entry)}
                            className="bg-orange-500 hover:bg-orange-600 h-8 text-xs text-white"
                          >
                            Handle
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-blue-600">{entry["Return No."]}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{entry["Party Name"]}</TableCell>
                      <TableCell>{entry["Product Name"]}</TableCell>
                      <TableCell className="font-bold">{entry["Qty"]}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRowExpansion(entry.id)}
                        >
                          {expandedRows[entry.id]
                            ? <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={activeLogisticSubTab === "pending" ? 6 : 5} className="p-0 bg-gray-50/40">
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm border-t">
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Return No.</p>
                              <p className="font-semibold text-blue-600">{entry["Return No."]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">D.O Number</p>
                              <p className="font-medium">{entry["D.O Number"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Party Name</p>
                              <p className="font-medium">{entry["Party Name"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Product</p>
                              <p className="font-medium">{entry["Product Name"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Qty</p>
                              <p className="font-medium">{entry["Qty"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Transport Payment</p>
                              <p className="font-medium">{entry["Tranport Payment"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Bilty No.</p>
                              <p className="font-medium">{entry["Bilty No."] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Reason Of Return</p>
                              <p className="font-medium">{entry["Reason Of Material Return"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Debit Note Type</p>
                              <p className="font-medium text-orange-600 font-semibold">{entry["Debit Note"] || "—"}</p>
                            </div>
                            {entry["Transporter Name"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Transporter Name</p>
                                <p className="font-medium">{entry["Transporter Name"]}</p>
                              </div>
                            )}
                            {entry["Vehicle No."] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Vehicle No.</p>
                                <p className="font-medium">{entry["Vehicle No."]}</p>
                              </div>
                            )}
                            {entry["Type Of Rate"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Type Of Rate</p>
                                <p className="font-medium">{entry["Type Of Rate"]}</p>
                              </div>
                            )}
                            {entry["Rate"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Rate</p>
                                <p className="font-semibold text-green-700">₹{entry["Rate"]}</p>
                              </div>
                            )}
                            {entry["Debit Note Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Debit Note Copy</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Debit Note Copy"])}>
                                  View <Eye className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            )}
                            {entry["Bill Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Bill Copy</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Bill Copy"])}>
                                  View <Eye className="w-3 h-3 ml-1" />
                                </Button>
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
    )
  }

  const renderReceivedReturnTab = () => {
    const list = activeReceivedSubTab === "pending" ? getReceivedPending() : getReceivedHistory()
    const filteredList = searchFiltered(list)

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Return Entries</p>
                <div className="text-2xl font-bold text-blue-900">{returnEntries.length}</div>
              </div>
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                <RotateCcw className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-purple-600">Pending Received</p>
                <div className="text-2xl font-bold text-purple-900">{getReceivedPending().length}</div>
              </div>
              <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
                <ClipboardList className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-green-600">Completed Received</p>
                <div className="text-2xl font-bold text-green-900">{getReceivedHistory().length}</div>
              </div>
              <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
            <button
              onClick={() => setActiveReceivedSubTab("pending")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeReceivedSubTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Pending ({getReceivedPending().length})
            </button>
            <button
              onClick={() => setActiveReceivedSubTab("history")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeReceivedSubTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              History ({getReceivedHistory().length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-gray-200">
              <Filter className="w-4 h-4 text-gray-500" />
            </Button>
            <Select defaultValue="all">
              <SelectTrigger className="w-[100px] h-9 shrink-0 border-gray-200 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 border-b">
              <TableRow>
                {activeReceivedSubTab === "pending" && <TableHead className="w-[100px]">Action</TableHead>}
                <TableHead>Return No.</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="w-[60px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeReceivedSubTab === "pending" ? 6 : 5} className="text-center py-10 text-gray-500">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow className="hover:bg-gray-50/50">
                      {activeReceivedSubTab === "pending" && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleReceivedAction(entry)}
                            className="bg-purple-500 hover:bg-purple-600 h-8 text-xs text-white"
                          >
                            Receive
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-blue-600">{entry["Return No."]}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{entry["Party Name"]}</TableCell>
                      <TableCell>{entry["Product Name"]}</TableCell>
                      <TableCell className="font-bold">{entry["Qty"]}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRowExpansion(entry.id)}
                        >
                          {expandedRows[entry.id]
                            ? <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={activeReceivedSubTab === "pending" ? 6 : 5} className="p-0 bg-gray-50/40">
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm border-t">
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Return No.</p>
                              <p className="font-semibold text-blue-600">{entry["Return No."]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">D.O Number</p>
                              <p className="font-medium">{entry["D.O Number"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Party Name</p>
                              <p className="font-medium">{entry["Party Name"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Product</p>
                              <p className="font-medium">{entry["Product Name"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Qty</p>
                              <p className="font-medium">{entry["Qty"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Transport Payment</p>
                              <p className="font-medium">{entry["Tranport Payment"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Bilty No.</p>
                              <p className="font-medium">{entry["Bilty No."] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Reason Of Return</p>
                              <p className="font-medium">{entry["Reason Of Material Return"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Debit Note Type</p>
                              <p className="font-medium text-orange-600 font-semibold">{entry["Debit Note"] || "—"}</p>
                            </div>
                            {entry["Transporter Name"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Transporter Name</p>
                                <p className="font-medium">{entry["Transporter Name"]}</p>
                              </div>
                            )}
                            {entry["Vehicle No."] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Vehicle No.</p>
                                <p className="font-medium">{entry["Vehicle No."]}</p>
                              </div>
                            )}
                            {entry["Type Of Rate"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Type Of Rate</p>
                                <p className="font-medium">{entry["Type Of Rate"]}</p>
                              </div>
                            )}
                            {entry["Rate"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Rate (Logistics)</p>
                                <p className="font-semibold">₹{entry["Rate"]}</p>
                              </div>
                            )}
                            {entry["Debit Note Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Debit Note Copy</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Debit Note Copy"])}>
                                  View <Eye className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            )}
                            {entry["Bill Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Bill Copy</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Bill Copy"])}>
                                  View <Eye className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            )}
                            {entry["Qty Of Return Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Return Qty</p>
                                <p className="font-medium">{entry["Qty Of Return Material"]}</p>
                              </div>
                            )}
                            {entry["Rate Of Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Rate Of Material</p>
                                <p className="font-semibold text-green-700">₹{entry["Rate Of Material"]}</p>
                              </div>
                            )}
                            {entry["Condition of Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Condition</p>
                                <Badge variant="outline" className={entry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                                  {entry["Condition of Material"]}
                                </Badge>
                              </div>
                            )}
                            {entry["Photo Of Return Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Photo Of Return Material</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Photo Of Return Material"])}>
                                  View Photo <Eye className="w-3 h-3 ml-1" />
                                </Button>
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
    )
  }

  const renderIssueNoteTab = () => {
    const list = activeIssueSubTab === "pending" ? getIssuePending() : getIssueHistory()
    const filteredList = searchFiltered(list)

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Return Entries</p>
                <div className="text-2xl font-bold text-blue-900">{returnEntries.length}</div>
              </div>
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                <RotateCcw className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-green-600">Pending Issue Note</p>
                <div className="text-2xl font-bold text-green-900">{getIssuePending().length}</div>
              </div>
              <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                <FileText className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-indigo-50 border-indigo-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-indigo-600">Completed Issue Note</p>
                <div className="text-2xl font-bold text-indigo-900">{getIssueHistory().length}</div>
              </div>
              <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
            <button
              onClick={() => setActiveIssueSubTab("pending")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeIssueSubTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Pending ({getIssuePending().length})
            </button>
            <button
              onClick={() => setActiveIssueSubTab("history")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeIssueSubTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              History ({getIssueHistory().length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-gray-200">
              <Filter className="w-4 h-4 text-gray-500" />
            </Button>
            <Select defaultValue="all">
              <SelectTrigger className="w-[100px] h-9 shrink-0 border-gray-200 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 border-b">
              <TableRow>
                {activeIssueSubTab === "pending" && <TableHead className="w-[110px]">Action</TableHead>}
                <TableHead>Return No.</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-[60px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeIssueSubTab === "pending" ? 5 : 4} className="text-center py-10 text-gray-500">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow className="hover:bg-gray-50/50">
                      {activeIssueSubTab === "pending" && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleIssueAction(entry)}
                            className="bg-green-600 hover:bg-green-700 h-8 text-xs text-white"
                          >
                            Issue Note
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-blue-600">{entry["Return No."]}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{entry["Party Name"]}</TableCell>
                      <TableCell>{entry["Product Name"]}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRowExpansion(entry.id)}
                        >
                          {expandedRows[entry.id]
                            ? <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={activeIssueSubTab === "pending" ? 5 : 4} className="p-0 bg-gray-50/40">
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm border-t">
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Return No.</p>
                              <p className="font-semibold text-blue-600">{entry["Return No."]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">D.O Number</p>
                              <p className="font-medium">{entry["D.O Number"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Party Name</p>
                              <p className="font-medium">{entry["Party Name"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Product</p>
                              <p className="font-medium">{entry["Product Name"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Qty</p>
                              <p className="font-medium">{entry["Qty"]}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Transport Payment</p>
                              <p className="font-medium">{entry["Tranport Payment"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Bilty No.</p>
                              <p className="font-medium">{entry["Bilty No."] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Reason Of Return</p>
                              <p className="font-medium">{entry["Reason Of Material Return"] || "—"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-0.5">Debit Note Type</p>
                              <p className="font-medium text-orange-600 font-semibold">{entry["Debit Note"] || "—"}</p>
                            </div>
                            {/* ── Step 2: Arrange Logistic ── */}
                            {entry["Transporter Name"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Transporter Name</p>
                                <p className="font-medium">{entry["Transporter Name"]}</p>
                              </div>
                            )}
                            {entry["Vehicle No."] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Vehicle No.</p>
                                <p className="font-medium">{entry["Vehicle No."]}</p>
                              </div>
                            )}
                            {entry["Type Of Rate"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Type Of Rate</p>
                                <p className="font-medium">{entry["Type Of Rate"]}</p>
                              </div>
                            )}
                            {entry["Rate"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Rate (Logistics)</p>
                                <p className="font-semibold">₹{entry["Rate"]}</p>
                              </div>
                            )}
                            {entry["Debit Note Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Debit Note Copy</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Debit Note Copy"])}>
                                  View <Eye className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            )}
                            {entry["Bill Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Bill Copy</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Bill Copy"])}>
                                  View <Eye className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            )}
                            {/* ── Step 3: Received Return Material ── */}
                            {entry["Qty Of Return Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Return Qty</p>
                                <p className="font-medium">{entry["Qty Of Return Material"]}</p>
                              </div>
                            )}
                            {entry["Rate Of Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Rate Of Material</p>
                                <p className="font-semibold text-green-700">₹{entry["Rate Of Material"]}</p>
                              </div>
                            )}
                            {entry["Condition of Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Condition</p>
                                <Badge variant="outline" className={entry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                                  {entry["Condition of Material"]}
                                </Badge>
                              </div>
                            )}
                            {entry["Photo Of Return Material"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Photo Of Return Material</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Photo Of Return Material"])}>
                                  View Photo <Eye className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            )}
                            {/* ── Step 4: Issue Note ── */}
                            {entry["Credit Note No."] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Credit Note No.</p>
                                <p className="font-medium">{entry["Credit Note No."]}</p>
                              </div>
                            )}
                            {entry["Amount"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Amount</p>
                                <p className="font-semibold text-green-700">₹{entry["Amount"]}</p>
                              </div>
                            )}
                            {entry["Credit Note Copy"] && (
                              <div>
                                <p className="text-gray-500 text-xs mb-0.5">Credit Note Copy</p>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-blue-600 font-semibold"
                                  onClick={() => handleViewPhoto(entry["Credit Note Copy"])}
                                >
                                  View Copy <Eye className="w-3 h-3 ml-1" />
                                </Button>
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
    )
  }

  const renderManagementApprovalTab = () => {
    const list = activeManagementSubTab === "pending" ? getManagementPending() : getManagementHistory()
    const filteredList = searchFiltered(list)

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Return Entries</p>
                <div className="text-2xl font-bold text-blue-900">{returnEntries.length}</div>
              </div>
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                <RotateCcw className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-amber-600">Pending Approval</p>
                <div className="text-2xl font-bold text-amber-900">{getManagementPending().length}</div>
              </div>
              <div className="h-10 w-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-green-600">Completed Approval</p>
                <div className="text-2xl font-bold text-green-900">{getManagementHistory().length}</div>
              </div>
              <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
            <button
              onClick={() => setActiveManagementSubTab("pending")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeManagementSubTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Pending ({getManagementPending().length})
            </button>
            <button
              onClick={() => setActiveManagementSubTab("history")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeManagementSubTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              History ({getManagementHistory().length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-gray-200">
              <Filter className="w-4 h-4 text-gray-500" />
            </Button>
          </div>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 border-b">
              <TableRow>
                {activeManagementSubTab === "pending" && <TableHead className="w-[120px]">Action</TableHead>}
                <TableHead>Return No.</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="w-[60px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeManagementSubTab === "pending" ? 6 : 5} className="text-center py-10 text-gray-500">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow className="hover:bg-gray-50/50">
                      {activeManagementSubTab === "pending" && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleManagementAction(entry)}
                            className="bg-amber-600 hover:bg-amber-700 h-8 text-xs text-white"
                          >
                            Approve
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-blue-600">{entry["Return No."]}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{entry["Party Name"]}</TableCell>
                      <TableCell>{entry["Product Name"]}</TableCell>
                      <TableCell className="font-bold">{entry["Qty"]}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRowExpansion(entry.id)}
                        >
                          {expandedRows[entry.id]
                            ? <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={activeManagementSubTab === "pending" ? 6 : 5} className="p-0 bg-gray-50/40">
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm border-t">
                            {/* Step 1 — Basic Return */}
                            {entry["Invoice Number"] && <div className="col-span-2"><p className="text-gray-500 text-xs mb-0.5">Invoice Number</p><p className="font-semibold text-blue-700">{entry["Invoice Number"]}</p></div>}
                            <div><p className="text-gray-500 text-xs mb-0.5">Return No.</p><p className="font-semibold text-blue-600">{entry["Return No."]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">D.O Number</p><p className="font-medium">{entry["D.O Number"] || "—"}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Party Name</p><p className="font-medium">{entry["Party Name"]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Product</p><p className="font-medium">{entry["Product Name"]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Qty</p><p className="font-medium">{entry["Qty"]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Reason Of Return</p><p className="font-medium text-orange-600">{entry["Reason Of Material Return"] || "—"}</p></div>
                            {entry["Tranport Payment"] && <div><p className="text-gray-500 text-xs mb-0.5">Transport Payment</p><p className="font-medium">{entry["Tranport Payment"]}</p></div>}
                            {entry["Bilty No."] && <div><p className="text-gray-500 text-xs mb-0.5">Bilty No.</p><p className="font-medium">{entry["Bilty No."]}</p></div>}
                            {entry["Debit Note"] && <div><p className="text-gray-500 text-xs mb-0.5">Debit Note Type</p><p className="font-medium text-orange-600 font-semibold">{entry["Debit Note"]}</p></div>}
                            {/* Step 2 — Arrange Logistic */}
                            {entry["Transporter Name"] && <div><p className="text-gray-500 text-xs mb-0.5">Transporter Name</p><p className="font-medium">{entry["Transporter Name"]}</p></div>}
                            {entry["Vehicle No."] && <div><p className="text-gray-500 text-xs mb-0.5">Vehicle No.</p><p className="font-medium">{entry["Vehicle No."]}</p></div>}
                            {entry["Type Of Rate"] && <div><p className="text-gray-500 text-xs mb-0.5">Type Of Rate</p><p className="font-medium">{entry["Type Of Rate"]}</p></div>}
                            {entry["Rate"] && <div><p className="text-gray-500 text-xs mb-0.5">Rate (Logistics)</p><p className="font-semibold">₹{entry["Rate"]}</p></div>}
                            {entry["Debit Note Copy"] && <div><p className="text-gray-500 text-xs mb-0.5">Debit Note Copy</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Debit Note Copy"])}>View <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {entry["Bill Copy"] && <div><p className="text-gray-500 text-xs mb-0.5">Bill Copy</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Bill Copy"])}>View <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {/* Step 3 — Received Return */}
                            {entry["Qty Of Return Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Return Qty</p><p className="font-medium">{entry["Qty Of Return Material"]}</p></div>}
                            {entry["Rate Of Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Rate Of Material</p><p className="font-semibold text-green-700">₹{entry["Rate Of Material"]}</p></div>}
                            {entry["Condition of Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Condition</p><Badge variant="outline" className={entry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>{entry["Condition of Material"]}</Badge></div>}
                            {entry["Photo Of Return Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Photo Of Return Material</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Photo Of Return Material"])}>View Photo <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {/* Step 4 — Issue Note */}
                            {entry["Credit Note No."] && <div><p className="text-gray-500 text-xs mb-0.5">Credit Note No.</p><p className="font-medium">{entry["Credit Note No."]}</p></div>}
                            {entry["Amount"] && <div><p className="text-gray-500 text-xs mb-0.5">Amount</p><p className="font-semibold text-green-700">₹{entry["Amount"]}</p></div>}
                            {entry["Credit Note Copy"] && <div><p className="text-gray-500 text-xs mb-0.5">Credit Note Copy</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Credit Note Copy"])}>View Copy <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {/* Step 5 — CRM */}
                            {entry["Photo Of Email Sent"] && <div><p className="text-gray-500 text-xs mb-0.5">Email Sent Screenshot</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Photo Of Email Sent"])}>View Screenshot <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {/* Management Approval */}
                            {entry["Actual5"] && <div><p className="text-gray-500 text-xs mb-0.5">Management Approval</p><Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Approved</Badge></div>}
                            {entry["Management Remarks"] && <div className="col-span-2"><p className="text-gray-500 text-xs mb-0.5">Management Remarks</p><p className="font-medium text-amber-700">{entry["Management Remarks"]}</p></div>}
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
    )
  }

  const renderCrmTab = () => {
    const list = activeCrmSubTab === "pending" ? getCrmPending() : getCrmHistory()
    const filteredList = searchFiltered(list)

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Return Entries</p>
                <div className="text-2xl font-bold text-blue-900">{returnEntries.length}</div>
              </div>
              <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                <RotateCcw className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-indigo-50 border-indigo-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-indigo-600">Pending CRM</p>
                <div className="text-2xl font-bold text-indigo-900">{getCrmPending().length}</div>
              </div>
              <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                <Send className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-teal-50 border-teal-100 shadow-sm">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-teal-600">Completed CRM</p>
                <div className="text-2xl font-bold text-teal-900">{getCrmHistory().length}</div>
              </div>
              <div className="h-10 w-10 bg-teal-500 rounded-full flex items-center justify-center text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
            <button
              onClick={() => setActiveCrmSubTab("pending")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeCrmSubTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Pending ({getCrmPending().length})
            </button>
            <button
              onClick={() => setActiveCrmSubTab("history")}
              className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all ${activeCrmSubTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              History ({getCrmHistory().length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-gray-200">
              <Filter className="w-4 h-4 text-gray-500" />
            </Button>
            <Select defaultValue="all">
              <SelectTrigger className="w-[100px] h-9 shrink-0 border-gray-200 text-sm">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 border-b">
              <TableRow>
                {activeCrmSubTab === "pending" && <TableHead className="w-[120px]">Action</TableHead>}
                <TableHead>Return No.</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="w-[60px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeCrmSubTab === "pending" ? 6 : 5} className="text-center py-10 text-gray-500">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow className="hover:bg-gray-50/50">
                      {activeCrmSubTab === "pending" && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleCrmAction(entry)}
                            className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs text-white"
                          >
                            Mark Done
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-blue-600">{entry["Return No."]}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{entry["Party Name"]}</TableCell>
                      <TableCell>{entry["Product Name"]}</TableCell>
                      <TableCell className="font-bold">{entry["Qty"]}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRowExpansion(entry.id)}
                        >
                          {expandedRows[entry.id]
                            ? <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows[entry.id] && (
                      <TableRow>
                        <TableCell colSpan={activeCrmSubTab === "pending" ? 6 : 5} className="p-0 bg-gray-50/40">
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm border-t">
                            {/* Step 1 — Basic Return */}
                            <div><p className="text-gray-500 text-xs mb-0.5">Return No.</p><p className="font-semibold text-blue-600">{entry["Return No."]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">D.O Number</p><p className="font-medium">{entry["D.O Number"] || "—"}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Party Name</p><p className="font-medium">{entry["Party Name"]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Product</p><p className="font-medium">{entry["Product Name"]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Qty</p><p className="font-medium">{entry["Qty"]}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Transport Payment</p><p className="font-medium">{entry["Tranport Payment"] || "—"}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Bilty No.</p><p className="font-medium">{entry["Bilty No."] || "—"}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Reason Of Return</p><p className="font-medium">{entry["Reason Of Material Return"] || "—"}</p></div>
                            <div><p className="text-gray-500 text-xs mb-0.5">Debit Note Type</p><p className="font-medium text-orange-600 font-semibold">{entry["Debit Note"] || "—"}</p></div>
                            {/* Step 2 — Arrange Logistic */}
                            {entry["Transporter Name"] && <div><p className="text-gray-500 text-xs mb-0.5">Transporter Name</p><p className="font-medium">{entry["Transporter Name"]}</p></div>}
                            {entry["Vehicle No."] && <div><p className="text-gray-500 text-xs mb-0.5">Vehicle No.</p><p className="font-medium">{entry["Vehicle No."]}</p></div>}
                            {entry["Type Of Rate"] && <div><p className="text-gray-500 text-xs mb-0.5">Type Of Rate</p><p className="font-medium">{entry["Type Of Rate"]}</p></div>}
                            {entry["Rate"] && <div><p className="text-gray-500 text-xs mb-0.5">Rate (Logistics)</p><p className="font-semibold">₹{entry["Rate"]}</p></div>}
                            {entry["Debit Note Copy"] && <div><p className="text-gray-500 text-xs mb-0.5">Debit Note Copy</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Debit Note Copy"])}>View <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {entry["Bill Copy"] && <div><p className="text-gray-500 text-xs mb-0.5">Bill Copy</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Bill Copy"])}>View <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {/* Step 3 — Received Return */}
                            {entry["Qty Of Return Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Return Qty</p><p className="font-medium">{entry["Qty Of Return Material"]}</p></div>}
                            {entry["Rate Of Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Rate Of Material</p><p className="font-semibold text-green-700">₹{entry["Rate Of Material"]}</p></div>}
                            {entry["Condition of Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Condition</p><Badge variant="outline" className={entry["Condition of Material"] === "Good" ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>{entry["Condition of Material"]}</Badge></div>}
                            {entry["Photo Of Return Material"] && <div><p className="text-gray-500 text-xs mb-0.5">Photo Of Return Material</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Photo Of Return Material"])}>View Photo <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {/* Step 4 — Issue Note */}
                            {entry["Credit Note No."] && <div><p className="text-gray-500 text-xs mb-0.5">Credit Note No.</p><p className="font-medium">{entry["Credit Note No."]}</p></div>}
                            {entry["Amount"] && <div><p className="text-gray-500 text-xs mb-0.5">Amount</p><p className="font-semibold text-green-700">₹{entry["Amount"]}</p></div>}
                            {entry["Credit Note Copy"] && <div><p className="text-gray-500 text-xs mb-0.5">Credit Note Copy</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Credit Note Copy"])}>View Copy <Eye className="w-3 h-3 ml-1" /></Button></div>}
                            {/* Step 5 — CRM */}
                            {entry["Photo Of Email Sent"] && <div><p className="text-gray-500 text-xs mb-0.5">Email Sent Screenshot</p><Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-semibold" onClick={() => handleViewPhoto(entry["Photo Of Email Sent"])}>View Screenshot <Eye className="w-3 h-3 ml-1" /></Button></div>}
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
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Material Return</h1>
          <p className="text-gray-600">Track and manage returned materials from parties</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        <button
          onClick={() => setActiveTab("return_from_party")}
          className={`pb-3 px-4 text-sm font-medium transition-all relative ${activeTab === "return_from_party" ? "text-blue-600 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          Material Return From Party
        </button>

      </div>

      <div className="mt-6">
        {renderReturnFromPartyTab()}
      </div>

      {/* Logistic Modal */}
      {selectedLogisticEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50">
              <div>
                <CardTitle className="text-xl text-gray-800">Arrange Logistic</CardTitle>
                <p className="text-sm text-gray-500">Return No: {selectedLogisticEntry["Return No."]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedLogisticEntry(null)}
                className="rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <form onSubmit={handleLogisticSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Transporter Name</Label>
                    <Select
                      value={logisticFormData.transporterName}
                      onValueChange={(val) => setLogisticFormData(prev => ({ ...prev, transporterName: val }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Transporter" />
                      </SelectTrigger>
                      <SelectContent>
                        {transporterList.map((t, idx) => (
                          <SelectItem key={idx} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle No.</Label>
                    <Input
                      value={logisticFormData.vehicleNo}
                      onChange={(e) => setLogisticFormData(prev => ({ ...prev, vehicleNo: e.target.value }))}
                      placeholder="Enter Vehicle No."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type of Rate</Label>
                    <Select
                      value={logisticFormData.typeOfRate}
                      onValueChange={(val) => setLogisticFormData(prev => ({ ...prev, typeOfRate: val }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Rate Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Per MT">Per MT</SelectItem>
                        <SelectItem value="Fixed">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rate</Label>
                    <Input
                      type="number"
                      value={logisticFormData.rate}
                      onChange={(e) => setLogisticFormData(prev => ({ ...prev, rate: e.target.value }))}
                      placeholder="Enter Rate"
                      required
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-md text-xs text-blue-700 space-y-1 mt-4">
                  <p><strong>Party:</strong> {selectedLogisticEntry["Party Name"]}</p>
                  <p><strong>Product:</strong> {selectedLogisticEntry["Product Name"]} ({selectedLogisticEntry["Qty"]})</p>
                  <p><strong>Reason:</strong> {selectedLogisticEntry["Reason Of Material Return"]}</p>
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex justify-end gap-3 border-t bg-gray-50 rounded-b-lg">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedLogisticEntry(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 min-w-[100px]"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Details"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Received Modal */}
      {selectedReceivedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50">
              <div>
                <CardTitle className="text-xl text-gray-800">Receive Return Material</CardTitle>
                <p className="text-sm text-gray-500">Return No: {selectedReceivedEntry["Return No."]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedReceivedEntry(null)}
                className="rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <form onSubmit={handleReceivedSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Qty Of Return Material</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={receivedFormData.qtyOfReturnMaterial}
                      onChange={(e) => setReceivedFormData(prev => ({ ...prev, qtyOfReturnMaterial: e.target.value }))}
                      placeholder="Enter Qty"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate Of Material</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={receivedFormData.rateOfMaterial}
                      onChange={(e) => setReceivedFormData(prev => ({ ...prev, rateOfMaterial: e.target.value }))}
                      placeholder="Enter Rate"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition of Material</Label>
                    <Select
                      value={receivedFormData.conditionOfMaterial}
                      onValueChange={(val) => setReceivedFormData(prev => ({ ...prev, conditionOfMaterial: val }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Bad">Bad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Photo Of Return Material</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setReceivedFormData(prev => ({ ...prev, photoOfReturnMaterial: e.target.files[0] }))}
                        className="text-xs"
                        required={!selectedReceivedEntry["Photo Of Return Material"]}
                      />
                      <Camera className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-3 rounded-md text-xs text-purple-700 space-y-1 mt-4">
                  <p><strong>Party:</strong> {selectedReceivedEntry["Party Name"]}</p>
                  <p><strong>Logistic:</strong> {selectedReceivedEntry["Transporter Name (Lift)"]} ({selectedReceivedEntry["Vehicle No. (Lift)"]})</p>
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex justify-end gap-3 border-t bg-gray-50 rounded-b-lg">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedReceivedEntry(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700 min-w-[100px] text-white"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Receive Material"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Issue Note Modal */}
      {selectedIssueEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50">
              <div>
                <CardTitle className="text-xl text-gray-800">Submit Issue Note</CardTitle>
                <p className="text-sm text-gray-500">Return No: {selectedIssueEntry["Return No."]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedIssueEntry(null)}
                className="rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <form onSubmit={handleIssueSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Credit Note No.</Label>
                    <Input
                      value={issueFormData.creditNoteNo}
                      onChange={(e) => setIssueFormData(prev => ({ ...prev, creditNoteNo: e.target.value }))}
                      placeholder="Enter Note No."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Credit Note Copy</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setIssueFormData(prev => ({ ...prev, creditNoteFile: e.target.files[0] }))}
                      className="text-xs"
                      required={!selectedIssueEntry["Credit Note Copy"]}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={issueFormData.amount}
                      onChange={(e) => setIssueFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Enter Amount"
                      required
                    />
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-md text-xs text-green-700 space-y-1 mt-4">
                  <p><strong>Party:</strong> {selectedIssueEntry["Party Name"]}</p>
                  <p><strong>Condition:</strong> {selectedIssueEntry["Condition of Material"]}</p>
                  <p><strong>Product:</strong> {selectedIssueEntry["Product Name"]}</p>
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex justify-end gap-3 border-t bg-gray-50 rounded-b-lg">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedIssueEntry(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 min-w-[100px] text-white"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Note"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CRM Modal */}
      {selectedCrmEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50">
              <div>
                <CardTitle className="text-xl text-gray-800">CRM — Mark Done</CardTitle>
                <p className="text-sm text-gray-500">Return No: {selectedCrmEntry["Return No."]} · {selectedCrmEntry["Party Name"]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedCrmEntry(null)}
                className="rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <form onSubmit={handleCrmSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Screenshot of Email Sent <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-gray-500">Upload the screenshot as proof that the email was sent to the party.</p>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setCrmFormData(prev => ({ ...prev, emailScreenshot: e.target.files[0] }))}
                    className="text-xs"
                    required
                  />
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex justify-end gap-3 border-t bg-gray-50 rounded-b-lg">
                <Button type="button" variant="outline" onClick={() => setSelectedCrmEntry(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 min-w-[100px] text-white"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark Done"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Management Approval Modal */}
      {selectedManagementEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50">
              <div>
                <CardTitle className="text-xl text-gray-800">Management Approval</CardTitle>
                <p className="text-sm text-gray-500">Return No: {selectedManagementEntry["Return No."]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelectedManagementEntry(null); setManagementRemarks("") }}
                className="rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <form onSubmit={handleManagementSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    {selectedManagementEntry["Invoice Number"] && (
                      <div className="col-span-2">
                        <p className="text-gray-500 text-xs">Invoice Number</p>
                        <p className="font-semibold text-blue-700">{selectedManagementEntry["Invoice Number"]}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500 text-xs">Party Name</p>
                      <p className="font-semibold truncate">{selectedManagementEntry["Party Name"]}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Product</p>
                      <p className="font-semibold truncate">{selectedManagementEntry["Product Name"]}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Quantity</p>
                      <p className="font-semibold">{selectedManagementEntry["Qty"]}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Return No.</p>
                      <p className="font-semibold text-blue-600">{selectedManagementEntry["Return No."]}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500 text-xs">Reason Of Return</p>
                      <p className="font-semibold text-orange-600">{selectedManagementEntry["Reason Of Material Return"] || "—"}</p>
                    </div>
                    {selectedManagementEntry["D.O Number"] && (
                      <div>
                        <p className="text-gray-500 text-xs">D.O Number</p>
                        <p className="font-medium">{selectedManagementEntry["D.O Number"]}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <p className="text-gray-500 text-xs mb-1">Debit Note</p>
                      {selectedManagementEntry["Debit Note Copy"] ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => handleViewPhoto(selectedManagementEntry["Debit Note Copy"])}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Debit Note
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Not uploaded</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Management Remarks</Label>
                  <Textarea
                    value={managementRemarks}
                    onChange={(e) => setManagementRemarks(e.target.value)}
                    placeholder="Enter approval remarks or notes..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex justify-end gap-3 border-t bg-gray-50 rounded-b-lg">
                <Button type="button" variant="outline" onClick={() => { setSelectedManagementEntry(null); setManagementRemarks("") }}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-amber-600 hover:bg-amber-700 min-w-[120px] text-white"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Approval"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
