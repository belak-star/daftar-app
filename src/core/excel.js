// src/core/excel.js
// Exporte des données vers un fichier Excel.

/**
 * Crée et télécharge un fichier Excel.
 * @param {Array} rows - Tableau d'objets (ex: [{Nom: "Ahmed", Classe: "7A"}])
 * @param {string} sheetName - Nom de la feuille Excel
 * @param {string} fileName - Nom du fichier (sans .xlsx)
 */
export function exportExcel(rows, sheetName, fileName) {
  if (typeof XLSX === 'undefined') {
    alert('مكتبة Excel غير محملة. تحقق من الاتصال بالإنترنت.');
    return;
  }

  if (!rows || rows.length === 0) {
    alert('لا توجد بيانات للتصدير.');
    return;
  }

  // Crée un classeur
  const wb = XLSX.utils.book_new();

  // Convertit les données en feuille
  const ws = XLSX.utils.json_to_sheet(rows);

  // Ajoute la feuille au classeur
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');

  // Télécharge le fichier
  const safeName = (fileName || 'export').replace(/[\\/:*?"<>|]/g, '_');
  XLSX.writeFile(wb, safeName + '.xlsx');
}