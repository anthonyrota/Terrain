import { Disposable } from './Disposable';
import { removeFirst } from './removeFirst';
import workerize, {
    WorkerMethodMap,
    WorkerFactory,
    Workerized,
} from './workerize';

export class WorkerPool<
    M extends WorkerMethodMap,
    K_ extends keyof M
> extends Disposable {
    private _activeWorkers: Workerized<M>[] = [];
    private _inactiveWorkers: Workerized<M>[] = [];
    private _executionQueue: {
        method: K_;
        parameters: Parameters<M[keyof M]>;
        disposable: Disposable;
        onExecutionStart: () => void;
        resolve: (value: ReturnType<M[keyof M]>) => void;
        reject: (error: unknown) => void;
    }[] = [];

    constructor(workerFactory: WorkerFactory<M>, workerCount: number) {
        super();
        if (workerCount <= 0) {
            throw new TypeError(`Invalid number of workers n=${workerCount}`);
        }
        for (let i = 0; i < workerCount; i++) {
            const worker = workerize(workerFactory);
            this._inactiveWorkers[i] = worker;
            this.add(
                new Disposable(() => {
                    worker.terminate();
                }),
            );
        }
    }

    public execute<K extends K_>(
        method: K,
        parameters: Parameters<M[K]>,
        disposable: Disposable,
    ): Promise<ReturnType<M[K]>> {
        if (this.disposed || disposable.disposed) {
            return Promise.reject(new ExecutionCanceledError());
        }
        if (this._inactiveWorkers.length !== 0) {
            return this._execute(
                method,
                parameters,
                disposable,
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this._inactiveWorkers.shift()!,
            );
        }
        let resolve!: (value: ReturnType<M[K]>) => void;
        let reject!: (error: unknown) => void;
        const promise = new Promise<ReturnType<M[K]>>((resolve_, reject_) => {
            resolve = resolve_;
            reject = reject_;
        });
        const queueItem = {
            method,
            parameters,
            disposable,
            onExecutionStart(): void {
                disposable.remove(removeFromQueueDisposable);
            },
            resolve,
            reject,
        };
        this._executionQueue.push(queueItem);
        const removeFromQueueDisposable = new Disposable(() => {
            removeFirst(this._executionQueue, queueItem);
        });
        disposable.add(removeFromQueueDisposable);
        return promise;
    }

    public dispose(): void {
        super.dispose();
        this._activeWorkers.length = 0;
        this._inactiveWorkers.length = 0;
        for (let i = 0; i < this._executionQueue.length; i++) {
            this._executionQueue[i].reject(new ExecutionCanceledError());
        }
        this._executionQueue.length = 0;
    }

    private _execute<K extends K_>(
        method: K,
        parameters: Parameters<M[K]>,
        disposable: Disposable,
        worker: Workerized<M>,
    ): Promise<ReturnType<M[K]>> {
        this._activeWorkers.push(worker);
        return new Promise((resolve, reject) => {
            worker.call(method, parameters).then(
                (result) => {
                    this._inactiveWorkers.push(worker);
                    this._checkQueue();
                    if (disposable.disposed) {
                        reject(new ExecutionCanceledError());
                        return;
                    }
                    resolve(result);
                },
                (error) => {
                    this._inactiveWorkers.push(worker);
                    this._checkQueue();
                    if (disposable.disposed) {
                        setTimeout(() => {
                            throw error;
                        });
                        reject(new ExecutionCanceledError());
                        return;
                    }
                    reject(error);
                },
            );
        });
    }

    private _checkQueue(): void {
        if (this._executionQueue.length === 0) {
            return;
        }
        const {
            method,
            parameters,
            disposable,
            onExecutionStart,
            resolve,
            reject,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        } = this._executionQueue.shift()!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const worker = this._inactiveWorkers.shift()!;
        onExecutionStart();
        this._execute(method, parameters, disposable, worker).then(
            resolve,
            reject,
        );
    }
}

export class ExecutionCanceledError extends Error {
    public name = 'ExecutionCanceledError';
}
