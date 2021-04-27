import { vec2, vec3, mat4 } from 'gl-matrix';
import { attachDocumentEvent } from './attachDocumentEvent';
import { attachPointerLock } from './attachPointerControls';
import { Disposable } from './Disposable';
import { Frustum } from './Frustum';
import { KeyControls, KEYS } from './KeyControls';

export interface FirstPersonCameraParameters {
    canvas: HTMLCanvasElement;
    horizontalSpeed: number;
    verticalSpeed: number;
    maxFallSpeed: number;
    gravity: number;
    horizontalDrag: number;
    sensitivity: number;
    fov: number;
    aspect: number;
    near: number;
    far: number;
    getCanJump: () => boolean;
}

const MOVEMENT_KEYS = [
    [[KEYS.W, KEYS.UP_ARROW], vec3.fromValues(0, 0, -1)],
    [[KEYS.S, KEYS.DOWN_ARROW], vec3.fromValues(0, 0, 1)],
    [[KEYS.D, KEYS.RIGHT_ARROW], vec3.fromValues(1, 0, 0)],
    [[KEYS.A, KEYS.LEFT_ARROW], vec3.fromValues(-1, 0, 0)],
] as const;

export class FirstPersonCamera extends Disposable {
    private _keyControls = new KeyControls();
    private _velocity = vec3.create();
    private _position = vec3.fromValues(0, 0, 0);
    private _rotation = vec2.create();

    public get x(): number {
        return this._position[0];
    }
    public set x(value: number) {
        this._position[0] = value;
        this._calculateLookAtMatrix();
        this._calculateFrustum();
    }
    public get y(): number {
        return this._position[1];
    }
    public set y(value: number) {
        this._position[1] = value;
        this._calculateLookAtMatrix();
        this._calculateFrustum();
    }
    public get z(): number {
        return this._position[2];
    }
    public set z(value: number) {
        this._position[2] = value;
        this._calculateLookAtMatrix();
        this._calculateFrustum();
    }
    public get xyz(): vec3 {
        return vec3.clone(this._position);
    }

    private _horizontalSpeed: number;
    private _verticalSpeed: number;
    private _maxFallSpeed: number;
    private _gravity: number;
    private _horizontalDrag: number;
    private _sensitivity: number;
    private _fov: number;
    private _aspect: number;
    private _near: number;
    private _far: number;
    private _getCanJump: () => boolean;

    public set fov(value: number) {
        this._fov = value;
        this._calculateProjectionMatrix();
        this._calculateFrustum();
    }
    public get fov(): number {
        return this._fov;
    }
    public set aspect(value: number) {
        this._aspect = value;
        this._calculateProjectionMatrix();
        this._calculateFrustum();
    }
    public get aspect(): number {
        return this._aspect;
    }
    public set near(value: number) {
        this._near = value;
        this._calculateProjectionMatrix();
        this._calculateFrustum();
    }
    public get near(): number {
        return this._near;
    }
    public set far(value: number) {
        this._far = value;
        this._calculateProjectionMatrix();
        this._calculateFrustum();
    }
    public get far(): number {
        return this._far;
    }
    public get nearFarPlanes(): vec2 {
        return vec2.fromValues(this.near, this.far);
    }

    private _lookAtMatrix = mat4.create();
    private _projectionMatrix = mat4.create();
    private _frustum = new Frustum();

    public get lookAtMatrix(): mat4 {
        return this._lookAtMatrix;
    }
    public get projectionMatrix(): mat4 {
        return this._projectionMatrix;
    }
    public get frustum(): Frustum {
        return this._frustum;
    }

    constructor(parameters: FirstPersonCameraParameters) {
        super();

        const {
            canvas,
            horizontalSpeed,
            verticalSpeed,
            maxFallSpeed,
            gravity,
            horizontalDrag: drag,
            sensitivity,
            fov,
            aspect,
            near,
            far,
            getCanJump,
        } = parameters;

        this._horizontalSpeed = horizontalSpeed;
        this._verticalSpeed = verticalSpeed;
        this._maxFallSpeed = maxFallSpeed;
        this._gravity = gravity;
        this._horizontalDrag = drag;
        this._sensitivity = sensitivity;
        this._fov = fov;
        this._aspect = aspect;
        this._near = near;
        this._far = far;
        this._getCanJump = getCanJump;

        let eventsDisposable = new Disposable();
        this.add(this._keyControls);
        this.add(eventsDisposable);
        attachPointerLock(
            canvas,
            () => {
                this._keyControls.onKeyCodePressed(
                    KEYS.SPACE,
                    () => this._onJumpKey(),
                    eventsDisposable,
                );
                attachDocumentEvent(
                    'mousemove',
                    (e) => this._onMouseMove(e),
                    eventsDisposable,
                );
            },
            () => {
                eventsDisposable.dispose();
                eventsDisposable = new Disposable();
                this.add(eventsDisposable);
            },
            this,
        );

        this._calculateProjectionMatrix();
        this._calculateLookAtMatrix();
        this._calculateFrustum();
    }

    public update(dt: number): void {
        MOVEMENT_KEYS.forEach(([keyCodes, movementDirection]) => {
            keyCodes.forEach((keyCode) => {
                if (this._keyControls.isKeyCodePressed(keyCode)) {
                    const temp = vec3.create();
                    const origin = vec3.fromValues(0, 0, 0);
                    vec3.rotateY(
                        temp,
                        movementDirection,
                        origin,
                        this._rotation[1],
                    );
                    vec3.scale(temp, temp, this._horizontalSpeed * dt);
                    vec3.add(this._velocity, this._velocity, temp);
                }
            });
        });

        this._velocity[1] -= this._gravity * dt;
        if (this._velocity[1] < -this._maxFallSpeed) {
            this._velocity[1] = -this._maxFallSpeed;
        }

        const temp = vec3.create();
        vec3.scale(temp, this._velocity, dt);
        vec3.add(this._position, this._position, temp);

        this._velocity[0] *= this._horizontalDrag ** dt;
        this._velocity[2] *= this._horizontalDrag ** dt;

        this._calculateLookAtMatrix();
        this._calculateFrustum();
    }

    public reflectAboutY(y: number): void {
        this._position[1] -= 2 * (this._position[1] - y);
        this._rotation[0] *= -1;

        this._calculateLookAtMatrix();
        this._calculateFrustum();
    }

    private _onJumpKey(): void {
        if (this._getCanJump()) {
            this._velocity[1] = this._verticalSpeed;
        }
    }

    private _onMouseMove(e: MouseEvent): void {
        this._rotation[0] += e.movementY * this._sensitivity;
        this._rotation[1] -= e.movementX * this._sensitivity;
        this._rotation[0] = Math.max(
            Math.min(this._rotation[0], Math.PI / 2 - 0.01),
            -Math.PI / 2 + 0.01,
        );
    }

    private _calculateProjectionMatrix(): void {
        mat4.perspective(
            this._projectionMatrix,
            this._fov,
            this._aspect,
            this._near,
            this._far,
        );
    }

    private _calculateRotationVector(): vec3 {
        const x = this._rotation[1];
        const y = this._rotation[0];

        const cy = Math.cos(y);
        const cx = Math.cos(x);
        const sy = Math.sin(y);
        const sx = Math.sin(x);

        return vec3.fromValues(cy * sx, sy, cy * cx);
    }

    private _calculateLookAtMatrix(): void {
        mat4.lookAt(
            this._lookAtMatrix,
            this._position,
            vec3.sub(
                vec3.create(),
                this._position,
                this._calculateRotationVector(),
            ),
            vec3.fromValues(0, 1, 0),
        );
    }

    private _calculateFrustum(): void {
        const projectionViewMatrix = mat4.create();
        mat4.multiply(
            projectionViewMatrix,
            this._projectionMatrix,
            this._lookAtMatrix,
        );
        this._frustum.setMatrix(projectionViewMatrix);
    }
}
