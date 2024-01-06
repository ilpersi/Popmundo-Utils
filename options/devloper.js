// Original code form https://raw.githubusercontent.com/xpl/crx-hotreload/master/hot-reload.js
// Some minor modifications to make it work with Manifest V3. It is not perfect, but still a good compromise that allows some time saving.

const filesInDirectory = dir => new Promise(resolve =>
    dir.createReader().readEntries(entries =>
        Promise.all(entries.filter(e => e.name[0] !== '.').map(e =>
            e.isDirectory
                ? filesInDirectory(e)
                : new Promise(resolve => e.file(resolve))
        ))
            .then(files => [].concat(...files))
            .then(resolve)
    )
)

const timestampForFilesInDirectory = dir =>
    filesInDirectory(dir).then(files => {
        return files.map(f => f.name + f.lastModifiedDate).join();
    }
    )

const watchChanges = (dir, lastTimestamp) => {
    timestampForFilesInDirectory(dir).then(timestamp => {
        if (!lastTimestamp || (lastTimestamp === timestamp)) {
            setTimeout (() => watchChanges (dir, timestamp), 1000) // retry after 1s
        } else {
            chrome.storage.local.set({'hot-reload': true}, () => {
                chrome.runtime.reload();
            })
        }
    })
}

chrome.management.getSelf(self => {
    if (self.installType === 'development') {
        chrome.runtime.getPackageDirectoryEntry(dir => watchChanges(dir))
    }
})