declare module 'workerize' {
    export type WorkerMethodMap = {
        [key: string]: (...args: any[]) => any;
    };

    export type WorkerFactory<M extends WorkerMethodMap> = (exports: M) => void;

    export interface Workerized<M extends WorkerMethodMap> {
        terminate(): void;
        call<K extends keyof M>(
            method: K,
            parameters: Parameters<M[K]>,
        ): Promise<ReturnType<M[K]>>;
    }

    function workerize<M extends WorkerMethodMap>(
        factory: WorkerFactory<M>,
    ): Workerized<M>;

    export default workerize;
}
