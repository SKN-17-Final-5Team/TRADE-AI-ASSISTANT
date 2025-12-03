import { useEditor, EditorContent, Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { saleContractTemplateHTML } from '../../templates/saleContract'
import EditorToolbar from './EditorToolbar'
import './editor.css'

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
        const handleDelete = (editor: any) => {
            const { state } = editor
            const { selection } = state
            const $from = selection.$from

            for (let d = $from.depth; d > 0; d--) {
                const node = $from.node(d)
                if (node.type.name === 'dataField') {
                    const text = node.textContent
                    const fieldId = node.attrs.fieldId
                    const placeholder = `[${fieldId}]`
                    const pos = $from.before(d)

                    // Already placeholder - prevent any deletion
                    if (text === placeholder) {
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
                            .setTextSelection(pos + 1)
                            .run()
                        return true
                    }
                    break
                }
            }
            return false
        }

        return {
            'Backspace': ({ editor }) => handleDelete(editor),
            'Delete': ({ editor }) => handleDelete(editor),
        }
    },

    addNodeView() {
        return ReactNodeViewRenderer(({ node, getPos, editor }) => {
            const isPlaceholder = node.textContent === `[${node.attrs.fieldId}]`;
            const source = node.attrs.source;

            let bgClass = '';
            if (isPlaceholder) {
                bgClass = 'text-transparent bg-gray-50 hover:bg-gray-100 select-none';
            } else if (source === 'agent') {
                bgClass = 'bg-yellow-100';
            } else if (source === 'mapped') {
                bgClass = 'bg-green-100';
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

export interface ContractEditorRef {
    getContent: () => string
    getJSON: () => object
    setContent: (content: string) => void
    insertContent: (content: string) => void
    replaceSelection: (content: string) => void
    confirmMappedData: () => void
    reviewMappedFields: () => void
}

interface ContractEditorProps {
    initialContent?: string
    onChange?: (content: string) => void
    onMappedFieldsDetected?: (hasMapped: boolean) => void
    className?: string
}

const ContractEditor = forwardRef<ContractEditorRef, ContractEditorProps>(
    ({ initialContent, onChange, onMappedFieldsDetected, className }, ref) => {
        const editor = useEditor({
            extensions: [
                StarterKit.configure({
                    heading: {
                        levels: [1, 2, 3, 4],
                    },
                }),
                Table.configure({
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

                // Check for mapped fields in the current document
                let hasMappedFields = false
                editor.state.doc.descendants((node: any) => {
                    if (node.type.name === 'dataField' && node.attrs.source === 'mapped') {
                        hasMappedFields = true
                        return false
                    }
                })
                onMappedFieldsDetected?.(hasMappedFields)

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

                // 1. Auto-restore empty fields to placeholder
                doc.descendants((node: any, pos: number) => {
                    if (node.type.name === 'dataField') {
                        const fieldId = node.attrs.fieldId
                        const placeholder = `[${fieldId}]`
                        const text = node.textContent

                        if (text === '') {
                            tr.insertText(placeholder, pos + 1, pos + 1)
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: null })
                            modified = true
                        }
                    }
                })

                // 2. Sync same-fieldId nodes (if we're in a dataField)
                if (sourceFieldId && sourceContent !== null) {
                    const isPlaceholder = sourceContent === '' || sourceContent === `[${sourceFieldId}]`
                    const targetValue = isPlaceholder ? `[${sourceFieldId}]` : sourceContent

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
            confirmMappedData: () => {
                if (!editor) return;

                const { state, view } = editor;
                const tr = state.tr;
                let modified = false;

                // Find all mapped fields and remove highlight (set source to null)
                state.doc.descendants((node: any, pos: number) => {
                    if (node.type.name === 'dataField' && node.attrs.source === 'mapped') {
                        tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: null });
                        modified = true;

                        // Also remove any temporary highlight styles
                        const domNode = editor.view.nodeDOM(pos);
                        if (domNode && domNode instanceof HTMLElement) {
                            domNode.style.boxShadow = '';
                            domNode.style.transform = '';
                            domNode.style.transition = '';
                        }
                    }
                });

                if (modified) {
                    view.dispatch(tr);

                    // Force a re-render to ensure HTML attributes are updated
                    setTimeout(() => {
                        const content = editor.getHTML();
                        // Remove data-source="mapped" from HTML
                        const updatedContent = content.replace(/data-source="mapped"/g, '');
                        if (content !== updatedContent) {
                            editor.commands.setContent(updatedContent);
                        }
                    }, 50);
                }
            },
            reviewMappedFields: async () => {
                if (!editor) return;

                const { state } = editor;
                const mappedFieldPositions: { pos: number; fieldId: string; top: number }[] = [];

                // Collect all mapped field positions with their Y coordinates
                state.doc.descendants((node: any, pos: number) => {
                    if (node.type.name === 'dataField' && node.attrs.source === 'mapped') {
                        const domNode = editor.view.nodeDOM(pos);
                        if (domNode && domNode instanceof HTMLElement) {
                            const rect = domNode.getBoundingClientRect();
                            mappedFieldPositions.push({
                                pos,
                                fieldId: node.attrs.fieldId,
                                top: rect.top + window.scrollY
                            });
                        }
                    }
                });

                if (mappedFieldPositions.length === 0) return;

                // Sort by vertical position
                mappedFieldPositions.sort((a, b) => a.top - b.top);

                // Group fields by screen/viewport (within 300px vertical distance)
                const VIEWPORT_THRESHOLD = 150;
                const groups: typeof mappedFieldPositions[] = [];
                let currentGroup: typeof mappedFieldPositions = [mappedFieldPositions[0]];

                for (let i = 1; i < mappedFieldPositions.length; i++) {
                    const prevField = mappedFieldPositions[i - 1];
                    const currentField = mappedFieldPositions[i];

                    // If fields are close together (same screen), add to current group
                    if (Math.abs(currentField.top - prevField.top) < VIEWPORT_THRESHOLD) {
                        currentGroup.push(currentField);
                    } else {
                        // Start a new group
                        groups.push(currentGroup);
                        currentGroup = [currentField];
                    }
                }
                groups.push(currentGroup); // Add last group

                // Sequentially show each group
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    const group = groups[groupIndex];

                    // Scroll to the first field in the group
                    const firstField = group[0];
                    const firstDomNode = editor.view.nodeDOM(firstField.pos);

                    if (firstDomNode && firstDomNode instanceof HTMLElement) {
                        firstDomNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Wait for scroll to complete
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Highlight all fields in this group
                        for (const field of group) {
                            const domNode = editor.view.nodeDOM(field.pos);
                            if (domNode && domNode instanceof HTMLElement) {
                                domNode.style.transition = 'all 0.3s ease';
                                domNode.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.5)';
                                domNode.style.transform = 'scale(1.05)';
                            }
                        }

                        // Wait 1.5 seconds before moving to next group
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }

                // Keep highlights until user confirms
                // Highlights will be removed when user clicks confirm button
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
            <div className={`contract-editor flex flex-col h-full ${className || ''}`}>
                <EditorToolbar editor={editor} />
                <div className="flex-1 border border-gray-200 rounded-b-lg bg-white overflow-y-auto min-h-0">
                    <EditorContent editor={editor} className="h-full" />
                </div>
            </div>
        )
    }
)

ContractEditor.displayName = 'ContractEditor'

export default ContractEditor
