import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Plus, Minus } from "lucide-react";

interface TableCell {
  value: string;
  interpolated?: boolean;
}

interface SimpleTableProps {
  headers: string[];
  rows: TableCell[][];
  onCellChange: (rowIndex: number, cellIndex: number, value: string) => void;
  onCopyTable: () => void;
  onDownloadExcel: () => void;
}

export function SimpleTable({
  headers,
  rows,
  onCellChange,
  onCopyTable,
  onDownloadExcel,
}: SimpleTableProps) {
  const [columnWidths, setColumnWidths] = useState<{ [key: number]: number }>(
    {},
  );
  const [rowHeights, setRowHeights] = useState<{ [key: number]: number }>({});

  const getColumnWidth = (index: number) => columnWidths[index] || 120;
  const getRowHeight = (index: number) => rowHeights[index] || 40;

  const adjustColumnWidth = (index: number, delta: number) => {
    const newWidth = Math.max(80, getColumnWidth(index) + delta);
    setColumnWidths((prev) => ({ ...prev, [index]: newWidth }));
  };

  const adjustRowHeight = (index: number, delta: number) => {
    const newHeight = Math.max(30, getRowHeight(index) + delta);
    setRowHeights((prev) => ({ ...prev, [index]: newHeight }));
  };

  const selectAllText = () => {
    const headerRow = headers.join("\t");
    const dataRows = rows
      .map((row) => row.map((cell) => cell.value).join("\t"))
      .join("\n");
    const content = `${headerRow}\n${dataRows}`;

    navigator.clipboard
      .writeText(content)
      .then(() => {
        console.log("Table copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
      });
  };

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={selectAllText} variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-1" />
          Copy All
        </Button>
        <Button onClick={onCopyTable} variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-1" />
          Copy Table
        </Button>
        <Button onClick={onDownloadExcel} size="sm">
          <Download className="h-4 w-4 mr-1" />
          Excel
        </Button>
      </div>

      {/* Column Width Controls */}
      <div className="border rounded-lg p-3 bg-muted/30">
        <h4 className="text-sm font-medium mb-2">Column Widths</h4>
        <div className="flex gap-2 flex-wrap">
          {headers.map((header, index) => (
            <div key={index} className="flex items-center gap-1 text-xs">
              <span className="min-w-[40px]">{header.substring(0, 6)}:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => adjustColumnWidth(index, -10)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[35px] text-center">
                {getColumnWidth(index)}px
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => adjustColumnWidth(index, 10)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto max-h-96 bg-background">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="bg-muted font-semibold text-left border-r border-b border-border p-2 sticky top-0"
                  style={{
                    width: getColumnWidth(index),
                    minWidth: getColumnWidth(index),
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "border-r border-b border-border p-1",
                      cell.interpolated && "bg-blue-50 dark:bg-blue-950/20",
                    )}
                    style={{
                      width: getColumnWidth(cellIndex),
                      height: getRowHeight(rowIndex),
                      minWidth: getColumnWidth(cellIndex),
                    }}
                  >
                    <input
                      type="text"
                      value={cell.value}
                      onChange={(e) =>
                        onCellChange(rowIndex, cellIndex, e.target.value)
                      }
                      className={cn(
                        "w-full h-full px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded text-sm",
                        cell.interpolated &&
                          "bg-blue-50/50 dark:bg-blue-950/10",
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row Height Controls */}
      <div className="border rounded-lg p-3 bg-muted/30">
        <h4 className="text-sm font-medium mb-2">Row Heights</h4>
        <div className="flex gap-2 flex-wrap">
          {rows.slice(0, 5).map((_, index) => (
            <div key={index} className="flex items-center gap-1 text-xs">
              <span className="min-w-[40px]">Row {index + 1}:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => adjustRowHeight(index, -5)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[35px] text-center">
                {getRowHeight(index)}px
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => adjustRowHeight(index, 5)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {rows.length > 5 && (
            <span className="text-xs text-muted-foreground">
              ...and {rows.length - 5} more rows
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-xs text-muted-foreground">
        📊 {rows.length} rows × {headers.length} columns •{" "}
        {rows.flat().filter((cell) => cell.interpolated).length} interpolated
      </div>
    </div>
  );
}
