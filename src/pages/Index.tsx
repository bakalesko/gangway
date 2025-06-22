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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Download,
  Copy,
  FileText,
  CheckCircle,
  AlertCircle,
  Scan,
  Loader2,
} from "lucide-react";
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

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setTableData(data);
        setAlertMessage({
          type: "success",
          message: "Image scanned successfully with Google Vision API!",
        });
      } else {
        throw new Error("API not available");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      // Fallback to enhanced mock data
      const mockData: TableData = {
        headers: [
          "Sample ID",
          "pH Level",
          "Temperature (°C)",
          "Concentration",
          "Notes",
        ],
        rows: [
          [
            { value: "S001", interpolated: false },
            { value: "7.2", interpolated: true },
            { value: "25.4", interpolated: false },
            { value: "0.5 mg/L", interpolated: false },
            { value: "Normal range", interpolated: false },
          ],
          [
            { value: "S002", interpolated: false },
            { value: "6.8", interpolated: false },
            { value: "24.1", interpolated: true },
            { value: "0.7 mg/L", interpolated: false },
            { value: "Slightly elevated", interpolated: false },
          ],
          [
            { value: "S003", interpolated: false },
            { value: "7.0", interpolated: false },
            { value: "25.8", interpolated: false },
            { value: "0.4 mg/L", interpolated: true },
            { value: "Within range", interpolated: false },
          ],
          [
            { value: "S004", interpolated: false },
            { value: "6.9", interpolated: true },
            { value: "26.2", interpolated: false },
            { value: "0.6 mg/L", interpolated: true },
            { value: "High temp", interpolated: false },
          ],
        ],
      };
      setTableData(mockData);
      setAlertMessage({
        type: "success",
        message: "Demo: Enhanced mock data loaded (API not configured yet)",
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
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to export data");
      }

      // Create download link
      const blob = await response.blob();
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
        message: "Excel file downloaded successfully!",
      });
    } catch (error) {
      console.error("Export Error:", error);
      setAlertMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to download file. Please try again.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
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
                  "border-green-200 bg-green-50 text-green-800",
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

          {/* Actions Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Options
              </CardTitle>
              <CardDescription>
                Copy or download your processed table data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  onClick={copyTableToClipboard}
                  disabled={!tableData}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Table
                </Button>

                <Button
                  onClick={downloadAsExcel}
                  disabled={!tableData || isDownloading}
                  className="w-full"
                  size="lg"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download as .xlsx
                    </>
                  )}
                </Button>

                {tableData && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">
                      Table Information:
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Columns: {tableData.headers.length}</p>
                      <p>Rows: {tableData.rows.length}</p>
                      <p>
                        Interpolated cells:{" "}
                        {
                          tableData.rows
                            .flat()
                            .filter((cell) => cell.interpolated).length
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table Section */}
        {tableData && (
          <Card className="mt-8 shadow-lg">
            <CardHeader>
              <CardTitle>Extracted Table Data</CardTitle>
              <CardDescription>
                Edit any cell values as needed. Cells with light blue background
                were interpolated by OCR.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {tableData.headers.map((header, index) => (
                          <TableHead key={index} className="font-semibold">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell
                              key={cellIndex}
                              className={cn(
                                "p-2",
                                cell.interpolated &&
                                  "bg-blue-50 dark:bg-blue-950/20",
                              )}
                            >
                              <input
                                type="text"
                                value={cell.value}
                                onChange={(e) =>
                                  updateCellValue(
                                    rowIndex,
                                    cellIndex,
                                    e.target.value,
                                  )
                                }
                                className={cn(
                                  "w-full min-w-[100px] px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded",
                                  cell.interpolated &&
                                    "bg-blue-50/50 dark:bg-blue-950/10",
                                )}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
                  <span>Interpolated values</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-background border border-border rounded"></div>
                  <span>Original values</span>
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
