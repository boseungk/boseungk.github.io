// Generated from Dayloom src/world/drawn/growth/art-shapes.ts. Do not edit.
// Small authoring helpers. These create plain data; native paths are prepared by art.ts.
export function shape(fill, ops, alpha = 1) {
    return { type: 'path', ops, fill, fillAlpha: alpha, stroke: null, strokeWidth: 0, strokeAlpha: 1 };
}
export function line(stroke, width, ops, alpha = 1) {
    return { type: 'path', ops, fill: null, fillAlpha: 1, stroke, strokeWidth: width, strokeAlpha: alpha };
}
export function oval(fill, cx, cy, rx, ry, alpha = 1) {
    return { type: 'ellipse', cx, cy, rx, ry, fill, fillAlpha: alpha, stroke: null, strokeWidth: 0, strokeAlpha: 1 };
}
export function facet(fill, points, alpha = 1) {
    const ops = points.map(([x, y], index) => [index ? 'L' : 'M', x, y]);
    return shape(fill, [...ops, ['Z']], alpha);
}
/** Size the authored family once around its ground anchor. Fitted catalog art
 * keeps its framing; world art, shadows and stroke widths grow together. */
export function scaleGrowthFamily(stages, scale, anchorX, groundY) {
    const x = (value) => anchorX + (value - anchorX) * scale;
    const y = (value) => groundY + (value - groundY) * scale;
    const operation = (op) => {
        switch (op[0]) {
            case 'M':
            case 'L': return [op[0], x(op[1]), y(op[2])];
            case 'Q': return ['Q', x(op[1]), y(op[2]), x(op[3]), y(op[4])];
            case 'C': return ['C', x(op[1]), y(op[2]), x(op[3]), y(op[4]), x(op[5]), y(op[6])];
            case 'Z': return op;
        }
    };
    return stages.map(stage => stage.map((primitive) => primitive.type === 'ellipse'
        ? { ...primitive, cx: x(primitive.cx), cy: y(primitive.cy), rx: primitive.rx * scale, ry: primitive.ry * scale, strokeWidth: primitive.strokeWidth * scale }
        : { ...primitive, ops: primitive.ops.map(operation), strokeWidth: primitive.strokeWidth * scale }));
}
