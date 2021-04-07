import { vec4, mat4 } from 'gl-matrix';
import { Box3 } from './Box3';

export class Frustum {
    private _planes!: vec4[];

    setMatrix(m: mat4) {
        this._planes = [
            vec4.fromValues(
                m[3] + m[0],
                m[7] + m[4],
                m[11] + m[8],
                m[15] + m[12],
            ),
            vec4.fromValues(
                m[3] - m[0],
                m[7] - m[4],
                m[11] - m[8],
                m[15] - m[12],
            ),
            vec4.fromValues(
                m[3] + m[1],
                m[7] + m[5],
                m[11] + m[9],
                m[15] + m[13],
            ),
            vec4.fromValues(
                m[3] - m[1],
                m[7] - m[5],
                m[11] - m[9],
                m[15] - m[13],
            ),
            vec4.fromValues(
                m[3] + m[2],
                m[7] + m[6],
                m[11] + m[10],
                m[15] + m[14],
            ),
            vec4.fromValues(
                m[3] - m[2],
                m[7] - m[6],
                m[11] - m[10],
                m[15] - m[14],
            ),
        ];

        for (let i = 0; i < 6; i++) {
            vec4.normalize(this._planes[i], this._planes[i]);
        }
    }

    collidesWithBox3(box: Box3) {
        const planes = this._planes;
        const boxMinMax = [box.min, box.max];

        for (let i = 0; i < 6; i++) {
            const plane = planes[i];

            const px = plane[0] > 0 ? 1 : 0;
            const py = plane[1] > 0 ? 1 : 0;
            const pz = plane[2] > 0 ? 1 : 0;

            const dp =
                plane[0] * boxMinMax[px][0] +
                plane[1] * boxMinMax[py][1] +
                plane[2] * boxMinMax[pz][2];

            if (dp < -plane[3] - 0.2) {
                return false;
            }
        }

        return true;
    }
}
