import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

export class WebSocketClient {
  constructor() {
    this.eventTarget = new EventTarget();
    this.stompClient = null;
    this.connected = false;
    this.reconnectInterval = 3000;
    this.checkInterval = window.APP_CONFIG?.WS_CHECK_INTERVAL || 5000;
    this.connect();
    this.startConnectionCheck();
  }

  startConnectionCheck() {
    setInterval(() => {
      if (!this.stompClient.ws||!this.stompClient.ws.readyState === WebSocket.OPEN) {
        this.reconnect();
      }
    }, this.checkInterval);
  }

  connect() {
    const wsServer = window.APP_CONFIG?.WS_SERVER || 'http://172.20.14.155:8745/draw-ws?maxFramePayloadSize=104857600';
    const socket = new SockJS(wsServer);
    this.stompClient = Stomp.over(socket);

    this.stompClient.connect({},
      () => {
        this.connected = this.stompClient.ws.readyState === WebSocket.OPEN;
        this.emit('connected');
        // 连接成功后主动请求最新数据
        this.stompClient.publish({
          destination: '/app/getDiagrams',
          body: JSON.stringify({forceRefresh: true})
        });
        this.stompClient.subscribe('/topic/diagramData', (message) => {
          try {
            const payload = JSON.parse(message.body);
            this.emit('diagramData', payload);
          } catch (error) {
            console.error('Message parse error:', error);
          }
        });
        this.stompClient.subscribe('/topic/diagrams', (message) => this.emit('diagramsData', message.body));
        this.stompClient.subscribe('/topic/errors', (message) => this.emit('serverError', message.body));
        this.stompClient.subscribe('/topic/diagrams/update', (message) => {
          try {
            const payload = JSON.parse(message.body);
            this.emit('diagramData', payload);
          } catch (error) {
            console.error('Message parse error:', error);
          }
        });
      },
      (error) => {
        this.connected = this.stompClient.ws.readyState === WebSocket.OPEN;
        this.emit('disconnected');
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    );
  }

  send(type, payload) {
    if (!this.stompClient.ws||!this.stompClient.ws.readyState === WebSocket.OPEN) {
      this.reconnect();
    }else{
      this.stompClient.publish({
        destination: `/app/${type}`,
        body: JSON.stringify(payload)
      });
    }
  }

  emit(event, data) {
    this.eventTarget.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  on(event, callback) {
    this.eventTarget.addEventListener(event, (e) => callback(e.detail));
  }

  once(event, callback) {
    const onceCallback = (e) => {
      callback(e.detail);
      this.eventTarget.removeEventListener(event, onceCallback);
    };
    this.eventTarget.addEventListener(event, onceCallback);
  }

  reconnect() {
    if (this.stompClient) {
      this.stompClient.disconnect();
    }
    this.connect();
  }
}

export const wsClient = new WebSocketClient();