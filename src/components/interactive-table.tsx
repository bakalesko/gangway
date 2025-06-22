import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TableCell {
  value: string;
  interpolated?: boolean;
}

interface InteractiveTableProps {
  headers: string[];
  rows: TableCell[][];
  onCellChange: (rowIndex: number, cellIndex: number, value: string) => void;
}

interface ColumnWidth {
  [key: number]: number;
}

interface RowHeight {
  [key: number]: number;
}

export function InteractiveTable({
  headers,
  rows,
  onCellChange,
}: InteractiveTableProps) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>({});
  const [rowHeights, setRowHeights] = useState<RowHeight>({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCol, setResizeCol] = useState<number | null>(null);
  const [resizeRow, setResizeRow] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>();

  const getColumnWidth = (index: number) => columnWidths[index] || 120;
  const getRowHeight = (index: number) => rowHeights[index] || 40;

  // Handle column resize
  const handleColumnResizeStart = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeCol(colIndex);

      resizeRef.current = {
        startX: e.clientX,
        startY: 0,
        startWidth: getColumnWidth(colIndex),
        startHeight: 0,
      };
    },
    [getColumnWidth],
  );

  // Handle row resize
  const handleRowResizeStart = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeRow(rowIndex);

      resizeRef.current = {
        startX: 0,
        startY: e.clientY,
        startWidth: 0,
        startHeight: getRowHeight(rowIndex),
      };
    },
    [getRowHeight],
  );

  // Handle mouse move for resizing
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;

      if (resizeCol !== null) {
        const deltaX = e.clientX - resizeRef.current.startX;
        const newWidth = Math.max(50, resizeRef.current.startWidth + deltaX);
        setColumnWidths((prev) => ({ ...prev, [resizeCol]: newWidth }));
      }

      if (resizeRow !== null) {
        const deltaY = e.clientY - resizeRef.current.startY;
        const newHeight = Math.max(30, resizeRef.current.startHeight + deltaY);
        setRowHeights((prev) => ({ ...prev, [resizeRow]: newHeight }));
      }
    },
    [isResizing, resizeCol, resizeRow],
  );

  // Handle mouse up for resizing
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeCol(null);
    setResizeRow(null);
    resizeRef.current = undefined;
  }, []);

  // Cell selection handlers
  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, colIndex: number) => {
      if (e.button !== 0) return; // Only left click

      setIsSelecting(true);
      setSelectionStart({ row: rowIndex, col: colIndex });
      setSelectedCells(new Set([`${rowIndex}-${colIndex}`]));
    },
    [],
  );

  const handleCellMouseEnter = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!isSelecting || !selectionStart) return;

      const startRow = Math.min(selectionStart.row, rowIndex);
      const endRow = Math.max(selectionStart.row, rowIndex);
      const startCol = Math.min(selectionStart.col, colIndex);
      const endCol = Math.max(selectionStart.col, colIndex);

      const newSelection = new Set<string>();
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          newSelection.add(`${r}-${c}`);
        }
      }
      setSelectedCells(newSelection);
    },
    [isSelecting, selectionStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  // Copy selected cells
  const copySelectedCells = useCallback(async () => {
    if (selectedCells.size === 0) return;

    const selectedData: string[][] = [];
    const cellPositions = Array.from(selectedCells)
      .map((cell) => {
        const [row, col] = cell.split("-").map(Number);
        return { row, col };
      })
      .sort((a, b) => a.row - b.row || a.col - b.col);

    // Group by rows
    const rowGroups: { [key: number]: { col: number; value: string }[] } = {};
    cellPositions.forEach(({ row, col }) => {
      if (!rowGroups[row]) rowGroups[row] = [];
      const value = row === -1 ? headers[col] : rows[row]?.[col]?.value || "";
      rowGroups[row].push({ col, value });
    });

    // Convert to TSV format
    const tsvData = Object.keys(rowGroups)
      .sort((a, b) => Number(a) - Number(b))
      .map((rowKey) => {
        const rowData = rowGroups[Number(rowKey)];
        return rowData
          .sort((a, b) => a.col - b.col)
          .map((cell) => cell.value)
          .join("\t");
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(tsvData);
      console.log("Selected cells copied to clipboard");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }, [selectedCells, headers, rows]);

  // Global event listeners
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    if (isSelecting) {
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isSelecting, handleMouseUp]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedCells.size > 0) {
        e.preventDefault();
        copySelectedCells();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [copySelectedCells, selectedCells]);

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="overflow-auto max-h-96 relative">
        <table ref={tableRef} className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="relative bg-muted font-semibold text-left border-r border-b border-border"
                  style={{
                    width: getColumnWidth(index),
                    minWidth: getColumnWidth(index),
                    maxWidth: getColumnWidth(index),
                  }}
                >
                  <div className="p-2 pr-4">{header}</div>

                  {/* Column resize handle */}
                  <div
                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/20 transition-colors"
                    onMouseDown={(e) => handleColumnResizeStart(e, index)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ height: getRowHeight(rowIndex) }}>
                {/* Row resize handle */}
                <td className="absolute left-0 w-full h-px">
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize bg-transparent hover:bg-primary/20 transition-colors"
                    onMouseDown={(e) => handleRowResizeStart(e, rowIndex)}
                  />
                </td>

                {row.map((cell, cellIndex) => {
                  const cellKey = `${rowIndex}-${cellIndex}`;
                  const isSelected = selectedCells.has(cellKey);

                  return (
                    <td
                      key={cellIndex}
                      className={cn(
                        "relative border-r border-b border-border",
                        cell.interpolated && "bg-blue-50 dark:bg-blue-950/20",
                        isSelected && "bg-primary/20 dark:bg-primary/30",
                      )}
                      style={{
                        width: getColumnWidth(cellIndex),
                        height: getRowHeight(rowIndex),
                        minWidth: getColumnWidth(cellIndex),
                        maxWidth: getColumnWidth(cellIndex),
                      }}
                      onMouseDown={(e) =>
                        handleCellMouseDown(e, rowIndex, cellIndex)
                      }
                      onMouseEnter={() =>
                        handleCellMouseEnter(rowIndex, cellIndex)
                      }
                    >
                      <input
                        type="text"
                        value={cell.value}
                        onChange={(e) =>
                          onCellChange(rowIndex, cellIndex, e.target.value)
                        }
                        className={cn(
                          "w-full h-full px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded-none resize-none",
                          cell.interpolated &&
                            "bg-blue-50/50 dark:bg-blue-950/10",
                          isSelected && "bg-transparent",
                        )}
                        style={{
                          height: getRowHeight(rowIndex) - 2,
                          fontSize: "14px",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selection info */}
      {selectedCells.size > 0 && (
        <div className="p-2 bg-muted text-sm text-muted-foreground border-t">
          {selectedCells.size} cell{selectedCells.size !== 1 ? "s" : ""}{" "}
          selected. Press Ctrl+C to copy.
        </div>
      )}
    </div>
  );
}
