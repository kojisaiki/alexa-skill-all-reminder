const { google } = require('googleapis');
const moment = require('moment-timezone');
const constants = require('./constants');

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
    
    refreshRemind: async (handlerInput, calendarId) => {
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
        
        const persists = await handlerInput.attributesManager.getPersistentAttributes();
        
        // 単独イベント
        const eventStartDt = moment().tz('Asia/Tokyo');
        const eventEndDt = eventStartDt.clone().add(7, 'days').set({hour:23, minute:59, second:59});
        const foundEvents = await getEvents(calendarApiClient, calendarId, eventStartDt, eventEndDt);
        
        // 繰り返しイベントのインスタンスを取得しつつ、リマインドするべきイベントリストを作成
        const actualEvents = [];
        for (const event of foundEvents) {
            if (event.recurrence) {
                const eventsInRecurrence = await getEventsInRecurrence(calendarApiClient, calendarId, event.id, eventStartDt, eventEndDt);
                actualEvents.push(...eventsInRecurrence);
            } else {
                actualEvents.push(event);
            }
        }
        
        // 永続ストレージから登録済みイベントを取得する
        var oldEvents = persists[constants.PERSIST_FIELD.REMINDED_EVENTS];
        if (!oldEvents) {
            oldEvents = {};
        }
        
        // 登録イベント、削除イベントを算出
        const newRemindedEvents = {};
        const removeEvents = {};
        const addEvents = [];
        // リマインド済みイベントから、未来のもののみを残す
        for (const [key, value] of Object.entries(oldEvents)) {
            if (moment(value.start.dateTime).isAfter()) {
                // 保持
                newRemindedEvents[key] = value;
                // 削除対象
                removeEvents[key] = value;
            }
        }
        
        actualEvents.forEach(event => {
            if (newRemindedEvents[event.id]) {
                // 削除対対象ではなくなる
                delete removeEvents[event.id];
            } else {
                // リマインド済みイベントに存在しなかったら、追加対象となる
                addEvents.push(event);
            }
        });
        
        // イベントをリマインダー登録
        var miss = 0;
        const requestDt = moment().tz('Asia/Tokyo');
        for (const event of addEvents) {
            const alertToken = await remindEvent(handlerInput, event, requestDt);
            if (alertToken) {
                event['alertToken'] = alertToken;
                newRemindedEvents[event.id] = event;
            }
        }
        
        // リマインダー削除
        for (const [key, value] of Object.entries(removeEvents)) {
            deleteReminder(handlerInput, value['alertToken'])
            delete newRemindedEvents[key];
        }
        
        // 永続ストレージに保存
        persists[constants.PERSIST_FIELD.REMINDED_EVENTS] = newRemindedEvents;
        handlerInput.attributesManager.setPersistentAttributes(persists);
        await handlerInput.attributesManager.savePersistentAttributes();
        
        return {
            add: addEvents.length,
            remove: Object.entries(removeEvents).length,
            reminded: Object.entries(newRemindedEvents).length
        };
    }
}

/**
 * １週間分のイベント取得。
 */
async function getEvents(calendarApiClient, calendarId, startDt, endDt) {
    return new Promise((resolve, reject) => {
      calendarApiClient.events.list({
        calendarId: calendarId,
        timeMin: startDt.format('YYYY-MM-DDTHH:mm:ssZ'),
        timeMax: endDt.format('YYYY-MM-DDTHH:mm:ssZ')
      },(err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res.data.items);
        }
      })
    });
}

async function getEventsInRecurrence(calendarApiClient, calendarId, eventId, startDt, endDt) {
    return new Promise((resolve, reject) => {
      calendarApiClient.events.instances({
        calendarId: calendarId,
        eventId: eventId,
        timeMin: startDt.format('YYYY-MM-DDTHH:mm:ssZ'),
        timeMax: endDt.format('YYYY-MM-DDTHH:mm:ssZ')
      },(err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res.data.items);
        }
      })
    });
}

/**
 * Remind an event.
 * 
 * event: https://developers.google.com/calendar/v3/reference/events#resource
 */
async function remindEvent(handlerInput, event, requestDt) {
    const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;
    
    const reminderApiClient = serviceClientFactory.getReminderManagementServiceClient();
    
    const reminderPayload = {
       "requestTime" : requestDt.format('YYYY-MM-DDTHH:mm:ss'),
       "trigger": {
            "type" : "SCHEDULED_ABSOLUTE",
            "scheduledTime" : moment.tz(event.start.dateTime, 'Asia/Tokyo').format('YYYY-MM-DDTHH:mm:ss'),
            "timeZoneId" : "Asia/Tokyo"
       },
       "alertInfo": {
            "spokenInfo": {
                "content": [{
                    "locale": "ja-JP", 
                    "text": event.summary
                }]
            }
        },
        "pushNotification" : {                            
             "status" : "ENABLED"
        }
    };
    
    try {
        const result = await reminderApiClient.createReminder(reminderPayload);
        return result.alertToken;
    } catch (error) {
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);
        return null;
    }
}

async function deleteReminder(handlerInput, alertToken) {
    const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;
    
    const reminderApiClient = serviceClientFactory.getReminderManagementServiceClient();
    
    await reminderApiClient.deleteReminder(alertToken);
}
