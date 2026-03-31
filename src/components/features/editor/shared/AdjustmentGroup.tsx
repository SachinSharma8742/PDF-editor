import React, { useEffect, useRef, useCallback } from 'react';
import { Group } from 'react-konva';
import Konva from 'konva';
import type { PDFObject } from '../../../../store/pdfStore';
import { PDFObjectRenderer } from '../PDFObjectRenderer';
import { processImageData, resolveParams } from '../../../../utils/effectUtils';

interface AdjustmentGroupProps {
    object: PDFObject;
    isSelected: boolean;
    onSelect?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    children: React.ReactNode;
    contentVersion?: string;
}

/**
 * Custom Konva filter that applies the unified adjustment pipeline.
 * Works on the cached ImageData of a Group node.
 */
const createAdjustmentFilter = (effectParams: Record<string, any>) => {
    return function adjustmentFilter(imageData: ImageData) {
        const params = resolveParams(effectParams || {});
        processImageData(imageData, params);
    };
};

/** Stable serialization of effect params for dependency comparison */
const serializeParams = (params: Record<string, any> | undefined): string => {
    if (!params) return '';
    try { return JSON.stringify(params); } catch { return ''; }
};

export const AdjustmentGroup: React.FC<AdjustmentGroupProps> = ({ object, isSelected, onSelect, children, contentVersion }) => {
    const groupRef = useRef<Konva.Group>(null);
    const cacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevParamsRef = useRef<string>('');

    // Stable cache key based on effect parameters only
    const paramKey = serializeParams(object.effectParams);

    const doCache = useCallback(() => {
        if (!groupRef.current) return;
        try {
            groupRef.current.cache({
                x: 0,
                y: 0,
                width: object.width || 800,
                height: object.height || 1100,
                pixelRatio: 1
            });
            groupRef.current.getLayer()?.batchDraw();
        } catch (e) {
            // Silently fail — cache errors are non-critical
        }
    }, [object.width, object.height]);

    // Re-cache only when effect parameters, visibility, opacity, or the underlying objects actually change
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.clearCache();
            // Debounce the cache to avoid rapid successive calls
            if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current);
            cacheTimerRef.current = setTimeout(doCache, 150);
            prevParamsRef.current = paramKey;
        }
        return () => {
            if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current);
        };
    }, [paramKey, object.opacity, object.visible, doCache, contentVersion]);

    // Build the custom filter based on current params
    const filters: any[] = [];

    if (object.visible !== false && object.effectParams) {
        filters.push(createAdjustmentFilter(object.effectParams));
    }

    return (
        <>
            <Group
                ref={groupRef}
                filters={filters}
                opacity={object.opacity ?? 1}
            >
                {children}
            </Group>
            <PDFObjectRenderer
                object={object}
                isSelected={isSelected}
                onSelect={onSelect}
                isLocked={object.isLocked}
                isSelectionEnabled={!!onSelect}
            />
        </>
    );
};

