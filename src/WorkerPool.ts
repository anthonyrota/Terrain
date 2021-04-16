import { Disposable } from './Disposable';
import { removeFirst } from './removeFirst';
import { RequestBase, ResponseBase } from './terrainWorkerTypes';

export class WorkerPool<Request, Response> extends Disposable {
    private _requestId = 0;
    private _activeWorkers: Worker[] = [];
    private _inactiveWorkers: Worker[] = [];
    private _executionQueue: {
        request: Request & RequestBase;
        disposable: Disposable;
        onExecutionStart: () => void;
        resolve: (value: Response) => void;
        reject: (error: unknown) => void;
    }[] = [];
    private _requestQueue: {
        request: Request & RequestBase;
        disposable: Disposable;
        resolve: (value: Response) => void;
        reject: (error: unknown) => void;
    }[] = [];

    constructor(makeWorker: () => Worker, workerCount: number) {
        super();
        if (workerCount <= 0) {
            throw new TypeError(`Invalid number of workers n=${workerCount}`);
        }
        for (let i = 0; i < workerCount; i++) {
            const worker = makeWorker();
            this._inactiveWorkers[i] = worker;
            this.add(
                new Disposable(() => {
                    worker.terminate();
                }),
            );
            worker.onmessage = (
                event: MessageEvent<Response & ResponseBase>,
            ) => {
                const response = event.data;
                for (let i = 0; i < this._requestQueue.length; i++) {
                    const item = this._requestQueue[i];
                    if (response.requestId === item.request.requestId) {
                        this._requestQueue.splice(i, 1);
                        this._inactiveWorkers.push(worker);
                        this._checkQueue();
                        if (item.disposable.disposed) {
                            item.reject(new ExecutionCanceledError());
                        } else {
                            item.resolve(response);
                        }
                        break;
                    }
                }
            };
        }
    }

    public execute(
        request: Request,
        disposable: Disposable,
    ): Promise<Response> {
        if (this.disposed || disposable.disposed) {
            return Promise.reject(new ExecutionCanceledError());
        }
        const internalRequest: Request & RequestBase = {
            ...request,
            requestId: this._requestId++,
        };
        if (this._inactiveWorkers.length !== 0) {
            return this._execute(
                internalRequest,
                disposable,
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this._inactiveWorkers.shift()!,
            );
        }
        let resolve!: (value: Response) => void;
        let reject!: (error: unknown) => void;
        const promise = new Promise<Response>((resolve_, reject_) => {
            resolve = resolve_;
            reject = reject_;
        });
        const queueItem = {
            request: internalRequest,
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

    private _execute(
        request: Request & RequestBase,
        disposable: Disposable,
        worker: Worker,
    ): Promise<Response> {
        this._activeWorkers.push(worker);
        return new Promise((resolve, reject) => {
            this._requestQueue.push({
                request,
                disposable,
                resolve,
                reject,
            });
            worker.postMessage(request);
        });
    }

    private _checkQueue(): void {
        if (this._executionQueue.length === 0) {
            return;
        }
        const {
            request,
            disposable,
            onExecutionStart,
            resolve,
            reject,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        } = this._executionQueue.shift()!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const worker = this._inactiveWorkers.shift()!;
        onExecutionStart();
        this._execute(request, disposable, worker).then(resolve, reject);
    }
}

export class ExecutionCanceledError extends Error {
    public name = 'ExecutionCanceledError';
}
