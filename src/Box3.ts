import { vec3 } from 'gl-matrix';

export class Box3 {
    constructor(public min: vec3, public max: vec3) {}

    offset(position: vec3): void {
        vec3.add(this.min, this.min, position);
        vec3.add(this.max, this.max, position);
    }
}
