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
const exchange = channel.assertExchange('My exchange', 'fanout');
```
## Create sender
A sender is linked to a queue and let you send messages into.
```javascript
const queue = await channel.createSender('MyQueueName');

queue.send('My message');
```
## Create publisher
A publisher is linked to an exchange and let you publish messages into.
```javascript
const exchange = await channel.createPublisher('My exchange', 'fanout');

exchange.publish('My message', 'routing.keys');
```
## Create Receiver
A receiver is linked to a queue and let you consume messages into.
```javascript
const queue = await channel.createReceiver('My Queue', (message) => {
  console.log('Message receive:', message);
});
```
## Create Subscriber 
A subscriber is linked to an exchange and let you consume messages into from queue.
```javascript
const { exchange, queue } = await channel.createSubscriber('My exchange', 'fanout', (message) => {
  console.log('Message receive:', message);
}, ['routing.patterns', 'routing.*.keys']);
```
# RPC
`RabbitMQClient` allow you to create RPC server and client.
## Create server
RPC server is managed using a Receiver.
```javascript
const queue = await channel.createReceiverRPC('My rpc function', (message) => {
  return myRPCStuff(message);
});
```
## Create client
RPC client is managed using a Sender.
```javascript
const queue = await cannel.createSender('My rpc function');

const response = await queue.sendRPC('My rpc arguments');
```
# Typescript
`RabbitMQClient` allow you to define schema for send, publish and consume message type.
## Defining schema
Schema can be define by give your queues and exchanges names and message type on template fields.
```typescript
import { MessagesDefinition, ArgumentBody } from '@enchiladas/rabbitmq-nodejs-client';

enum enumOne {
  ONE_ONE = 'one_one',
  ONE_TWO = 'one_two',
}

enum enumTwo {
  TWO_ONE = 'two_one',
  TWO_TWO = 'two_two',
}

type Command<T extends string = string, U = any> = {
  command: T;
  args: U;
};

type MessageTypeOne = {
  [enumOne.ONE_ONE]: [
    ArgumentBody<Command<'cmd_a', { a: string, b: number }>, void>,
    ArgumentBody<Command<'cmd_b', { c: string, d: number }>, void>,
  ];
  [enumOne.ONE_TWO]: [
    ArgumentBody<Command<'cmd_c', { e: boolean, f: number }>, void>,
    ArgumentBody<Command<'cmd_d', { g: string, h: number }>, void>,
  ];
}


type MessageTypeTwo = {
  [enumTwo.TWO_ONE]: {
    'cmd_name_a': ArgumentBody<boolean, void>,
    'cmd_name_b': ArgumentBody<string, void>,
  };
  [enumTwo.TWO_TWO]: {
    'cmd_name_b': ArgumentBody<number, void>,
    'cmd_name_c': ArgumentBody<string, void>,
  };
}

type Arguments = MessageTypeOne & MessageTypeTwo;
type Definitions = MessagesDefinition<Arguments>;
```
## Using schema
You can use `Definitions` to let `RabbitMQClient` know the type of messages.
### Sender
```typescript
const channel = await RabbitMQClient.createChannel<Definitions>();

const senderOne = await channel.createSender(
  enumOne.ONE_ONE,
);
const senderTwo = await channel.createSender(
  enumTwo.TWO_TWO,
);

// must be Command<'cmd_a', { a: string, b: number }> | Command<'cmd_b', { c: string, d: number }>
senderOne.send({ command: 'cmd_a', args: { a: 'hello', b: 23 } });
senderOne.send({ command: 'cmd_b', args: { c: 'world', d: 23 } });

// must be string | number
senderTwo.send('hello');
senderTwo.send(12);

await channel.close();
```
### Publisher
```typescript
const channel = await RabbitMQClient.createChannel<Definitions>();

const publisherOne = await channel.createPublisher(
  enumOne.ONE_TWO,
  'fanout',
);
const publisherTwo = await channel.createPublisher(
  enumTwo.TWO_ONE,
  'direct',
);

// must be Command<'cmd_c', { e: boolean, f: number }> | Command<'cmd_d', { g: string, h: number }>
publisherOne.publish({ command: 'cmd_c', args: { e: true, f: 54 } });
publisherOne.publish({ command: 'cmd_d', args: { g: 'hello', h: 54 } });

// must be boolean | string
publisherTwo.publish('hello');
publisherTwo.publish(false);

await channel.close();
```
### Receiver
```typescript
const channel = await RabbitMQClient.createChannel<Definitions>();

await channel.createReceiver(enumOne.ONE_ONE, (message) => {
  console.log(message.content.command); // 'cmd_a' | 'cmd_b'
});

await channel.createReceiver(enumTwo.TWO_TWO, (message) => {
  console.log(message.content); // srting | number
});

await channel.close();
```
### Subscriber
```typescript
const channel = await RabbitMQClient.createChannel<Definitions>();

await channel.createSubscriber(
  enumOne.ONE_TWO,
  'fanout',
  (message) => {
    console.log(message.content.command); // 'cmd_c' | 'cmd_d'
  });

await channel.createSubscriber(
  enumTwo.TWO_ONE,
  'fanout',
  (message) => {
    console.log(message.content); // boolean | string
  });

await channel.close();
```
## Defining RPC schema
```typescript
import { MessagesDefinition, ArgumentBody } from '@enchiladas/rabbitmq-nodejs-client';

enum enumOne {
  ONE_ONE = 'one_one',
  ONE_TWO = 'one_two',
}

enum enumTwo {
  TWO_ONE = 'two_one',
  TWO_TWO = 'two_two',
}

type Command<T extends string = string, U = any> = {
  command: T;
  args: U;
};

type ErrorReturn<T extends boolean> = { error: T };
type SuccessReturn = ErrorReturn<false>;
type FailureReturn = ErrorReturn<true>;

type MessageTypeRPCOne = {
  [enumOne.ONE_ONE]: [
    ArgumentBody<Command<'cmd_a', { a: string, b: number }>, SuccessReturn & { a: string }>,
    ArgumentBody<Command<'cmd_b', { c: string, d: number }>, SuccessReturn & { b: number }>,
  ];
  [enumOne.ONE_TWO]: [
    ArgumentBody<Command<'cmd_c', { e: boolean, f: number }>, SuccessReturn | FailureReturn>,
    ArgumentBody<Command<'cmd_d', { g: string, h: number }>, FailureReturn & { message: string }>,
  ];
}


type MessageTypeRPCTwo = {
  [enumTwo.TWO_ONE]: {
    'cmd_name_a': ArgumentBody<boolean, string>,
    'cmd_name_b': ArgumentBody<string, number>,
  };
  [enumTwo.TWO_TWO]: {
    'cmd_name_b': ArgumentBody<number, number>,
    'cmd_name_c': ArgumentBody<string, string>,
  };
}

type ArgumentsRPC = MessageTypeRPCOne & MessageTypeRPCTwo;
type DefinitionsRPC = MessagesDefinition<ArgumentsRPC>;
```
### Client
```typescript
const channel = await RabbitMQClient.createChannel<DefinitionsRPC>();

const senderOne = await channel.createSender(enumOne.ONE_ONE);
const senderTwo = await channel.createSender(enumTwo.TWO_TWO);

// must be Command<'cmd_a', { a: string, b: number }> | Command<'cmd_b', { c: string, d: number }>
const responseOne1 = await senderOne.sendRPC({ command: 'cmd_a', args: { a: 'hello', b: 12 } });
const responseOne2 = await senderOne.sendRPC({ command: 'cmd_b', args: { c: 'world', d: 22 } });

console.log(responseOne1); // SuccessReturn & { a: string }
console.log(responseOne2); // SuccessReturn & { b: number }

// must be number | string
const responseTwo1 = await senderTwo.sendRPC('hello');
const responseTwo2 = await senderTwo.sendRPC(12);

console.log(responseTwo1); // string
console.log(responseTwo2); // number

await channel.close();
```
### Server
```typescript
const channel = await RabbitMQClient.createChannel<DefinitionsRPC>();

// must return SuccessReturn & { a: string } | SuccessReturn & { b: number }
await channel.createReceiverRPC(enumOne.ONE_TWO, (message) => {
  switch (message.content.command) {
    case 'cmd_c':
      console.log(message.content); // Command<'cmd_c', { e: boolean, f: number }>
      return {
        error: false,
        a: 'hello',
      }

    case 'cmd_d':
      console.log(message.content); // Command<'cmd_d', { g: string, h: number }>
      return {
        error: false,
        b: 12,
      }
  }
});

//must return string | number
await channel.createReceiverRPC(enumTwo.TWO_ONE, (message) => {
  console.log(message); // boolean | string
  if (message.content === true || message.content === false) {
    return 'success';
  }
  return 42;
});

await channel.close();
```