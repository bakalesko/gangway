import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SimpleTable } from "@/components/simple-table";
import {
  Upload,
  Download,
  Copy,
  FileText,
  CheckCircle,
  AlertCircle,
  Scan,
  Loader2,
  Settings,
  MousePointer,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// Type definitions for table data
interface TableCell {
  value: string;
  interpolated?: boolean;
}

interface TableData {
  headers: string[];
  rows: TableCell[][];
}

const Index = () => {
  // State management
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Table configuration
  const [expectedColumns, setExpectedColumns] = useState(13);
  const [expectedRows, setExpectedRows] = useState(24);

  // First and last row anchor values for better interpolation
  const [firstRowValues, setFirstRowValues] = useState("");
  const [lastRowValues, setLastRowValues] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File selection handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
        setAlertMessage(null);
      } else {
        setAlertMessage({
          type: "error",
          message: "Please select a valid file (JPG, PNG, or PDF)",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      const validTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
        setAlertMessage(null);
      } else {
        setAlertMessage({
          type: "error",
          message: "Please select a valid file (JPG, PNG, or PDF)",
        });
      }
    }
  };

  // OCR scan handler
  const handleScanTable = async () => {
    if (!selectedFile) {
      setAlertMessage({
        type: "error",
        message: "Please select a file first",
      });
      return;
    }

    setIsScanning(true);
    setAlertMessage(null);

    try {
      // Try to use the API endpoint first
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("expectedColumns", expectedColumns.toString());
      formData.append("expectedRows", expectedRows.toString());
      if (firstRowValues.trim()) {
        formData.append("firstRowValues", firstRowValues.trim());
      }
      if (lastRowValues.trim()) {
        formData.append("lastRowValues", lastRowValues.trim());
      }

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        if (data.source === "Google Vision API") {
          setTableData(data);
          setAlertMessage({
            type: "success",
            message: "✅ Image scanned successfully with Google Vision API!",
          });
        } else {
          setAlertMessage({
            type: "error",
            message:
              "❌ Cannot process image - Google Vision API not available.",
          });
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown API error" }));

        setAlertMessage({
          type: "error",
          message: "❌ Failed to process image. Please try again.",
        });
      }
    } catch (error) {
      setAlertMessage({
        type: "error",
        message: "❌ Cannot connect to processing server.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Update cell value
  const updateCellValue = (
    rowIndex: number,
    cellIndex: number,
    newValue: string,
  ) => {
    if (!tableData) return;

    const updatedData = { ...tableData };
    updatedData.rows[rowIndex][cellIndex] = {
      ...updatedData.rows[rowIndex][cellIndex],
      value: newValue,
    };
    setTableData(updatedData);
  };

  // Copy table to clipboard
  const copyTableToClipboard = async () => {
    if (!tableData) return;

    try {
      // Create tab-separated values format
      const headers = tableData.headers.join("\t");
      const rows = tableData.rows
        .map((row) => row.map((cell) => cell.value).join("\t"))
        .join("\n");

      const content = `${headers}\n${rows}`;
      await navigator.clipboard.writeText(content);

      setAlertMessage({
        type: "success",
        message: "Table copied to clipboard!",
      });
    } catch (error) {
      setAlertMessage({
        type: "error",
        message: "Failed to copy table to clipboard",
      });
    }
  };

  // Download as Excel
  const downloadAsExcel = async () => {
    if (!tableData) return;

    setIsDownloading(true);
    setAlertMessage(null);

    try {
      // Prepare data in the format expected by the API
      const exportData = [
        // Include headers as first row
        tableData.headers.map((header) => ({
          value: header,
          interpolated: false,
        })),
        // Include all data rows
        ...tableData.rows,
      ];

      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      // Create download link
      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("Generated file is empty");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Extract filename from response headers if available
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `lab-table-export-${new Date().toISOString().split("T")[0]}.xlsx`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setAlertMessage({
        type: "success",
        message: `Excel file "${filename}" downloaded successfully!`,
      });
    } catch (error) {
      setAlertMessage({
        type: "error",
        message: "❌ Excel download failed. Please try again.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              Lab Table Scanner
            </h1>
            <div className="ml-4">
              <ThemeToggle />
            </div>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform handwritten lab tables into digital data. Upload your
            scanned images and get editable, exportable results.
          </p>
        </div>

        {/* Alert Messages */}
        {alertMessage && (
          <div className="mb-6">
            <Alert
              variant={
                alertMessage.type === "error" ? "destructive" : "default"
              }
              className={cn(
                alertMessage.type === "success" &&
                  "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
              )}
            >
              {alertMessage.type === "success" ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{alertMessage.message}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Upload Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Document
              </CardTitle>
              <CardDescription>
                Select a scanned image of your lab table (JPG, PNG, or PDF)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-muted">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {selectedFile
                        ? selectedFile.name
                        : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      JPG, PNG, or PDF up to 10MB
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleScanTable}
                disabled={!selectedFile || isScanning}
                className="w-full mt-6"
                size="lg"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Scan className="mr-2 h-4 w-4" />
                    Scan Table
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Anchor Rows Configuration */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Anchor Rows for Interpolation
              </CardTitle>
              <CardDescription>
                Define first and last row values for better interpolation when
                OCR misses data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Table Configuration */}
              <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-4 w-4" />
                  <Label className="text-sm font-medium">
                    Table Configuration
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="columns"
                      className="text-xs text-muted-foreground"
                    >
                      Columns
                    </Label>
                    <Input
                      id="columns"
                      type="number"
                      min="1"
                      max="50"
                      value={expectedColumns}
                      onChange={(e) =>
                        setExpectedColumns(Number(e.target.value))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="rows"
                      className="text-xs text-muted-foreground"
                    >
                      Rows
                    </Label>
                    <Input
                      id="rows"
                      type="number"
                      min="1"
                      max="100"
                      value={expectedRows}
                      onChange={(e) => setExpectedRows(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Set expected table dimensions for more accurate reading
                </p>
              </div>

              {/* Anchor Values */}
              <div className="space-y-3">
                <div>
                  <Label
                    htmlFor="firstRow"
                    className="text-xs text-blue-700 dark:text-blue-300"
                  >
                    First Row (comma or space separated)
                  </Label>
                  <Input
                    id="firstRow"
                    type="text"
                    placeholder="e.g. 1, 5.2, 10.5, 15.8, ..."
                    value={firstRowValues}
                    onChange={(e) => setFirstRowValues(e.target.value)}
                    className="mt-1 border-blue-200 focus:border-blue-400 dark:border-blue-700"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="lastRow"
                    className="text-xs text-blue-700 dark:text-blue-300"
                  >
                    Last Row (comma or space separated)
                  </Label>
                  <Input
                    id="lastRow"
                    type="text"
                    placeholder="e.g. 24, 127.4, 245.2, 368.9, ..."
                    value={lastRowValues}
                    onChange={(e) => setLastRowValues(e.target.value)}
                    className="mt-1 border-blue-200 focus:border-blue-400 dark:border-blue-700"
                  />
                </div>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                💡 When OCR misses entire rows, these values will be used as
                anchors for interpolation
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Results Table Section */}
        {tableData && (
          <Card className="mt-8 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Extracted Table Data</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Select entire table programmatically
                      const allCells = [];
                      // Add headers
                      for (let col = 0; col < tableData.headers.length; col++) {
                        allCells.push(`-1-${col}`);
                      }
                      // Add all data cells
                      for (let row = 0; row < tableData.rows.length; row++) {
                        for (
                          let col = 0;
                          col < tableData.rows[row].length;
                          col++
                        ) {
                          allCells.push(`${row}-${col}`);
                        }
                      }
                      // Trigger selection via window event
                      window.dispatchEvent(
                        new CustomEvent("selectAllCells", { detail: allCells }),
                      );
                    }}
                  >
                    <MousePointer className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyTableToClipboard}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Table
                  </Button>
                  <Button
                    size="sm"
                    onClick={downloadAsExcel}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="mr-1 h-4 w-4" />
                        Excel
                      </>
                    )}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Drag column/row borders to resize • Select cells with mouse •
                Ctrl+A (select all) • Ctrl+C (copy selection)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InteractiveTable
                headers={tableData.headers}
                rows={tableData.rows}
                onCellChange={updateCellValue}
              />

              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded"></div>
                  <span>Interpolated values</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-background border border-border rounded"></div>
                  <span>Original values</span>
                </div>
                <div className="ml-auto text-xs">
                  📊 {tableData.rows.length} rows × {tableData.headers.length}{" "}
                  columns •{" "}
                  {
                    tableData.rows.flat().filter((cell) => cell.interpolated)
                      .length
                  }{" "}
                  interpolated
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
