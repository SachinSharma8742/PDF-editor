import React from 'react';
import { SmartSearchPanel } from './SmartSearchPanel';

export interface SearchFindPanelProps {
    isOpen: boolean;
    onClose: () => void;
    defaultMode?: 'find' | 'replace';
    allowReplace?: boolean;
}

export const SearchFindPanel: React.FC<SearchFindPanelProps> = ({
    isOpen,
    onClose,
    defaultMode = 'find',
    allowReplace = false,
}) => (
    <SmartSearchPanel
        isOpen={isOpen}
        onClose={onClose}
        defaultMode={defaultMode}
        allowReplace={allowReplace}
    />
);
