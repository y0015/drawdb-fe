import { wsClient } from './websocketClient';
const CONNECTION_TIMEOUT = 50000000;
const CHECK_INTERVAL = 100;
const db = {
  diagrams: {
    get: (id) => new Promise((resolve, reject) => {
      const waitForConnection = () => new Promise((res, rej) => {
        const timeout = CONNECTION_TIMEOUT;
        const start = Date.now();
        const check = () => {
          if (wsClient.connected) {
            res();
          } else if (Date.now() - start > timeout) {
            rej(new Error('WebSocket connection timeout'));
          } else {
            setTimeout(check, CHECK_INTERVAL);
          }
        };
        check();
      });

      waitForConnection()
        .then(() => {
          wsClient.send('getDiagram', id);
          wsClient.once('diagramData', resolve);
        })
        .catch(reject);
    }),
    toArray: () => new Promise((resolve, reject) => {
      const waitForConnection = () => new Promise((res, rej) => {
        const timeout = CONNECTION_TIMEOUT;
        const start = Date.now();
        const check = () => {
          if (wsClient.connected) {
            res();
          } else if (Date.now() - start > timeout) {
            rej(new Error('WebSocket connection timeout'));
          } else {
            setTimeout(check, CHECK_INTERVAL);
          }
        };
        check();
      });

      waitForConnection()
        .then(() => {
          wsClient.send('getDiagrams', {});
          wsClient.once('diagramsData', resolve);
        })
        .catch(reject);
    }),
    add: (diagram) => new Promise((resolve, reject) => {
      const waitForConnection = () => new Promise((res, rej) => {


const timeout = CONNECTION_TIMEOUT;
        const start = Date.now();
        const check = () => {
          if (wsClient.connected) {
            res();
          } else if (Date.now() - start > timeout) {
            rej(new Error('WebSocket connection timeout'));
          } else {
            setTimeout(check, CHECK_INTERVAL);
          }
        };
        check();
      });

      waitForConnection()
        .then(() => {
          wsClient.send('addDiagram', diagram);
          resolve();
        })
        .catch(reject);
    }),
    update: (id,diagram) => new Promise((resolve, reject) => {
      const waitForConnection = () => new Promise((res, rej) => {


const timeout = CONNECTION_TIMEOUT;
        const start = Date.now();
        const check = () => {
          if (wsClient.connected) {
            res();
          } else if (Date.now() - start > timeout) {
            rej(new Error('WebSocket connection timeout'));
          } else {
            setTimeout(check, CHECK_INTERVAL);
          }
        };
        check();
      });

      waitForConnection()
        .then(() => {
          wsClient.send('updateDiagram', diagram);
          resolve();
        })
        .catch(reject);
    }),
    delete: (id) => new Promise((resolve, reject) => {
      const waitForConnection = () => new Promise((res, rej) => {
        const CONNECTION_TIMEOUT = 5000;
const CHECK_INTERVAL = 100;

const timeout = CONNECTION_TIMEOUT;
        const start = Date.now();
        const check = () => {
          if (wsClient.connected) {
            res();
          } else if (Date.now() - start > timeout) {
            rej(new Error('WebSocket connection timeout'));
          } else {
            setTimeout(check, CHECK_INTERVAL);
          }
        };
        check();
      });

      waitForConnection()
        .then(() => {
          wsClient.send('deleteDiagram', id);
          resolve();
        })
        .catch(reject);
    })
  },
  templates: {
    // 保留原有模板接口
    bulkAdd: (items) => wsClient.send('bulkAddTemplates', items)
  },
  on: wsClient.on.bind(wsClient)
};

export { db };
