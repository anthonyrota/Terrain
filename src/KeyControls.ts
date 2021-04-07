import { attachDocumentEvent } from './attachDocumentEvent';
import { Disposable } from './Disposable';
import { removeFirst } from './removeFirst';

export const KEYS = {
    BACKSPACE: 8,
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    PAUSE: 19,
    CAPS_LOCK: 20,
    ESCAPE: 27,
    SPACE: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    END: 35,
    HOME: 36,
    LEFT_ARROW: 37,
    UP_ARROW: 38,
    RIGHT_ARROW: 39,
    DOWN_ARROW: 40,
    INSERT: 45,
    DELETE: 46,
    '0': 48,
    '1': 49,
    '2': 50,
    '3': 51,
    '4': 52,
    '5': 53,
    '6': 54,
    '7': 55,
    '8': 56,
    '9': 57,
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    F: 70,
    G: 71,
    H: 72,
    I: 73,
    J: 74,
    K: 75,
    L: 76,
    M: 77,
    N: 78,
    O: 79,
    P: 80,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    U: 85,
    V: 86,
    W: 87,
    X: 88,
    Y: 89,
    Z: 90,
    LEFT_SUPER: 91,
    RIGHT_SUPER: 92,
    SELECT_KEY: 93,
    NUMPAD_0: 96,
    NUMPAD_1: 97,
    NUMPAD_2: 98,
    NUMPAD_3: 99,
    NUMPAD_4: 100,
    NUMPAD_5: 101,
    NUMPAD_6: 102,
    NUMPAD_7: 103,
    NUMPAD_8: 104,
    NUMPAD_9: 105,
    MULTIPLY: 106,
    ADD: 107,
    SUBTRACT: 109,
    DECIMAL_POINT: 110,
    DIVIDE: 111,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    F12: 123,
    NUM_LOCK: 144,
    SCROLL_LOCK: 145,
    SEMI_COLON: 186,
    EQUAL_SIGN: 187,
    COMMA: 188,
    DASH: 189,
    PERIOD: 190,
    FORWARD_SLASH: 191,
    GRAVE_ACCENT: 192,
    OPEN_BRACKET: 219,
    BACK_SLASH: 220,
    CLOSE_BRACKET: 221,
    SINGLE_QUOTE: 222,
};

export class KeyControls extends Disposable {
    private _isKeyCodePressedMap: { [keyCode: number]: boolean } = {};
    private _keyPressCallbacks: {
        [keyCode: number]: ((e: KeyboardEvent) => void)[];
    } = {};

    constructor() {
        super();
        attachDocumentEvent('keydown', (e) => this._onKeyDown(e), this);
        attachDocumentEvent('keyup', (e) => this._onKeyUp(e), this);
    }

    public isKeyCodePressed(keyCode: number): boolean {
        return !!this._isKeyCodePressedMap[keyCode];
    }

    public onKeyCodePressed(
        keyCode: number,
        callback: (e: KeyboardEvent) => void,
        disposable: Disposable,
    ): void {
        if (this.disposed || disposable.disposed) {
            return;
        }

        const disposeBinding = new Disposable(() => {
            removeFirst(this._keyPressCallbacks[keyCode], callback);
        });
        this.add(disposeBinding);
        disposable.add(disposeBinding);

        if (!(keyCode in this._keyPressCallbacks)) {
            this._keyPressCallbacks[keyCode] = [];
        }
        this._keyPressCallbacks[keyCode].push(callback);
    }

    private _onKeyDown(e: KeyboardEvent): void {
        const { keyCode } = e;
        this._isKeyCodePressedMap[keyCode] = true;
        if (this._keyPressCallbacks[keyCode]) {
            this._keyPressCallbacks[keyCode].forEach((callback) => {
                callback(e);
            });
        }
    }

    private _onKeyUp(e: KeyboardEvent): void {
        const { keyCode } = e;
        this._isKeyCodePressedMap[keyCode] = false;
    }
}
