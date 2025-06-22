import React, { useState } from "react";
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

export function InteractiveTable({
  headers,
  rows,
  onCellChange,
}: InteractiveTableProps) {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const copySelectedCells = async () => {
    // Simple copy functionality
    if (selectedCells.size === 0) {
      // Copy entire table
      const headerRow = headers.join("\t");
      const dataRows = rows
        .map((row) => row.map((cell) => cell.value).join("\t"))
        .join("\n");
      const content = `${headerRow}\n${dataRows}`;

      try {
        await navigator.clipboard.writeText(content);
        console.log("Table copied to clipboard");
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    }
  };

  const selectAll = () => {
    const allCells = new Set<string>();
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < rows[row].length; col++) {
        allCells.add(`${row}-${col}`);
      }
    }
    setSelectedCells(allCells);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="overflow-auto max-h-96">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="bg-muted font-semibold text-left border-r border-b border-border p-2"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => {
                  const cellKey = `${rowIndex}-${cellIndex}`;
                  const isSelected = selectedCells.has(cellKey);

                  return (
                    <td
                      key={cellIndex}
                      className={cn(
                        "border-r border-b border-border p-2",
                        cell.interpolated && "bg-blue-50 dark:bg-blue-950/20",
                        isSelected && "bg-primary/20",
                      )}
                      onClick={() => {
                        const newSelection = new Set(selectedCells);
                        if (isSelected) {
                          newSelection.delete(cellKey);
                        } else {
                          newSelection.add(cellKey);
                        }
                        setSelectedCells(newSelection);
                      }}
                    >
                      <input
                        type="text"
                        value={cell.value}
                        onChange={(e) =>
                          onCellChange(rowIndex, cellIndex, e.target.value)
                        }
                        className={cn(
                          "w-full px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded",
                          cell.interpolated &&
                            "bg-blue-50/50 dark:bg-blue-950/10",
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCells.size > 0 && (
        <div className="p-2 bg-muted text-sm text-muted-foreground border-t">
          {selectedCells.size} cell{selectedCells.size !== 1 ? "s" : ""}{" "}
          selected.
          <button
            onClick={copySelectedCells}
            className="ml-2 text-primary hover:underline"
          >
            Copy
          </button>
          <button
            onClick={selectAll}
            className="ml-2 text-primary hover:underline"
          >
            Select All
          </button>
        </div>
      )}
    </div>
  );
}
