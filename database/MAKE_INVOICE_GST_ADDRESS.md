# Make Invoice Module - GST & Address Implementation

## Overview
The Make Invoice module now displays GST Number and Address by joining data from the DISPATCH and ORDER RECEIPT tables.

## Data Join Logic

### Tables Involved
1. **DISPATCH** - Primary table (filtered by `Planned3 IS NOT NULL`)
2. **ORDER RECEIPT** - Joined to get GST Number and Address

### Join Condition
```
DISPATCH["Delivery Order No."] = ORDER RECEIPT["DO-Delivery Order No."]
```

## Implementation Details

### 1. Data Fetching (Lines 31-128)
The `fetchInvoiceData()` function now:
1. Fetches all DISPATCH records where `Planned3` is not null
2. Fetches all ORDER RECEIPT records
3. Creates a Map of Delivery Order No. to GST/Address for quick lookup
4. Joins the data by matching `"Delivery Order No."` with `"DO-Delivery Order No."`
5. Adds `gstNumber` and `address` fields to each order object

### 2. Data Mapping
```javascript
const orderReceiptMap = new Map()
orderReceiptData.forEach(row => {
  const doNumber = row["DO-Delivery Order No."]
  if (doNumber) {
    orderReceiptMap.set(doNumber, {
      gstNumber: row["Gst Number"] || "",
      address: row["Address"] || ""
    })
  }
})
```

### 3. Order Object Structure
Each order now includes:
```javascript
{
  // ... existing fields
  gstNumber: orderReceiptInfo.gstNumber || "N/A",
  address: orderReceiptInfo.address || "N/A",
  // ... more fields
}
```

## Table Display

### Column Order (12 columns for pending, 11 for history)
1. **Action** (pending only)
2. LGST-Sr
3. DO No.
4. Party Name
5. Product Name
6. Truck Qty
7. Type Of Transporting
8. **GST Number** ← NEW!
9. **Address** ← NEW!
10. Transporter
11. Truck No
12. Planned

### Column Specifications

#### GST Number Column
- **Width**: min-width 150px
- **Display**: Font-mono, text-xs for better readability
- **Truncation**: Truncates at 150px width
- **Source**: `ORDER RECEIPT["Gst Number"]`
- **Fallback**: Shows "N/A" if not found

#### Address Column
- **Width**: min-width 200px (wider for address text)
- **Display**: Truncates at 200px width
- **Tooltip**: Shows full address on hover via `title` attribute
- **Source**: `ORDER RECEIPT["Address"]`
- **Fallback**: Shows "N/A" if not found

## Data Flow

```
User Opens Make Invoice Module
        ↓
fetchInvoiceData() is called
        ↓
Fetch DISPATCH table (where Planned3 IS NOT NULL)
        ↓
Fetch ORDER RECEIPT table
        ↓
Create orderReceiptMap (DO Number → {gstNumber, address})
        ↓
For each DISPATCH record:
  - Get Delivery Order No.
  - Lookup in orderReceiptMap
  - Add gstNumber and address to order object
        ↓
Display in table with GST Number and Address columns
```

## Example Join

### DISPATCH Record
```javascript
{
  "Delivery Order No.": "DO-2024-001",
  "Party Name": "ABC Company",
  // ... other fields
}
```

### ORDER RECEIPT Record
```javascript
{
  "DO-Delivery Order No.": "DO-2024-001",
  "Gst Number": "27AABCU9603R1ZM",
  "Address": "123 Main Street, Mumbai, Maharashtra",
  // ... other fields
}
```

### Resulting Display
| DO No. | Party Name | GST Number | Address |
|--------|------------|------------|---------|
| DO-2024-001 | ABC Company | 27AABCU9603R1ZM | 123 Main Street, Mumbai... |

## Error Handling
- If ORDER RECEIPT fetch fails, logs error to console but continues with DISPATCH data
- If no matching DO Number found, displays "N/A" for GST and Address
- Gracefully handles null/empty values

## Performance Considerations
- Uses Map for O(1) lookup performance
- Single query for each table (no N+1 queries)
- Efficient memory usage with Map data structure

## Module Isolation
✅ Changes are **ONLY** applied to Make Invoice module (`InvoicePage.jsx`)
✅ No other modules were modified
✅ No database schema changes required
