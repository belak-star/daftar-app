// src/core/excel.js
// Gère l'exportation des données vers des fichiers Excel (.xlsx)

export function exportToExcel(data, filename, sheetName = 'Données') {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات لتصديرها.');
    return;
  }

  try {
    // Création de la feuille de calcul
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Création du classeur (workbook)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Ajustement automatique de la largeur des colonnes (pour que ce soit lisible)
    const colWidths = [];
    for (const key in data[0]) {
      colWidths.push({ wch: Math.max(key.length, 15) }); // Largeur min de 15
    }
    ws['!cols'] = colWidths;

    // Déclenchement du téléchargement
    XLSX.writeFile(wb, filename + '.xlsx');
    
  } catch (error) {
    console.error('Erreur lors de l\'export Excel:', error);
    alert('حدث خطأ أثناء محاولة تصدير الملف.');
  }
}