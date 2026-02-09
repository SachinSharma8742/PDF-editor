import React, { useEffect, useRef } from 'react';
import { Group } from 'react-konva';
import Konva from 'konva';
import type { PDFObject } from '../../../../store/pdfStore';
import { PDFObjectRenderer } from '../PDFObjectRenderer';

interface AdjustmentGroupProps {
    object: PDFObject;
    isSelected: boolean;
    onSelect?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    children: React.ReactNode;
}

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

    const filters: any[] = [];
    const filterProps: any = {};

    if (object.visible !== false) {
        switch (object.effectType) {
            case 'grayscale':
                filters.push(Konva.Filters.Grayscale);
                break;
            case 'invert':
                filters.push(Konva.Filters.Invert);
                break;
            case 'sepia':
                filters.push(Konva.Filters.Sepia);
                break;
            case 'blur':
                filters.push(Konva.Filters.Blur);
                filterProps.blurRadius = (object.effectParams?.value || 0) / 10;
                break;
            case 'brightness':
                filters.push(Konva.Filters.Brighten);
                filterProps.brightness = ((object.effectParams?.value || 100) - 100) / 100;
                break;
            case 'contrast':
                filters.push(Konva.Filters.Contrast);
                filterProps.contrast = (object.effectParams?.value || 100) - 100;
                break;
            case 'bw':
                filters.push(Konva.Filters.Threshold);
                filterProps.threshold = (object.effectParams?.threshold || 128) / 255;
                break;
            case 'scanEnhance':
                filters.push(Konva.Filters.Brighten, Konva.Filters.Contrast);
                filterProps.brightness = ((object.effectParams?.brightness || 1) - 1);
                filterProps.contrast = ((object.effectParams?.contrast || 1) - 1) * 100;
                break;
        }
    }

    return (
        <>
            <Group
                ref={groupRef}
                filters={filters}
                {...filterProps}
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
