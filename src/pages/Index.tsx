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
  Settings,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  const [errorLogs, setErrorLogs] = useState<string[]>([]);

  // Table configuration
  const [expectedColumns, setExpectedColumns] = useState(13);
  const [expectedRows, setExpectedRows] = useState(24);

  // First and last row anchor values for better interpolation
  const [firstRowValues, setFirstRowValues] = useState("");
  const [lastRowValues, setLastRowValues] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check system status
  const checkSystemStatus = async () => {
    addErrorLog("🔍 Checking system status...");

    try {
      // Test basic connectivity first
      const response = await fetch("/api/health");

      if (response.ok) {
        addErrorLog("✅ API server is reachable");

        // In development mode, API endpoints might not work properly
        // but the credentials should be configured in the build process
        addErrorLog("💡 Development mode detected");
        addErrorLog("📋 API endpoints are designed for production (Vercel)");
        addErrorLog(
          "🧪 Test with actual image upload to verify Google Vision API",
        );
      } else {
        addErrorLog(
          `❌ API server returned ${response.status}: ${response.statusText}`,
        );
        addErrorLog("⚠️ This is expected in development mode");
        addErrorLog("🚀 Deploy to Vercel to test full functionality");
      }
    } catch (error) {
      addErrorLog("⚠️ API endpoints not available in development mode");
      addErrorLog(
        "💡 This is normal - the app is configured for Vercel deployment",
      );
      addErrorLog("🧪 Try uploading an image to test Google Vision API");
      addErrorLog("🚀 For full testing, deploy to Vercel");
    }
  };

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

  // Add error to log
  const addErrorLog = (error: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setErrorLogs((prev) => [`[${timestamp}] ${error}`, ...prev.slice(0, 9)]);
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
          // API returned mock data, log the errors
          const debug = data.debug || {};
          const errorDetails = [];

          if (!debug.credentialsFound) {
            errorDetails.push("Google Cloud credentials not configured");
          }
          if (!debug.useRealAPI) {
            errorDetails.push("Failed to connect to Google Vision API");
          }

          const mainError = `Google Vision API connection failed: ${errorDetails.join(", ")}`;
          addErrorLog(mainError);

          setAlertMessage({
            type: "error",
            message:
              "❌ Cannot process image - Google Vision API not available. Check error log below.",
          });
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown API error" }));
        const errorMsg = `API request failed: ${errorData.error || response.statusText}`;
        addErrorLog(errorMsg);

        setAlertMessage({
          type: "error",
          message:
            "��� Failed to process image. Check error log below for details.",
        });
      }
    } catch (error) {
      const errorMsg = `Network error: ${error instanceof Error ? error.message : "Unknown error"}`;
      addErrorLog(errorMsg);

      setAlertMessage({
        type: "error",
        message:
          "❌ Cannot connect to processing server. Check error log below.",
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
        const errorMsg = `Excel export failed (${response.status}): ${errorData.error || response.statusText}`;
        addErrorLog(errorMsg);
        throw new Error(errorData.error || "Failed to export data");
      }

      // Check if response is actually Excel file
      const contentType = response.headers.get("Content-Type");
      if (
        !contentType?.includes("spreadsheetml") &&
        !contentType?.includes("excel")
      ) {
        const errorMsg = `Invalid response type: ${contentType}. Expected Excel file.`;
        addErrorLog(errorMsg);
        throw new Error("Server returned invalid file format");
      }

      // Create download link
      const blob = await response.blob();

      if (blob.size === 0) {
        const errorMsg = "Excel export returned empty file";
        addErrorLog(errorMsg);
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
      console.error("Export Error:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Unknown download error";
      addErrorLog(`Excel download failed: ${errorMsg}`);

      setAlertMessage({
        type: "error",
        message: "❌ Excel download failed. Check error log below for details.",
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

              {/* Table Configuration */}
              <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-4 w-4" />
                  <Label className="text-sm font-medium">
                    Конфигуриране на таблицата
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="columns"
                      className="text-xs text-muted-foreground"
                    >
                      Колони
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
                      Редове
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
                  Задайте очакваните размери на таблицата за по-точно разчитане
                </p>
              </div>

              {/* Anchor Rows Configuration */}
              <div className="mt-4 p-4 bg-blue-50/50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium text-blue-900">
                    Котвени редове за интерполация
                  </Label>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="firstRow" className="text-xs text-blue-700">
                      Първи ред (разделени с комa или интервал)
                    </Label>
                    <Input
                      id="firstRow"
                      type="text"
                      placeholder="напр. 1, 5.2, 10.5, 15.8, ..."
                      value={firstRowValues}
                      onChange={(e) => setFirstRowValues(e.target.value)}
                      className="mt-1 border-blue-200 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastRow" className="text-xs text-blue-700">
                      Последен ред (разделени с комa или интервал)
                    </Label>
                    <Input
                      id="lastRow"
                      type="text"
                      placeholder="напр. 24, 127.4, 245.2, 368.9, ..."
                      value={lastRowValues}
                      onChange={(e) => setLastRowValues(e.target.value)}
                      className="mt-1 border-blue-200 focus:border-blue-400"
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  💡 Когато OCR пропусне цели редове, тези стойности ще се
                  използват като котви за интерполация
                </p>
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

        {/* Error Log Section - Always visible now for debugging */}
        <Card className="mt-8 shadow-lg border-orange-200">
          <CardHeader className="bg-orange-50">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              System Status & Error Log
              <div className="ml-auto flex gap-2">
                <Button onClick={checkSystemStatus} variant="outline" size="sm">
                  Check System Status
                </Button>
                {errorLogs.length > 0 && (
                  <Button
                    onClick={() => setErrorLogs([])}
                    variant="outline"
                    size="sm"
                  >
                    Clear Log
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription className="text-orange-600">
              {errorLogs.length > 0
                ? "Connection and processing errors are logged here for debugging"
                : "No errors logged yet. Click 'Check System Status' to test the connection."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {errorLogs.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
                {errorLogs.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      "text-sm font-mono p-2 border rounded",
                      log.includes("✅")
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800",
                    )}
                  >
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mb-4 p-3 bg-gray-50 border rounded">
                No system errors recorded. Use the "Check System Status" button
                to test connectivity.
              </div>
            )}

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Troubleshooting steps:</strong>
              </p>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                <li>
                  • <strong>For Google Vision API:</strong> Check if credentials
                  are configured in environment variables
                </li>
                <li>
                  • <strong>For Excel export:</strong> Ensure the API server is
                  running and accessible
                </li>
                <li>
                  • <strong>For image processing:</strong> Try different image
                  formats (JPG, PNG, PDF)
                </li>
                <li>
                  • <strong>Network issues:</strong> Check browser developer
                  console for additional errors
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
