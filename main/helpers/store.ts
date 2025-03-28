import fs from 'fs'
import path from 'path'

export default class Store {
    constructor(filename = 'store.json') {
        this.filename = filename
        this.data = {}
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data')
        }
        this.load()
    }

    private filename: string
    private data: any
    
    load() {
        try {
            if (fs.existsSync(path.join('data', this.filename))) {
                this.data = JSON.parse(fs.readFileSync(path.join('data', this.filename), 'utf8'))
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
        fs.writeFileSync(path.join('data', this.filename), JSON.stringify(this.data, null, 2))
    }

    delete(key) {
        delete this.data[key]
        this.save()
    }
}