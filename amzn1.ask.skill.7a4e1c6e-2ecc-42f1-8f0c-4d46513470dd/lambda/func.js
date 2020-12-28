const { google } = require('googleapis');
const moment = require('moment-timezone');

module.exports = {
    
    validatePermission: handlerInput => {
        const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;

        const consentToken = 
            requestEnvelope.context.System.user.permissions 
            && requestEnvelope.context.System.user.permissions.consentToken;
            
        if (!consentToken) {
            return responseBuilder
                .speak('Alexaモバイルアプリから、リマインダーの許可を行ってください。')
                .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                .getResponse();
        }
    },
    
    getCalendarList: async () => {
        const {
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URIS,
            ACCESS_TOKEN,
            REFRESH_TOKEN,
            TOKEN_TYPE,
            EXPIRES_IN,
            SCOPE,
            CODE,
        } = process.env;
        
        // Setup oAuth2 client
        const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URIS);
        const tokens = {
          access_token: ACCESS_TOKEN,
          scope: SCOPE,
          token_type: TOKEN_TYPE,
          expires_in: EXPIRES_IN,
        };
        if (REFRESH_TOKEN) tokens.refresh_token = REFRESH_TOKEN;
        oAuth2Client.credentials = tokens;
        
    
        // Create a Calendar instance
        const calendar = google.calendar({
          version: 'v3',
          auth: oAuth2Client,
        });
            
        return new Promise((resolve, reject) => {
          calendar.calendarList.list({}, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.data.items);
            }
          })
        });
    },
    
    refreshRemind: async calendarId => {
        const {
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URIS,
            ACCESS_TOKEN,
            REFRESH_TOKEN,
            TOKEN_TYPE,
            EXPIRES_IN,
            SCOPE,
            CODE,
        } = process.env;
        
        // Setup oAuth2 client
        const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URIS);
        
        const tokens = {
          access_token: ACCESS_TOKEN,
          scope: SCOPE,
          token_type: TOKEN_TYPE,
          expires_in: EXPIRES_IN,
        };
        if (REFRESH_TOKEN) tokens.refresh_token = REFRESH_TOKEN;
        oAuth2Client.credentials = tokens;
    
        // Create a Calendar instance
        const calendarApiClient = google.calendar({
          version: 'v3',
          auth: oAuth2Client,
        });
        
        return await getEventsInWeek(calendarApiClient, calendarId, moment().tz('Asia/Tokyo'));
    }
}

async function getEventsInWeek(calendarApiClient, calendarId, startDateTime) {
    const start = startDateTime.clone().set({hour:0, minute:0, second:0});
    const end = start.clone().add(7, 'days').set({hour:23, minute:59, second:59});
    
    return new Promise((resolve, reject) => {
      calendarApiClient.events.list({
        calendarId: calendarId,
        timeMin: start.format('YYYY-MM-DDTHH:mm:ssZ'),
        timeMax: end.format('YYYY-MM-DDTHH:mm:ssZ')
      },(err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res.data.items);
        }
      })
    });
}