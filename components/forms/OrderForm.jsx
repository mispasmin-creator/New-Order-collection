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

// Google Apps Script URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec";
const FOLDER_ID = "1Mr68o4MM5zlbRoltdIcpXIBZCh8Ffql-";
export default function OrderForm({ onSubmit, onCancel, user }) {
  const [formData, setFormData] = useState({
    // Basic Information
    "Timestamp": "",
    "DO-Delivery Order No.": "",
    "PARTY PO NO (As Per Po Exact)": "",
    "Party PO Date": "",
    "Party Name": "",
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
    "Retention Payment": "",
    "Retention Percentage": "",
    "Lead Time for Retention": "",
    "Specific Concern": "",
    
    // Technical & Lead Time
    "Lead Time For Collection Of Final Payment": "",
    "Type Of Application": "",
    
    // Agent & Marketing
    "Is This Order Through Some Agent": "",
    "Marketing Mangager Name": "",
    
    // Product specific fields
    "Product Name": "",
    "Quantity": "",
    "Rate Of Material": "",
    "Alumina%": "",
    "Iron%": "",
    "Advance": "",
    "Basic": "",
    
    // File upload
    "Upload SO": null,
    
    // Products array for multiple products
    products: [],
  })

  const [dropdownData, setDropdownData] = useState({
    firmNames: [],
    partyNames: [],
    gstNumbers: [],
    addresses: [],
    typeOfPis: [],
    customerCategories: [],
    marketingMangagerNames: [],
    productNames: [],
    uoms: [],
    typeOfTransportings: [],
    paymentToBeTakens: ["Yes", "No"],
    orderReceivedFroms: ["NBD & CRR OF CRR FMS", "NBD AND NBD OF CRR OUTGOING FMS", "CRR ENQUIRY"],
    typeOfApplications: ["Full application", "Our Supervision only", "Patching only", "None of the above"],
    agents: ["Yes", "No"],
    retentionPayments: ["Yes", "No"]
  })

  const [lastDoNumber, setLastDoNumber] = useState(0)
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
  const [isDoNumberFetched, setIsDoNumberFetched] = useState(false)

  // Fetch dropdown data from Master sheet and get last DO number
  useEffect(() => {
    fetchDropdownData();
    fetchLastDoNumber();
  }, [])

  // Generate timestamp in format: 12/24/2022 13:45:01
  const generateTimestamp = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  }

  // Generate DO number like DO-958, DO-959, etc.
  // const generateDoNumber = () => {
  //   if (!isDoNumberFetched || lastDoNumber === 0) {
  //     // Fetch last DO number first
  //     fetchLastDoNumber();
  //     return "DO-1";
  //   }
  //   return `DO-${lastDoNumber + 1}`;
  // }

 const fetchLastDoNumber = async () => {
  try {
    setLoading(true);

    const response = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=ORDER RECEIPT`);
    const result = await response.json();

    if (result.success && result.data && result.data.length > 1) {
      const data = result.data;
      const headers = data[0].map(h => h.trim());
      const doNumberIndex = headers.indexOf("DO-Delivery Order No.");

      if (doNumberIndex === -1) {
        console.error("DO column not found");
        return;
      }

      let maxNumber = 0;

      data.slice(1).forEach(row => {
        const value = row[doNumberIndex];
        if (value && String(value).startsWith("DO-")) {
          const num = parseInt(String(value).replace("DO-", ""), 10);
          if (!isNaN(num)) maxNumber = Math.max(maxNumber, num);
        }
      });

      setLastDoNumber(maxNumber);
      setIsDoNumberFetched(true);
      console.log("Last DO found:", maxNumber);
    }
  } catch (err) {
    console.error("Error fetching last DO number:", err);
  } finally {
    setLoading(false);
  }
};


  const fetchDropdownData = async () => {
    try {
      setLoading(true);
      
      // Fetch data from Master sheet
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=Master`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const masterData = result.data;
        
        if (masterData.length === 0) {
          console.warn("No data found in Master sheet");
          return;
        }
        
        const headers = masterData[0].map(h => h.trim());
        console.log("Master sheet headers:", headers);
        
        // Find column indices
        const firmNameIndex = headers.indexOf("Firm Name");
        const partyNameIndex = headers.findIndex(h => h.includes("Party"));
        const addressIndex = headers.indexOf("Address");
        const gstNumberIndex = headers.findIndex(h => h.includes("GST"));
        const customerCategoryIndex = headers.findIndex(h => h.includes("Customer Category"));
        const typeOfPiIndex = headers.findIndex(h => h.includes("Type of PI") || h.includes("Type Of PI"));
        const marketingManagerIndex = headers.findIndex(h => 
          h.includes("Marketing Sales Person") || 
          h.includes("Marketing Mangager Name") ||
          h.includes("Sales Person")
        );
        const productNameIndex = headers.findIndex(h => h.includes("Product Name"));
        const uomIndex = headers.findIndex(h => h.includes("UOM") || h.includes("Unit"));
        
        console.log("Column indices:", {
          partyNameIndex,
          marketingManagerIndex,
          productNameIndex
        });
        
        // Initialize sets
        const firmNamesSet = new Set();
        const partyNamesSet = new Set();
        const gstNumbersSet = new Set();
        const addressesSet = new Set();
        const typeOfPisSet = new Set();
        const customerCategoriesSet = new Set();
        const marketingManagersSet = new Set();
        const productNamesSet = new Set();
        const uomsSet = new Set();

        // Extract data from each row
        masterData.slice(1).forEach(row => {
          if (firmNameIndex !== -1 && row[firmNameIndex]) {
            firmNamesSet.add(String(row[firmNameIndex]).trim());
          }
          if (partyNameIndex !== -1 && row[partyNameIndex]) {
            const partyName = String(row[partyNameIndex]).trim();
            if (partyName) partyNamesSet.add(partyName);
          }
          if (gstNumberIndex !== -1 && row[gstNumberIndex]) {
            gstNumbersSet.add(String(row[gstNumberIndex]).trim());
          }
          if (addressIndex !== -1 && row[addressIndex]) {
            addressesSet.add(String(row[addressIndex]).trim());
          }
          if (typeOfPiIndex !== -1 && row[typeOfPiIndex]) {
            typeOfPisSet.add(String(row[typeOfPiIndex]).trim());
          }
          if (customerCategoryIndex !== -1 && row[customerCategoryIndex]) {
            customerCategoriesSet.add(String(row[customerCategoryIndex]).trim());
          }
          if (marketingManagerIndex !== -1 && row[marketingManagerIndex]) {
            const managerName = String(row[marketingManagerIndex]).trim();
            if (managerName) marketingManagersSet.add(managerName);
          }
          if (productNameIndex !== -1 && row[productNameIndex]) {
            productNamesSet.add(String(row[productNameIndex]).trim());
          }
          if (uomIndex !== -1 && row[uomIndex]) {
            uomsSet.add(String(row[uomIndex]).trim());
          }
        });
        
        console.log("Dropdown data counts:", {
          partyNames: Array.from(partyNamesSet).length,
          marketingManagers: Array.from(marketingManagersSet).length,
          productNames: Array.from(productNamesSet).length
        });
        
        setDropdownData(prev => ({
          ...prev,
          firmNames: Array.from(firmNamesSet).filter(Boolean),
          partyNames: Array.from(partyNamesSet).filter(Boolean),
          gstNumbers: Array.from(gstNumbersSet).filter(Boolean),
          addresses: Array.from(addressesSet).filter(Boolean),
          typeOfPis: Array.from(typeOfPisSet).filter(Boolean),
          customerCategories: Array.from(customerCategoriesSet).filter(Boolean),
          marketingMangagerNames: Array.from(marketingManagersSet).filter(Boolean),
          productNames: Array.from(productNamesSet).filter(Boolean),
          uoms: Array.from(uomsSet).filter(Boolean),
          typeOfTransportings: ["FOR", "Ex Factory", "Ex Factory But paid by Us"],
        }));
      }
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch address and GST when party name is selected
  const fetchPartyDetails = async (partyName) => {
    if (!partyName) return;
    
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=Master`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const masterData = result.data;
        const headers = masterData[0].map(h => h.trim());
        
        const partyNameIndex = headers.findIndex(h => h.includes("Party"));
        const addressIndex = headers.indexOf("Address");
        const gstNumberIndex = headers.findIndex(h => h.includes("GST"));
        const firmNameIndex = headers.indexOf("Firm Name");
        
        // Find the row with matching party name
        const partyRow = masterData.slice(1).find(row => {
          return row[partyNameIndex] && String(row[partyNameIndex]).trim() === partyName.trim();
        });
        
        if (partyRow) {
          const updates = {};
          
          if (addressIndex !== -1 && partyRow[addressIndex]) {
            updates["Address"] = String(partyRow[addressIndex]).trim();
          }
          
          if (gstNumberIndex !== -1 && partyRow[gstNumberIndex]) {
            updates["Gst Number"] = String(partyRow[gstNumberIndex]).trim();
          }
          
          if (firmNameIndex !== -1 && partyRow[firmNameIndex] && user.role === "master") {
            updates["Firm Name"] = String(partyRow[firmNameIndex]).trim();
          }
          
          setFormData(prev => ({ 
            ...prev, 
            ...updates
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching party details:", error);
    }
  }

  const handleInputChange = (field, value) => {
    if (field === "Party Name") {
      setFormData(prev => ({ ...prev, [field]: value }));
      fetchPartyDetails(value);
    } else if (field === "Gst Number") {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  }

  const handleProductChange = (field, value) => {
    const updatedProduct = { ...currentProduct, [field]: value };
    
    if (field === "Quantity" || field === "Rate Of Material") {
      const quantity = field === "Quantity" ? parseFloat(value) || 0 : parseFloat(currentProduct["Quantity"]) || 0;
      const rate = field === "Rate Of Material" ? parseFloat(value) || 0 : parseFloat(currentProduct["Rate Of Material"]) || 0;
      updatedProduct["Total PO Basic Value"] = (quantity * rate).toString();
    }
    
    setCurrentProduct(updatedProduct);
  }

  const addProduct = () => {
    if (currentProduct["Product Name"] && currentProduct["Quantity"]) {
      const newProduct = {
        ...currentProduct, 
        id: Date.now(),
        "Total PO Basic Value": currentProduct["Total PO Basic Value"] || 
          (parseFloat(currentProduct["Quantity"]) * parseFloat(currentProduct["Rate Of Material"]) || 0).toString()
      };
      
      setFormData((prev) => ({
        ...prev,
        products: [...prev.products, newProduct],
        "Total PO Basic Value": (parseFloat(prev["Total PO Basic Value"] || 0) + 
          parseFloat(newProduct["Total PO Basic Value"])).toString()
      }));
      
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
      });
      setShowProductForm(false);
    }
  }

  const removeProduct = (productId) => {
    const productToRemove = formData.products.find(p => p.id === productId);
    
    setFormData((prev) => {
      const updatedProducts = prev.products.filter((p) => p.id !== productId);
      const totalValue = updatedProducts.reduce((sum, product) => 
        sum + parseFloat(product["Total PO Basic Value"] || 0), 0);
      
      return {
        ...prev,
        products: updatedProducts,
        "Total PO Basic Value": totalValue.toString()
      };
    });
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      
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

  // Prepare row data according to your exact header requirements
const prepareRowData = (doNumber) => {
  const timestamp = generateTimestamp();

  return {
    "Timestamp": timestamp,
    "DO-Delivery Order No.": doNumber,
    "PARTY PO NO (As Per Po Exact)": formData["PARTY PO NO (As Per Po Exact)"],
    "Party PO Date": formData["Party PO Date"],
    "Party Names": formData["Party Name"],
    "Product Name": "",
    "Quantity": "",
    "Rate Of Material": "",
    "Type Of Transporting": formData["Type Of Transporting"],
    "Upload SO": formData["Upload SO URL"] || "",
    "Is This Order Through Some Agent": formData["Is This Order Through Some Agent"],
    "Order Received From": formData["Order Received From"],
    "Type Of Measurement": "",
    "Contact Person Name": formData["Contact Person Name"],
    "Contact Person WhatsApp No.": formData["Contact Person WhatsApp No."],
    "Alumina%": "",
    "Iron%": "",
    "Type Of PI": formData["Type Of PI"],
    "Lead Time For Collection Of Final Payment": formData["Lead Time For Collection Of Final Payment"],
    "Type Of Application": formData["Type Of Application"],
    "Customer Category": formData["Customer Category"],
    "Free Replacement (FOC)": formData["Free Replacement (FOC)"],
    "Gst Number": formData["Gst Number"],
    "Address": formData["Address"],
    "Firm Name": formData["Firm Name"],
    "Total PO Basic Value": "",
    "Payment to Be Taken": formData["Payment to Be Taken"],
    "Advance": "",
    "Basic": "",
    "Retention Payment": formData["Retention Payment"],
    "Retention Percentage": formData["Retention Percentage"],
    "Lead Time for Retention": formData["Lead Time for Retention"],
    "Specific Concern": formData["Specific Concern"],
    "Reference No.": formData["Reference No."],
    "Adjusted Amount": formData["Adjusted Amount"],
    "Marketing Mangager Name": formData["Marketing Mangager Name"],
  };
};

 const handleSubmit = async (e) => {
  e.preventDefault();

  if (formData.products.length === 0) {
    alert("Please add at least one product");
    return;
  }

  try {
    setLoading(true);

    // ✅ Ensure latest DO is fetched
    if (!isDoNumberFetched) {
      await fetchLastDoNumber();
    }

    // ✅ SINGLE SOURCE OF TRUTH
    const generatedDo = `DO-${lastDoNumber + 1}`;

    const rowsToInsert = formData.products.map(product => {
      const baseRow = prepareRowData(generatedDo);

      return {
        ...baseRow,
        "Product Name": product["Product Name"],
        "Quantity": product["Quantity"],
        "Rate Of Material": product["Rate Of Material"],
        "Type Of Measurement": product["Type Of Measurement"],
        "Alumina%": product["Alumina%"],
        "Iron%": product["Iron%"],
        "Advance": product["Advance"],
        "Basic": product["Basic"],
        "Total PO Basic Value": product["Total PO Basic Value"],
      };
    });
     
      // Convert to array format in EXACT header order
      const rowArrays = rowsToInsert.map(row => {
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
          row["Marketing Mangager Name"] // Last field - column 35
        ];
      });
      
      console.log("Submitting data:", {
        doNumbers: rowsToInsert.map(r => r["DO-Delivery Order No."]),
        marketingManager: formData["Marketing Mangager Name"],
        rowCount: rowArrays.length
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
      console.log("Submission result:", result);
      
      if (result.success) {
        // Update last DO number for next submission
          setLastDoNumber(prev => prev + 1);
        
        setSuccess(true);
        // Reset form
        const timestamp = generateTimestamp();
        setFormData({
          "Timestamp": timestamp,
          "DO-Delivery Order No.": "",
          "PARTY PO NO (As Per Po Exact)": "",
          "Party PO Date": "",
          "Party Name": "",
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
          "Retention Payment": "",
          "Retention Percentage": "",
          "Lead Time for Retention": "",
          "Specific Concern": "",
          "Lead Time For Collection Of Final Payment": "",
          "Type Of Application": "",
          "Is This Order Through Some Agent": "",
          "Marketing Mangager Name": "",
          "Product Name": "",
          "Quantity": "",
          "Rate Of Material": "",
          "Alumina%": "",
          "Iron%": "",
          "Advance": "",
          "Basic": "",
          "Upload SO": null,
          products: [],
        });
      } else {
        alert("Error submitting form: " + (result.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error submitting form. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    const nextDoNumber = lastDoNumber > 0 ? lastDoNumber + 1 : 1;
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-green-600">Order Successfully Submitted!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">Order has been recorded in the system.</p>
            <p className="text-sm text-gray-500">Last DO Number: DO-{lastDoNumber}</p>
            <Button 
              onClick={() => {
                setSuccess(false);
                const timestamp = generateTimestamp();
                setFormData(prev => ({ ...prev, "Timestamp": timestamp }));
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
          
          {/* BASIC INFORMATION SECTION */}
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
                    {dropdownData.firmNames.length > 0 ? (
                      dropdownData.firmNames.map((firm, index) => (
                        <SelectItem key={index} value={firm}>{firm}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="No data" disabled>No firms found</SelectItem>
                    )}
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

              {/* Party Name Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Party Name *
                </Label>
                <Select
                  value={formData["Party Name"]}
                  onValueChange={(value) => handleInputChange("Party Name", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select Party Name" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.partyNames.length > 0 ? (
                      dropdownData.partyNames.map((party, index) => (
                        <SelectItem key={index} value={party}>{party}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="No data" disabled>
                        {loading ? "Loading..." : "No party names found"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* GST Number */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  GST Number
                </Label>
                <Input
                  value={formData["Gst Number"]}
                  onChange={(e) => handleInputChange("Gst Number", e.target.value)}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter GST number"
                />
              </div>

              {/* Address (auto-filled) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Address
                </Label>
                <Textarea
                  value={formData["Address"]}
                  readOnly
                  className="h-20 border-gray-300 bg-gray-50"
                  placeholder="Auto-filled from Party Name"
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

              {/* Is This Order Through Some Agent */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Is This Order Through Some Agent
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

              {/* Type Of PI */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Type Of PI
                </Label>
                <Select
                  value={formData["Type Of PI"]}
                  onValueChange={(value) => handleInputChange("Type Of PI", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select PI type" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.typeOfPis.length > 0 ? (
                      dropdownData.typeOfPis.map((pi, index) => (
                        <SelectItem key={index} value={pi}>{pi}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="No data" disabled>Loading...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Category */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Customer Category
                </Label>
                <Select
                  value={formData["Customer Category"]}
                  onValueChange={(value) => handleInputChange("Customer Category", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300">
                    <SelectValue placeholder="Select Customer Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.customerCategories.length > 0 ? (
                      dropdownData.customerCategories.map((cat, index) => (
                        <SelectItem key={index} value={cat}>
                          {cat}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Marketing Mangager Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Marketing Mangager Name
                </Label>
                <Select
                  value={formData["Marketing Mangager Name"]}
                  onValueChange={(value) => handleInputChange("Marketing Mangager Name", value)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {dropdownData.marketingMangagerNames.length > 0 ? (
                      dropdownData.marketingMangagerNames.map((manager, index) => (
                        <SelectItem key={index} value={manager}>{manager}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="No data" disabled>
                        {loading ? "Loading..." : "No managers found"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
              {/* Total PO Basic Value (auto-calculated from products) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Total PO Basic Value
                </Label>
                <Input
                  value={formData["Total PO Basic Value"]}
                  readOnly
                  className="h-11 border-gray-300 bg-gray-50"
                  placeholder="Auto-calculated from products"
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
            </div>
          </div>

          {/* PRODUCTS SECTION */}
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
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              Total: ₹{product["Total PO Basic Value"]}
                            </Badge>
                            {product["Type Of Measurement"] && (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                UOM: {product["Type Of Measurement"]}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200">
                              Al₂O₃: {product["Alumina%"]}%
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              Fe₂O₃: {product["Iron%"]}%
                            </Badge>
                            {product["Advance"] && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                Advance: {product["Advance"]}%
                              </Badge>
                            )}
                            {product["Basic"] && (
                              <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                                Basic: {product["Basic"]}%
                              </Badge>
                            )}
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
                            {dropdownData.productNames.length > 0 ? (
                              dropdownData.productNames.map((product, index) => (
                                <SelectItem key={index} value={product}>{product}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="No data" disabled>
                                {loading ? "Loading..." : "No products found"}
                              </SelectItem>
                            )}
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

                      {/* Type Of Measurement */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Type Of Measurement</Label>
                        <Select
                          value={currentProduct["Type Of Measurement"]}
                          onValueChange={(value) => handleProductChange("Type Of Measurement", value)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select UOM" />
                          </SelectTrigger>
                          <SelectContent>
                            {dropdownData.uoms.map((uom, index) => (
                              <SelectItem key={index} value={uom}>
                                {uom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Total PO Basic Value (auto-calculated) */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Total PO Basic Value</Label>
                        <Input
                          value={currentProduct["Total PO Basic Value"]}
                          readOnly
                          className="h-11 border-gray-300 bg-gray-50"
                          placeholder="Auto-calculated"
                        />
                        <p className="text-xs text-gray-500">(Quantity × Rate)</p>
                      </div>

                      {/* Alumina% */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Alumina%</Label>
                        <Input
                          type="number"
                          value={currentProduct["Alumina%"]}
                          onChange={(e) => handleProductChange("Alumina%", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Alumina percentage"
                        />
                      </div>

                      {/* Iron% */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Iron%</Label>
                        <Input
                          type="number"
                          value={currentProduct["Iron%"]}
                          onChange={(e) => handleProductChange("Iron%", e.target.value)}
                          className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                          placeholder="Iron percentage"
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