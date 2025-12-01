import { useEditor, EditorContent, Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { saleContractTemplateHTML } from '../../templates/saleContract'
import EditorToolbar from './EditorToolbar'
import './editor.css'
import { NodeSelection } from '@tiptap/pm/state'

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

    addNodeView() {
        return ReactNodeViewRenderer(({ node, getPos, editor }) => {
            const isPlaceholder = node.textContent === `[${node.attrs.fieldId}]`;
            const source = node.attrs.source;

            let bgClass = '';
            if (isPlaceholder) {
                bgClass = 'text-transparent bg-gray-50 hover:bg-gray-100 select-none';
            } else if (source === 'agent') {
                bgClass = 'bg-yellow-100'; // Agent generated
            } else if (source === 'mapped') {
                bgClass = 'bg-green-100'; // Mapped data
            } else {
                bgClass = 'bg-transparent'; // No highlight for user input or confirmed data
            }

            const handleClick = (e: React.MouseEvent) => {
                if (isPlaceholder && typeof getPos === 'function') {
                    // Select the entire text content of the node
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
                Underline,
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
                    class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
                },
            },
            onUpdate: ({ editor }) => {
                onChange?.(editor.getHTML())

                // Check for mapped fields IN THE CURRENT DOCUMENT ONLY
                let hasMappedFields = false;
                editor.state.doc.descendants((node: any) => {
                    if (node.type.name === 'dataField' && node.attrs.source === 'mapped') {
                        hasMappedFields = true;
                        return false; // Stop iteration
                    }
                });

                // Only notify if there are mapped fields in the current document
                onMappedFieldsDetected?.(hasMappedFields);

                // Same-Doc Sync Logic
                const { state, view } = editor;
                const { selection, doc } = state;
                const { from } = selection;

                // 0. Auto-Cleaning & Restoring Logic
                const tr = state.tr;
                let cleaningModified = false;

                // Robust "Subtraction" Cleaning Logic
                // This handles cases where user types inside the placeholder (e.g. "[tag]A" or "[taAg]")
                doc.descendants((node: any, pos: number) => {
                    if (node.type.name === 'dataField') {
                        const fieldId = node.attrs.fieldId;
                        const placeholder = `[${fieldId}]`;
                        const text = node.textContent;

                        // Case 1: Dirty Placeholder (contains [ and ])
                        // If the text is NOT exactly the placeholder, but contains brackets, it's likely a mixed state.
                        if (text !== placeholder && text.includes('[') && text.includes(']')) {
                            // Attempt to extract user input by removing placeholder characters
                            let cleanText = text;
                            // Remove first [ and last ] (or just first ])
                            cleanText = cleanText.replace('[', '').replace(']', '');

                            // Remove fieldId characters sequentially
                            const chars = fieldId.split('');
                            for (const char of chars) {
                                cleanText = cleanText.replace(char, '');
                            }

                            // If cleanText is empty (e.g. user deleted a char from placeholder), restore placeholder
                            // If cleanText is not empty (user typed something), use it.

                            if (cleanText.trim() === '') {
                                // Restore placeholder
                                if (!cleaningModified) {
                                    tr.insertText(placeholder, pos + 1, pos + node.nodeSize - 1);
                                    tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: null });
                                    cleaningModified = true;
                                }
                            } else {
                                // Use the cleaned text
                                if (!cleaningModified) {
                                    tr.insertText(cleanText, pos + 1, pos + node.nodeSize - 1);
                                    cleaningModified = true;
                                }
                            }
                        }
                        // Case 2: Empty Content -> Restore Placeholder
                        else if (text === '') {
                            if (!cleaningModified) {
                                tr.insertText(placeholder, pos + 1, pos + 1);
                                tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: null });
                                cleaningModified = true;
                            }
                        }
                    }
                });

                if (cleaningModified) {
                    view.dispatch(tr);
                    return; // Exit to let the next update cycle handle the rest
                }

                // 1. Identify the "active" field (the one being edited)
                let activeFieldId: string | null = null;
                let activeContent: string | null = null;

                // Check for NodeSelection (when user clicks the field wrapper)
                if (selection instanceof NodeSelection && selection.node.type.name === 'dataField') {
                    activeFieldId = selection.node.attrs.fieldId;
                    activeContent = selection.node.textContent;
                } else {
                    // Resolve position to find parent nodes (TextSelection)
                    const $pos = doc.resolve(from);

                    // Walk up the depth to find 'dataField'
                    for (let d = $pos.depth; d > 0; d--) {
                        const node = $pos.node(d);
                        if (node.type.name === 'dataField') {
                            activeFieldId = node.attrs.fieldId;
                            activeContent = node.textContent;
                            break;
                        }
                    }
                }

                // 2. If we are editing a field, sync others to it
                if (activeFieldId && activeContent !== null) {
                    const tr = state.tr;
                    let modified = false;

                    doc.descendants((node: any, pos: number) => {
                        if (node.type.name === 'dataField' && node.attrs.fieldId === activeFieldId) {
                            // Update if content is different
                            if (node.textContent !== activeContent) {
                                // Replace content of this node
                                tr.insertText(activeContent!, pos + 1, pos + node.nodeSize - 1);
                                // Set source to 'mapped' for other fields
                                tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: 'mapped' });
                                modified = true;
                            }
                        }
                    });

                    // Set source to 'user' for the active field (if it's not already)
                    // We need to find the active node position again or just rely on the fact that we are editing it
                    // Actually, we should update the active node's source to 'user'
                    // But we can't easily find "the" active node if there are multiple.
                    // However, the one where selection is, is the user one.

                    // Let's iterate again or optimize.
                    // Ideally, we update the active node to 'user' and others to 'mapped'.

                    // Optimization: We know the active field ID.
                    // We can just update ALL fields with that ID.
                    // But wait, the one the user is typing in IS the user source.
                    // The others are mapped.
                    // So we need to distinguish the active node from others.

                    // We can use the selection position to identify the active node.
                    // But we are inside onUpdate, so selection is current.

                    // Let's refine the logic:
                    // 1. Find all nodes with activeFieldId.
                    // 2. If node range includes selection.from, it's the USER node -> set source='user'.
                    // 3. Else, it's a MAPPED node -> set source='mapped'.

                    doc.descendants((node: any, pos: number) => {
                        if (node.type.name === 'dataField' && node.attrs.fieldId === activeFieldId) {
                            const isUserNode = (pos <= from && pos + node.nodeSize >= from);
                            const newSource = isUserNode ? 'user' : 'mapped';

                            if (node.attrs.source !== newSource) {
                                tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: newSource });
                                modified = true;
                            }
                        }
                    });

                    if (modified) {
                        view.dispatch(tr);
                    }
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
                console.log('Save triggered')
            }
        }, [])

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
            <div className={`contract-editor flex flex-col h-full w-full ${className || ''}`}>
                <EditorToolbar editor={editor} />
                <div className="flex-1 border border-gray-200 rounded-b-lg bg-white overflow-y-auto min-h-0 w-full">
                    <EditorContent editor={editor} className="h-full w-full" />
                </div>
            </div>
        )
    }
)

ContractEditor.displayName = 'ContractEditor'

export default ContractEditor
