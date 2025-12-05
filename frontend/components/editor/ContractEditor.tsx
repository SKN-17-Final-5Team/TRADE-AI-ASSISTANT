import { useEditor, EditorContent, Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import FontFamily from '@tiptap/extension-font-family'
import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { saleContractTemplateHTML } from '../../templates/saleContract'
import EditorToolbar from './EditorToolbar'
import './editor.css'

// Custom FontSize Extension
const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        }
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontSize) {
                                return {}
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            }
                        },
                    },
                },
            },
        ]
    },
    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run()
            },
            unsetFontSize: () => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run()
            },
        }
    },
})

const DataField = Node.create({
    name: 'dataField',
    group: 'inline',
    inline: true,
    content: 'text*',

    addAttributes() {
        return {
            fieldId: {
                default: null,
                parseHTML: element => element.getAttribute('data-field-id'),
                renderHTML: attributes => {
                    return {
                        'data-field-id': attributes.fieldId,
                    }
                },
            },
            source: {
                default: null,
                parseHTML: element => element.getAttribute('data-source'),
                renderHTML: attributes => {
                    return {
                        'data-source': attributes.source,
                    }
                },
            },
        }
    },

    parseHTML() {
        return [
            { tag: 'span[data-field-id]' },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'data-field' }), 0]
    },

    // Prevent node deletion - restore placeholder when field would become empty
    addKeyboardShortcuts() {
        const handleDelete = (editor: any, key: string) => { // Added key param
            const { state } = editor
            const { selection } = state
            const { from, to } = selection
            const $from = selection.$from

            // 0. Boundary Checks: If at start/end of field, let browser handle (delete outside)
            if (selection.empty) {
                // If Backspace at start of field (offset 0), we are deleting the char BEFORE the field.
                // We should NOT trap this.
                if (key === 'Backspace' && $from.parentOffset === 0) {
                    return false
                }
                // If Delete at end of field, we are deleting the char AFTER the field.
                if (key === 'Delete' && $from.parent.type.name === 'dataField' && $from.parentOffset === $from.parent.content.size) {
                    return false
                }
            }

            // 1. Check if selection fully covers a dataField (e.g. NodeSelection or full TextSelection)
            let coveredNode: any = null
            let coveredPos: number | null = null

            state.doc.nodesBetween(from, to, (node: any, pos: number) => {
                if (coveredNode) return false
                if (node.type.name === 'dataField') {
                    // Check if fully covered (allow for small margin of error in selection or exact match)
                    if (pos >= from && pos + node.nodeSize <= to) {
                        coveredNode = node
                        coveredPos = pos
                    }
                }
            })

            if (coveredNode && coveredPos !== null) {
                const fieldId = coveredNode.attrs.fieldId
                const placeholder = `[${fieldId}]`
                const targetPos = coveredPos as number // Fix TS error

                // If fully selected, restore placeholder
                editor.chain()
                    .command(({ tr }: any) => {
                        tr.replaceWith(targetPos + 1, targetPos + coveredNode.nodeSize - 1, state.schema.text(placeholder))
                        tr.setNodeMarkup(targetPos, undefined, { ...coveredNode.attrs, source: null })
                        return true
                    })
                    .setTextSelection({ from: targetPos + 1, to: targetPos + 1 + placeholder.length })
                    .run()
                return true
            }

            // 2. Check if cursor is inside a dataField (Original Logic)
            for (let d = $from.depth; d > 0; d--) {
                const node = $from.node(d)
                if (node.type.name === 'dataField') {
                    const text = node.textContent
                    const fieldId = node.attrs.fieldId
                    const placeholder = `[${fieldId}]`
                    const pos = $from.before(d)

                    // Already placeholder - prevent any deletion
                    if (text === placeholder) {
                        // Ensure it is selected so next type overwrites it
                        if (selection.empty) {
                            editor.commands.setTextSelection({ from: pos + 1, to: pos + 1 + placeholder.length })
                        }
                        return true
                    }

                    // Calculate remaining length after delete
                    let remainingLength: number
                    if (!selection.empty) {
                        // Selection delete
                        const nodeStart = pos + 1
                        const nodeEnd = nodeStart + text.length
                        const selStart = Math.max(selection.from, nodeStart)
                        const selEnd = Math.min(selection.to, nodeEnd)
                        remainingLength = text.length - (selEnd - selStart)
                    } else {
                        // Single char delete
                        remainingLength = text.length - 1
                    }

                    // If would become empty, restore placeholder instead
                    if (remainingLength <= 0) {
                        editor.chain()
                            .command(({ tr }: any) => {
                                tr.replaceWith(pos + 1, pos + node.nodeSize - 1, state.schema.text(placeholder))
                                tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: null })
                                return true
                            })
                            .setTextSelection({ from: pos + 1, to: pos + 1 + placeholder.length })
                            .run()
                        return true
                    }
                    break
                }
            }
            return false
        }

        return {
            'Backspace': ({ editor }) => handleDelete(editor, 'Backspace'),
            'Delete': ({ editor }) => handleDelete(editor, 'Delete'),
        }
    },

    addNodeView() {
        return ReactNodeViewRenderer(({ node, getPos, editor }) => {
            const fieldId = node.attrs.fieldId;
            const source = node.attrs.source;
            const textContent = node.textContent;

            // Always show placeholder format
            const displayText = `[${fieldId}]`;
            const isPlaceholder = textContent === displayText;

            let bgClass = '';
            if (source === 'agent') {
                bgClass = 'bg-yellow-50 border border-yellow-200 text-yellow-900 px-1 rounded';
            } else if (source === 'mapped') {
                bgClass = 'bg-green-50 border border-green-200 text-green-900 px-1 rounded';
            } else if (source === 'user') {
                // [CHANGED] User input should be black text, but keep blue bg/border to indicate status
                bgClass = 'bg-blue-50 border border-blue-200 text-gray-900 px-1 rounded';
            } else {
                // Default: show placeholder text always
                bgClass = 'bg-gray-50 border border-gray-300 text-gray-600 px-1 rounded';
            }

            const handleClick = () => {
                if (isPlaceholder && typeof getPos === 'function') {
                    const pos = getPos();
                    if (typeof pos === 'number') {
                        editor.commands.setTextSelection({
                            from: pos + 1,
                            to: pos + node.nodeSize - 1
                        });
                    }
                }
            };

            return (
                <NodeViewWrapper
                    as="span"
                    className={`data-field-node ${bgClass} transition-colors duration-200`}
                    onClick={handleClick}
                    style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
                >
                    {/* Always show the text content */}
                    {/* @ts-ignore */}
                    <NodeViewContent as="span" />
                </NodeViewWrapper>
            )
        })
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('dataFieldProtection'),
                appendTransaction: (transactions, oldState, newState) => {
                    // Check if any transaction modified the document
                    const docChanged = transactions.some(tr => tr.docChanged)
                    if (!docChanged) return null

                    const tr = newState.tr
                    let modified = false

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === 'dataField' && node.content.size === 0) {
                            const fieldId = node.attrs.fieldId
                            const placeholder = `[${fieldId}]`

                            // Restore placeholder
                            tr.insertText(placeholder, pos + 1)
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: null })

                            // Force cursor inside and SELECT the placeholder so typing overwrites it
                            const sel = newState.selection
                            // Check if selection is near the node (inside or at boundaries)
                            if (sel.head >= pos && sel.head <= pos + 1) { // Relaxed check
                                tr.setSelection(TextSelection.create(tr.doc, pos + 1, pos + 1 + placeholder.length))
                            }

                            modified = true
                        }
                    })

                    return modified ? tr : null
                }
            })
        ]
    },
})

// Sync flag to prevent recursive updates
let isSyncing = false

const Div = Node.create({
    name: 'div',
    group: 'block',
    content: 'block+',
    addAttributes() {
        return {
            class: {
                default: null,
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    if (!attributes.class) {
                        return {}
                    }
                    return { class: attributes.class }
                },
            },
            style: {
                default: null,
                parseHTML: element => element.getAttribute('style'),
                renderHTML: attributes => {
                    if (!attributes.style) {
                        return {}
                    }
                    return { style: attributes.style }
                },
            },
        }
    },
    parseHTML() {
        return [
            { tag: 'div' },
        ]
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes), 0]
    },
})

// Row Deletion Detector Extension
const createRowDeletionDetector = (onRowDeleted?: (fieldIds: string[]) => void) => {
    return Extension.create({
        name: 'rowDeletionDetector',

        addProseMirrorPlugins() {
            return [
                new Plugin({
                    key: new PluginKey('rowDeletionDetector'),
                    appendTransaction: (transactions, oldState, newState) => {
                        if (!onRowDeleted) return null

                        // Check if any transaction modified the document
                        const docChanged = transactions.some(tr => tr.docChanged)
                        if (!docChanged) return null

                        // Count rows and collect field IDs in old and new state
                        const oldRows: Array<{ fieldIds: string[] }> = []
                        const newRows: Array<{ fieldIds: string[] }> = []

                        // Collect rows from old state
                        oldState.doc.descendants((node) => {
                            if (node.type.name === 'tableRow') {
                                const fieldIds: string[] = []
                                node.descendants((childNode) => {
                                    if (childNode.type.name === 'dataField') {
                                        const fieldId = childNode.attrs.fieldId
                                        if (fieldId) {
                                            fieldIds.push(fieldId)
                                        }
                                    }
                                })
                                if (fieldIds.length > 0) {
                                    oldRows.push({ fieldIds })
                                }
                            }
                        })

                        // Collect rows from new state
                        newState.doc.descendants((node) => {
                            if (node.type.name === 'tableRow') {
                                const fieldIds: string[] = []
                                node.descendants((childNode) => {
                                    if (childNode.type.name === 'dataField') {
                                        const fieldId = childNode.attrs.fieldId
                                        if (fieldId) {
                                            fieldIds.push(fieldId)
                                        }
                                    }
                                })
                                if (fieldIds.length > 0) {
                                    newRows.push({ fieldIds })
                                }
                            }
                        })

                        // Only proceed if row count decreased (deletion)
                        if (newRows.length >= oldRows.length) {
                            return null
                        }

                        // Find which rows were deleted by comparing field IDs
                        const deletedFieldIds: string[] = []
                        for (const oldRow of oldRows) {
                            // Check if this row exists in new state
                            const rowExists = newRows.some(newRow => {
                                // Row exists if it has at least one matching field ID
                                return newRow.fieldIds.some(newId => oldRow.fieldIds.includes(newId))
                            })

                            if (!rowExists) {
                                // Row was deleted
                                deletedFieldIds.push(...oldRow.fieldIds)
                            }
                        }

                        if (deletedFieldIds.length > 0) {
                            console.log(`🗑️ Row deleted with fields: [${deletedFieldIds.join(', ')}]`)
                            // Call callback asynchronously to avoid transaction conflicts
                            setTimeout(() => {
                                onRowDeleted(deletedFieldIds)
                            }, 0)
                        }

                        return null
                    }
                })
            ]
        }
    })
}

const Checkbox = Node.create({
    name: 'checkbox',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            checked: {
                default: false,
                parseHTML: element => element.hasAttribute('data-checked'),
                renderHTML: attributes => {
                    return {
                        'data-checked': attributes.checked,
                    }
                },
            },
            group: {
                default: null,
                parseHTML: element => element.getAttribute('data-group'),
                renderHTML: attributes => {
                    return {
                        'data-group': attributes.group,
                    }
                },
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span.checkbox-widget',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'checkbox-widget' }), HTMLAttributes.checked ? '[V]' : '[ ]']
    },

    addNodeView() {
        return ReactNodeViewRenderer(({ node, updateAttributes, editor, getPos }) => {
            return (
                <span
                    className="checkbox-widget cursor-pointer select-none font-bold hover:text-blue-600"
                    onClick={() => {
                        const isChecked = !node.attrs.checked;
                        if (isChecked && node.attrs.group) {
                            // Uncheck other checkboxes in the same group
                            editor.state.doc.descendants((descendant: any, pos: number) => {
                                if (descendant.type.name === 'checkbox' &&
                                    descendant.attrs.group === node.attrs.group &&
                                    descendant.attrs.checked &&
                                    pos !== getPos()) {
                                    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...descendant.attrs, checked: false }));
                                }
                                return true;
                            });
                        }
                        updateAttributes({ checked: isChecked });
                    }}
                >
                    {node.attrs.checked ? '[V]' : '[ ]'}
                </span>
            )
        })
    },
})

const Radio = Node.create({
    name: 'radio',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            checked: {
                default: false,
                parseHTML: element => element.classList.contains('checked'),
                renderHTML: attributes => {
                    return {
                        class: `radio-circle ${attributes.checked ? 'checked' : ''}`,
                    }
                },
            },
            group: {
                default: null,
                parseHTML: element => element.getAttribute('data-group'),
                renderHTML: attributes => {
                    return {
                        'data-group': attributes.group,
                    }
                },
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span.radio-circle',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: `radio-circle ${HTMLAttributes.checked ? 'checked' : ''}` })]
    },

    addNodeView() {
        return ReactNodeViewRenderer(({ node, updateAttributes, editor, getPos }) => {
            return (
                <span
                    className={`radio-circle cursor-pointer inline-block w-3 h-3 border border-black rounded-full mx-auto relative ${node.attrs.checked ? 'bg-black' : ''}`}
                    onClick={() => {
                        const isChecked = !node.attrs.checked;
                        if (isChecked && node.attrs.group) {
                            // Uncheck other radios in the same group
                            editor.state.doc.descendants((descendant: any, pos: number) => {
                                if (descendant.type.name === 'radio' &&
                                    descendant.attrs.group === node.attrs.group &&
                                    descendant.attrs.checked &&
                                    pos !== getPos()) {
                                    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...descendant.attrs, checked: false }));
                                }
                                return true;
                            });
                        }
                        updateAttributes({ checked: isChecked });
                    }}
                    style={{ verticalAlign: 'middle' }}
                />
            )
        })
    },
})

export interface FieldChange {
    fieldId: string
    value: string
}

export interface ContractEditorRef {
    getContent: () => string
    getJSON: () => object
    setContent: (content: string) => void
    insertContent: (content: string) => void
    replaceSelection: (content: string) => void
    applyFieldChanges: (changes: FieldChange[]) => void
}

interface ContractEditorProps {
    initialContent?: string
    onChange?: (content: string) => void
    onRowAdded?: (fieldIds: string[]) => void  // Callback when a row is added
    onRowDeleted?: (fieldIds: string[]) => void  // Callback when a row is deleted
    className?: string
    showFieldHighlight?: boolean
    showAgentHighlight?: boolean
    defaultFontFamily?: string
    defaultFontSize?: string
}

const ContractEditor = forwardRef<ContractEditorRef, ContractEditorProps>(
    ({ initialContent, onChange, onRowAdded, onRowDeleted, className, showFieldHighlight = true, showAgentHighlight = true, defaultFontFamily, defaultFontSize }, ref) => {
        const editor = useEditor({
            extensions: [
                StarterKit.configure({
                    heading: {
                        levels: [1, 2, 3, 4],
                    },
                }),
                Table.extend({
                    addCommands() {
                        const parentCommands = this.parent?.() || {}
                        return {
                            ...parentCommands,
                            addRowAfter: () => ({ chain, state, dispatch }) => {
                                console.log('🔵 Custom addRowAfter triggered')
                                const { selection } = state
                                const { $from } = selection

                                // Find the table
                                let tableDepth = -1
                                for (let d = $from.depth; d > 0; d--) {
                                    if ($from.node(d).type.name === 'table') {
                                        tableDepth = d
                                        break
                                    }
                                }

                                const parentAddRowAfter = parentCommands.addRowAfter
                                if (!parentAddRowAfter) {
                                    console.error('❌ Parent addRowAfter not found')
                                    return false
                                }

                                if (tableDepth === -1) {
                                    console.warn('⚠️ Not inside a table')
                                    return chain().command(parentAddRowAfter()).run()
                                }

                                const tableNode = $from.node(tableDepth)

                                // Find template row (LAST row with 4+ dataField nodes)
                                // This ensures we get the actual data row (goods section) instead of header sections
                                let templateRow: any = null
                                let templateRowFieldCount = 0
                                const rows: any[] = []
                                tableNode.forEach((row: any) => {
                                    if (row.type.name === 'tableRow') {
                                        rows.push(row)
                                    }
                                })

                                // Search in reverse to find the last data row
                                for (let i = rows.length - 1; i >= 0; i--) {
                                    const row = rows[i]
                                    let fieldCount = 0
                                    row.descendants((node: any) => {
                                        if (node.type.name === 'dataField') {
                                            fieldCount++
                                        }
                                    })

                                    if (fieldCount >= 4) {
                                        // Skip if this is the Total row
                                        let rowText = ''
                                        row.descendants((node: any) => {
                                            if (node.isText) {
                                                rowText += node.text
                                            }
                                        })
                                        if (rowText.toLowerCase().includes('total')) {
                                            continue
                                        }

                                        templateRow = row
                                        templateRowFieldCount = fieldCount
                                        console.log(`📋 Found template row with ${fieldCount} fields`)
                                        break
                                    }
                                }

                                if (!templateRow) {
                                    console.log('ℹ️ No template row found with data fields (need at least 4)')
                                    return chain().command(parentAddRowAfter()).run()
                                }

                                // Extract field structure from template row
                                const cellFields: Array<{ cellIndex: number, fields: Array<{ fieldId: string, marks: any[] }> }> = []
                                templateRow.forEach((cell: any, cellOffset: number, cellIndex: number) => {
                                    const fields: Array<{ fieldId: string, marks: any[] }> = []
                                    cell.descendants((node: any) => {
                                        if (node.type.name === 'dataField') {
                                            // Get the marks from the text content inside the dataField
                                            const marks: any[] = []
                                            node.content.forEach((textNode: any) => {
                                                if (textNode.marks) {
                                                    marks.push(...textNode.marks)
                                                }
                                            })
                                            fields.push({
                                                fieldId: node.attrs.fieldId,
                                                marks: marks
                                            })
                                        }
                                    })
                                    if (fields.length > 0) {
                                        cellFields.push({ cellIndex, fields })
                                    }
                                })
                                console.log(`📋 Found ${cellFields.length} cells with fields in template`)

                                // Collect all existing field IDs
                                const existingFieldIds = new Set<string>()
                                state.doc.descendants((node: any) => {
                                    if (node.type.name === 'dataField') {
                                        existingFieldIds.add(node.attrs.fieldId)
                                    }
                                })

                                // Helper to get next incremented field ID
                                const getIncrementedFieldId = (baseFieldId: string): string => {
                                    const match = baseFieldId.match(/^(.*)_(\d+)$/)
                                    let baseName = baseFieldId
                                    let startCounter = 2

                                    if (match) {
                                        baseName = match[1]
                                    }

                                    let counter = startCounter
                                    let newId = `${baseName}_${counter}`
                                    while (existingFieldIds.has(newId)) {
                                        counter++
                                        newId = `${baseName}_${counter}`
                                    }
                                    existingFieldIds.add(newId)
                                    return newId
                                }

                                // Instead of using addRowAfter, we'll insert before the last row (Total row)
                                // Find the position right before the last row
                                const lastRowIndex = tableNode.childCount - 1
                                const tableStartPos = $from.start(tableDepth)

                                // Calculate position before the last row
                                let insertPos = tableStartPos
                                for (let i = 0; i < lastRowIndex; i++) {
                                    insertPos += tableNode.child(i).nodeSize
                                }

                                console.log(`📍 Inserting new row before Total row (index ${lastRowIndex}) at pos ${insertPos}`)

                                // Helper to recursively clone nodes and replace dataFields
                                const cloneNode = (node: any): any => {
                                    if (node.type.name === 'dataField') {
                                        // Replace with new incremented dataField
                                        const oldFieldId = node.attrs.fieldId
                                        const newFieldId = getIncrementedFieldId(oldFieldId)
                                        const placeholder = `[${newFieldId}]`

                                        // Clone text content with all marks
                                        const newTextContent: any[] = []
                                        node.content.forEach((textNode: any) => {
                                            newTextContent.push(
                                                state.schema.text(placeholder, textNode.marks)
                                            )
                                        })

                                        return state.schema.nodes.dataField.create(
                                            { ...node.attrs, fieldId: newFieldId },
                                            newTextContent
                                        )
                                    } else if (node.content && node.content.size > 0) {
                                        // Recursively clone children
                                        const children: any[] = []
                                        node.content.forEach((child: any) => {
                                            children.push(cloneNode(child))
                                        })
                                        return node.type.create(node.attrs, children, node.marks)
                                    } else {
                                        // Leaf node - clone as-is
                                        return node.copy(node.content)
                                    }
                                }

                                // Clone entire template row
                                const clonedCells: any[] = []
                                templateRow.forEach((cell: any) => {
                                    clonedCells.push(cloneNode(cell))
                                })

                                const newRow = state.schema.nodes.tableRow.create(
                                    templateRow.attrs,
                                    clonedCells
                                )

                                // Execute: Insert row, then call callback
                                const result = chain()
                                    .command(({ tr }) => {
                                        tr.insert(insertPos, newRow)
                                        console.log('✅ Inserted new row with cloned fields')
                                        return true
                                    })
                                    .run()

                                // Extract new field IDs and call callback
                                if (result && onRowAdded) {
                                    const newFieldIds: string[] = []
                                    newRow.descendants((node: any) => {
                                        if (node.type.name === 'dataField') {
                                            newFieldIds.push(node.attrs.fieldId)
                                        }
                                    })
                                    console.log('📢 Calling onRowAdded with fields:', newFieldIds)
                                    onRowAdded(newFieldIds)
                                }

                                return result
                            },
                        }
                    },
                }).configure({
                    resizable: true,
                    HTMLAttributes: {
                        class: 'contract-table',
                    },
                }),
                TableRow,
                TableCell.extend({
                    addAttributes() {
                        return {
                            ...this.parent?.(),
                            class: {
                                default: null,
                                parseHTML: (element: HTMLElement) => element.getAttribute('class'),
                                renderHTML: (attributes: Record<string, any>) => {
                                    if (!attributes.class) {
                                        return {}
                                    }
                                    return { class: attributes.class }
                                },
                            },
                            style: {
                                default: null,
                                parseHTML: (element: HTMLElement) => element.getAttribute('style'),
                                renderHTML: (attributes: Record<string, any>) => {
                                    if (!attributes.style) {
                                        return {}
                                    }
                                    return { style: attributes.style }
                                },
                            },
                        }
                    },
                }),
                TableHeader.extend({
                    addAttributes() {
                        return {
                            ...this.parent?.(),
                            class: {
                                default: null,
                                parseHTML: (element: HTMLElement) => element.getAttribute('class'),
                                renderHTML: (attributes: Record<string, any>) => {
                                    if (!attributes.class) {
                                        return {}
                                    }
                                    return { class: attributes.class }
                                },
                            },
                            style: {
                                default: null,
                                parseHTML: (element: HTMLElement) => element.getAttribute('style'),
                                renderHTML: (attributes: Record<string, any>) => {
                                    if (!attributes.style) {
                                        return {}
                                    }
                                    return { style: attributes.style }
                                },
                            },
                        }
                    },
                }),
                Placeholder.configure({
                    placeholder: 'Start typing or ask AI for help...',
                }),
                // Underline, // Removed to fix duplicate extension warning
                TextAlign.configure({
                    types: ['heading', 'paragraph'],
                }),
                Highlight.configure({
                    multicolor: true,
                }),
                TextStyle,
                FontFamily,
                FontSize,
                Div,
                Checkbox,
                Radio,
                DataField,
                createRowDeletionDetector(onRowDeleted),
            ],
            content: initialContent || saleContractTemplateHTML,
            editorProps: {
                attributes: {
                    class: 'focus:outline-none min-h-[500px] p-4 w-full',
                },
            },
            onUpdate: ({ editor }) => {
                onChange?.(editor.getHTML())

                // Skip if currently syncing
                if (isSyncing) return

                const { state, view } = editor
                const { selection, doc } = state
                const $from = selection.$from

                // Find the dataField at current selection
                let sourceFieldId: string | null = null
                let sourceContent: string | null = null
                let sourcePos: number | null = null

                for (let d = $from.depth; d > 0; d--) {
                    const node = $from.node(d)
                    if (node.type.name === 'dataField') {
                        sourceFieldId = node.attrs.fieldId
                        sourceContent = node.textContent
                        sourcePos = $from.before(d)
                        break
                    }
                }

                // Build transaction for sync and placeholder restoration
                const tr = state.tr
                let modified = false

                // 1. Auto-restore empty fields to placeholder - REMOVED (Handled by ProseMirror Plugin)
                // The 'dataFieldProtection' plugin in DataField extension now handles this via appendTransaction
                // which prevents the cursor from jumping out.

                // 2. Sync same-fieldId nodes (if we're in a dataField)
                if (sourceFieldId && sourceContent !== null && sourcePos !== null) {
                    const isPlaceholder = sourceContent === '' || sourceContent === `[${sourceFieldId}]`
                    const targetValue = isPlaceholder ? `[${sourceFieldId}]` : sourceContent

                    // Set source to 'user' for the field being edited (if not placeholder)
                    if (!isPlaceholder) {
                        const sourceNode = doc.nodeAt(sourcePos)
                        if (sourceNode && sourceNode.attrs.source !== 'user' && sourceNode.attrs.source !== 'agent') {
                            tr.setNodeMarkup(sourcePos, undefined, { ...sourceNode.attrs, source: 'user' })
                            modified = true
                        }
                    }

                    // Collect nodes to sync (from current state, accounting for any placeholder restorations)
                    const nodesToSync: { pos: number; node: any }[] = []
                    doc.descendants((node: any, pos: number) => {
                        if (node.type.name === 'dataField' &&
                            node.attrs.fieldId === sourceFieldId &&
                            pos !== sourcePos &&
                            node.textContent !== targetValue &&
                            node.textContent !== '') { // Skip empty (will be placeholder-restored)
                            nodesToSync.push({ pos, node })
                        }
                    })

                    // Sort by position descending and apply
                    nodesToSync.sort((a, b) => b.pos - a.pos)
                    for (const { pos, node } of nodesToSync) {
                        tr.replaceWith(pos + 1, pos + node.nodeSize - 1, state.schema.text(targetValue))
                        // Set source to 'mapped' for synced fields (or null for placeholder)
                        tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            source: isPlaceholder ? null : 'mapped'
                        })
                        modified = true
                    }
                }

                if (modified) {
                    isSyncing = true
                    view.dispatch(tr)
                    isSyncing = false
                }
            },
            immediatelyRender: false,
        })

        // Expose methods to parent components via ref
        useImperativeHandle(ref, () => ({
            getContent: () => editor?.getHTML() || '',
            getJSON: () => editor?.getJSON() || {},
            setContent: (content: string) => {
                editor?.commands.setContent(content)
            },
            insertContent: (content: string) => {
                editor?.commands.insertContent(content)
            },
            replaceSelection: (content: string) => {
                editor?.commands.insertContent(content)
            },
            applyFieldChanges: (changes: FieldChange[]) => {
                if (!editor || changes.length === 0) return

                const { state, view } = editor
                const tr = state.tr
                let modified = false

                // Build a map of fieldId -> value for quick lookup
                const changesMap = new Map(changes.map(c => [c.fieldId, c.value]))

                // Collect all nodes to update (in reverse order to avoid position shifts)
                const nodesToUpdate: { pos: number; node: any; newValue: string }[] = []

                state.doc.descendants((node: any, pos: number) => {
                    if (node.type.name === 'dataField') {
                        const fieldId = node.attrs.fieldId
                        if (changesMap.has(fieldId)) {
                            const newValue = changesMap.get(fieldId)!
                            const currentText = node.textContent
                            const placeholder = `[${fieldId}]`

                            // Only update if value is different and not already the same
                            if (currentText !== newValue && newValue !== placeholder) {
                                nodesToUpdate.push({ pos, node, newValue })
                            }
                        }
                    }
                })

                // Sort by position descending to avoid position shifts
                nodesToUpdate.sort((a, b) => b.pos - a.pos)

                // Apply updates
                for (const { pos, node, newValue } of nodesToUpdate) {
                    // Replace text content
                    tr.replaceWith(
                        pos + 1,
                        pos + node.nodeSize - 1,
                        state.schema.text(newValue)
                    )
                    // Set source to 'agent'
                    tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: 'agent' })
                    modified = true
                }

                if (modified) {
                    // Use syncing flag to prevent onUpdate sync loop
                    isSyncing = true
                    view.dispatch(tr)
                    isSyncing = false
                }
            },
        }))

        // Handle keyboard shortcuts
        const handleKeyDown = useCallback((event: KeyboardEvent) => {
            // Cmd/Ctrl + S to save
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault()
                // Trigger save - implement your save logic here
            }
        }, [])

        const hasInitialized = useRef(false);

        // Reset hasInitialized when editor instance changes
        useEffect(() => {
            if (editor) {
                hasInitialized.current = false;
            }
        }, [editor]);

        useEffect(() => {
            if (editor && initialContent !== undefined && !hasInitialized.current) {
                // Only set content on initial mount of this editor instance
                editor.commands.setContent(initialContent);
                hasInitialized.current = true;
            }
        }, [editor, initialContent]);

        useEffect(() => {
            document.addEventListener('keydown', handleKeyDown)
            return () => {
                document.removeEventListener('keydown', handleKeyDown)
            }
        }, [handleKeyDown])

        if (!editor) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            )
        }

        return (
            <div
                className={`contract-editor flex flex-col h-full ${showFieldHighlight ? 'show-field-highlight' : ''} ${showAgentHighlight ? 'show-agent-highlight' : ''} ${className || ''}`}
                onClick={() => {
                    // [CHANGED] Immediate focus on container click
                    if (editor && !editor.isFocused) {
                        editor.chain().focus().run();
                    }
                }}
            >
                <EditorToolbar editor={editor} defaultFontFamily={defaultFontFamily} defaultFontSize={defaultFontSize} />
                <div className="flex-1 border border-gray-200 rounded-b-lg bg-white overflow-y-auto min-h-0 cursor-text">
                    <EditorContent editor={editor} className="h-full" />
                </div>
            </div>
        )
    }
)

ContractEditor.displayName = 'ContractEditor'

export default ContractEditor

