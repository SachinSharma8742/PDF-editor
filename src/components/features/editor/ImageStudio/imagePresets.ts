import type { ImageOperations } from "./useImageStudioStore";
import { FileText, Scan, Sparkles, Sun, Droplets, Palette } from "lucide-react";
import type { ElementType } from "react";

export interface ImagePreset {
    id: string;
    label: string;
    description: string;
    category: "document" | "photo" | "cleanup";
    icon: ElementType; // Lucide icon component
    operations: Partial<ImageOperations>;
}

export const IMAGE_PRESETS: ImagePreset[] = [
    // --- Document Presets ---
    {
        id: 'clean-doc',
        label: 'Clean Document',
        description: 'Enhances text readability and removes background noise',
        category: 'document',
        icon: FileText,
        operations: {
            cleanup: {
                deskew: true,
                backgroundRemoved: false,
                scanRepair: false
            },
            adjust: {
                brightness: 0.1,
                contrast: 0.2, // 20% boost
                saturation: -0.1 // Slight desaturation for text
            },

            enhance: {
                upscale: false,
                upscaleFactor: 1
            }
        }
    },
    {
        id: 'scan-repair',
        label: 'Scan Repair',
        description: 'Fixes skewed scans and normalizes contrast',
        category: 'document',
        icon: Scan,
        operations: {
            cleanup: {
                deskew: true,
                backgroundRemoved: false,
                scanRepair: true
            },
            adjust: {
                brightness: 0.05,
                contrast: 0.1,
                saturation: 0
            }
        }
    },


    // --- Photo Presets ---
    {
        id: 'soft-enhance',
        label: 'Soft Enhance',
        description: 'Gentle color and brightness boost',
        category: 'photo',
        icon: Sparkles,
        operations: {
            adjust: {
                brightness: 0.05,
                contrast: 0.05,
                saturation: 0.1
            },

            enhance: {
                upscale: false,
                upscaleFactor: 1
            }
        }
    },
    {
        id: 'vivid',
        label: 'Vivid',
        description: 'Rich colors and high contrast',
        category: 'photo',
        icon: Palette,
        operations: {
            adjust: {
                brightness: 0,
                contrast: 0.15,
                saturation: 0.3
            }
        }
    },
    {
        id: 'matte',
        label: 'Matte',
        description: 'Faded, soft look with lower contrast',
        category: 'photo',
        icon: Droplets,
        operations: {
            adjust: {
                brightness: 0.05,
                contrast: -0.1,
                saturation: -0.1
            },
            effects: {
                sepia: true,
                grayscale: false,
                invert: false,
                noise: 0
            }
        }
    },
    {
        id: 'bw-art',
        label: 'B&W Art',
        description: 'Artistic high-contrast black and white',
        category: 'photo',
        icon: Sun,
        operations: {
            effects: {
                grayscale: true,
                invert: false,
                sepia: false,
                noise: 0
            },
            adjust: {
                brightness: 0,
                contrast: 0.2,
                saturation: 0
            }
        }
    },


];
