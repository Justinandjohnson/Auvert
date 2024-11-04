export function readEntriesPromise(dirEntry) {
    return new Promise((resolve, reject) => {
        const reader = dirEntry.createReader();
        reader.readEntries(resolve, reject);
    });
}

export function filePromise(fileEntry) {
    return new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject);
    });
}

export async function getAllFiles(dirEntry) {
    const files = [];
    const entries = await readEntriesPromise(dirEntry);
    
    for (const entry of entries) {
        if (entry.isFile) {
            const file = await filePromise(entry);
            files.push(file);
        } else if (entry.isDirectory) {
            const subFiles = await getAllFiles(entry);
            files.push(...subFiles);
        }
    }
    
    return files;
}