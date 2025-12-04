import { useEditor, EditorContent, Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import FontFamily from '@tiptap/extension-font-family'
import { useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
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
            const isPlaceholder = node.textContent === `[${node.attrs.fieldId}]`;
            const source = node.attrs.source;

            let bgClass = '';
            if (isPlaceholder) {
                // [CHANGED] Hide text by default (transparent), show on hover. Keep box visible.
                bgClass = 'bg-white border border-gray-300 text-transparent hover:text-gray-400 px-1 rounded';
            } else if (source === 'agent') {
                bgClass = 'bg-yellow-50 border border-yellow-200 text-yellow-900 px-1 rounded';
            } else if (source === 'mapped') {
                bgClass = 'bg-green-50 border border-green-200 text-green-900 px-1 rounded';
            } else if (source === 'user') {
                // [CHANGED] User input should be black text, but keep blue bg/border to indicate status
                bgClass = 'bg-blue-50 border border-blue-200 text-gray-900 px-1 rounded';
            } else {
                bgClass = 'bg-transparent';
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
    className?: string
    showFieldHighlight?: boolean
    showAgentHighlight?: boolean
    defaultFontFamily?: string
    defaultFontSize?: string
}

const ContractEditor = forwardRef<ContractEditorRef, ContractEditorProps>(
    ({ initialContent, onChange, className, showFieldHighlight = true, showAgentHighlight = true, defaultFontFamily, defaultFontSize }, ref) => {
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
                            addRowAfter: () => (props: any) => {
                                console.log('🔵 Custom addRowAfter called')
                                // Call parent addRowAfter first
                                const parentAddRowAfter = parentCommands.addRowAfter
                                if (!parentAddRowAfter) {
                                    console.log('❌ No parent addRowAfter found')
                                    return false
                                }

                                console.log('🔵 Calling parent addRowAfter')
                                const success = parentAddRowAfter()(props)
                                if (!success) {
                                    console.log('❌ Parent addRowAfter failed')
                                    return false
                                }

                                console.log('✅ Parent addRowAfter succeeded, scheduling field population')
                                // Use setTimeout to allow the row to be added first, then populate it
                                setTimeout(() => {
                                    console.log('🔵 Starting field population')
                                    const { editor } = props
                                    const { state: newState } = editor
                                    const { selection } = newState
                                    const { $from } = selection

                                    // Find the table
                                    let tableDepth = -1
                                    for (let d = $from.depth; d > 0; d--) {
                                        if ($from.node(d).type.name === 'table') {
                                            tableDepth = d
                                            break
                                        }
                                    }

                                    if (tableDepth === -1) {
                                        console.log('❌ Not in a table')
                                        return
                                    }
                                    console.log('✅ Found table at depth:', tableDepth)

                                    const tableNode = $from.node(tableDepth)
                                    const tablePos = $from.before(tableDepth)

                                    // Find first data row with field tags
                                    let firstDataRow: any = null

                                    tableNode.forEach((row: any) => {
                                        if (row.type.name === 'tableRow' && !firstDataRow) {
                                            let hasDataFields = false
                                            row.descendants((node: any) => {
                                                if (node.type.name === 'dataField') {
                                                    hasDataFields = true
                                                }
                                            })

                                            if (hasDataFields) {
                                                firstDataRow = row
                                            }
                                        }
                                    })

                                    if (!firstDataRow) {
                                        console.log('❌ No first data row with fields found')
                                        return
                                    }
                                    console.log('✅ Found first data row with fields')

                                    // Find current row (where cursor is - this is the newly added row)
                                    const currentRowIndex = $from.index(tableDepth)
                                    const currentRow = tableNode.child(currentRowIndex)

                                    console.log('📍 Current row index:', currentRowIndex)
                                    console.log('📍 Current row:', currentRow)

                                    // Collect all existing field IDs to determine next increment
                                    const existingFieldIds = new Set<string>()
                                    tableNode.descendants((node: any) => {
                                        if (node.type.name === 'dataField') {
                                            existingFieldIds.add(node.attrs.fieldId)
                                        }
                                    })

                                    // Get next incremented field ID
                                    const getIncrementedFieldId = (baseFieldId: string): string => {
                                        // Remove any existing _N suffix to get the base name
                                        const baseName = baseFieldId.replace(/_\d+$/, '')
                                        let counter = 2
                                        while (existingFieldIds.has(`${baseName}_${counter}`)) {
                                            counter++
                                        }
                                        const newId = `${baseName}_${counter}`
                                        existingFieldIds.add(newId)
                                        return newId
                                    }

                                    // Extract field structure from first data row
                                    const cellFields: Array<{ cellIndex: number, fieldIds: string[] }> = []

                                    firstDataRow.forEach((cell: any, cellOffset: number, cellIndex: number) => {
                                        const fieldIds: string[] = []
                                        cell.descendants((node: any) => {
                                            if (node.type.name === 'dataField') {
                                                fieldIds.push(node.attrs.fieldId)
                                            }
                                        })

                                        if (fieldIds.length > 0) {
                                            cellFields.push({ cellIndex, fieldIds })
                                        }
                                    })

                                    console.log('📊 Extracted cellFields:', cellFields)
                                    console.log('📊 Existing field IDs:', Array.from(existingFieldIds))
                                    if (cellFields.length === 0) {
                                        console.log('❌ No cell fields extracted')
                                        return
                                    }
                                    console.log('✅ Found', cellFields.length, 'cells with fields')

                                    // Build transaction to replace fields in the current (newly added) row
                                    const newTr = newState.tr

                                    // Calculate position of current row
                                    let rowPos = tablePos + 1
                                    for (let i = 0; i < currentRowIndex; i++) {
                                        rowPos += tableNode.child(i).nodeSize
                                    }

                                    console.log('📍 Row position:', rowPos)

                                    // For each cell, replace the existing dataField nodes with incremented ones
                                    cellFields.forEach(({ cellIndex, fieldIds }) => {
                                        const cell = currentRow.child(cellIndex)

                                        // Calculate cell position
                                        let cellPos = rowPos + 1 // +1 for row opening tag
                                        for (let i = 0; i < cellIndex; i++) {
                                            cellPos += currentRow.child(i).nodeSize
                                        }

                                        console.log(`📍 Cell ${cellIndex} position:`, cellPos)

                                        // Find and delete existing dataField nodes in this cell
                                        const nodesToDelete: Array<{ pos: number, size: number }> = []
                                        let currentPos = cellPos + 1 // +1 for cell opening tag

                                        cell.descendants((node: any, pos: number) => {
                                            if (node.type.name === 'dataField') {
                                                nodesToDelete.push({ pos: currentPos + pos, size: node.nodeSize })
                                            }
                                        })

                                        console.log(`🗑️  Nodes to delete in cell ${cellIndex}:`, nodesToDelete)

                                        // Delete in reverse order to maintain positions
                                        for (let i = nodesToDelete.length - 1; i >= 0; i--) {
                                            const { pos, size } = nodesToDelete[i]
                                            newTr.delete(pos, pos + size)
                                        }

                                        // Insert new incremented fields
                                        let insertPos = cellPos + 1 // +1 for cell opening tag

                                        fieldIds.forEach((baseFieldId, idx) => {
                                            const newFieldId = getIncrementedFieldId(baseFieldId)
                                            const placeholder = `[${newFieldId}]`
                                            console.log(`🔧 Creating field: ${baseFieldId} → ${newFieldId} at pos ${insertPos}`)

                                            const dataFieldNode = newState.schema.nodes.dataField.create(
                                                { fieldId: newFieldId, source: null },
                                                newState.schema.text(placeholder)
                                            )

                                            newTr.insert(insertPos, dataFieldNode)
                                            insertPos += dataFieldNode.nodeSize
                                        })
                                    })

                                    console.log('✅ Dispatching transaction')
                                    editor.view.dispatch(newTr)
                                }, 0)

                                return true
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

        useEffect(() => {
            if (editor && initialContent !== undefined && editor.getHTML() !== initialContent) {
                // Force update content
                editor.commands.setContent(initialContent);
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
