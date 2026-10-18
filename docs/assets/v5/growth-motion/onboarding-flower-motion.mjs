// Generated from Dayloom src/features/onboarding/scene/onboarding-flower-motion.ts. Do not edit.
import { flowerArt } from './art-flower.mjs';
// Portable flower-only rig from the approved growth-reveal plant study.
export const FLOWER_DURATION_MS = 11100;
export const FLOWER_START_MS = [600, 3300, 6000, 8700];
const range = (start, end) => Array.from({ length: end - start }, (_, i) => start + i);
function structure(stage) {
    const parts = flowerArt[stage];
    const nodes = [];
    const add = (id, indices, anchor, role = 'leaf') => {
        nodes.push({ id, indices, anchor, role, signature: JSON.stringify(indices.map(index => parts[index])) });
    };
    if (stage === 0)
        add('seed', [9, 10], [130, 153], 'seed');
    else {
        add('stem', [9], [130, 155], 'wood');
        if (stage === 1) {
            add('left-leaf', [10], [132, 139]);
            add('right-leaf', [11], [132, 132]);
        }
        else {
            add('left-leaf', [10, 12], [130, 137]);
            add('right-leaf', [11, 13], [134, 120]);
            if (stage === 2)
                add('top-leaf', [14], [135, 103]);
            else {
                add('side-stem', [14], [137, 99], 'wood');
                add('top-leaf', [15], [137, 102]);
                if (stage === 3)
                    add('bud', [16, 17, 18], [135, 70], 'bloom');
                else {
                    add('flower', range(16, 28), [139, 67], 'bloom');
                    add('side-bud', [28, 29], [157, 86], 'bloom');
                }
            }
        }
    }
    return nodes;
}
function top(parts, indices) {
    let minimum = 155;
    for (const index of indices) {
        const part = parts[index];
        if (part.type === 'ellipse')
            minimum = Math.min(minimum, part.cy - part.ry);
        else
            for (const op of part.ops)
                for (let i = 2; i < op.length; i += 2)
                    minimum = Math.min(minimum, op[i]);
    }
    return minimum;
}
export function prepareFlowerTransitions() {
    return Array.from({ length: 4 }, (_, from) => {
        const old = structure(from), next = structure(from + 1), replacement = from < 3;
        const signatures = new Set(old.map(node => node.signature));
        const newWood = next.some(node => node.role === 'wood' && !signatures.has(node.signature));
        const retained = new Set(next.filter(node => signatures.has(node.signature)).map(node => node.signature));
        const support = (nodes) => {
            const wood = nodes.filter(node => node.role === 'wood');
            return (wood.length ? wood : nodes).flatMap(node => node.indices);
        };
        return {
            from, replacement, old,
            oldIndices: old.filter(node => replacement || !retained.has(node.signature)).flatMap(node => node.indices),
            startScale: from === 0 ? .035 : Math.max(.18, Math.min(.95, (155 - top(flowerArt[from], support(old))) / (155 - top(flowerArt[from + 1], support(next))))),
            tracks: next.map((node, index) => ({ ...node, common: signatures.has(node.signature),
                delay: replacement || newWood ? .48 + .025 * (index % 4) : .17 + .045 * (index % 4),
                span: replacement || newWood ? .35 : .57 })),
        };
    });
}
export function flowerPhase(progress, start, span) {
    'worklet';
    const t = progress === 1 ? 1 : Math.max(0, Math.min(1, (progress - start) / span));
    return t * t * (3 - 2 * t);
}
export function flowerPosition(elapsed, reducedMotion = false) {
    'worklet';
    const time = reducedMotion ? FLOWER_DURATION_MS : Math.max(0, elapsed);
    let transition = 0;
    while (transition < 3 && time >= FLOWER_START_MS[transition + 1])
        transition += 1;
    return { transition, progress: Math.max(0, Math.min(1, (time - FLOWER_START_MS[transition]) / 2400)) };
}
export function flowerTrackPose(track, transition, progress) {
    'worklet';
    let opacity = 1, sx = 1, sy = 1, rotation = 0;
    let anchor = track.anchor;
    const hasStemMorph = transition.from > 0 && transition.from < 3;
    if (hasStemMorph && track.role === 'wood') {
        const growth = flowerPhase(progress, .48, .18);
        opacity = Math.min(1, growth * 4);
        sy = Math.max(.001, growth);
    }
    else if (transition.replacement && track.role === 'wood') {
        const growth = flowerPhase(progress, .09, .39);
        opacity = flowerPhase(progress, .04, .14);
        sx = .8 + .2 * growth;
        sy = transition.startScale + (1 - transition.startScale) * growth;
        anchor = [130, 155];
    }
    else if (track.common)
        opacity = transition.replacement ? flowerPhase(progress, .48, .1) : 1;
    else {
        const growth = flowerPhase(progress, track.role === 'wood' ? .08 : track.delay, track.role === 'wood' ? .4 : track.span);
        opacity = Math.min(1, growth * 4);
        sy = Math.max(.001, growth);
        sx = .35 + .65 * sy;
        rotation = track.role === 'wood' ? 0 : (anchor[0] < 132 ? -1 : 1) * 10 * (1 - growth);
    }
    return { opacity, sx, sy, rotation, anchor };
}
