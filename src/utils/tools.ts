import assert from 'assert'

export function last<T>(array: T[]): T {
    assert(array.length > 0)
    return array[array.length - 1]
}

export function createEntityMap<T extends {id: string}>(entities: T[]) {
    return new Map(entities.map((e) => [e.id, e]))
}

export function mergeMaps<K, V>(a: Map<K, V>, b: Map<K, V>): Map<K, V> {
    for (const [k, v] of b) {
        a.set(k, v)
    }
    return a
}

export function removeNullBytes(str: string): string {
    return str.replace(/\0/g, '')
}
