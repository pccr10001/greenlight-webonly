import Application from './application'
import { Msal } from 'xal-node'
import AuthTokenStore from './helpers/tokenstore'


export default class Authentication {
    _application:Application

    _tokenStore:AuthTokenStore
    _msal:Msal
    
    _authWindow
    _authCallback

    _isAuthenticating:boolean = false
    _isAuthenticated:boolean = false
    _appLevel:number = 0

    _userCode: string = ''
    _authError: string = ''
    _tokenRefresher: any = 0

    _xhomeToken: any = null
    _xcloudToken: any = null

    constructor(application:Application){
        this._application = application
        this._tokenStore = new AuthTokenStore()
        this._tokenStore.load()
        this._msal = new Msal(this._tokenStore)
    }

    checkAuthentication(){
        this._application.log('authenticationV2', '[checkAuthentication()] Starting token check...')
        if(this._tokenStore.hasValidAuthTokens()){
            this._application.log('authenticationV2', '[checkAuthentication()] Tokens are valid.')
            this.startSilentFlow()

            return true

        } else {
            if(this._tokenStore.getUserToken() !== undefined){
                // We have a user token, lets try to refresh it.
                this._application.log('authenticationV2', '[checkAuthentication()] Tokens are expired but we have a user token. Lets try to refresh the tokens.')
                this.startSilentFlow()

                return true
    
            } else {
                this._application.log('authenticationV2', '[checkAuthentication()] No tokens are present.')
                return false
            }
        }
    }

    startSilentFlow() {

        this._application.log('authenticationV2', '[startSilentFlow()] Starting silent flow...')
        this._isAuthenticating = true
        this._userCode = ''

        this._msal.getOrRefreshUserToken().then(() => {
            this._application.log('authenticationV2', '[startSilentFlow()] Tokens have been refreshed')
            this._msal.getGssvToken().then((gssvToken) => {
                if (gssvToken === undefined) {
                    throw new Error('No gssv token found. Please authenticate first.')
                }

                this._msal.getWebToken().then((webToken) => {
                    if (webToken === undefined) {
                        throw new Error('No gssv token found. Please authenticate first.')
                    }
                    this._msal.getStreamToken(gssvToken.data.Token, 'xhome').then((xHomeToken) => {
                        this._application.log('authenticationV2', '[startSilentFlow()] xHome Tokens have been received.')
                        this._xhomeToken = xHomeToken
                        this._xcloudToken = null

                        if (this._tokenRefresher === 0) {
                            this._tokenRefresher = setInterval(() => {
                                if (this._xhomeToken.getSecondsValid() < 60 ||
                                    this._tokenStore.getUserToken().getSecondsValid() < 60) {
                                    this.startSilentFlow()
                                }
                            }, 60 * 1000)
                            this._application.log('authenticationV2', '[startSilentFlow()] Token refresher created.')
                        }

                        this._application.authenticationCompleted({ xHomeToken: xHomeToken, xCloudToken: null }, webToken)

                    }).catch((err) => {
                        this._application.log('authenticationV2', '[startSilentFlow()] Failed to retrieve xHome tokens:', err)
                    })

                }).catch((err) => {
                    this._application.log('authenticationV2', '[startSilentFlow()] Failed to retrieve webToken tokens:', err)
                })
            }).catch((err) => {
                this._application.log('authenticationV2', '[startSilentFlow()] Failed to retrieve Gssv tokens:', err)
            })


        }).catch((err) => {
            this._application.log('authenticationV2', '[startSilentFlow()] Error refreshing tokens:', err)
            this._tokenStore.clear()
        })

    }

    startAuthflow() {
        this._application.log('authenticationV2', '[startAuthflow()] Starting authentication flow')

        this._msal.doDeviceCodeAuth().then((deviceCodeDetails: any) => {
            console.log('deviceCodeDetails', deviceCodeDetails)
            this._userCode = deviceCodeDetails.user_code
            this._msal.doPollForDeviceCodeAuth(deviceCodeDetails.device_code, deviceCodeDetails.expires_in * 1000).then((tokens: any) => {
                this._application.log('authenticationV2', '[startAuthFlow()] Got tokens:', tokens)
                this.startSilentFlow()
            }).catch((err: any) => {
                this._userCode = ''
                this._application.log('authenticationV2', '[startAuthFlow()] Error authenticating user:', err)
                this._authError = 'Error authenticating user. Error details: ' + JSON.stringify(err)
            })
        }).catch((err: any) => {

            this._application.log('authenticationV2', '[startAuthFlow()] Error getting redirect URI:', err)
            this._authError = 'Error', 'Error request device code. Error details: ' + JSON.stringify(err)
        })
    }
}
