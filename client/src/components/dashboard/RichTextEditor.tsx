import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

/**
 * Rich text editor component using TipTap
 * Supports markdown-style formatting and maintains HTML content
 */
const RichTextEditor = ({ content, onChange, placeholder = 'Start typing...' }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none min-h-[100px] focus:outline-none px-3 py-2',
      },
    },
    parseOptions: {
      preserveWhitespace: 'full',
    },
    immediatelyRender: false // Fix for SSR hydration
  })

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className="rich-text-editor">
      <div className="menu border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 flex gap-2">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`p-1 rounded ${editor?.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`p-1 rounded ${editor?.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`p-1 rounded ${editor?.isActive('strike') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1 rounded ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          title="Heading"
        >
          H
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`p-1 rounded ${editor?.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          title="Bullet List"
        >
          •
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`p-1 rounded ${editor?.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          title="Numbered List"
        >
          1.
        </button>
      </div>
      <EditorContent editor={editor} />
      <style jsx global>{`
        .rich-text-editor {
          .ProseMirror {
            min-height: 100px;
            
            &:focus {
              outline: none;
            }
            
            > * + * {
              margin-top: 0.75em;
            }
            
            ul, ol {
              padding: 0 1rem;
            }
            
            h1, h2, h3, h4, h5, h6 {
              line-height: 1.1;
              margin: 1rem 0 0.5rem;
            }
            
            p.is-editor-empty:first-child::before {
              color: #adb5bd;
              content: attr(data-placeholder);
              float: left;
              height: 0;
              pointer-events: none;
            }
          }
        }
      `}</style>
    </div>
  )
}

export default RichTextEditor 