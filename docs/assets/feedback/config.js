// Public values only. Secrets and database credentials belong to the Worker.
const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
export const feedbackConfig = Object.freeze({
  api: local ? 'http://127.0.0.1:8789' : 'https://feedback-api.myanimalroom.com',
  siteKey: local ? '1x00000000000000000000AA' : '0x4AAAAAAFXOzFvyw_M9xEzn'
});
