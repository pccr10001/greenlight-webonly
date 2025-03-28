import Store from './helpers/store'
import Debug from 'debug'
import { xboxWorker } from './helpers'
import Authentication from './authentication'
import Ipc from './ipc'
import WebUI from './webui'

import xboxWebApi from 'xbox-webapi'
import xCloudApi from './helpers/xcloudapi'

import pkg from '../package.json'

interface startupFlags {
    fullscreen:boolean;
    autoStream:string;
}

export default class Application {

    private _log
    public _store = new Store()
    private _startupFlags: startupFlags = {
        fullscreen: false,
        autoStream: '',
    }

    public _isProduction:boolean = (process.env.NODE_ENV === 'production')
    private _isCi:boolean = (process.env.CI !== undefined)
    private _isMac:boolean = (process.platform === 'darwin')
    private _isWindows:boolean = (process.platform === 'win32')
    private _isQuitting:boolean = false

    public _mainWindow
    public _ipc:Ipc
    public _webUI:WebUI
    public _authentication:Authentication

    constructor(){
        console.log(__filename+'[constructor()] Starting Greenlight v'+pkg.version)
        this._log = Debug('greenlight')

        this.readStartupFlags()
        
        this._ipc = new Ipc(this)
        this._authentication = new Authentication(this)

        this._ipc.startUp()
        this._webUI = new WebUI(this)

        this.loadApplicationDefaults()
    }

    log(namespace = 'application', ...args){
        this._log.extend(namespace)(...args)
    }

    getStartupFlags(){
        return this._startupFlags
    }

    resetAutostream(){
        this._startupFlags.autoStream = ''
    }

    readStartupFlags(){
        this.log('application', __filename+'[readStartupFlags()] Program args detected:', process.argv)

        for(const arg in process.argv){
            if(process.argv[arg].includes('--fullscreen')){
                this.log('application', __filename+'[readStartupFlags()] --fullscreen switch found. Setting fullscreen to true')
                this._startupFlags.fullscreen = true
            }

            if(process.argv[arg].includes('--connect=')){
                const key = process.argv[arg].substring(10)

                this.log('application', __filename+'[readStartupFlags()] --connect switch found. Setting autoStream to', key)
                this._startupFlags.autoStream = key
            }
        }

        this.log('application', __filename+'[readStartupFlags()] End result of startupFlags:', this._startupFlags)
    }

    loadApplicationDefaults(){
        if(! this._authentication.checkAuthentication()){
            this._authentication.startAuthflow()
        }
    }

    _webApi:xboxWebApi
    _xHomeApi:xCloudApi
    _xCloudApi:xCloudApi
    _xboxWorker:xboxWorker

    authenticationCompleted(streamingTokens, webToken){
        this.log('electron', __filename+'[authenticationCompleted()] authenticationCompleted called')
        // const tokens = this._authentication._tokens
        this._xHomeApi = new xCloudApi(this, streamingTokens.xHomeToken.getDefaultRegion().baseUri.substring(8), streamingTokens.xHomeToken.data.gsToken, 'home')

        if(streamingTokens.xCloudToken !== null){
            try{
                this._xCloudApi = new xCloudApi(this, streamingTokens.xCloudToken.getDefaultRegion().baseUri.substring(8), streamingTokens.xCloudToken.data.gsToken, 'cloud')
            } catch(error) {
                this._authentication._appLevel = 1
                this.log('electron', __filename+'[authenticationCompleted()] Failed to create xCloudApi:', error)
            }
        }

        this._webApi = new xboxWebApi({
            userToken: webToken.data.Token,
            uhs: webToken.data.DisplayClaims.xui[0].uhs,
        })

        this._authentication._isAuthenticating = false
        this._authentication._isAuthenticated = true

        this._webApi.getProvider('profile').get('/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag').then((result) => {
            if(result.profileUsers.length > 0) {
                for(const setting in result.profileUsers[0].settings){

                    if(result.profileUsers[0].settings[setting].id === 'Gamertag'){
                        this._store.set('user.gamertag', result.profileUsers[0].settings[setting].value)

                    } else if(result.profileUsers[0].settings[setting].id === 'GameDisplayPicRaw'){
                        this._store.set('user.gamerpic', result.profileUsers[0].settings[setting].value)

                    } else if(result.profileUsers[0].settings[setting].id === 'Gamerscore'){
                        this._store.set('user.gamerscore', result.profileUsers[0].settings[setting].value)
                    }
                }
            }

            // Run workers
            if(this._xboxWorker === undefined){
                this._xboxWorker = new xboxWorker(this)
            }
            this._ipc.onUserLoaded()

        }).catch((error) => {
            this.log('electron', __filename+'[authenticationCompleted()] Failed to retrieve user profile:', error)
            
        })
    }

    
}

new Application()