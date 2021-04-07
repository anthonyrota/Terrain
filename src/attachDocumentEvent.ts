import { Disposable } from './Disposable';

export function attachDocumentEvent<K extends keyof DocumentEventMap>(
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => unknown,
    disposable: Disposable,
    options?: boolean | AddEventListenerOptions,
): void {
    disposable.add(
        new Disposable(() => {
            document.removeEventListener(type, listener, options);
        }),
    );
    document.addEventListener(type, listener, options);
}
