import {
    RotateCw, MoveHorizontal, MoveVertical, AlignVerticalSpaceAround,
    ArrowUpCircle, Eraser,
    Sun, Contrast, Droplet, Moon, Coffee, Shuffle, Crop
} from 'lucide-react';

export interface ImageTool {
    id: string;
    label: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: React.ComponentType<{ size?: number; className?: string } & Record<string, any>>;
    category: 'transform' | 'adjust' | 'effects' | 'tools'; // Crop is special
    type: 'button' | 'toggle' | 'slider';
    operationKey?: string; // Key in store operations (e.g. 'transform.rotate') or handler key
    oneTime?: boolean; // If true, typically resets after action or is a single-fire event
    sliderConfig?: { min: number; max: number; step: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    disabledIf?: (ops: Record<string, any>, state: Record<string, boolean>) => boolean;
}

// Crop icon export for use in the sidebar tab rail
export { Crop as CropIcon };

export const IMAGE_TOOLS: ImageTool[] = [
    // --- Transform ---
    {
        id: 'rotate',
        label: 'Rotate',
        icon: RotateCw,
        category: 'transform',
        type: 'button',
        operationKey: 'rotate90',
        oneTime: true
    },
    {
        id: 'flipX',
        label: 'Flip X',
        icon: MoveHorizontal,
        category: 'transform',
        type: 'toggle',
        operationKey: 'transform.flipX'
    },
    {
        id: 'flipY',
        label: 'Flip Y',
        icon: MoveVertical,
        category: 'transform',
        type: 'toggle',
        operationKey: 'transform.flipY'
    },
    {
        id: 'deskew',
        label: 'Deskew',
        icon: AlignVerticalSpaceAround,
        category: 'transform',
        operationKey: 'cleanup.deskew',
        type: 'toggle',
        disabledIf: (_ops, state) => state.isDeskewing
    },
    {
        id: 'bgRemoval',
        label: 'Remove BG',
        icon: Eraser,
        category: 'tools', // Moved from Transform
        type: 'button',
        operationKey: 'bgRemoval', // Custom handler
        oneTime: true,
        disabledIf: (ops, state) => ops.cleanup.backgroundRemoved || state.isBgProcessing
    },
    {
        id: 'upscale',
        label: 'Upscale',
        icon: ArrowUpCircle,
        category: 'tools', // Moved from Transform
        type: 'button',
        operationKey: 'enhance.upscale',
        disabledIf: (ops, state) => ops.enhance.upscale || state.isUpscaling
    },


    // --- Adjust ---
    {
        id: 'brightness',
        label: 'Brightness',
        icon: Sun,
        category: 'adjust',
        type: 'slider',
        operationKey: 'adjust.brightness',
        sliderConfig: { min: -1, max: 1, step: 0.05 }
    },
    {
        id: 'contrast',
        label: 'Contrast',
        icon: Contrast,
        category: 'adjust',
        type: 'slider',
        operationKey: 'adjust.contrast',
        sliderConfig: { min: -100, max: 100, step: 5 }
    },
    {
        id: 'saturation',
        label: 'Saturation',
        icon: Droplet,
        category: 'adjust',
        type: 'slider',
        operationKey: 'adjust.saturation',
        sliderConfig: { min: -2, max: 10, step: 0.1 }
    },

    // --- Effects ---
    {
        id: 'grayscale',
        label: 'Grayscale',
        icon: Moon,
        category: 'effects',
        type: 'toggle',
        operationKey: 'effects.grayscale'
    },
    {
        id: 'sepia',
        label: 'Sepia',
        icon: Coffee,
        category: 'effects',
        type: 'toggle',
        operationKey: 'effects.sepia'
    },
    {
        id: 'invert',
        label: 'Invert',
        icon: Shuffle,
        category: 'effects',
        type: 'toggle',
        operationKey: 'effects.invert'
    },

];
