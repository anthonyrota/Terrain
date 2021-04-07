export function removeFirst<T>(array: T[], item: T): boolean {
    const index = array.indexOf(item);
    if (index !== -1) {
        array.splice(index, 1);
        return true;
    }
    return false;
}
