const Alexa = require('ask-sdk-core');
require('dotenv').config();

const func = require('./func');
const constants = require('./constants');

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
        if (!persists[constants.PERSIST_FIELD.TARGET_CALENDAR]) {
        return handlerInput.responseBuilder
            .speak('更新対象のカレンダーが設定されていません。まずはカレンダーを選択しましょう。')
            .reprompt('「カレンダーを選択したい」と言ってください。')
            .getResponse();
        }
        
        const targetCalendar = persists[constants.PERSIST_FIELD.TARGET_CALENDAR];
        
        // TODO: リマインダー更新処理
        const events = await func.refreshRemind(handlerInput, targetCalendar.calendarId);
        
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
        
        // TODO: カレンダー一覧をAPIで取得し、何らかの手段で特定の１つをユーザーに選択させる
        const calendarList = await func.getCalendarList();
        
        // TODO: カレンダー一覧から獲得したカレンダー情報を設定
        const targetCalendar = {
            name: '日々',
            calendarId: process.env.TARGET_CALENDAR_ID
        };
        
        const persists = await handlerInput.attributesManager.getPersistentAttributes();
        
        persists[constants.PERSIST_FIELD.TARGET_CALENDAR] = targetCalendar;
        
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
        
        persists[constants.PERSIST_FIELD.TARGET_CALENDAR] = null;
        
        // TODO: 既存のリマインダーを消す
        
        handlerInput.attributesManager.setPersistentAttributes(persists);
        await handlerInput.attributesManager.savePersistentAttributes();
        
        return handlerInput.responseBuilder
            .speak('設定をクリアしました。次は何をしますか？再度カレンダーを設定することをお勧めします。')
            .reprompt('次は何をしますか？再度カレンダーを設定することをお勧めします。')
            .getResponse();
    }
};

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