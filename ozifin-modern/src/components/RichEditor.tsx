'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

// Dynamic import for ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <div className="h-40 bg-gray-50 animate-pulse rounded-xl border border-gray-200"></div>,
});

interface RichEditorProps {
    content: string;
    onChange: (html: string) => void;
    editable?: boolean;
}

export function RichEditor({ content, onChange, editable = true }: RichEditorProps) {
    // We need to keep local state to avoid cursor jumping issues
    // but we also need to sync with prop if it changes externally (like reset)
    const [value, setValue] = useState(content);

    // Sync local state with content prop if content changes significantly
    // (e.g. reset to empty string)
    useEffect(() => {
        if (content !== value) {
            // Basic check to allow external resets. 
            // In a perfect world we'd diff more intelligently.
            // But for "reset" logic, if content is '' and value is not, we should reset.
            if (content === '' && value !== '') {
                setValue('');
            }
            // If incoming content is different and we aren't editing? 
            // Ideally we trust the parent.
            else if (content !== value) {
                setValue(content);
            }
        }
    }, [content]);

    const handleChange = (content: string) => {
        setValue(content);
        onChange(content);
    };

    const modules = useMemo(() => ({
        toolbar: editable ? [
            [{ 'font': [] }],
            [{ 'size': ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'script': 'sub' }, { 'script': 'super' }],
            [{ 'header': 1 }, { 'header': 2 }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            [{ 'align': [] }],
            ['link', 'image', 'video'],
            ['clean']
        ] : false,
    }), [editable]);

    const formats = [
        'font', 'size',
        'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
        'color', 'background',
        'script', 'header',
        'list', 'indent', 'align',
        'link', 'image', 'video'
    ];

    return (
        <div className={`prose prose-sm sm:prose lg:prose-lg xl:prose-2xl w-full max-w-none 
            ${editable ? 'bg-white' : 'bg-gray-50/50 pointer-events-none'}
            [&_.ql-container]:rounded-b-xl [&_.ql-container]:border-gray-200 [&_.ql-container]:text-base
            [&_.ql-toolbar]:rounded-t-xl [&_.ql-toolbar]:border-gray-200 [&_.ql-toolbar]:bg-gray-50
            [&_.ql-editor]:min-h-[150px]
            [&_.ql-editor_li[data-list="checked"]]:line-through [&_.ql-editor_li[data-list="checked"]]:text-gray-400 [&_.ql-editor_li[data-list="checked"]]:decoration-2
            ${!editable ? '[&_.ql-toolbar]:hidden [&_.ql-container]:rounded-xl [&_.ql-container]:border-transparent' : ''}
        `}>
            <ReactQuill
                theme="snow"
                value={value}
                onChange={handleChange}
                modules={modules}
                formats={formats}
                readOnly={!editable}
                className="w-full"
            />
        </div>
    );
}
