import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel file.
 * @param {Array} data - The array of objects to export.
 * @param {string} fileName - The name of the file (without extension).
 */
export const exportToExcel = (data, fileName = 'export') => {
  if (!data || !data.length) {
    console.error('No data to export');
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  // Generate Excel file and trigger download
  XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};
