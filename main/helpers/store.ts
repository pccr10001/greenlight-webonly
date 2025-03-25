import fs from 'fs'

export default class Store {
    constructor(filename = 'store.json') {
        this.filename = filename
        this.data = {}
        this.load()
    }

    private filename: string
    private data: any
    
    load() {
        try {
            if (fs.existsSync(this.filename)) {
                this.data = JSON.parse(fs.readFileSync(this.filename, 'utf8'))
            }
        } catch (error) {
            console.error('Failed to load store:', error)
        }
    }

    set(key, value) {
        this.data[key] = value
        this.save()
    }

    get(key, defaultValue:any = null) {
        return key in this.data ? this.data[key] : defaultValue
    }

    save() {
        fs.writeFileSync(this.filename, JSON.stringify(this.data, null, 2))
    }

    delete(key) {
        delete this.data[key]
        this.save()
    }
}