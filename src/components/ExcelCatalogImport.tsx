import ExcelCatalogImportSection from "../features/catalog/excel-import/ExcelCatalogImportSection";

interface ExcelCatalogImportProps {
  supplierId: string;
  supplierName: string;
  onImportComplete: () => void;
}

export function ExcelCatalogImport({
  supplierId,
  supplierName,
  onImportComplete,
}: ExcelCatalogImportProps) {
  return (
    <ExcelCatalogImportSection
      supplierId={supplierId}
      supplierName={supplierName}
      onImportComplete={onImportComplete}
    />
  );
}
