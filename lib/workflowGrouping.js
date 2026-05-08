export function groupRowsByPo(
  rows,
  { poNumberKey = "partyPONumber", partyNameKey = "partyName", fallbackKey = "id" } = {}
) {
  const groups = new Map()

  rows.forEach((row, index) => {
    const poNumber = row?.[poNumberKey] || "PO Not Available"
    const partyName = row?.[partyNameKey] || "Party Not Available"
    const fallback = row?.[fallbackKey] ?? index
    const key = `${poNumber}::${partyName}::${fallback}`
    const groupKey =
      poNumber === "PO Not Available" ? key : `${poNumber}::${partyName}`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        poNumber,
        partyName,
        rows: [],
      })
    }

    groups.get(groupKey).rows.push(row)
  })

  return Array.from(groups.values())
}
