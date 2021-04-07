import { removeFirst } from './removeFirst';

export class Disposable {
    private _children: Disposable[] | null = [];
    private _parents: Disposable[] | null = [];

    constructor(private _onDispose?: () => void) {}

    public get disposed(): boolean {
        return this._children === null;
    }

    public add(disposable: Disposable): void {
        if (!this._children) {
            disposable.dispose();
            return;
        }

        if (disposable.disposed) {
            return;
        }

        if (this._children.indexOf(disposable) !== -1) {
            return;
        }

        this._children.push(disposable);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        disposable._parents!.push(this);
    }

    public remove(disposable: Disposable): void {
        if (!this._children || disposable.disposed) {
            return;
        }

        if (removeFirst(this._children, disposable)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            removeFirst(disposable._parents!, this);
        }
    }

    public dispose(): void {
        const children = this._children;

        if (!children) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const parents = this._parents!;

        this._children = null;
        this._parents = null;

        for (let i = 0; i < parents.length; i++) {
            const { _children } = parents[i];
            if (_children) {
                removeFirst(_children, this);
            }
        }

        const errors: unknown[] = [];

        const onDispose = this._onDispose;
        if (onDispose) {
            try {
                onDispose();
            } catch (error) {
                errors.push(error);
            }
        }

        for (let i = 0; i < children.length; i++) {
            try {
                children[i].dispose();
            } catch (error) {
                errors.push(error);
            }
        }
    }
}
