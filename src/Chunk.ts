import { WorkerMethodMap } from 'workerize';
import { WorkerPool } from './WorkerPool';

interface ChunkGenerationParameters {
    chunkX: number;
    chunkZ: number;
    CHUNK_WIDTH: number;
    CHUNK_DEPTH: number;
    MAX_HEIGHT: number;
}

interface ChunkWorkerExports extends WorkerMethodMap {
    seedNoise(seed: number): void;
    generateHeightMap(parameters: ChunkGenerationParameters): Float32Array;
}

function ChunkWorkerFactory(exports: ChunkWorkerExports): void {
    // https://github.com/josephg/noisejs/blob/master/perlin.js
    // ISC License
    // Copyright (c) 2013, Joseph Gentle
    // Permission to use, copy, modify, and/or distribute this software for any
    // purpose with or without fee is hereby granted, provided that the above
    // copyright notice and this permission notice appear in all copies.
    const { seedNoise, simplex2 } = (function () {
        interface Grad {
            x: number;
            y: number;
            dot2(x: number, y: number): number;
        }

        function Grad(x: number, y: number): Grad {
            return {
                x,
                y,
                dot2(x2: number, y2: number): number {
                    return x * x2 + y * y2;
                },
            };
        }

        const grad3 = [
            Grad(1, 1),
            Grad(-1, 1),
            Grad(1, -1),
            Grad(-1, -1),
            Grad(1, 0),
            Grad(-1, 0),
            Grad(1, 0),
            Grad(-1, 0),
            Grad(0, 1),
            Grad(0, -1),
            Grad(0, 1),
            Grad(0, -1),
        ];

        // prettier-ignore
        // eslint-disable-next-line max-len
        const p = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190,  6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168,  68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,  65, 25, 63, 161,  1, 216, 80, 73, 209, 76, 132, 187, 208,  89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186,  3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152,  2, 44, 154, 163,  70, 221, 153, 101, 155, 167,  43, 172, 9, 129, 22, 39, 253,  19, 98, 108, 110, 79, 113, 224, 232, 178, 185,  112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,  81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214,  31, 181, 199, 106, 157, 184,  84, 204, 176, 115, 121, 50, 45, 127,  4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
        const perm = new Array<number>(512);
        const gradP = new Array<Grad>(512);

        function seedNoise(seed: number): void {
            seed = Math.floor(seed);
            if (seed < 256) {
                seed |= seed << 8;
            }

            for (let i = 0; i < 256; i++) {
                let v: number;
                if (i & 1) {
                    v = p[i] ^ (seed & 255);
                } else {
                    v = p[i] ^ ((seed >> 8) & 255);
                }

                perm[i] = perm[i + 256] = v;
                gradP[i] = gradP[i + 256] = grad3[v % 12];
            }
        }

        seedNoise(Math.random() * 65536);

        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;

        function simplex2(xin: number, yin: number): number {
            let n0: number;
            let n1: number;
            let n2: number;
            const s = (xin + yin) * F2;
            let i = Math.floor(xin + s);
            let j = Math.floor(yin + s);
            const t = (i + j) * G2;
            const x0 = xin - i + t;
            const y0 = yin - j + t;
            let i1: number;
            let j1: number;
            if (x0 > y0) {
                i1 = 1;
                j1 = 0;
            } else {
                i1 = 0;
                j1 = 1;
            }
            const x1 = x0 - i1 + G2;
            const y1 = y0 - j1 + G2;
            const x2 = x0 - 1 + 2 * G2;
            const y2 = y0 - 1 + 2 * G2;
            i &= 255;
            j &= 255;
            const gi0 = gradP[i + perm[j]];
            const gi1 = gradP[i + i1 + perm[j + j1]];
            const gi2 = gradP[i + 1 + perm[j + 1]];
            let t0 = 0.5 - x0 * x0 - y0 * y0;
            if (t0 < 0) {
                n0 = 0;
            } else {
                t0 *= t0;
                n0 = t0 * t0 * gi0.dot2(x0, y0);
            }
            let t1 = 0.5 - x1 * x1 - y1 * y1;
            if (t1 < 0) {
                n1 = 0;
            } else {
                t1 *= t1;
                n1 = t1 * t1 * gi1.dot2(x1, y1);
            }
            let t2 = 0.5 - x2 * x2 - y2 * y2;
            if (t2 < 0) {
                n2 = 0;
            } else {
                t2 *= t2;
                n2 = t2 * t2 * gi2.dot2(x2, y2);
            }
            return 70 * (n0 + n1 + n2);
        }

        return {
            seedNoise,
            simplex2,
        };
    })();

    function generateHeightMap(
        parameters: ChunkGenerationParameters,
    ): Float32Array {
        const {
            chunkX,
            chunkZ,
            CHUNK_WIDTH,
            CHUNK_DEPTH,
            MAX_HEIGHT,
        } = parameters;
        // For example if width=2, depth=2 then we generate:
        // * * *
        // * * *
        // * * *
        // Where the right column and bottom row are the boundary heights shared
        // with the adjacent right and bottom chunks.
        const heightMap = new Float32Array(
            (CHUNK_WIDTH + 1) * (CHUNK_DEPTH + 1),
        );

        const OCTAVES = 4;
        const PERSISTENCE = 0.4;
        const LACUNARITY = 3;
        const FINENESS = 100;

        let maxPossibleNoiseValue = 0;
        let amplitude = 1;
        for (let k = 0; k < OCTAVES; k++) {
            maxPossibleNoiseValue += amplitude;
            amplitude *= PERSISTENCE;
        }

        for (let i = 0; i <= CHUNK_WIDTH; i++) {
            for (let j = 0; j <= CHUNK_DEPTH; j++) {
                const x = chunkX + i;
                const z = chunkZ + j;
                const noiseX = x / FINENESS;
                const noiseZ = z / FINENESS;
                let amplitude = 1;
                let frequency = 1;
                let accumulatedNoiseValue = 0;
                for (let i = 0; i < OCTAVES; i++) {
                    const sampleX = noiseX * frequency;
                    const sampleZ = noiseZ * frequency;
                    // simplex2 has range [-1, 1] so add 1 to make range [0, 2]
                    // then divide by 2 to make range [0, 1]
                    const noiseValue = (1 + simplex2(sampleX, sampleZ)) / 2;
                    accumulatedNoiseValue += noiseValue * amplitude;
                    amplitude *= PERSISTENCE;
                    frequency *= LACUNARITY;
                }
                // Map to [0, 1]
                const normalizedAccumulatedNoiseValue =
                    accumulatedNoiseValue / maxPossibleNoiseValue;
                const height = normalizedAccumulatedNoiseValue * MAX_HEIGHT;
                heightMap[j * (CHUNK_WIDTH + 1) + i] = height;
            }
        }

        // https://jobtalle.com/simulating_hydraulic_erosion.html
        // MIT License
        // Copyright (c) 2020 Job Talle
        // Permission is hereby granted, free of charge, to any person obtaining
        // a copy of this software and associated documentation files (the
        // "Software"), to deal in the Software without restriction, including
        // without limitation the rights to use, copy, modify, merge, publish,
        // distribute, sublicense, and/or sell copies of the Software, and to
        // permit persons to whom the Software is furnished to do so, subject to
        // the following conditions:
        // The above copyright notice and this permission notice shall be
        // included in all copies or substantial portions of the Software.
        const DROPS_PER_CELL = 0.75;
        const EROSION_RATE = 0.04;
        const DEPOSITION_RATE = 0.03;
        const SPEED = 0.15;
        const FRICTION = 0.7;
        const RADIUS = 0.8;
        const MAX_RAIN_ITERATIONS = 800;
        const ITERATION_SCALE = 0.04;

        function getInterpolatedHeight(x: number, z: number): number {
            const DEFAULT = 0;

            if (x < 0 || z < 0) {
                return DEFAULT;
            }

            const floorX = Math.floor(x);
            const floorZ = Math.floor(z);

            if (floorX >= CHUNK_WIDTH || floorZ >= CHUNK_DEPTH) {
                return DEFAULT;
            }

            const gridOffsetX = x - floorX;
            const gridOffsetZ = z - floorZ;

            const heightTopLeft =
                heightMap[floorZ * (CHUNK_WIDTH + 1) + floorX];
            const heightTopRight =
                heightMap[floorZ * (CHUNK_WIDTH + 1) + (floorX + 1)];
            const heightBottomLeft =
                heightMap[(floorZ + 1) * (CHUNK_WIDTH + 1) + floorX];
            const heightBottomRight =
                heightMap[(floorZ + 1) * (CHUNK_WIDTH + 1) + (floorX + 1)];

            const heightLeft =
                heightTopLeft +
                (heightBottomLeft - heightTopLeft) * gridOffsetZ;
            const heightRight =
                heightTopRight +
                (heightBottomRight - heightTopRight) * gridOffsetZ;

            return heightLeft + (heightRight - heightLeft) * gridOffsetX;
        }

        function changeInterpolatedHeight(
            x: number,
            z: number,
            amount: number,
        ): void {
            if (x < 0 || z < 0) {
                return;
            }

            const floorX = Math.floor(x);
            const floorZ = Math.floor(z);

            if (floorX >= CHUNK_WIDTH || floorZ >= CHUNK_DEPTH) {
                return;
            }

            const gridOffsetX = x - floorX;
            const gridOffsetZ = z - floorZ;

            heightMap[floorZ * (CHUNK_WIDTH + 1) + floorX] +=
                gridOffsetX * gridOffsetZ * amount;
            heightMap[floorZ * (CHUNK_WIDTH + 1) + (floorX + 1)] +=
                (1 - gridOffsetX) * gridOffsetZ * amount;
            heightMap[(floorZ + 1) * (CHUNK_WIDTH + 1) + floorX] +=
                gridOffsetX * (1 - gridOffsetZ) * amount;
            heightMap[(floorZ + 1) * (CHUNK_WIDTH + 1) + (floorX + 1)] +=
                (1 - gridOffsetX) * (1 - gridOffsetZ) * amount;
        }

        function blurHeightMap(): void {
            const blurredValues = new Float32Array(
                (CHUNK_WIDTH - 1) * (CHUNK_DEPTH - 1),
            );

            for (let z = 1; z <= CHUNK_DEPTH - 1; z++) {
                for (let x = 1; x <= CHUNK_WIDTH - 1; x++) {
                    const edges =
                        heightMap[z * (CHUNK_WIDTH + 1) + (x - 1)] +
                        heightMap[(z - 1) * (CHUNK_WIDTH + 1) + x] +
                        heightMap[z * (CHUNK_WIDTH + 1) + (x + 1)] +
                        heightMap[(z + 1) * (CHUNK_WIDTH + 1) + x];
                    const corners =
                        heightMap[(z - 1) * (CHUNK_WIDTH + 1) + (x - 1)] +
                        heightMap[(z - 1) * (CHUNK_WIDTH + 1) + (x + 1)] +
                        heightMap[(z + 1) * (CHUNK_WIDTH + 1) + (x - 1)] +
                        heightMap[(z + 1) * (CHUNK_WIDTH + 1) + (x + 1)];
                    const middle = heightMap[z * (CHUNK_WIDTH + 1) + x];
                    blurredValues[(z - 1) * (CHUNK_WIDTH - 1) + (x - 1)] =
                        edges * 0.125 + corners * 0.0625 + middle * 0.25;
                }
            }

            for (let z = 1; z <= CHUNK_DEPTH - 1; z++) {
                for (let x = 1; x <= CHUNK_WIDTH - 1; x++) {
                    heightMap[z * (CHUNK_WIDTH + 1) + x] =
                        blurredValues[(z - 1) * (CHUNK_WIDTH - 1) + (x - 1)];
                }
            }
        }

        interface Vector3 {
            x: number;
            y: number;
            z: number;
        }

        function normalizeVector3(vector: Vector3): void {
            const lengthSquared =
                vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;
            const scale = 1 / Math.sqrt(lengthSquared);
            vector.x *= scale;
            vector.y *= scale;
            vector.z *= scale;
        }

        function sampleNormal(x: number, z: number): Vector3 {
            const left = getInterpolatedHeight(x - 1, z);
            const top = getInterpolatedHeight(x, z - 1);
            const right = getInterpolatedHeight(x + 1, z);
            const bottom = getInterpolatedHeight(x, z + 1);

            const normal = {
                x: -2 * (right - left),
                y: 4,
                z: -2 * (bottom - top),
            };

            normalizeVector3(normal);

            return normal;
        }

        function trace(x: number, z: number): void {
            const offsetX = (Math.random() * 2 - 1) * RADIUS;
            const offsetZ = (Math.random() * 2 - 1) * RADIUS;
            let sediment = 0;
            let previousX = x;
            let previousZ = z;
            let velocityX = 0;
            let velocityZ = 0;

            for (let i = 0; i < MAX_RAIN_ITERATIONS; i++) {
                const surfaceNormal = sampleNormal(x + offsetX, z + offsetZ);

                if (surfaceNormal.y === 1) {
                    break;
                }

                const deposit = sediment * DEPOSITION_RATE * surfaceNormal.y;
                const erosion =
                    EROSION_RATE *
                    (1 - surfaceNormal.y) *
                    Math.min(1, i * ITERATION_SCALE);

                changeInterpolatedHeight(
                    previousX,
                    previousZ,
                    deposit - erosion,
                );
                sediment += erosion - deposit;

                velocityX = FRICTION * velocityX + surfaceNormal.x * SPEED;
                velocityZ = FRICTION * velocityZ + surfaceNormal.z * SPEED;
                previousX = x;
                previousZ = z;
                x += velocityX;
                z += velocityZ;
            }
        }

        const dropsCount = DROPS_PER_CELL * CHUNK_WIDTH * CHUNK_DEPTH;

        for (let i = 0; i < dropsCount; i++) {
            trace(
                Math.random() * (CHUNK_WIDTH + 1),
                Math.random() * (CHUNK_DEPTH + 1),
            );
        }

        blurHeightMap();

        return heightMap;
    }

    exports.seedNoise = seedNoise;
    exports.generateHeightMap = generateHeightMap;
}

const chunkWorker = new WorkerPool<ChunkWorkerExports>(
    ChunkWorkerFactory,
    navigator.hardwareConcurrency,
);

export { chunkWorker };
