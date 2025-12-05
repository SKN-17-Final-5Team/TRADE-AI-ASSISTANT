# Branch Changelog: feature/text-editor-v2

**Branch:** `feature/text-editor-v2`
**Date:** 2025-12-05
**Author:** Antigravity (AI Assistant)

## Overview
This branch focuses on improving the stability and functionality of the document editor, specifically addressing row synchronization between documents (Offer Sheet <-> Proforma Invoice), automatic calculation of totals, and editor initialization issues.

## Detailed Changes

### 1. Row Synchronization Logic (`frontend/components/document-creation/index.tsx`)
- **Name-Based Field Mapping:** Switched `addRowToDocument` from index-based to name-based field mapping. This ensures fields are correctly mapped even if the field order differs between the source and target documents (e.g., Offer Sheet vs. PI).
- **Improved Template Row Detection:**
  - Implemented logic to explicitly exclude header rows (containing "SENT BY", "SENT TO", "Bill of Lading", "Description of goods") and Total rows from being detected as the data template.
  - Fixed the logic to find the *last* valid data row in `tbody` to use as the template.
- **Correct Insertion Order:** Changed row insertion logic from `insertBefore` (prepend) to `insertBefore(nextSibling)` (append), ensuring new rows are added *after* the existing data rows, preserving chronological order.
- **Auto-Increment Logic:** Added `getNextFieldId` to automatically generate unique field IDs (e.g., `item_no` -> `item_no_2`) when no direct mapping exists or when adding multiple rows.
- **Initial Sync Fix:** Modified `handleRowAdded` to check if the target document exists. If `prev[step]` is undefined, it now hydrates the document from its template before adding the row, preventing data loss during the first sync.

### 2. Row Deletion Synchronization
- **`createRowDeletionDetector` Extension (`frontend/components/editor/ContractEditor.tsx`):**
  - Created a ProseMirror extension to monitor transaction steps for row deletions.
  - Implemented logic to compare row counts and identify deleted nodes by their `data-field-id`.
  - Triggers `onRowDeleted` callback with the IDs of deleted fields.
- **`handleRowDeleted` Handler (`frontend/components/document-creation/index.tsx`):**
  - Implemented `deleteRowFromDocument` helper to parse HTML and remove the `<tr>` containing the matching field IDs.
  - Synchronizes deletions across all linked documents.

### 3. Auto-Calculation (Offer Sheet)
- **DOM-Based Calculation (`frontend/components/document-creation/index.tsx`):**
  - Implemented `calculateTotals` function that parses the editor's HTML content.
  - Sums all `quantity` and `sub_total_price` fields.
  - Updates `total_quantity` and `total_price` fields directly in the DOM.
  - Integrated into `handleEditorChange` to run on every content update.
  - **Safety Mechanism:** Added checks to only update the editor content if the calculated values actually changed, preventing infinite render loops.
- **Removal of Unstable Extension:** Removed the `AutoCalculation` ProseMirror extension from `ContractEditor.tsx` as it caused transaction conflicts and content corruption.

### 4. Template Updates
- **Offer Sheet (`frontend/templates/offerSheet.ts`):**
  - Restored the corrupted `<tfoot>` section to properly display the Total row.
  - Added `[total_quantity]` and `[total_price]` fields with `data-field-id` attributes for auto-calculation.
  - Restored missing `detail-block` (Country of Origin, Shipment, etc.).
- **Proforma Invoice (`frontend/templates/proformaInvoice.ts`):**
  - Changed the "Number of pieces" field from `[quantity]` to `[total_quantity]`.
  - Added `data-field-id="total_quantity"` to enable automatic synchronization with the Offer Sheet's calculated total.

### 5. Editor Stability & Performance (`frontend/components/editor/ContractEditor.tsx`)
- **Initialization Guard:** Implemented `hasInitialized` ref to ensure `editor.commands.setContent` is only called once on mount. This prevents the editor from resetting cursor position or content when `initialContent` is re-evaluated.
- **Memoization:** Wrapped `initialContent` in `useMemo` in `index.tsx` to prevent unnecessary re-computations.

## Files Modified
- `frontend/components/document-creation/index.tsx`
- `frontend/components/editor/ContractEditor.tsx`
- `frontend/templates/offerSheet.ts`
- `frontend/templates/proformaInvoice.ts`

## Technical Impact
- **Reliability:** Row synchronization is now robust against different document structures and initialization states.
- **Data Integrity:** Auto-calculation is performed safely without risking document corruption.
- **User Experience:** Editor no longer flickers or loses cursor position during auto-save or sync operations.
