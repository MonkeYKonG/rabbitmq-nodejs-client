__TOC__

# Description
Quick and easy client for contacting RabbitMQ server.
# Installation
```bash
npm install @enchiladas/rabbitmq-nodejs-client
```
# Usage
## Load module
```javascript
import RabbitMQClient from '@enchiladas/rabbitmq-nodejs-client';
```
## Connect
```javascript
await RAbbitMQClient.connect('MyHost:12345');
```
Giving a hostname and port is not mandatory. If hostname is not provided, then environment variable `RABBITMQ_HOST` will be use if exists else use `localhost`.

Connection is done automatically if not done before calling a creation function.
## Disconnect
```javascript
await RAbbitMQClient.close();
```
## Create channel
A channel allow you to create queues or exchanges into.
```javascript
const channel = await RabbitMQClient.createChannel();
const queue = channel.assertQueue('My queue');
const exchange = channel.assertExchange('My exchange');
```
## Create sender
A sender is linked to a Queue and let you send messages into.
```javascript
const { channel, queue, name } = await RabbitMQClient.createSender('MyQueueName');

queue.send('My message');
```
## Create publisher
A publisher is linked to an exchange and let you publish messages into.
```javascript
const { channel, exchange, name } = await RabbitMQClient.createPublisher('My exchange', 'fanout');

exchange.publish('My message', 'routing.keys');
```
## Create Receiver
A receiver is linked to a queue and let you consume messages into.
```javascript
const { channel, queue, name} = await RabbitMQClient.createReceiver('My Queue', (message) => {
  console.log('Message receive:', message);
});
```
## Create Subscriber 
A subscriber is linked to an exchange and let you consume messages into from queue.
```javascript
const { channel, exchange, queue, name } = await RabbitMQClient.createSubscriber('My exchange', 'fanout', (message) => {
  console.log('Message receive:', message);
}, ['routing.patterns', 'routing.*.keys']);
```
# RPC
`RabbitMQClient` allow you to create RPC server and client.
## Create server
RPC server is managed using a Receiver.
```javascript
const { channel, queue, name } = await RabbitMQClient.createReceiverRPC('My rpc function', (message) => {
  return myRPCStuff(message);
});
```
## Create client
RPC client is managed using a Sender.
```javascript
const { channel, queue, name } = await RabbitMQClient.createSender('My rpc function');

const response = await queue.sendRPC('My rpc arguments');
```
## Create server JSON
A JSON version on the rpc server give you JSON object on consume function.
```javascript
const { channel, queue, name } = await RabbitMQClient.createReceiverRPCJson('My json rpc function', (message) => {
  return myJsonRPCStuff(message);
});
```
# Typescript
`RabbitMQClient` allow you to define schema for send, publish and consume message type.
## Defining schema
Schema can be define by give your queues and exchanges names and message type on template fields.
```typescript
enum Queues {
  REFRESH = 'refresh',
  START = 'start',
}

enum Exchanges {
  REFRESH_ALL = 'refresh_all',
  START_ALL = 'start_all',
}

type MessageTypes = {
  [Queues.REFRESH]: { delay: number },
  [Queues.START]: { args: string },
  [Exchanges.REFRESH_ALL]: {delay: number, userId: number},
  [Exchanges.START_ALL]: {args: string[], userId: number},
};

type MySendersReceivers = BaseSenders<Queues & Exchanges, MessageTypes>;
```
## Using schema
You can use `MySendersReceivers` to let `RabbitMQClient` know the type of messages.
### Sender
```typescript
// Typescript Error: 'My Queue' is not a valide queueName
const { channel, queue, name } = await RabbitMQClient.createSender<MySendersReceivers>('My Queue');

const { channel, queue, name } = await RabbitMQClient.createSender<MySendersReceivers>(Queues.REFRESH);

// Typescript Error: Expect type { delay: number }
queue.send({ param: 'value' });
// Valid
queue.send({ delay: 10 });
```
### Publisher
```typescript
// Typescript Error: 'My Exchange' is not a valide exchangeName
const { channel, exchange, name } = await RabbitMQClient.createPublisher<MySendersReceivers>('My Exchange');

const { channel, exchange, name } = await RabbitMQClient.createPublisher<MySendersReceivers>(Exchanges.REFRESH);

// Typescript Error: Expect type { delay: number, userId: number }
exchange.publish({ param: 'value' }, 'routing.keys');
// Valid
exchange.publish({ delay: 10, userId: 1 }, 'routing.keys');
```
### Receiver
```typescript
// Typescript Error: 'My Queue' is not a valide queueName
const { channel, queue, name } = await RabbitMQClient.createReceiver<MySendersReceivers>('My Queue', (message) => {
  console.log('Message receive:', message);
});

const { channel, queue, name } = await RabbitMQClient.createReceiver<MySendersReceivers>(Queues.START, (message) => {
  // message is automatically typed { args: string }
  console.log('Message receive:', message.args);
});
```
### Subscriber
```typescript
// Typescript Error: 'My Exchange' is not a valide exchangeName
const { channgel, exchange, name } = await RabbitMQClient.createSubscriber<MySendersReceivers>('My exchange', 'fanout', (message) => {
  console.log('Message receive:', message);
}, ['routing.*']);

const { channgel, exchange, name } = await RabbitMQClient.createSubscriber<MySendersReceivers>(Exchanges.START_ALL, 'fanout', (message) => {
  // message is automatically typed { args: string[], userId: number }
  console.log('Message receive:', message.args.join('.'), message.userId);
}, ['routing.*']);
```
## Defining RPC schema
```typescript
type ReturnTypes = {
  [Queues.REFRESH]: { error: boolean },
  [Queues.START]: { pid: number },
};

type MyRPCSendersReceivers = BaseSendersReceiversRPC<Queues, MessageTypes, ReturnTypes>;
```
### Client
```typescript
const { channel, queue, name} = await RabbitMQClient.createSender<MyRPCSendersReceivers>(Queues.REFRESH);

// response is automatically typed { error: boolean }
const response = await queue.sendRPC({delay: 12});
```
### Server
```typescript
const { channel, queue, name } = await RabbitMQClient.createReceiverRPCJson<MyRPCSendersReceivers>(Queues.REFRESH, (message) => {
  // must return { error: boolean }
  return myRPCStuff(message.delay);
});
```