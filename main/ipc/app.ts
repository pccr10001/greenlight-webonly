import IpcBase from './base'

interface setForceRegionIpArgs {
    ip:string;
}

interface setPreferredGameLanguageArgs {
    language:string;
}

export default class IpcApp extends IpcBase {
    // _streamingSessions:any = {}

    loadCachedUser(){
        return new Promise((resolve) => {
            const user = this.getUserState()

            resolve(user)
        })
    }

    getUserState(){
        const gamertag = this._application._store.get('user.gamertag')
        const gamerpic = this._application._store.get('user.gamerpic')
        const gamerscore = this._application._store.get('user.gamerscore')

        return {
            signedIn: gamertag ? true : false,
            type: 'user',
            gamertag: gamertag ? gamertag : '',
            gamerpic: gamerpic ? gamerpic : '',
            gamerscore: gamerscore ? gamerscore : '',
            level: this._application._authentication._appLevel,
        }
    }

    getAuthState(){
        return new Promise((resolve) => {
            resolve({
                isAuthenticating: this._application._authentication._isAuthenticating,
                isAuthenticated: this._application._authentication._isAuthenticated,
                user: this.getUserState(),
                userCode: this._application._authentication._userCode,
                authError: this._application._authentication._authError,
            })
        })
    }

    login(){
        return new Promise<boolean>((resolve) => {
            this._application._authentication.startAuthflow()
            resolve(true)
        })
    }

    quit(){
        return new Promise<boolean>((resolve) => {
            resolve(true)
           
        })
    }
    
    restart(){
        return new Promise<boolean>((resolve) => {
            resolve(true)
            
        })
    }

    clearData(){
        return new Promise<boolean>((resolve, reject) => {
            
                this._application._authentication._tokenStore.clear()
                this._application._store.delete('user')
                this._application._store.delete('auth')

                this._application.log('authentication', __filename+'[startIpcEvents()] Received restart request. Restarting application...')
                resolve(true)
                process.exit()

        })
    }

    getOnlineFriends(){
        return new Promise((resolve) => {
            if(this._application._xboxWorker === undefined){
                // Worker is not loaded yet..
                resolve([])
            } else {
                resolve(this._application._xboxWorker._onlineFriends)
            }
        })
    }

    onUiShown(){

        return new Promise((resolve) => {
            resolve({
                autoStream: this._application.getStartupFlags().autoStream,
            })
            this._application.getStartupFlags().autoStream = ''
        }) 
    }

    setForceRegionIp(args:setForceRegionIpArgs){
        return new Promise<boolean>((resolve) => {
            console.log('IPC received force region IP data and write to store:', args.ip)
            this._application._store.set('force_region_ip', args.ip)

            // Rerun silent flow to retrieve new tokens
            this._application._authentication.startSilentFlow()

            resolve(true)
        })
    }

    setPreferredGameLanguage(args:setPreferredGameLanguageArgs){
        return new Promise((resolve) => {
            console.log('IPC received preferred game\'s language and write to store:', args.language)
            this._application._store.set('preferred_game_language', args.language)

            resolve(true)
        })
    }

    async debug(){
        const returnValue = []

        // Application Values
        returnValue.push({
            name: 'Application',
            data: [
                { name: 'Name', value: 'Greenlight' },
            ],
        })

        // xCloud values
        returnValue.push({
            name: 'xCloud',
            data: [
                { name: 'Titles in cache', value: this._application._ipc._channels.xCloud._titles.length },
                { name: 'Titles last update', value: this._application._ipc._channels.xCloud._titlesLastUpdate },
                { name: 'Recent titles in cache', value: this._application._ipc._channels.xCloud._recentTitles.length },
                { name: 'Recent titles last update', value: this._application._ipc._channels.xCloud._recentTitlesLastUpdate },
                { name: '', value: ''},
                { name: 'Titlemanager titles loaded', value: Object.keys(this._application._ipc._channels.xCloud._titleManager._xCloudTitles).length },

            ],
        })

        // Streaming values
        returnValue.push({
            name: 'Streaming',
            data: [
                { name: 'Active sessions', value: Object.keys(this._application._ipc._channels.streaming._streamManager._sessions).length },

            ],
        })

        // Tokenstore values
        const xCloudTokenValid = (this._application._authentication._xcloudToken !== null) ? this._application._authentication._xcloudToken.getSecondsValid() : 'None'
        returnValue.push({
            name: 'MSAL',
            data: [
                { name: 'User token expires in', value: this._application._authentication._tokenStore.getUserToken().getSecondsValid() },
                { name: '', value: '' },
                { name: 'xHome Token validity', value: this._application._authentication._xhomeToken.getSecondsValid() },
                { name: 'xCloud Token validity', value: xCloudTokenValid },

            ],
        })

        return returnValue
    }
}
