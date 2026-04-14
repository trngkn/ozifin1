declare module 'react-quill' {
    import React from 'react';
    export interface ReactQuillProps {
        theme?: string;
        modules?: any;
        formats?: string[];
        value?: string;
        defaultValue?: string;
        placeholder?: string;
        readOnly?: boolean;
        onChange?: (content: string, delta: any, source: any, editor: any) => void;
        className?: string;
        style?: React.CSSProperties;
        onKeyDown?: any;
        onKeyPress?: any;
        onKeyUp?: any;
        onFocus?: any;
        onBlur?: any;
        preserveWhitespace?: boolean;
    }
    export default class ReactQuill extends React.Component<ReactQuillProps> { }
}
