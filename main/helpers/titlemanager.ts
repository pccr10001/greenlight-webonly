import Application from '../application'
import HTTP from './http'
import Store from './store'

interface titleInfoArgs {
    ProductTitle: string;
    PublisherName: string;
    XCloudTitleId: string;
    Image_Tile: any;
    Image_Poster: any;
    Streamability: any;
    Categories: any;
    LocalizedCategories: any;
    XCloudOfferings: any;
    XboxTitleId: string;
    ChildXboxTitleIds: any;
    StoreId: string;
}

interface FilterArgs {
    name: string;
}

export default class TitleManager {

    _application:Application
    _store = new Store('titles.json')
    _http:HTTP

    _xCloudTitles = {}
    _productIdQueue = []

    _xCloudRecentTitles = {}
    _xCloudRecentTitlesLastUpdate = 0

    
    constructor(application){
        this._application = application
        this._http = new HTTP(this._application)
        this._xCloudTitles = JSON.parse(this._store.get('titles', '{}'))
    }

    setCloudTitles(titles) {
        return new Promise((resolve, reject) => {
            // Keep a backup of existing titles before clearing
            const previousTitles = { ...this._xCloudTitles }
            this._xCloudTitles = {}

            // Check if titles or titles.results is valid
            if (!titles || !titles.results) {
                this._application.log('TitleManager', 'Invalid titles data received')
                this._xCloudTitles = previousTitles // Restore previous titles
                return resolve(true)
            }

            for (const title in titles.results) {
                if (!titles.results[title] || !titles.results[title].titleId) {
                    continue
                }
                
                const titleItem = new Title(titles.results[title])
                this._xCloudTitles[titles.results[title].titleId] = titleItem
                
                // If we have catalog details from cache, restore them
                const prevTitle = previousTitles[titles.results[title].titleId]
                if (prevTitle && prevTitle.catalogDetails) {
                    titleItem.setCatalogDetails(prevTitle.catalogDetails)
                }
                
                if (titles.results[title].details && titles.results[title].details.productId) {
                    this._productIdQueue.push(titles.results[title].details.productId)
                }
            }

            if (this._productIdQueue.length > 0) {
                this._http.post('catalog.gamepass.com', '/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0', {
                    'Products': this._productIdQueue,
                }, {
                    'ms-cv': 0,
                    'calling-app-name': 'Xbox Cloud Gaming Web',
                    'calling-app-version': '21.0.0',
                }).then((result: any) => {
                    if (result && result.Products) {
                        this.populateTitleInfo(result.Products)
                    }
                    resolve(true)
                }).catch((error) => {
                    console.log('Error:', error)
                    // Don't clear titles on error - keep what we have
                    this._application.log('TitleManager', 'Failed to fetch catalog details, using cached data')
                    resolve(true)
                })
            } else {
                resolve(true)
            }
        })
    }

    getNewTitles(){
        return this._http.get('catalog.gamepass.com', '/sigls/v2?id=f13cf6b4-57e6-4459-89df-6aec18cf0538&market=US&language=en-US')
    }

    populateTitleInfo(titleInfo: titleInfoArgs[]) {
        if (!titleInfo || !Array.isArray(titleInfo)) {
            this._application.log('TitleManager', 'Invalid titleInfo received')
            return
        }

        for (const product in titleInfo) {
            if (!titleInfo[product] || !titleInfo[product].XCloudTitleId) {
                this._application.log('TitleManager', 'Invalid product data:', titleInfo[product])
                continue
            }

            const xCloudTitle = titleInfo[product].XCloudTitleId

            if (this._xCloudTitles[xCloudTitle] !== undefined) {
                this._xCloudTitles[xCloudTitle].setCatalogDetails(titleInfo[product])
            } else {
                const productId = titleInfo[product].StoreId
                if (productId) {
                    const altTitle = this.findTitleByProductId(productId)
                    if (altTitle !== undefined) {
                        altTitle.setCatalogDetails(titleInfo[product])
                    } else {
                        this._application.log('TitleManager', 'Title not found in cache:', titleInfo[product].XCloudTitleId, titleInfo[product].StoreId)
                    }
                }
            }
        }
        
        this._store.set('titles', JSON.stringify(this._xCloudTitles))
    }

    findTitleByProductId(productId:string){
        for(const title in this._xCloudTitles){
            if(this._xCloudTitles[title].productId === productId){
                return this._xCloudTitles[title]
            }
        }

        // Perform a lookup?
        // this._application.log('TitleManager', 'Title not found in cache:', productId, 'Trying to get info from store...')
        // this._http.post('catalog.gamepass.com', '/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0', { // RemoteLowJade0
        //     "Products": [productId]
        // }, {
        //     'ms-cv': 0,
        //     'calling-app-name': 'Xbox Cloud Gaming Web',
        //     'calling-app-version': '21.0.0',

        // }).then((result:any) => {
        //     this._application.log('TitleManager', 'Retrieved information from store:', result.Products)
        //     this.populateTitleInfo(result.Products)

        // }).catch((error) => {
        //     console.log('Error:', error)
        // })

        return undefined
    }

    findTitle(titleId:string){
        if(this._xCloudTitles[titleId] !== undefined){
            return this._xCloudTitles[titleId]
        }

        return undefined
    }

    filterTitles(filter:FilterArgs){
        const returnTitles = []

        for(const title in this._xCloudTitles){
            if(this._xCloudTitles[title].catalogDetails !== undefined){

                if(this._xCloudTitles[title].catalogDetails.ProductTitle.toLowerCase().includes(filter.name.toLowerCase())){
                    returnTitles.push(this._xCloudTitles[title].titleId)
                }

            }
        }

        return returnTitles
    }
}

interface TitleDetails {
    titleId:string;
    details: {
        productId:string;
        xboxTitleId:number;
        hasEntitlement:boolean;
        supportsInAppPurchases:boolean;
        supportedTabs: any;
        supportedInputTypes: any;
        programs: any;
        userPrograms: any;
        userSubscriptions: any;
        isFreeInStore: boolean;
        maxGameplayTimeInSeconds: number;
    };
}

export class Title {

    titleId
    productId
    xboxTitleId
    supportedInputTypes
    catalogDetails

    constructor(title:TitleDetails){
        this.titleId = title.titleId
        this.productId = title.details.productId
        this.xboxTitleId = title.details.xboxTitleId
        this.supportedInputTypes = title.details.supportedInputTypes
    }

    setCatalogDetails(titleInfo:titleInfoArgs){
        this.catalogDetails = titleInfo
    }

    toString(){
        return JSON.stringify(this)
    }

    restoreFromCache(cachedObj){
        this.catalogDetails = cachedObj.catalogDetails
    }
}