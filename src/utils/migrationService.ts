import JSZip from 'jszip';
import { Buque, RegistroViaje } from '../types';
import { getStandardDateTime } from '../services/storageService';

/**
 * Converts a base64 data URL to a binary Uint8Array for JSZip
 */
function dataURLtoUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const arr = dataUrl.split(',');
    const bstr = atob(arr[1] || arr[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return u8arr;
  } catch (e) {
    console.error('Error converting base64 to uint8array:', e);
    return null;
  }
}

/**
 * Trigger download of a Blob file in the browser
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}

/**
 * Generate CSV text with UTF-8 BOM for direct Microsoft Excel compatibility
 */
export function generateRecordsCSV(buque: Buque, registros: RegistroViaje[]): string {
  const headers = [
    'ID_VIAJE',
    'CORRELATIVO_BASE',
    'BUQUE',
    'MUELLE_OPERACION',
    'PUESTO',
    'UNIDAD_TT_O_PLACA',
    'CONDUCTOR',
    'PRODUCTO_1',
    'BOLSONES_P1',
    'PRODUCTO_2',
    'BOLSONES_P2',
    'TOTAL_BOLSONES',
    'FECHA_HORA_REGISTRO',
    'CANTIDAD_FOTOS_EVIDENCIA',
    'EDITADO_POR_DNI',
    'FECHA_EDICION',
  ];

  const escapeCSV = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = registros.map((r) => {
    let p1 = '';
    let b1 = 0;
    let p2 = '';
    let b2 = 0;

    if (r.itemsProductos && r.itemsProductos.length > 0) {
      p1 = r.itemsProductos[0].producto;
      b1 = r.itemsProductos[0].bolsones;
      if (r.itemsProductos.length > 1) {
        p2 = r.itemsProductos[1].producto;
        b2 = r.itemsProductos[1].bolsones;
      }
    } else {
      p1 = r.productos;
      b1 = r.bolsones;
    }

    return [
      escapeCSV(r.viajeId),
      escapeCSV(r.baseViajeId),
      escapeCSV(r.buqueNombre || buque.nombre),
      escapeCSV(buque.muelle),
      escapeCSV(r.puesto.toUpperCase()),
      escapeCSV(r.tt),
      escapeCSV(r.conductor || '—'),
      escapeCSV(p1),
      escapeCSV(b1),
      escapeCSV(p2 || '—'),
      escapeCSV(b2 || 0),
      escapeCSV(r.bolsones),
      escapeCSV(r.fechaHora),
      escapeCSV(r.fotos ? r.fotos.length : 0),
      escapeCSV(r.editadoPor?.dni || '—'),
      escapeCSV(r.editadoPor?.fechaHora || '—'),
    ].join(';');
  });

  // Include UTF-8 BOM so Excel opens accents correctly
  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Generate a detailed summary text report
 */
function generateSummaryText(buque: Buque, registros: RegistroViaje[]): string {
  const muelleRegs = registros.filter((r) => r.puesto === 'muelle');
  const labartheRegs = registros.filter((r) => r.puesto === 'labarthe');
  const despachoRegs = registros.filter((r) => r.puesto === 'despacho');

  const totalMuelle = muelleRegs.reduce((acc, r) => acc + (r.bolsones || 0), 0);
  const totalLabarthe = labartheRegs.reduce((acc, r) => acc + (r.bolsones || 0), 0);
  const totalDespacho = despachoRegs.reduce((acc, r) => acc + (r.bolsones || 0), 0);

  const totalFotos = registros.reduce((acc, r) => acc + (r.fotos ? r.fotos.length : 0), 0);

  return `=====================================================
INFORME DE MIGRACIÓN Y CIERRE DE OPERACIÓN
SISTEMA DE CONTROL DE DESCARGA Y DESPACHO IQBF
=====================================================

NAVE: ${buque.nombre}
MUELLE ASIGNADO: ${buque.muelle}
FECHA ARRIBO: ${buque.fechaArribo}
FECHA Y HORA DE MIGRACIÓN: ${getStandardDateTime()}
TOTAL REGISTROS AUDITADOS: ${registros.length}
TOTAL FOTOS DE EVIDENCIA ADJUNTAS: ${totalFotos}

-----------------------------------------------------
BALANCE DE CARGA DE BOLSONES:
-----------------------------------------------------
1. MUELLE (Descarga inicial):   ${totalMuelle} bolsones (${muelleRegs.length} viajes TT)
2. LABARTHE (Recepción balanza): ${totalLabarthe} bolsones (${labartheRegs.length} viajes TT)
3. DESPACHO (Salida en camión):  ${totalDespacho} bolsones (${despachoRegs.length} despachos)

DIFERENCIA MUELLE vs LABARTHE: ${totalMuelle - totalLabarthe} bolsones
DIFERENCIA LABARTHE vs DESPACHO: ${totalLabarthe - totalDespacho} bolsones

-----------------------------------------------------
DESGLOSE POR PRODUCTO DECLARADO EN MANIFIESTO:
-----------------------------------------------------
${buque.productos
  .map(
    (p, i) =>
      `${i + 1}. ${p.producto}: Manifiesto ${p.cantidadBuque} bols.`
  )
  .join('\n')}

=====================================================
Generado automáticamente por el Sistema IQBF Terminal
=====================================================
`;
}

/**
 * Execute full vessel migration:
 * 1. Creates a ZIP package named after the vessel.
 * 2. Saves Excel/CSV with all operational records.
 * 3. Saves subfolders: Muelle/, Labarthe/, Despacho/ with all captured photos.
 * 4. Saves summary report.
 * 5. Triggers file download.
 */
export async function executeVesselMigration(
  buque: Buque,
  registros: RegistroViaje[],
  onProgress?: (progress: number, statusText: string) => void
): Promise<{ success: boolean; filename: string; totalPhotos: number }> {
  try {
    const zip = new JSZip();
    const cleanVesselName = buque.nombre.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const zipFileName = `MIGRACION_${cleanVesselName}_${timestampStr}.zip`;

    onProgress?.(10, 'Generando archivo de base de datos Excel / CSV...');

    // 1. Add CSV file
    const csvContent = generateRecordsCSV(buque, registros);
    zip.file(`REGISTROS_${cleanVesselName}.csv`, csvContent);

    // 2. Add Summary text report
    const summaryText = generateSummaryText(buque, registros);
    zip.file(`RESUMEN_CIERRE_${cleanVesselName}.txt`, summaryText);

    // 3. Create folders for evidence images
    const folderMuelle = zip.folder('1_MUELLE_EVIDENCIAS');
    const folderLabarthe = zip.folder('2_LABARTHE_EVIDENCIAS');
    const folderDespacho = zip.folder('3_DESPACHO_EVIDENCIAS');

    onProgress?.(25, 'Empaquetando fotografías de evidencias...');

    let photoCount = 0;
    const totalRegs = registros.length;

    registros.forEach((reg, regIndex) => {
      const targetFolder =
        reg.puesto === 'muelle'
          ? folderMuelle
          : reg.puesto === 'labarthe'
          ? folderLabarthe
          : folderDespacho;

      if (targetFolder && reg.fotos && reg.fotos.length > 0) {
        reg.fotos.forEach((fotoBase64, photoIdx) => {
          const u8Arr = dataURLtoUint8Array(fotoBase64);
          if (u8Arr) {
            const cleanTT = (reg.tt || 'TT').replace(/[^a-zA-Z0-9_-]/g, '_');
            const cleanDate = (reg.fechaHora || '').replace(/[^a-zA-Z0-9_-]/g, '_');
            const photoName = `${cleanTT}_viaje_${reg.viajeId}_foto_${photoIdx + 1}.jpg`;
            targetFolder.file(photoName, u8Arr, { binary: true });
            photoCount++;
          }
        });
      }

      if (totalRegs > 0 && regIndex % 10 === 0) {
        const pct = 25 + Math.round((regIndex / totalRegs) * 45);
        onProgress?.(pct, `Procesando registros (${regIndex + 1}/${totalRegs})...`);
      }
    });

    onProgress?.(75, 'Comprimiendo archivo ZIP con todas las imágenes...');

    const zipBlob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      },
      (metadata) => {
        const pct = 75 + Math.round(metadata.percent * 0.2);
        onProgress?.(pct, `Comprimiendo paquete (${Math.round(metadata.percent)}%)...`);
      }
    );

    onProgress?.(95, 'Iniciando descarga en el navegador...');

    // Download the full ZIP
    triggerFileDownload(zipBlob, zipFileName);

    // Also download the CSV standalone for extra safety
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerFileDownload(csvBlob, `EXCEL_REGISTROS_${cleanVesselName}.csv`);

    onProgress?.(100, '¡Migración completada con éxito!');
    return { success: true, filename: zipFileName, totalPhotos: photoCount };
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
}
