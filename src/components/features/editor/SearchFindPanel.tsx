import React from 'react';
import { SmartSearchPanel } from './SmartSearchPanel';

export interface SearchFindPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SearchFindPanel: React.FC<SearchFindPanelProps> = ({ isOpen, onClose }) => (
    <SmartSearchPanel
        isOpen={isOpen}
        onClose={onClose}
        defaultMode="find"
        allowReplace={false}
    />
);
