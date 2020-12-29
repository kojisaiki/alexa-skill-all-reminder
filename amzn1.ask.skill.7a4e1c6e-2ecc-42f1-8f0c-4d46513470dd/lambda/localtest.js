const { google } = require('googleapis');
const moment = require('moment-timezone');
require('dotenv').config();

logic().then(v => {
    console.log('success');
}, err => {
    console.log('error');
    console.log(err);
})

async function logic() {
    const calendarId = process.env.TARGET_CALENDAR_ID;

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
    
    console.log(CLIENT_ID)
    
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

    console.log(calendarId)
        
    // 単独イベント
    const eventStartDt = moment().tz('Asia/Tokyo').set({hour:0, minute:0, second:0});
    const eventEndDt = eventStartDt.clone().add(7, 'days').set({hour:23, minute:59, second:59});
    const foundEvents = await getEvents(calendarApiClient, calendarId, eventStartDt, eventEndDt);

    console.log('found event');
    console.log(foundEvents);

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

    console.log('found actuals');
    for (const event of actualEvents) {
        console.log('=====================================');
        console.log(event);
    }

    // 永続ストレージから登録済みイベントを取得する
    const remindedEvents = {
        '53uo023p8r4f2lipfigikm473n_20201231T080000Z': {
            id: '53uo023p8r4f2lipfigikm473n_20201231T080000Z',
            summary: '晩御飯の献立を考えましょう',
          },
          '17t51jm8548g4884cnp69f17qp': {
            id: '17t51jm8548g4884cnp69f17qp',
            summary: '12月30日です！',
          },
          'yahoo!': {
              id: 'yahoo!',
              summary: 'きえる'
          }
        };
        
    console.log('===================================== latest reminded events');
    console.log(remindedEvents);

    // 登録イベント、削除イベントを算出
    const removeEvents = {};
    const addEvents = [];
    // まずはリマインド済みイベントを全部削除対象としておく
    for (const [key, value] of Object.entries(remindedEvents)) {
        removeEvents[key] = value;
    }
    
    console.log('===================================== prepared remove events');
    console.log(removeEvents);

    actualEvents.forEach(event => {
        if (removeEvents[event.id]) {
            // 有効なイベントは削除対象から除外する（リマインドが残る）
            delete removeEvents[event.id];
        } else {
            // 削除対象（リマインド済みイベント）に存在しなかったら、追加対象となる
            addEvents.push(event);
        }
    });

    console.log('add events');
    console.log(addEvents);
    
    console.log('remove events');
    console.log(removeEvents);
        
    // イベントをリマインダー登録
    const requestDt = moment().tz('Asia/Tokyo');
    for (const event of addEvents) {
        remindedEvents[event.id] = event;
    }
    
    // TODO: リマインダー削除
    for (const [key, value] of Object.entries(removeEvents)) {
        // TODO: リマインダー削除
            delete remindedEvents[key];
    }

    console.log('reminded events');
    console.log(remindedEvents);
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
