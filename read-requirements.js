const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'requirements', 'BGAppWireframe.xlsx');

console.log('Reading Excel file:', filePath);
console.log('='.repeat(80));

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log('\n📊 SHEETS FOUND:', workbook.SheetNames.length);
  console.log('Sheet Names:', workbook.SheetNames.join(', '));
  console.log('\n');

  workbook.SheetNames.forEach((sheetName, index) => {
    console.log('='.repeat(80));
    console.log(`\n📄 SHEET ${index + 1}: ${sheetName}`);
    console.log('-'.repeat(80));
    
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    // Print first 50 rows or all if less
    const maxRows = Math.min(data.length, 50);
    
    if (data.length === 0) {
      console.log('(Empty sheet)');
    } else {
      // Print header row
      if (data[0]) {
        console.log('\nColumns:', data[0].filter(c => c).join(' | '));
        console.log('-'.repeat(80));
      }
      
      // Print data rows
      for (let i = 1; i < maxRows; i++) {
        const row = data[i];
        if (row && row.some(cell => cell !== '')) {
          const rowData = row.map(cell => {
            if (typeof cell === 'string' && cell.length > 50) {
              return cell.substring(0, 47) + '...';
            }
            return cell;
          }).filter((_, idx) => data[0][idx]).join(' | ');
          console.log(`Row ${i}: ${rowData}`);
        }
      }
      
      if (data.length > 50) {
        console.log(`\n... and ${data.length - 50} more rows`);
      }
    }
    
    console.log(`\nTotal rows: ${data.length}`);
    console.log('\n');
  });

} catch (error) {
  console.error('Error reading Excel file:', error.message);
}
