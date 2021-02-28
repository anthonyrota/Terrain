import { chunkWorker } from './Chunk';
import { Disposable } from './Disposable';

const canvas = document.querySelector('.canvas') as HTMLCanvasElement;

const PIXEL_SIZE = 1;

const CHUNK_WIDTH = 1024;
const CHUNK_DEPTH = 1024;
const MAX_HEIGHT = 256;

canvas.width = (CHUNK_WIDTH + 1) * PIXEL_SIZE;
canvas.height = (CHUNK_DEPTH + 1) * PIXEL_SIZE;

chunkWorker
    .execute(
        'generateHeightMap',
        [
            {
                chunkX: 0,
                chunkZ: 0,
                CHUNK_WIDTH,
                CHUNK_DEPTH,
                MAX_HEIGHT,
            },
        ],
        new Disposable(),
    )
    .then((heightMap) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const context = canvas.getContext('2d')!;
        const imageData = context.createImageData(canvas.width, canvas.height);
        const pixels = imageData.data;
        for (let x = 0; x <= CHUNK_WIDTH; x++) {
            for (let z = 0; z <= CHUNK_DEPTH; z++) {
                const gray = 255 - heightMap[z * (CHUNK_WIDTH + 1) + x];
                for (let xOffset = 0; xOffset < PIXEL_SIZE; xOffset++) {
                    for (let zOffset = 0; zOffset < PIXEL_SIZE; zOffset++) {
                        const pointer =
                            ((z * PIXEL_SIZE + zOffset) *
                                (CHUNK_WIDTH + 1) *
                                PIXEL_SIZE +
                                (x * PIXEL_SIZE + xOffset)) *
                            4;
                        pixels[pointer] = gray;
                        pixels[pointer + 1] = gray;
                        pixels[pointer + 2] = gray;
                        pixels[pointer + 3] = 255;
                    }
                }
            }
        }
        context.putImageData(imageData, 0, 0);
    })
    .catch(console.error);

// canvas.addEventListener('click', () => {
//     canvas.requestPointerLock();
// });

// function resizeCanvas(): void {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
// }

// resizeCanvas();
// window.addEventListener('resize', resizeCanvas);

// function loop(): void {
//     requestAnimationFrame(loop);
// }
// requestAnimationFrame(loop);
