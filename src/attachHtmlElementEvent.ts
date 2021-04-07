import { Disposable } from './Disposable';

export function attachHtmlElementEvent<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    disposable: Disposable,
    options?: boolean | AddEventListenerOptions | undefined,
): void {
    disposable.add(
        new Disposable(() => {
            element.removeEventListener(type, listener, options);
        }),
    );
    element.addEventListener(type, listener, options);
}
