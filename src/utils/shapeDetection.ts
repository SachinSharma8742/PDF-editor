export interface DetectedShape {
    type: 'rectangle' | 'circle' | 'line' | 'triangle' | 'none';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    points?: number[]; // For triangle or line
}

export const detectShape = (points: number[], tolerance = 15): DetectedShape => {
    if (points.length < 10) return { type: 'none', x: 0, y: 0, width: 0, height: 0 };

    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;

    // 1. Check for Line
    const startX = points[0];
    const startY = points[1];
    const endX = points[points.length - 2];
    const endY = points[points.length - 1];
    const distStartEnd = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

    let totalPathLength = 0;
    for (let i = 0; i < points.length - 2; i += 2) {
        totalPathLength += Math.sqrt((points[i + 2] - points[i]) ** 2 + (points[i + 3] - points[i + 1]) ** 2);
    }

    // If total path length is close to distance between start and end, it's a line
    if (totalPathLength < distStartEnd * 1.15) {
        return { type: 'line', x: minX, y: minY, width, height, points: [startX, startY, endX, endY] };
    }

    // Check if it's closed (start and end points are close)
    const isClosed = distStartEnd < Math.max(width, height) * 0.3;

    if (isClosed) {
        // 2. Check for Circle / Ellipse
        // Calculate average distance from center
        const distances = [];
        for (let i = 0; i < points.length; i += 2) {
            distances.push(Math.sqrt((points[i] - centerX) ** 2 + (points[i + 1] - centerY) ** 2));
        }
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((a, b) => a + (b - avgDist) ** 2, 0) / distances.length;
        const stdDev = Math.sqrt(variance);

        // If variance is low relative to radius, it's likely a circle/ellipse
        if (stdDev < avgDist * 0.15) {
            return { type: 'circle', x: centerX - avgDist, y: centerY - avgDist, width: avgDist * 2, height: avgDist * 2 };
        }

        // 3. Check for Rectangle
        // Compare area of bounding box to "occupied" area? 
        // A better way: Check how many points are near the corners.
        // Or check if the points mostly stay near the 4 lines of the bounding box.
        let pointOnEdges = 0;
        for (let i = 0; i < points.length; i += 2) {
            const nearLeft = Math.abs(points[i] - minX) < tolerance;
            const nearRight = Math.abs(points[i] - maxX) < tolerance;
            const nearTop = Math.abs(points[i + 1] - minY) < tolerance;
            const nearBottom = Math.abs(points[i + 1] - maxY) < tolerance;
            if (nearLeft || nearRight || nearTop || nearBottom) pointOnEdges++;
        }

        if (pointOnEdges / (points.length / 2) > 0.7) {
            return { type: 'rectangle', x: minX, y: minY, width, height };
        }

        // 4. Check for Triangle (3 segments)
        // This is harder, skipping for basic implementation or using simplified points count
    }

    return { type: 'none', x: 0, y: 0, width: 0, height: 0 };
};
