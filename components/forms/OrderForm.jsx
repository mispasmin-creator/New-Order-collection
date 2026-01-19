"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Package, Trash2, Upload } from "lucide-react"

// Google Apps Script URL - using your provided URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec";
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-";
const SPREADSHEET_ID = "1PNv5zw2xWrC9g3o7XaKAsoCkoagDR4FjDwDpS1vv5_g";

export default function OrderForm({ onSubmit, onCancel, user }) {
  const [formData, setFormData] = useState({
    // Basic Information
    "Timestamp": new Date().toISOString(),
    "DO-Delivery Order No.": "",
    "PARTY PO NO (As Per Po Exact)": "",
    "Party PO Date": "",
    "Party Names": "",
    "Gst Number": "",
    "Address": "",
    "Firm Name": user.role === "master" ? "" : user.firm,
    
    // Contact & Transport
    "Type Of Transporting": "",
    "Contact Person Name": "",
    "Contact Person WhatsApp No.": "",
    
    // Order Details
    "Order Received From": "",
    "Type Of Measurement": "",
    "Type Of PI": "",
    "Customer Category": "",
    "Free Replacement (FOC)": "",
    "Adjusted Amount": "",
    "Reference No.": "",
    
    // Payment & Terms
    "Total PO Basic Value": "",
    "Payment to Be Taken": "",
    "Advance": "",
    "Basic": "",
    "Retention Payment": "",
    "Retention Percentage": "",
    "Lead Time for Retention": "",
    "Specific Concern": "",
    
    // Technical & Lead Time
    "Lead Time For Collection Of Final Payment": "",
    "Type Of Application": "",
    
    // Product fields (will be handled separately for multiple products)
    "Product Name": "",
    "Quantity": "",
    "Rate Of Material": "",
    "Alumina%": "",
    "Iron%": "",
    
    // Additional fields from your header
    "Is This Order Through Some Agent": "",
    "Upload SO": null,
    "Marketing Manager Name": "",
    "Crm For The Customer": "",
    "Mail": "",
    
    // Status fields (usually auto-filled)
    "Quantity Delivered": "",
    "Order Cancel": "",
    "Pending Qty": "",
    "Material Return": "",
    "Status": "New Order",
    "Complete Date": "",
    
    // Products array for multiple products
    products: [],
  })

  const [dropdownData, setDropdownData] = useState({
    firmNames: [],
    partyNames: [],
    gstNumbers: [],
    customerCategories: [],
    typeOfPis: [],
    marketingSalesPersons: [],
    productNames: [],
    uoms: [],
    typeOfTransportings: [],
    paymentToBeTakens: [],
    orderReceivedFroms: [],
    typeOfApplications: [],
    retentionPayments: [],
    agents: []
  })

  const [showProductForm, setShowProductForm] = useState(false)
  const [currentProduct, setCurrentProduct] = useState({
    "Product Name": "",
    "Quantity": "",
    "Rate Of Material": "",
    "Alumina%": "",
    "Iron%": "",
    "Type Of Measurement": "",
    "Total PO Basic Value": "",
    "Advance": "",
    "Basic": "",
  })

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Fetch dropdown data from Master sheet
  useEffect(() => {
    fetchDropdownData();
  }, [])

  const fetchDropdownData = async () => {
    try {
      setLoading(true);
      
      // Fetch data from Master sheet
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=Master`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const masterData = result.data;
        const headers = masterData[0]; // First row contains headers
        
        // Extract columns based on your Master sheet headers
        const dataByColumn = {};
        
        // Map column indices based on your Master sheet headers
        masterData.slice(1).forEach(row => {
          headers.forEach((header, index) => {
            if (!dataByColumn[header]) dataByColumn[header] = new Set();
            if (row[index]) dataByColumn[header].add(row[index]);
          });
        });
        
        setDropdownData({
          firmNames: Array.from(dataByColumn["Firm Name"] || []),
          partyNames: Array.from(dataByColumn["Party Name"] || []),
          gstNumbers: Array.from(dataByColumn["GST Number"] || []),
          customerCategories: Array.from(dataByColumn["Customer Category"] || []),
          typeOfPis: Array.from(dataByColumn["Type of PI"] || []),
          marketingSalesPersons: Array.from(dataByColumn["Marketing Sales Person"] || []),
          productNames: Array.from(dataByColumn["Product Name"] || []),
          uoms: Array.from(dataByColumn["UOM"] || []),
          
          // Hardcoded dropdowns (add more as needed)
          typeOfTransportings: ["FOR", "Ex Factory", "Ex Factory But paid by Us"],
          paymentToBeTakens: ["100% Advance", "Partly Advance", "Against PI", "Partly PI", "Free of Cost"],
          orderReceivedFroms: ["Direct", "Agent", "Reference"],
          typeOfApplications: ["Refractory", "Abrasive", "Ceramic", "Other"],
          retentionPayments: ["Yes", "No"],
          agents: ["Agent 1", "Agent 2", "Agent 3", "No Agent"]
        });
      }
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch party details when GST number is selected
  const fetchPartyDetails = async (gstNumber) => {
    if (!gstNumber) return;
    
    try {
      // Fetch from Master sheet to get party details
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=Master`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const masterData = result.data;
        const headers = masterData[0];
        
        // Find the row with matching GST number
        const gstIndex = headers.indexOf("GST Number");
        const partyNameIndex = headers.indexOf("Party Name");
        const customerCategoryIndex = headers.indexOf("Customer Category");
        const typeOfPiIndex = headers.indexOf("Type of PI");
        const marketingPersonIndex = headers.indexOf("Marketing Sales Person");
        
        const partyRow = masterData.slice(1).find(row => row[gstIndex] === gstNumber);
        
        if (partyRow) {
          setFormData(prev => ({ 
            ...prev, 
            "Party Names": partyRow[partyNameIndex] || "",
            "Customer Category": partyRow[customerCategoryIndex] || "",
            "Type Of PI": partyRow[typeOfPiIndex] || "",
            "Marketing Manager Name": partyRow[marketingPersonIndex] || ""
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching party details:", error);
    }
  }

  const handleInputChange = (field, value) => {
    if (field === "Gst Number") {
      fetchPartyDetails(value);
    }
    
    if (field === "Free Replacement (FOC)") {
      setFormData(prev => ({ 
        ...prev, 
        [field]: value,
        "Adjusted Amount": value === "yesButAdjusted" ? prev["Adjusted Amount"] : ""
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  }

  const handleProductChange = (field, value) => {
    setCurrentProduct((prev) => ({ ...prev, [field]: value }))
  }

  const addProduct = () => {
    if (currentProduct["Product Name"] && currentProduct["Quantity"]) {
      setFormData((prev) => ({
        ...prev,
        products: [...prev.products, { 
          ...currentProduct, 
          id: Date.now(),
          // Calculate total PO value if not provided
          "Total PO Basic Value": currentProduct["Total PO Basic Value"] || 
            (parseFloat(currentProduct["Quantity"]) * parseFloat(currentProduct["Rate Of Material"]) || 0)
        }],
      }))
      setCurrentProduct({
        "Product Name": "",
        "Quantity": "",
        "Rate Of Material": "",
        "Alumina%": "",
        "Iron%": "",
        "Type Of Measurement": "",
        "Total PO Basic Value": "",
        "Advance": "",
        "Basic": "",
      })
      setShowProductForm(false)
    }
  }

  const removeProduct = (productId) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }))
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onloadend = async () => {
        const base64Data = reader.result;
        
        const formData = new FormData();
        formData.append("action", "uploadFile");
        formData.append("base64Data", base64Data);
        formData.append("fileName", file.name);
        formData.append("mimeType", file.type);
        formData.append("folderId", FOLDER_ID);
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: formData,
        });
        
        const result = await response.json();
        if (result.success) {
          setFormData(prev => ({ 
            ...prev, 
            "Upload SO": file,
            "Upload SO URL": result.fileUrl 
          }));
        }
      };
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setLoading(false);
    }
  }

  // Prepare row data for submission according to your ORDER RECEIPT sheet headers
  const prepareRowData = () => {
    // Start with base form data
    const rowData = {
      // Timestamp is auto-generated
      "Timestamp": new Date().toISOString(),
      
      // Basic order info
      "PARTY PO NO (As Per Po Exact)": formData["PARTY PO NO (As Per Po Exact)"],
      "Party PO Date": formData["Party PO Date"],
      "Party Names": formData["Party Names"],
      "Gst Number": formData["Gst Number"],
      "Address": formData["Address"],
      "Firm Name": formData["Firm Name"],
      
      // Transport & Contact
      "Type Of Transporting": formData["Type Of Transporting"],
      "Contact Person Name": formData["Contact Person Name"],
      "Contact Person WhatsApp No.": formData["Contact Person WhatsApp No."],
      
      // Order details
      "Order Received From": formData["Order Received From"],
      "Type Of PI": formData["Type Of PI"],
      "Customer Category": formData["Customer Category"],
      "Free Replacement (FOC)": formData["Free Replacement (FOC)"],
      "Adjusted Amount": formData["Adjusted Amount"],
      "Reference No.": formData["Reference No."],
      
      // Payment & Terms
      "Total PO Basic Value": formData["Total PO Basic Value"],
      "Payment to Be Taken": formData["Payment to Be Taken"],
      "Advance": formData["Advance"],
      "Basic": formData["Basic"],
      "Retention Payment": formData["Retention Payment"],
      "Retention Percentage": formData["Retention Percentage"],
      "Lead Time for Retention": formData["Lead Time for Retention"],
      "Specific Concern": formData["Specific Concern"],
      
      // Technical
      "Lead Time For Collection Of Final Payment": formData["Lead Time For Collection Of Final Payment"],
      "Type Of Application": formData["Type Of Application"],
      
      // Agent & Marketing
      "Is This Order Through Some Agent": formData["Is This Order Through Some Agent"],
      "Marketing Manager Name": formData["Marketing Manager Name"],
      
      // File upload (URL)
      "Upload SO": formData["Upload SO URL"] || "",
      
      // Status fields (default values)
      "Status": "New Order",
      "Quantity Delivered": "0",
      "Pending Qty": formData["Quantity"] || "0",
      "Order Cancel": "No",
      "Material Return": "No",
      
      // Other fields
      "Crm For The Customer": "",
      "Mail": "",
      "DO-Delivery Order No.": `DO-${Date.now()}`,
      "Complete Date": "",
    };
    
    return rowData;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.products.length === 0) {
      alert("Please add at least one product");
      return;
    }
    
    try {
      setLoading(true);
      
      // Prepare data for each product (multiple rows if multiple products)
      const rowsToInsert = formData.products.map(product => {
        const baseRow = prepareRowData();
        
        // Add product-specific data
        return {
          ...baseRow,
          "Product Name": product["Product Name"],
          "Quantity": product["Quantity"],
          "Rate Of Material": product["Rate Of Material"],
          "Type Of Measurement": product["Type Of Measurement"],
          "Alumina%": product["Alumina%"],
          "Iron%": product["Iron%"],
          "Total PO Basic Value": product["Total PO Basic Value"],
          "Advance": product["Advance"],
          "Basic": product["Basic"],
          "Pending Qty": product["Quantity"], // Set pending quantity to initial quantity
        };
      });
      
      // Convert to array format for Google Sheets
      const rowArrays = rowsToInsert.map(row => {
        // Map according to your ORDER RECEIPT sheet column order
        return [
          row["Timestamp"],
          row["DO-Delivery Order No."],
          row["PARTY PO NO (As Per Po Exact)"],
          row["Party PO Date"],
          row["Party Names"],
          row["Product Name"],
          row["Quantity"],
          row["Rate Of Material"],
          row["Type Of Transporting"],
          row["Upload SO"],
          row["Is This Order Through Some Agent"],
          row["Order Received From"],
          row["Type Of Measurement"],
          row["Contact Person Name"],
          row["Contact Person WhatsApp No."],
          row["Alumina%"],
          row["Iron%"],
          row["Type Of PI"],
          row["Lead Time For Collection Of Final Payment"],
          row["Type Of Application"],
          row["Customer Category"],
          row["Free Replacement (FOC)"],
          row["Gst Number"],
          row["Address"],
          row["Firm Name"],
          row["Total PO Basic Value"],
          row["Payment to Be Taken"],
          row["Advance"],
          row["Basic"],
          row["Retention Payment"],
          row["Retention Percentage"],
          row["Lead Time for Retention"],
          row["Specific Concern"],
          row["Reference No."],
          row["Adjusted Amount"],
          row["Quantity Delivered"],
          row["Order Cancel"],
          row["Pending Qty"],
          row["Material Return"],
          row["Status"],
          row["Complete Date"],
          row["Crm For The Customer"],
          row["Mail"],
          row["Marketing Manager Name"]
        ];
      });
      
      // Submit to Google Sheets
      const formDataToSend = new FormData();
      formDataToSend.append("action", "batchInsert");
      formDataToSend.append("sheetName", "ORDER RECEIPT");
      formDataToSend.append("rowsData", JSON.stringify(rowArrays));
      
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: formDataToSend,
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        // Reset form
        setFormData({
          "Timestamp": new Date().toISOString(),
          "DO-Delivery Order No.": "",
          "PARTY PO NO (As Per Po Exact)": "",
          "Party PO Date": "",
          "Party Names": "",
          "Gst Number": "",
          "Address": "",
          "Firm Name": user.role === "master" ? "" : user.firm,
          "Type Of Transporting": "",
          "Contact Person Name": "",
          "Contact Person WhatsApp No.": "",
          "Order Received From": "",
          "Type Of Measurement": "",
          "Type Of PI": "",
          "Customer Category": "",
          "Free Replacement (FOC)": "",
          "Adjusted Amount": "",
          "Reference No.": "",
          "Total PO Basic Value": "",
          "Payment to Be Taken": "",
          "Advance": "",
          "Basic": "",
          "Retention Payment": "",
          "Retention Percentage": "",
          "Lead Time for Retention": "",
          "Specific Concern": "",
          "Lead Time For Collection Of Final Payment": "",
          "Type Of Application": "",
          "Product Name": "",
          "Quantity": "",
          "Rate Of Material": "",
          "Alumina%": "",
          "Iron%": "",
          "Is This Order Through Some Agent": "",
          "Upload SO": null,
          "Marketing Manager Name": "",
          "Crm For The Customer": "",
          "Mail": "",
          "Quantity Delivered": "",
          "Order Cancel": "",
          "Pending Qty": "",
          "Material Return": "",
          "Status": "New Order",
          "Complete Date": "",
          products: [],
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error submitting form. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-green-600">Order Successfully Submitted!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">Order has been recorded in the system.</p>
            <p className="text-sm text-gray-500">Delivery Order Number: DO-{Date.now()}</p>
            <Button 
              onClick={() => {
                setSuccess(false);
                setFormData(prev => ({ ...prev, "Timestamp": new Date().toISOString() }));
              }}
              className="w-full"
            >
              Create Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ORDER RECEIPT FORM</h2>
          <p className="text-gray-600 mt-1">Fill in the order details</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="hover:bg-white/50">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <p className="text-gray-700">Processing, please wait...</p>
          </div>
        </div>
      )}

      <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* BASIC INFORMATION SECTION - Updated with your field names */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pl-11">
              {/* Firm Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Firm Name *
                </Label>
                <Select
                  value={formData["Firm Name"]}
                  onValueChange={(value) => handleInputChange("Firm Name", value)}
                  disabled={user.role !== "master"}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select Firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.firmNames.map((firm, index) => (
                      <SelectItem key={index} value={firm}>{firm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PARTY PO NO */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  PARTY PO NO (As Per Po Exact) *
                </Label>
                <Input
                  value={formData["PARTY PO NO (As Per Po Exact)"]}
                  onChange={(e) => handleInputChange("PARTY PO NO (As Per Po Exact)", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter PO number"
                  required
                />
              </div>

              {/* Party PO Date */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Party PO Date *
                </Label>
                <Input
                  type="date"
                  value={formData["Party PO Date"]}
                  onChange={(e) => handleInputChange("Party PO Date", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              {/* GST Number */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  GST Number *
                </Label>
                <Select
                  value={formData["Gst Number"]}
                  onValueChange={(value) => handleInputChange("Gst Number", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select GST Number" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.gstNumbers.map((gst, index) => (
                      <SelectItem key={index} value={gst}>{gst}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Party Names (auto-filled) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Party Names *
                </Label>
                <Input
                  value={formData["Party Names"]}
                  readOnly
                  className="h-11 border-gray-300 bg-gray-50"
                  placeholder="Auto-filled from GST"
                  required
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Address
                </Label>
                <Textarea
                  value={formData["Address"]}
                  onChange={(e) => handleInputChange("Address", e.target.value)}
                  className="h-20 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter address"
                />
              </div>

              {/* Type of Transporting */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Type Of Transporting
                </Label>
                <Select
                  value={formData["Type Of Transporting"]}
                  onValueChange={(value) => handleInputChange("Type Of Transporting", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select transport type" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.typeOfTransportings.map((type, index) => (
                      <SelectItem key={index} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Upload SO */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Upload SO
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  {formData["Upload SO"] && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      ✓ Uploaded
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CONTACT & ORDER DETAILS SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Contact & Order Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pl-11">
              {/* Contact Person Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Contact Person Name *
                </Label>
                <Input
                  value={formData["Contact Person Name"]}
                  onChange={(e) => handleInputChange("Contact Person Name", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter contact name"
                  required
                />
              </div>

              {/* Contact Person WhatsApp No. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Contact Person WhatsApp No. *
                </Label>
                <Input
                  type="tel"
                  value={formData["Contact Person WhatsApp No."]}
                  onChange={(e) => handleInputChange("Contact Person WhatsApp No.", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter WhatsApp number"
                  required
                />
              </div>

              {/* Order Received From */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Order Received From
                </Label>
                <Select
                  value={formData["Order Received From"]}
                  onValueChange={(value) => handleInputChange("Order Received From", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.orderReceivedFroms.map((source, index) => (
                      <SelectItem key={index} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Is This Order Through Some Agent */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Through Agent?
                </Label>
                <Select
                  value={formData["Is This Order Through Some Agent"]}
                  onValueChange={(value) => handleInputChange("Is This Order Through Some Agent", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.agents.map((agent, index) => (
                      <SelectItem key={index} value={agent}>{agent}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Category (auto-filled) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Customer Category
                </Label>
                <Input
                  value={formData["Customer Category"]}
                  readOnly
                  className="h-11 border-gray-300 bg-gray-50"
                  placeholder="Auto-filled from GST"
                />
              </div>

              {/* Type Of PI (auto-filled) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Type Of PI
                </Label>
                <Input
                  value={formData["Type Of PI"]}
                  readOnly
                  className="h-11 border-gray-300 bg-gray-50"
                  placeholder="Auto-filled from GST"
                />
              </div>
            </div>
          </div>

          {/* PAYMENT & TERMS SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Payment & Terms</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pl-11">
              {/* Total PO Basic Value */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Total PO Basic Value *
                </Label>
                <Input
                  type="number"
                  value={formData["Total PO Basic Value"]}
                  onChange={(e) => handleInputChange("Total PO Basic Value", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter total value"
                  required
                />
              </div>

              {/* Payment to Be Taken */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Payment to Be Taken
                </Label>
                <Select
                  value={formData["Payment to Be Taken"]}
                  onValueChange={(value) => handleInputChange("Payment to Be Taken", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.paymentToBeTakens.map((payment, index) => (
                      <SelectItem key={index} value={payment}>{payment}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Advance */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Advance %
                </Label>
                <Input
                  type="number"
                  value={formData["Advance"]}
                  onChange={(e) => handleInputChange("Advance", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter advance percentage"
                />
              </div>

              {/* Basic */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Basic %
                </Label>
                <Input
                  type="number"
                  value={formData["Basic"]}
                  onChange={(e) => handleInputChange("Basic", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter basic percentage"
                />
              </div>

              {/* Retention Payment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Retention Payment
                </Label>
                <Select
                  value={formData["Retention Payment"]}
                  onValueChange={(value) => handleInputChange("Retention Payment", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.retentionPayments.map((retention, index) => (
                      <SelectItem key={index} value={retention}>{retention}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Retention Percentage */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Retention Percentage
                </Label>
                <Input
                  type="number"
                  value={formData["Retention Percentage"]}
                  onChange={(e) => handleInputChange("Retention Percentage", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter retention %"
                />
              </div>

              {/* Lead Time for Retention */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Lead Time for Retention
                </Label>
                <Input
                  value={formData["Lead Time for Retention"]}
                  onChange={(e) => handleInputChange("Lead Time for Retention", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., 30 days"
                />
              </div>

              {/* Lead Time For Collection Of Final Payment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Lead Time For Collection Of Final Payment
                </Label>
                <Input
                  value={formData["Lead Time For Collection Of Final Payment"]}
                  onChange={(e) => handleInputChange("Lead Time For Collection Of Final Payment", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., 15 days"
                />
              </div>

              {/* Specific Concern */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Specific Concern
                </Label>
                <Input
                  value={formData["Specific Concern"]}
                  onChange={(e) => handleInputChange("Specific Concern", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Any specific concerns"
                />
              </div>

              {/* Reference No. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Reference No.
                </Label>
                <Input
                  value={formData["Reference No."]}
                  onChange={(e) => handleInputChange("Reference No.", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter reference number"
                />
              </div>

              {/* Free Replacement (FOC) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Free Replacement (FOC)
                </Label>
                <Select
                  value={formData["Free Replacement (FOC)"]}
                  onValueChange={(value) => handleInputChange("Free Replacement (FOC)", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">YES</SelectItem>
                    <SelectItem value="No">NO</SelectItem>
                    <SelectItem value="Yes But Adjusted">Yes But Adjusted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Adjusted Amount (conditional) */}
              {formData["Free Replacement (FOC)"] === "Yes But Adjusted" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Adjusted Amount
                  </Label>
                  <Input
                    value={formData["Adjusted Amount"]}
                    onChange={(e) => handleInputChange("Adjusted Amount", e.target.value)}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter adjusted amount"
                  />
                </div>
              )}

              {/* Type Of Application */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Type Of Application
                </Label>
                <Select
                  value={formData["Type Of Application"]}
                  onValueChange={(value) => handleInputChange("Type Of Application", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select application type" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.typeOfApplications.map((app, index) => (
                      <SelectItem key={index} value={app}>{app}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Marketing Manager Name (auto-filled) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Marketing Manager Name
                </Label>
                <Input
                  value={formData["Marketing Manager Name"]}
                  readOnly
                  className="h-11 border-gray-300 bg-gray-50"
                  placeholder="Auto-filled from GST"
                />
              </div>
            </div>
          </div>

          {/* PRODUCTS SECTION - Updated for multiple products */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">4</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Products</h3>
              </div>
              <Button
                type="button"
                onClick={() => setShowProductForm(true)}
                className="bg-orange-600 hover:bg-orange-700 shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>

            {/* Product List */}
            <div className="pl-11">
              {formData.products.length > 0 ? (
                <div className="space-y-3">
                  {formData.products.map((product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{product["Product Name"]}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Qty: {product["Quantity"]}
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Rate: ₹{product["Rate Of Material"]}
                            </Badge>
                            {product["Type Of Measurement"] && (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                UOM: {product["Type Of Measurement"]}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              Alumina: {product["Alumina%"]}%
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              Iron: {product["Iron%"]}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(product.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No products added yet</p>
                  <p className="text-gray-400 text-sm mt-1">Click "Add Product" to get started</p>
                </div>
              )}
            </div>

            {/* Product Form Modal */}
            {showProductForm && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl border-0">
                  <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-semibold text-gray-900">Add Product</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowProductForm(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Product Name */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Product Name *</Label>
                        <Select
                          value={currentProduct["Product Name"]}
                          onValueChange={(value) => handleProductChange("Product Name", value)}
                        >
                          <SelectTrigger className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                            <SelectValue placeholder="Select Product" />
                          </SelectTrigger>
                          <SelectContent>
                            {dropdownData.productNames.map((product, index) => (
                              <SelectItem key={index} value={product}>{product}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Quantity *</Label>
                        <Input
                          type="number"
                          value={currentProduct["Quantity"]}
                          onChange={(e) => handleProductChange("Quantity", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Enter quantity"
                          required
                        />
                      </div>

                      {/* Rate Of Material */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Rate Of Material *</Label>
                        <Input
                          type="number"
                          value={currentProduct["Rate Of Material"]}
                          onChange={(e) => handleProductChange("Rate Of Material", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Enter rate"
                          required
                        />
                      </div>

                      {/* Type Of Measurement (UOM) */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Type Of Measurement *</Label>
                        <Select
                          value={currentProduct["Type Of Measurement"]}
                          onValueChange={(value) => handleProductChange("Type Of Measurement", value)}
                        >
                          <SelectTrigger className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                            <SelectValue placeholder="Select UOM" />
                          </SelectTrigger>
                          <SelectContent>
                            {dropdownData.uoms.map((uom, index) => (
                              <SelectItem key={index} value={uom}>{uom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Alumina% */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Alumina% *</Label>
                        <Input
                          type="number"
                          value={currentProduct["Alumina%"]}
                          onChange={(e) => handleProductChange("Alumina%", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Alumina percentage"
                          required
                        />
                      </div>

                      {/* Iron% */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Iron% *</Label>
                        <Input
                          type="number"
                          value={currentProduct["Iron%"]}
                          onChange={(e) => handleProductChange("Iron%", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Iron percentage"
                          required
                        />
                      </div>

                      {/* Total PO Basic Value */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Total PO Basic Value</Label>
                        <Input
                          type="number"
                          value={currentProduct["Total PO Basic Value"]}
                          onChange={(e) => handleProductChange("Total PO Basic Value", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Will auto-calculate"
                        />
                      </div>

                      {/* Advance */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Advance %</Label>
                        <Input
                          type="number"
                          value={currentProduct["Advance"]}
                          onChange={(e) => handleProductChange("Advance", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Advance percentage"
                        />
                      </div>

                      {/* Basic */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Basic %</Label>
                        <Input
                          type="number"
                          value={currentProduct["Basic"]}
                          onChange={(e) => handleProductChange("Basic", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Basic percentage"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowProductForm(false)}
                        className="flex-1 h-11"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={addProduct}
                        className="flex-1 h-11 bg-orange-600 hover:bg-orange-700"
                        disabled={!currentProduct["Product Name"] || !currentProduct["Quantity"]}
                      >
                        Add Product
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-8 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 h-12 bg-white border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700 shadow-lg"
              disabled={loading || formData.products.length === 0}
            >
              {loading ? "Submitting..." : "Submit Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}