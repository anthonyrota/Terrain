import { attachDocumentEvent } from './attachDocumentEvent';
import { attachHtmlElementEvent } from './attachHtmlElementEvent';
import { Disposable } from './Disposable';

export function attachPointerLock(
    element: HTMLElement,
    onPointerLock: () => void,
    onPointerUnlock: () => void,
    disposable: Disposable,
): void {
    const requestPointerLock =
        // eslint-disable-next-line @typescript-eslint/unbound-method
        element.requestPointerLock ||
        // eslint-disable-next-line max-len
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        ((element as any)
            .mozRequestPointerLock as typeof element.requestPointerLock);

    function isPointerLock(): boolean {
        return (
            document.pointerLockElement === element ||
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            (document as any).mozPointerLockElement === element
        );
    }

    function onPointerLockChanged(): void {
        if (isPointerLock()) {
            onPointerLock();
        } else {
            onPointerUnlock();
        }
    }

    ['mozpointerlockchange', 'pointerlockchange'].forEach((event) => {
        attachDocumentEvent(
            event as 'pointerlockchange',
            onPointerLockChanged,
            disposable,
        );
    });

    attachHtmlElementEvent(element, 'click', requestPointerLock, disposable);
}
