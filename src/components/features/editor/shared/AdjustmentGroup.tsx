import React, { useEffect, useRef } from 'react';
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

export const AdjustmentGroup: React.FC<AdjustmentGroupProps> = ({ object, isSelected, onSelect, children }) => {
    const groupRef = useRef<Konva.Group>(null);

    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.clearCache();
            const timer = setTimeout(() => {
                if (groupRef.current) {
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
                        console.warn("AdjustmentGroup: Cache failed", e);
                    }
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [object.effectParams, object.opacity, object.visible, object.width, object.height, children]);

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
