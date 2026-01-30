import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Image as KonvaImage, Transformer } from 'react-konva';
import { usePDFStore } from '../../../store/pdfStore';
import useImage from 'use-image'; // You might need to install this or write a custom hook

// Helper to load image for Konva
const URLImage = ({ image, date, isSelected, onSelect, onChange }: any) => {
    const [img] = useImage(image.url);
    const shapeRef = useRef<any>(null);
    const trRef = useRef<any>(null);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    return (
        <>
            <KonvaImage
                onClick={onSelect}
                onTap={onSelect}
                ref={shapeRef}
                image={img}
                x={image.x}
                y={image.y}
                width={image.width}
                height={image.height}
                rotation={image.rotation}
                draggable
                onDragEnd={(e) => {
                    onChange({
                        ...image,
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={(e) => {
                    const node = shapeRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    // Reset scale to 1 and adjust width/height
                    node.scaleX(1);
                    node.scaleY(1);

                    onChange({
                        ...image,
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                        rotation: node.rotation(),
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        // Limit minimum size
                        if (newBox.width < 5 || newBox.height < 5) {
                            return oldBox;
                        }
                        return newBox;
                    }}
                />
            )}
        </>
    );
};

interface CanvasLayerProps {
    pageNumber: number;
    width: number;
    height: number;
    scale: number;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({ pageNumber, width, height, scale }) => {
    const {
        pages,
        activeTool,
        brushColor,
        brushSize,
        addDrawingLine,
        updateImagePosition
    } = usePDFStore();

    const page = pages.find(p => p.pageNumber === pageNumber);
    const [isDrawing, setIsDrawing] = React.useState(false);
    const [selectedImageId, setSelectedImageId] = React.useState<string | null>(null);

    if (!page) return null;

    const handleMouseDown = (e: any) => {
        // Deselect image if clicking on empty area
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            setSelectedImageId(null);
        }

        if (activeTool === 'select') return; // Only draw if tool is active

        setIsDrawing(true);
        const pos = e.target.getStage().getPointerPosition();
        if (!pos) return;

        // Start a new line
        addDrawingLine(pageNumber, {
            points: [pos.x / scale, pos.y / scale], // Store normalized coordinates
            color: activeTool === 'eraser' ? '#ffffff' : brushColor,
            width: brushSize,
            tool: activeTool
        });
    };

    const handleMouseMove = (e: any) => {
        if (!isDrawing || activeTool === 'select') return;

        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        if (!point) return;

        // Update last line
        const lastLine = page.lines[page.lines.length - 1];
        if (lastLine) {
            // We create a new array to trigger re-render properly in zustand/react
            const newPoints = lastLine.points.concat([point.x / scale, point.y / scale]);

            // NOTE: deeply updating partial array in store is tricky. 
            // Ideally we'd have an 'updateLastLine' action. 
            // For now, we hack it by just replacing the line locally? No, must go through store.
            // Optimization: In real app, use local state for current line, then commit to store onMouseUp.
            // For this MVP, we will commit to store onMouseUp and draw local line temporarily?
            // Actually, let's keep it simple: we need an action 'appendPointToLastLine'
        }
    };

    // Since updating store on every move is expensive, let's interpret lines locally or 
    // better: Use local state for the CURRENT line being drawn, then add to store on MouseUp.
    const [currentLine, setCurrentLine] = React.useState<any>(null);

    const handleLocalMouseDown = (e: any) => {
        if (selectedImageId && activeTool === 'select') {
            // If we are in select mode and have an image selected, check if we clicked on it? 
            // Handled by Image onClick.
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) setSelectedImageId(null);
            return;
        }

        if (activeTool === 'select') {
            setSelectedImageId(null);
            return;
        }

        setIsDrawing(true);
        const pos = e.target.getStage().getPointerPosition();
        if (!pos) return;
        setCurrentLine({
            points: [pos.x / scale, pos.y / scale],
            color: activeTool === 'eraser' ? '#ffffff' : brushColor,
            width: brushSize,
            tool: activeTool
        });
    };

    const handleLocalMouseMove = (e: any) => {
        if (!isDrawing || !currentLine) return;

        const point = e.target.getStage().getPointerPosition();
        if (!point) return;
        setCurrentLine({
            ...currentLine,
            points: [...currentLine.points, point.x / scale, point.y / scale]
        });
    };

    const handleLocalMouseUp = () => {
        if (currentLine) {
            addDrawingLine(pageNumber, currentLine);
            setCurrentLine(null);
        }
        setIsDrawing(false);
    };

    return (
        <div className="absolute inset-0 z-10 pointer-events-auto">
            <Stage
                width={width}
                height={height}
                onMouseDown={handleLocalMouseDown}
                onMouseMove={handleLocalMouseMove}
                onMouseUp={handleLocalMouseUp}
                onTouchStart={handleLocalMouseDown}
                onTouchMove={handleLocalMouseMove}
                onTouchEnd={handleLocalMouseUp}
                scaleX={scale}
                scaleY={scale}
            >
                <Layer>
                    {/* Render existing lines */}
                    {page.lines.map((line, i) => (
                        <Line
                            key={i}
                            points={line.points}
                            stroke={line.color}
                            strokeWidth={line.width}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            globalCompositeOperation={
                                line.tool === 'eraser' ? 'destination-out' : 'source-over'
                            }
                        />
                    ))}

                    {/* Render current line being drawn */}
                    {currentLine && (
                        <Line
                            points={currentLine.points}
                            stroke={currentLine.color}
                            strokeWidth={currentLine.width}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            globalCompositeOperation={
                                currentLine.tool === 'eraser' ? 'destination-out' : 'source-over'
                            }
                        />
                    )}

                    {/* Render Images */}
                    {page.images && page.images.map((img) => (
                        <URLImage
                            key={img.id}
                            image={img}
                            isSelected={img.id === selectedImageId}
                            onSelect={() => {
                                if (activeTool === 'select') setSelectedImageId(img.id);
                            }}
                            onChange={(newAttrs: any) => {
                                updateImagePosition(pageNumber, img.id, newAttrs);
                            }}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};
