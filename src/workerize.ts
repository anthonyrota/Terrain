/* eslint-disable */
// @ts-nocheck

// Copyright (c) 2021 Jason Miller
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

function workerize(code, options) {
    let exports = {};
    let exportsObjName = `__xpo${Math.random().toString().substring(2)}__`;
    if (typeof code === 'function')
        code = `(${Function.prototype.toString.call(code)})(${exportsObjName})`;
    code =
        toCjs(code, exportsObjName, exports) +
        `\n(${Function.prototype.toString.call(
            setup,
        )})(self,${exportsObjName},{})`;
    let url = URL.createObjectURL(
            new Blob([code], { type: 'text/javascript' }),
        ),
        worker = new Worker(url, options),
        term = worker.terminate,
        callbacks = {},
        counter = 0,
        i;
    worker.kill = (signal) => {
        worker.postMessage({ type: 'KILL', signal });
        setTimeout(worker.terminate);
    };
    worker.terminate = () => {
        URL.revokeObjectURL(url);
        term.call(worker);
    };
    worker.call = (method, params) =>
        new Promise((resolve, reject) => {
            let id = `rpc${++counter}`;
            callbacks[id] = [resolve, reject];
            worker.postMessage({ type: 'RPC', id, method, params });
        });
    worker.rpcMethods = {};
    setup(worker, worker.rpcMethods, callbacks);
    worker.expose = (methodName) => {
        worker[methodName] = function () {
            return worker.call(methodName, [].slice.call(arguments));
        };
    };
    for (i in exports) if (!(i in worker)) worker.expose(i);
    return worker;
}

function setup(ctx, rpcMethods, callbacks) {
    ctx.addEventListener('message', ({ data }) => {
        let id = data.id;
        if (data.type !== 'RPC' || id == null) return;
        if (data.method) {
            let method = rpcMethods[data.method];
            if (method == null) {
                ctx.postMessage({ type: 'RPC', id, error: 'NO_SUCH_METHOD' });
            } else {
                Promise.resolve()
                    .then(() => method.apply(null, data.params))
                    .then((result) => {
                        ctx.postMessage(
                            { type: 'RPC', id, result: result.result },
                            result.transferList,
                        );
                    })
                    .catch((err) => {
                        ctx.postMessage({ type: 'RPC', id, error: '' + err });
                    });
            }
        } else {
            let callback = callbacks[id];
            if (callback == null) throw Error(`Unknown callback ${id}`);
            delete callbacks[id];
            if (data.error) callback[1](Error(data.error));
            else callback[0](data.result);
        }
    });
}

function toCjs(code, exportsObjName, exports) {
    code = code.replace(/^(\s*)export\s+default\s+/m, (s, before) => {
        exports.default = true;
        return `${before}${exportsObjName}.default=`;
    });
    code = code.replace(
        /^(\s*)export\s+((?:async\s*)?function(?:\s*\*)?|const|let|var)(\s+)([a-zA-Z$_][a-zA-Z0-9$_]*)/gm,
        (s, before, type, ws, name) => {
            exports[name] = true;
            return `${before}${exportsObjName}.${name}=${type}${ws}${name}`;
        },
    );
    return `var ${exportsObjName}={};\n${code}\n${exportsObjName};`;
}

export type WorkerMethodMap = {
    [key: string]: (...args: any[]) => any;
};

export type WorkerFactoryExports<M extends WorkerMethodMap> = {
    [K in keyof M]: (
        ...args: Parameters<M[K]>
    ) => { result: ReturnType<M[K]>; transferList?: Transferable[] };
};

export type WorkerFactory<M extends WorkerMethodMap> = (
    exports: WorkerFactoryExports<M>,
) => void;

export interface Workerized<M extends WorkerMethodMap> {
    terminate(): void;
    call<K extends keyof M>(
        method: K,
        parameters: Parameters<M[K]>,
    ): Promise<ReturnType<M[K]>>;
}

interface WorkerizeFn {
    <M extends WorkerMethodMap>(factory: WorkerFactory<M>): Workerized<M>;
}

export default workerize as WorkerizeFn;
