/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const { google } = require('googleapis');
const dotenv = require('dotenv');
require('dotenv').config();
const moment = require('moment-timezone');

const func = require('./func');

const PERSIST_FIELD = {
    TARGET_CALENDAR: 'targetCalendar'
};

// 入り口インテント
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        // 共通の権限チェック
        const error = func.validatePermission(handlerInput);
        if (error) {
            return error;
        }
        
        const message = '「ぜんぶリマインド」スキルにようこそ。';

        return handlerInput.responseBuilder
            .speak(message)
            .reprompt(message)
            .getResponse();
    }
};

// リマインドインテント
const RemindIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RemindIntent';
    },
    async handle(handlerInput) {
        // 共通の権限チェック
        const error = func.validatePermission(handlerInput);
        if (error) {
            return error;
        }
        
        const persists = await handlerInput.attributesManager.getPersistentAttributes();
        if (!persists[PERSIST_FIELD.TARGET_CALENDAR]) {
        return handlerInput.responseBuilder
            .speak('更新対象のカレンダーが設定されていません。まずはカレンダーを選択しましょう。')
            .reprompt('「カレンダーを選択したい」と言ってください。')
            .getResponse();
        }
        
        const targetCalendar = persists[PERSIST_FIELD.TARGET_CALENDAR];
        
        // TODO: リマインダー更新処理
        // const events = await func.refreshRemind();
        const events = [];
        
        const speakOutput = `${targetCalendar.name}カレンダーをもとにリマインダーを更新しました。イベントは${events.length}個です。`;
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

// カレンダー変更インテント
const ConfigureCalendarIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConfigureCalendarIntent';
    },
    async handle(handlerInput) {
        // 共通の権限チェック
        const error = func.validatePermission(handlerInput);
        if (error) {
            return error;
        }
        
        const persists = await handlerInput.attributesManager.getPersistentAttributes();
        
        // TODO: カレンダー一覧をAPIで取得し、何らかの手段で特定の１つをユーザーに選択させる
        const calendarList = await func.getCalendarList();
        
        // TODO: カレンダー一覧から獲得したカレンダー情報を設定
        const targetCalendar = {
            name: '日々',
            calendarId: process.env.TARGET_CALENDAR_ID
        };
        
        persists[PERSIST_FIELD.TARGET_CALENDAR] = targetCalendar;
        
        handlerInput.attributesManager.setPersistentAttributes(persists);
        await handlerInput.attributesManager.savePersistentAttributes();
        
        return handlerInput.responseBuilder
            .speak(`${calendarList.length}個の中から、カレンダーを設定しました。早速更新してリマインダーを設定してみましょう。`)
            .reprompt('まだリマインダーは作成されていません。リマインダーを更新しましょう。')
            .getResponse();
    }
};

// 設定消去インテント
const CleanIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CleanIntent';
    },
    async handle(handlerInput) {
        // 共通の権限チェック
        const error = func.validatePermission(handlerInput);
        if (error) {
            return error;
        }
        
        const persists = await handlerInput.attributesManager.getPersistentAttributes();
        
        persists[PERSIST_FIELD.TARGET_CALENDAR] = null;
        
        // TODO: 既存のリマインダーを消す
        
        handlerInput.attributesManager.setPersistentAttributes(persists);
        await handlerInput.attributesManager.savePersistentAttributes();
        
        return handlerInput.responseBuilder
            .speak('設定をクリアしました。次は何をしますか？再度カレンダーを設定することをお勧めします。')
            .reprompt('次は何をしますか？再度カレンダーを設定することをお勧めします。')
            .getResponse();
    }
};















const RemindSampleIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;
        
        const reminderApiClient = serviceClientFactory.getReminderManagementServiceClient();
        
        const consentToken = requestEnvelope.context.System.user.permissions && requestEnvelope.context.System.user.permissions.consentToken;
        if (!consentToken) {
            return responseBuilder
                .speak('Alexaモバイルアプリから、リマインダーの許可を行ってください。')
                .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                .getResponse();
        }
        
        const reminderPayload = {
            "trigger": {
              "type": "SCHEDULED_RELATIVE",
              "offsetInSeconds": "30",
              "timeZoneId": "Asia/Tokyo"
            },
            "alertInfo": {
              "spokenInfo": {
                "content": [{
                  "locale": "ja-JP",
                  "text": "犬の散歩"
                }]
              }
            },
            "pushNotification": {
              "status": "ENABLED"
            }
          };
          
        const currentDt = moment().tz('Asia/Tokyo');
        const reminderPayload2 = {
           "requestTime" : currentDt.format('YYYY-MM-DDTHH:mm:ss'),
           "trigger": {
                "type" : "SCHEDULED_ABSOLUTE",
                "scheduledTime" : currentDt.add(15, 'second').format('YYYY-MM-DDTHH:mm:ss'),
                "timeZoneId" : "Asia/Tokyo"
           },
           "alertInfo": {
                "spokenInfo": {
                    "content": [{
                        "locale": "en-US", 
                        "text": "最初で最後の犬の散歩"
                    }]
                }
            },
            "pushNotification" : {                            
                 "status" : "ENABLED"
            }
        };
         
        try {
        await reminderApiClient.createReminder(reminderPayload2);
        } catch (error) {
            console.log(`--- Error: \n${error}`)
            return responseBuilder
                .speak('There was an error on scheduling your reminder. Please try again later.')
                .getResponse();
        }
        
        const speakOutput = `Remind!`;

        return responseBuilder
            .speak(speakOutput)
            // .reprompt(speakOutput)
            .getResponse();
    }
};

async function getEvents(calendarId) {
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
    console.log('================== client');
    const tokens = {
      access_token: ACCESS_TOKEN,
      scope: SCOPE,
      token_type: TOKEN_TYPE,
      expires_in: EXPIRES_IN,
    };
    if (REFRESH_TOKEN) tokens.refresh_token = REFRESH_TOKEN;
    oAuth2Client.credentials = tokens;
    console.log('================== prepare tokens');
    

    // Create a Calendar instance
    const calendarApi = google.calendar({
      version: 'v3',
      auth: oAuth2Client,
    });
    console.log('================== got calendar');
        
    console.log('================== try events list');
    return new Promise((resolve,reject) => {
      calendarApi.events.list({
        calendarId: calendarId,
        timeMin: '2020-12-21T00:00:00.000+09:00',
        timeMax: '2020-12-27T23:59:59.000+09:00'
      },(err, res) => {
        resolve(res.data.items);
      })
    });
}

async function getEventInstances(calendarId) {
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
    console.log('================== client');
    const tokens = {
      access_token: ACCESS_TOKEN,
      scope: SCOPE,
      token_type: TOKEN_TYPE,
      expires_in: EXPIRES_IN,
    };
    if (REFRESH_TOKEN) tokens.refresh_token = REFRESH_TOKEN;
    oAuth2Client.credentials = tokens;
    console.log('================== prepare tokens');
    

    // Create a Calendar instance
    const calendarApi = google.calendar({
      version: 'v3',
      auth: oAuth2Client,
    });
    console.log('================== got calendar');
        
    console.log('================== try events instances');
    return new Promise((resolve,reject) => {
      calendarApi.events.instances({
        calendarId: calendarId,
        eventId: '53uo023p8r4f2lipfigikm473n',
        timeMin: '2020-12-21T00:00:00.000+09:00',
        timeMax: '2020-12-27T23:59:59.000+09:00'
      },(err, res) => {
        if (err) {
          console.log('error ');
          console.log(err);
        }
        resolve(res.data.items);
      })
    });
}









const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        RemindIntentHandler,
        ConfigureCalendarIntentHandler,
        CleanIntentHandler,
        
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .withApiClient(new Alexa.DefaultApiClient())
    .withPersistenceAdapter(
        new persistenceAdapter.S3PersistenceAdapter(
            {bucketName:process.env.S3_PERSISTENCE_BUCKET}))
    .lambda();