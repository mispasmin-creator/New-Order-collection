"use client"

import { useState, useEffect } from "react"
import { getISTFullDisplayDateTime, getISTTimestamp } from "@/lib/dateUtils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Loader2, Eye, Upload, FileText, TrendingUp, Clock } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { getSignedUrl } from "@/lib/storageUtils"

export default function MaterialReceiptPage({ user }) {
  const [postDeliveryData, setPostDeliveryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    materialReceivedDate: "",
    imageOfReceivedBill: "",
    grnNumber: "",
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [file, setFile] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('POST DELIVERY')
        .select('*')

      if (error) throw error

      if (data) {
        setPostDeliveryData(data)
        console.log("POST DELIVERY data loaded:", data.length)
      }

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data from Supabase",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Filter POST DELIVERY data: Planned not null and Actual is null
  const getPendingEntries = () => {
    return postDeliveryData.filter(entry => {
      const planned = entry["Planned"] // Check exact column name match with DB
      const actual = entry["Actual"]

      return planned && (!actual || actual === "")
    })
  }

  const getHistoryEntries = () => {
    return postDeliveryData.filter(entry => {
      const planned = entry["Planned"]
      const actual = entry["Actual"]

      return planned && actual
    })
  }

  const pendingEntries = getPendingEntries()
  const historyEntries = getHistoryEntries()

  console.log("Pending entries count:", pendingEntries.length)
  console.log("History entries count:", historyEntries.length)

  // Apply search filter
  const searchFilteredEntries = (entriesList) => {
    if (!searchTerm.trim()) return entriesList

    return entriesList.filter((entry) =>
      Object.values(entry).some((value) =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const displayEntries = activeTab === "pending"
    ? searchFilteredEntries(pendingEntries)
    : searchFilteredEntries(historyEntries)

  const handleMaterialEntry = (entry) => {
    console.log("Selected entry:", entry)
    setSelectedEntry(entry)
    setFormData({
      materialReceivedDate: entry["Material Received Date"] || "",
      imageOfReceivedBill: entry["Image Of Received Bill / Audio"] || "",
      grnNumber: entry["Grn Number"] || "",
    })
    setFile(null)
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  const handleImageUpload = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "File size should be less than 5MB",
      })
      return
    }

    setFile(selectedFile)

    // Create preview URL for immediate feedback if image
    if (selectedFile.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(selectedFile)
      setFormData(prev => ({
        ...prev,
        previewUrl: objectUrl
      }))
    }
  }

  const handleSubmit = async () => {
    if (!selectedEntry) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No entry selected",
      })
      return
    }

    if (!formData.materialReceivedDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select Material Received Date",
      })
      return
    }

    if (!formData.grnNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter GRN Number",
      })
      return
    }

    try {
      setSubmitting(true)
      let imageUrl = formData.imageOfReceivedBill

      // Upload image if a new file is selected
      if (file) {
        try {
          setUploadingImage(true)
          const timestamp = Date.now()
          const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
          const filePath = `material_receipt/${selectedEntry.id}_${timestamp}_${safeFileName}`

          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath)

          imageUrl = publicUrl
        } catch (uploadError) {
          console.error("Image upload failed during submission:", uploadError)
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to upload image. Please try again.",
          })
          setSubmitting(false)
          setUploadingImage(false)
          return // Stop submission if upload fails
        }
        setUploadingImage(false)
      }

      const actualTime = getISTTimestamp()

      const updatePayload = {
        "Actual": actualTime,
        "Material Received Date": formData.materialReceivedDate,
        "Image Of Received Bill / Audio": imageUrl,
        "Grn Number": formData.grnNumber
      }

      const { error: updateError } = await supabase
        .from('POST DELIVERY')
        .update(updatePayload)
        .eq('id', selectedEntry.id)

      if (updateError) throw updateError

      await fetchData()

      // Trigger sidebar refresh
      window.dispatchEvent(new Event('refresh-sidebar-counts'))

      // Reset form and selection
      setSelectedEntry(null)
      setFormData({
        materialReceivedDate: "",
        imageOfReceivedBill: "",
        grnNumber: "",
        previewUrl: ""
      })
      setFile(null)

      toast({
        title: "Success",
        description: "Material receipt submitted successfully!",
      })

    } catch (error) {
      console.error("Error submitting material receipt:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit. Error: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSelectedEntry(null)
    setFormData({
      materialReceivedDate: "",
      imageOfReceivedBill: "",
      grnNumber: "",
    })
    setFile(null)
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString || dateString === "" || dateString === " ") return "N/A"

    try {
      // Handle different date formats
      const date = new Date(dateString)

      // Check if date is valid
      if (isNaN(date.getTime())) {
        // If not a valid date, try to parse dd/mm/yyyy format
        const parts = dateString.split('/')
        if (parts.length === 3) {
          const [day, month, year] = parts.map(part => parseInt(part, 10))
          const newDate = new Date(year, month - 1, day)
          if (!isNaN(newDate.getTime())) {
            return newDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          }
        }
        return dateString.toString()
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch (e) {
      console.error("Date formatting error:", e)
      return dateString ? dateString.toString() : "N/A"
    }
  }

  // Format datetime for display
  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === "" || dateTimeString === " ") return "N/A"

    try {
      const date = new Date(dateTimeString)

      if (isNaN(date.getTime())) {
        // Try to parse dd/mm/yyyy hh:mm:ss format
        const datePart = dateTimeString.split(' ')[0]
        const timePart = dateTimeString.split(' ')[1] || '00:00:00'
        const parts = datePart.split('/')

        if (parts.length === 3) {
          const [day, month, year] = parts.map(part => parseInt(part, 10))
          const [hours = 0, minutes = 0, seconds = 0] = timePart.split(':').map(part => parseInt(part, 10))
          const newDate = new Date(year, month - 1, day, hours, minutes, seconds)
          if (!isNaN(newDate.getTime())) {
            return newDate.toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          }
        }
        return dateTimeString.toString()
      }

      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return dateTimeString ? dateTimeString.toString() : "N/A"
    }
  }

  // Function to handle Google Drive URL - FIXED
  // Function to handle Google Drive URL - UPDATED to handle t=view&id= format
  const getDriveUrl = (driveLink) => {
    if (!driveLink || driveLink.trim() === "") return null;

    const link = driveLink.trim();

    console.log("Processing drive link:", link); // Debug log

    // Check if it's already a full URL
    if (link.startsWith('http://') || link.startsWith('https://')) {
      return link;
    }

    // NEW: Check for t=view&id= format (from your image)
    if (link.includes('t=view&id=')) {
      const match = link.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        console.log("Found t=view&id format, extracted ID:", match[1]); // Debug log
        return `https://drive.google.com/file/d/${match[1]}/view`;
      }
    }

    // Check if it contains a file ID pattern
    if (link.includes('/d/')) {
      const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        console.log("Found /d/ format, extracted ID:", match[1]); // Debug log
        return `https://drive.google.com/file/d/${match[1]}/view`;
      }
    }

    // Check if it's just a file ID
    if (link.match(/^[a-zA-Z0-9_-]{25,}$/)) {
      console.log("Found file ID format:", link); // Debug log
      return `https://drive.google.com/file/d/${link}/view`;
    }

    // If it's a partial URL
    if (link.startsWith('file/d/')) {
      const fileId = link.replace('file/d/', '').split('/')[0];
      console.log("Found file/d/ format, extracted ID:", fileId); // Debug log
      return `https://drive.google.com/file/d/${fileId}/view`;
    }

    console.log("No matching format found, returning as is:", link); // Debug log
    // Return as is (might be a direct link or another format)
    return link;
    return link;
  };

  const handleView = async (url) => {
    if (!url) return

    // First process potential Drive URL
    let target = getDriveUrl(url)

    // Then try to sign if it's a Supabase URL
    if (target && target.includes('supabase.co')) {
      const signed = await getSignedUrl(target)
      if (signed) target = signed
    }

    window.open(target, '_blank')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading material receipt data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Material Receipt</h1>
          <p className="text-gray-600">Manage material receipts for POST DELIVERY entries</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Pending</p>
              <div className="text-2xl font-bold text-blue-900">{pendingEntries.length}</div>
            </div>
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-blue-200 shadow-lg">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-600">Total Completed</p>
              <div className="text-2xl font-bold text-green-900">{historyEntries.length}</div>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-green-200 shadow-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Entries</p>
              <div className="text-2xl font-bold text-purple-900">{postDeliveryData.length}</div>
            </div>
            <div className="h-10 w-10 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-purple-200 shadow-lg">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by Order No, Party Name, Bill No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>

          <Button
            onClick={() => fetchData()}
            variant="outline"
            className="h-10 px-3"
            disabled={loading || submitting}
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Pending ({pendingEntries.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            History ({historyEntries.length})
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-md shadow-sm overflow-hidden mt-4">
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                {activeTab === "pending" && (
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Action</TableHead>
                )}
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Order No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Type of Bill</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Bill No</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Bill Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[150px]">Party Name</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Amount</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Planned</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Copy Of Bill</TableHead>
                {activeTab === "history" && (
                  <>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Actual</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">Received Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[120px]">GRN No.</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3 px-4 min-w-[100px]">Receipt</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayEntries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === "pending" ? 10 : 13}
                    className="text-center py-8 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg">No entries found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayEntries.map((entry, index) => {
                  const orderNo = entry["Order No."] || "N/A"
                  const billType = entry["Type of Bill"] || "N/A"
                  const billNo = entry["Bill No."] || "N/A"
                  const billDate = entry["Bill Date"]
                  const partyName = entry["Party Name"] || "N/A"
                  const amount = entry["Total Bill Amount"] || "0"
                  const planned = entry["Planned"]
                  const actual = entry["Actual"]
                  const copyOfBill = entry["Copy Of Bill"]
                  const receivedDate = entry["Material Received Date"]
                  const grnNumber = entry["Grn Number"]

                  // Get proper Drive URL
                  const driveUrl = getDriveUrl(copyOfBill);

                  return (
                    <TableRow key={`${orderNo}-${index}`} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                      {activeTab === "pending" && (
                        <TableCell className="py-2 px-4 min-w-[100px]">
                          <Button
                            size="sm"
                            onClick={() => handleMaterialEntry(entry)}
                            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                            disabled={submitting}
                          >
                            Receipt
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="py-2 px-4 min-w-[100px] text-sm font-medium text-blue-600">
                        {orderNo}
                      </TableCell>
                      <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                        <div className="truncate max-w-[120px]">{billType}</div>
                      </TableCell>
                      <TableCell className="py-2 px-4 min-w-[100px]">
                        <Badge className="bg-green-500 text-white rounded-sm text-xs">
                          {billNo}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 px-4 min-w-[120px] text-sm">{formatDate(billDate)}</TableCell>
                      <TableCell className="py-2 px-4 min-w-[150px] text-sm">
                        <div className="truncate max-w-[150px]">{partyName}</div>
                      </TableCell>
                      <TableCell className="py-2 px-4 min-w-[100px] font-medium text-sm">₹{amount}</TableCell>
                      <TableCell className="py-2 px-4 min-w-[120px] text-sm">
                        {formatDateTime(planned)}
                      </TableCell>
                      <TableCell className="py-2 px-4 min-w-[100px] text-sm">

                        {driveUrl ? (
                          <div
                            onClick={() => handleView(driveUrl)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>

                      {activeTab === "history" && (
                        <>
                          <TableCell className="py-2 px-4 min-w-[120px] text-sm">{formatDateTime(actual)}</TableCell>
                          <TableCell className="py-2 px-4 min-w-[120px] text-sm">{formatDate(receivedDate)}</TableCell>
                          <TableCell className="py-2 px-4 min-w-[120px] text-sm font-medium">{grnNumber || "N/A"}</TableCell>
                          <TableCell className="py-2 px-4 min-w-[100px] text-sm">
                            {entry["Image Of Received Bill / Audio"] ? (
                              <div
                                onClick={() => handleView(entry["Image Of Received Bill / Audio"])}
                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </div>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Material Receipt Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <div>
                <CardTitle className="text-lg lg:text-xl">Submit Material Receipt</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Order: {selectedEntry["Order No."] || "N/A"}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                {/* Entry Information */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 font-medium">Order No: </span>
                      <span className="font-medium text-gray-900">{selectedEntry["Order No."] || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Bill No: </span>
                      <span className="font-medium text-gray-900">{selectedEntry["Bill No."] || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Party Name: </span>
                      <span className="text-gray-900">{selectedEntry["Party Name"] || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Total Amount: </span>
                      <span className="font-medium text-gray-900">₹{selectedEntry["Total Bill Amount"] || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-900">{formatDateTime(selectedEntry["Planned"])}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Bill Date: </span>
                      <span className="text-gray-900">{formatDate(selectedEntry["Bill Date"])}</span>
                    </div>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">
                      Material Received Date *
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={formData.materialReceivedDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, materialReceivedDate: e.target.value }))}
                      className="h-10 mt-1"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Image Of Received Bill / Audio *</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*,.pdf,.mp3,.wav"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="file-upload"
                          disabled={submitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('file-upload')?.click()}
                          disabled={submitting}
                          className="h-10"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {file ? "Change File" : "Upload File"}
                        </Button>
                      </div>

                      {formData.previewUrl && (
                        <div className="relative h-10 w-10 overflow-hidden rounded-md border">
                          <img src={formData.previewUrl} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                      )}

                      {file && (
                        <span className="text-sm truncate max-w-[150px] text-gray-500 font-medium text-green-600">
                          {file.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Accepts image, PDF, or audio files (max 5MB)
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">
                      GRN Number *
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      value={formData.grnNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, grnNumber: e.target.value }))}
                      placeholder="Enter GRN number"
                      className="h-10 mt-1"
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancel} disabled={submitting} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formData.materialReceivedDate || !formData.grnNumber || submitting}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Submit Material Receipt
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}