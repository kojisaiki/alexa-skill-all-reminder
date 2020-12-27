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
    
    
}