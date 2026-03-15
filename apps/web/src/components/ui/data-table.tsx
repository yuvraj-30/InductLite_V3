import * as React from "react";
import { cn } from "@/lib/utils";

const DataTableShell = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("data-table-shell", className)} {...props} />
));

DataTableShell.displayName = "DataTableShell";

const DataTableScroll = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("data-table-scroll", className)} {...props} />
));

DataTableScroll.displayName = "DataTableScroll";

const DataTable = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table ref={ref} className={cn("data-table", className)} {...props} />
));

DataTable.displayName = "DataTable";

const DataTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("data-table-head", className)} {...props} />
));

DataTableHeader.displayName = "DataTableHeader";

const DataTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={cn(className)} {...props} />);

DataTableBody.displayName = "DataTableBody";

const DataTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("data-table-row", className)} {...props} />
));

DataTableRow.displayName = "DataTableRow";

const DataTableHeadCell = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn("data-table-th", className)} {...props} />
));

DataTableHeadCell.displayName = "DataTableHeadCell";

const DataTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("data-table-td", className)} {...props} />
));

DataTableCell.displayName = "DataTableCell";

function DataTableEmptyRow({
  colSpan,
  className,
  children,
}: {
  colSpan: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DataTableRow>
      <DataTableCell colSpan={colSpan} className={cn("data-table-empty", className)}>
        {children}
      </DataTableCell>
    </DataTableRow>
  );
}

export {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
};
